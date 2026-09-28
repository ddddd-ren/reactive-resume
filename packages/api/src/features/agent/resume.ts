import type { JsonPatchOperation } from "@reactive-resume/resume/patch";
import { slugify } from "@reactive-resume/utils/string";
import { pickFreeSlug } from "../resume/slugs";

const AI_DRAFT_SUFFIX = " - AI Draft";

export function buildAgentDraftResumeName(sourceName: string) {
	const normalized = sourceName.trim() || "Resume";
	if (normalized.endsWith(AI_DRAFT_SUFFIX)) return normalized;

	return `${normalized}${AI_DRAFT_SUFFIX}`;
}

export function buildUniqueAgentDraftSlug(sourceName: string, existingSlugs: Set<string>) {
	return pickFreeSlug(slugify(buildAgentDraftResumeName(sourceName)), existingSlugs);
}

function decodeJsonPointerSegment(segment: string) {
	return segment.replace(/~1/g, "/").replace(/~0/g, "~");
}

// Models frequently prefix paths with /data because read_resume nests the document under `data`.
// Patch paths are rooted at the document itself, and the root has no `data` key, so stripping is
// always safe. This runs at execution time — the schema accepts such paths, so the SDK's
// repairToolCall hook (parse/validation failures only) never sees them.
function stripDataPrefix(path: string) {
	if (path === "/data") return "";
	return path.startsWith("/data/") ? path.slice("/data".length) : path;
}

function normalizeSectionShortcutPath(data: { sections: Record<string, unknown> }, path: string) {
	if (!path.startsWith("/") || path.startsWith("/sections/")) return path;

	const sectionId = decodeJsonPointerSegment(path.slice(1).split("/")[0] ?? "");
	if (!Object.hasOwn(data.sections, sectionId)) return path;

	return `/sections${path}`;
}

export function normalizeAgentResumePatchOperations(
	data: { sections: Record<string, unknown> },
	operations: JsonPatchOperation[],
): JsonPatchOperation[] {
	return operations.map((operation) => {
		const path = normalizeSectionShortcutPath(data, stripDataPrefix(operation.path));
		const normalized = path === operation.path ? operation : { ...operation, path };

		if (!("from" in normalized)) return normalized;

		const from = normalizeSectionShortcutPath(data, stripDataPrefix(normalized.from));
		return from === normalized.from ? normalized : { ...normalized, from };
	});
}
