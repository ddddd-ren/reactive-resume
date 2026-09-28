import type { CoverLetterVersionData, CoverLetterVersionKind } from "@reactive-resume/db/schema";
import type { CoverLetter } from "@reactive-resume/schema/cover-letter/data";
import { ORPCError } from "@orpc/client";
import { and, desc, eq, inArray, lt, notInArray } from "drizzle-orm";
import { db } from "@reactive-resume/db/client";
import * as schema from "@reactive-resume/db/schema";

type DbOrTx = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

// The same retention as resumes (see resume/version-history.ts): sessions refresh their autosave at most every two
// minutes; autosaves and restore markers last 90 days; at most 500 autosaves per letter.
const SESSION_REFRESH_MS = 2 * 60 * 1000;
const RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
const EXPIRING_KINDS: CoverLetterVersionKind[] = ["auto", "restored"];
const MAX_AUTOSAVES = 500;
const LIST_LIMIT = 100;

const summary = {
	id: schema.coverLetterVersion.id,
	kind: schema.coverLetterVersion.kind,
	name: schema.coverLetterVersion.name,
	createdAt: schema.coverLetterVersion.createdAt,
};

/** The parts of a letter a version keeps. */
const letterVersionData = (letter: CoverLetter): CoverLetterVersionData => ({
	name: letter.name,
	recipient: letter.recipient,
	content: letter.content,
	style: letter.style,
	layout: letter.layout,
	recipientName: letter.recipientName,
	recipientCompany: letter.recipientCompany,
	letterDate: letter.letterDate,
});

type VersionInput = {
	letter: CoverLetter;
	userId: string;
	kind: CoverLetterVersionKind;
	name?: string | null;
	sessionId?: string;
};

export async function writeLetterVersion(client: DbOrTx, input: VersionInput) {
	const [version] = await client
		.insert(schema.coverLetterVersion)
		.values({
			coverLetterId: input.letter.id,
			userId: input.userId,
			data: letterVersionData(input.letter),
			kind: input.kind,
			name: input.name ?? null,
			sessionId: input.sessionId ?? null,
		})
		.returning(summary);
	if (!version) throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Failed to save the version." });

	await pruneLetterVersions(client, input.letter.id);
	return version;
}

async function pruneLetterVersions(client: DbOrTx, coverLetterId: string) {
	const table = schema.coverLetterVersion;
	await client
		.delete(table)
		.where(
			and(
				eq(table.coverLetterId, coverLetterId),
				inArray(table.kind, EXPIRING_KINDS),
				lt(table.createdAt, new Date(Date.now() - RETENTION_MS)),
			),
		);

	const newestAutosaves = client
		.select({ id: table.id })
		.from(table)
		.where(and(eq(table.coverLetterId, coverLetterId), eq(table.kind, "auto")))
		.orderBy(desc(table.createdAt))
		.limit(MAX_AUTOSAVES);

	await client
		.delete(table)
		.where(and(eq(table.coverLetterId, coverLetterId), eq(table.kind, "auto"), notInArray(table.id, newestAutosaves)));
}

/** The autosave path: one version per editing session, refreshed at most every two minutes. Never fails the save. */
export async function saveLetterSessionVersion(input: { letter: CoverLetter; userId: string; sessionId?: string }) {
	const table = schema.coverLetterVersion;
	try {
		const [latest] = await db
			.select({ id: table.id, createdAt: table.createdAt })
			.from(table)
			.where(
				and(
					eq(table.coverLetterId, input.letter.id),
					...(input.sessionId ? [eq(table.kind, "auto"), eq(table.sessionId, input.sessionId)] : []),
				),
			)
			.orderBy(desc(table.createdAt))
			.limit(1);

		if (latest && Date.now() - latest.createdAt.getTime() < SESSION_REFRESH_MS) return;

		if (latest && input.sessionId) {
			await db
				.update(table)
				.set({ data: letterVersionData(input.letter), createdAt: new Date() })
				.where(eq(table.id, latest.id));
			return;
		}

		await writeLetterVersion(db, { ...input, kind: "auto" });
	} catch (error) {
		console.warn("Failed to save the letter's session version:", error);
	}
}

type Owned = { coverLetterId: string; userId: string };

const ownedVersion = (input: Owned & { versionId: string }) =>
	and(
		eq(schema.coverLetterVersion.id, input.versionId),
		eq(schema.coverLetterVersion.coverLetterId, input.coverLetterId),
		eq(schema.coverLetterVersion.userId, input.userId),
	);

async function assertOwnsLetter(input: Owned) {
	const [owner] = await db
		.select({ id: schema.coverLetter.id })
		.from(schema.coverLetter)
		.where(and(eq(schema.coverLetter.id, input.coverLetterId), eq(schema.coverLetter.userId, input.userId)));
	if (!owner) throw new ORPCError("NOT_FOUND");
}

export async function listLetterVersions(input: Owned) {
	await assertOwnsLetter(input);
	return db
		.select(summary)
		.from(schema.coverLetterVersion)
		.where(eq(schema.coverLetterVersion.coverLetterId, input.coverLetterId))
		.orderBy(desc(schema.coverLetterVersion.createdAt))
		.limit(LIST_LIMIT);
}

export async function getLetterVersion(input: Owned & { versionId: string }) {
	const [version] = await db
		.select({ ...summary, data: schema.coverLetterVersion.data })
		.from(schema.coverLetterVersion)
		.where(ownedVersion(input));
	if (!version) throw new ORPCError("NOT_FOUND");
	return version;
}

/** Named versions are the user's own; only they can be renamed or deleted. */
export async function renameLetterVersion(input: Owned & { versionId: string; name: string }) {
	const [version] = await db
		.update(schema.coverLetterVersion)
		.set({ name: input.name })
		.where(and(ownedVersion(input), eq(schema.coverLetterVersion.kind, "named")))
		.returning(summary);
	if (!version) throw new ORPCError("NOT_FOUND");
	return version;
}

export async function deleteLetterVersion(input: Owned & { versionId: string }) {
	const [version] = await db
		.delete(schema.coverLetterVersion)
		.where(and(ownedVersion(input), eq(schema.coverLetterVersion.kind, "named")))
		.returning({ id: schema.coverLetterVersion.id });
	if (!version) throw new ORPCError("NOT_FOUND");
}
