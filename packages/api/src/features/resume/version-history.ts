import type { DbOrTx } from "@reactive-resume/db/client";
import type { ResumeVersionKind } from "@reactive-resume/db/schema";
import type { ResumeData } from "@reactive-resume/schema/resume/data";
import { ORPCError } from "@orpc/client";
import { and, desc, eq, inArray, lt, notInArray } from "drizzle-orm";
import { db } from "@reactive-resume/db/client";
import * as schema from "@reactive-resume/db/schema";
import { parseStoredResumeData, parseWritableResumeData } from "./resume-data-validation";

// An editing session's autosave is refreshed at most this often.
const SESSION_REFRESH_MS = 2 * 60 * 1000;
// Autosaves, AI edits and restore markers are kept this long. Named, sent, created, imported and
// before-restore versions stay until deleted.
const RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
const EXPIRING_KINDS: ResumeVersionKind[] = ["auto", "ai", "restored"];
// A safety cap on autosaves per resume, so storage stays bounded however often it's edited.
const MAX_AUTOSAVES = 500;
// History shows at most this many versions, newest first.
const LIST_LIMIT = 100;

const summary = {
	id: schema.resumeVersion.id,
	kind: schema.resumeVersion.kind,
	name: schema.resumeVersion.name,
	createdAt: schema.resumeVersion.createdAt,
};

type VersionInput = {
	resumeId: string;
	userId: string;
	data: ResumeData;
	kind: ResumeVersionKind;
	name?: string;
	sessionId?: string;
};

export async function writeVersion(client: DbOrTx, input: VersionInput) {
	const [version] = await client
		.insert(schema.resumeVersion)
		.values({
			resumeId: input.resumeId,
			userId: input.userId,
			data: parseWritableResumeData(input.data),
			kind: input.kind,
			name: input.name ?? null,
			sessionId: input.sessionId ?? null,
		})
		.returning(summary);
	if (!version) throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Failed to save the version." });

	await pruneVersions(client, input.resumeId);
	return version;
}

/** Retention runs when a resume gets a new version, so it needs no scheduler. */
async function pruneVersions(client: DbOrTx, resumeId: string) {
	await client
		.delete(schema.resumeVersion)
		.where(
			and(
				eq(schema.resumeVersion.resumeId, resumeId),
				inArray(schema.resumeVersion.kind, EXPIRING_KINDS),
				lt(schema.resumeVersion.createdAt, new Date(Date.now() - RETENTION_MS)),
			),
		);

	const newestAutosaves = client
		.select({ id: schema.resumeVersion.id })
		.from(schema.resumeVersion)
		.where(and(eq(schema.resumeVersion.resumeId, resumeId), eq(schema.resumeVersion.kind, "auto")))
		.orderBy(desc(schema.resumeVersion.createdAt))
		.limit(MAX_AUTOSAVES);

	await client
		.delete(schema.resumeVersion)
		.where(
			and(
				eq(schema.resumeVersion.resumeId, resumeId),
				eq(schema.resumeVersion.kind, "auto"),
				notInArray(schema.resumeVersion.id, newestAutosaves),
			),
		);
}

/**
 * The autosave path. Each editing session keeps one version holding its latest state, refreshed at most every
 * two minutes. Clients that send no session (API callers) get a new autosave once the newest version is two
 * minutes old. Best effort: it never fails or delays the save beyond its own queries.
 */
export async function saveSessionVersion(input: {
	resumeId: string;
	userId: string;
	data: ResumeData;
	sessionId?: string;
}) {
	try {
		const [latest] = await db
			.select({ id: schema.resumeVersion.id, createdAt: schema.resumeVersion.createdAt })
			.from(schema.resumeVersion)
			.where(
				and(
					eq(schema.resumeVersion.resumeId, input.resumeId),
					...(input.sessionId
						? [eq(schema.resumeVersion.kind, "auto"), eq(schema.resumeVersion.sessionId, input.sessionId)]
						: []),
				),
			)
			.orderBy(desc(schema.resumeVersion.createdAt))
			.limit(1);

		if (latest && Date.now() - latest.createdAt.getTime() < SESSION_REFRESH_MS) return;

		if (latest && input.sessionId) {
			await db
				.update(schema.resumeVersion)
				.set({ data: parseWritableResumeData(input.data), createdAt: new Date() })
				.where(eq(schema.resumeVersion.id, latest.id));
			return;
		}

		await writeVersion(db, { ...input, kind: "auto" });
	} catch (error) {
		console.warn("Failed to save the session's version:", error);
	}
}

const ownedVersion = (input: { resumeId: string; userId: string; versionId: string }) =>
	and(
		eq(schema.resumeVersion.id, input.versionId),
		eq(schema.resumeVersion.resumeId, input.resumeId),
		eq(schema.resumeVersion.userId, input.userId),
	);

async function assertOwnsResume(input: { resumeId: string; userId: string }) {
	const [owner] = await db
		.select({ id: schema.resume.id })
		.from(schema.resume)
		.where(and(eq(schema.resume.id, input.resumeId), eq(schema.resume.userId, input.userId)));

	if (!owner) throw new ORPCError("NOT_FOUND");
}

export async function listVersions(input: { resumeId: string; userId: string }) {
	await assertOwnsResume(input);

	return db
		.select(summary)
		.from(schema.resumeVersion)
		.where(eq(schema.resumeVersion.resumeId, input.resumeId))
		.orderBy(desc(schema.resumeVersion.createdAt))
		.limit(LIST_LIMIT);
}

export async function getVersion(input: { resumeId: string; userId: string; versionId: string }) {
	const [version] = await db
		.select({ ...summary, data: schema.resumeVersion.data })
		.from(schema.resumeVersion)
		.where(ownedVersion(input));

	if (!version) throw new ORPCError("NOT_FOUND");
	return { ...version, data: parseStoredResumeData(version.data) };
}

/** Named versions are the user's own; only they can be renamed or deleted. */
export async function renameVersion(input: { resumeId: string; userId: string; versionId: string; name: string }) {
	const [version] = await db
		.update(schema.resumeVersion)
		.set({ name: input.name })
		.where(and(ownedVersion(input), eq(schema.resumeVersion.kind, "named")))
		.returning(summary);

	if (!version) throw new ORPCError("NOT_FOUND");
	return version;
}

export async function deleteVersion(input: { resumeId: string; userId: string; versionId: string }) {
	const [version] = await db
		.delete(schema.resumeVersion)
		.where(and(ownedVersion(input), eq(schema.resumeVersion.kind, "named")))
		.returning({ id: schema.resumeVersion.id });

	if (!version) throw new ORPCError("NOT_FOUND");
}
