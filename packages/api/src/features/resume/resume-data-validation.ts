import type { ResumeData } from "@reactive-resume/schema/resume/data";
import { ORPCError } from "@orpc/client";
import { convertLegacyStyleRules } from "@reactive-resume/pdf/semantic-legacy";
import { SEMANTIC_CSS_LIMITS_V1 } from "@reactive-resume/resume/stylesheet";
import { parseResumeData } from "@reactive-resume/schema/resume/data";
import { syncResumeDates, upgradeResumeDates } from "@reactive-resume/schema/resume/dates";
import { parseResumeDataForWrite } from "@reactive-resume/schema/resume/write";

/**
 * Resumes saved before Semantic CSS styled themselves with legacy style rules (`metadata.styleRules`), which only the
 * old renderer read. Every resume read or written through the API comes out with those rules converted to a Semantic
 * CSS stylesheet, so the renderer has one styling system; the database catches up on the next save. The rules
 * themselves are kept for rollback. A draft typed in the old editor before it was activated was never shown on the
 * page, so the conversion (what the page showed) wins and the draft is kept below it, commented out.
 */
export function adoptLegacyStyles(data: ResumeData): ResumeData {
	const stylesheet = data.metadata.stylesheet;
	if (stylesheet?.mode === "semantic") return data;

	const converted = convertLegacyStyleRules(data).source;
	const draft = stylesheet?.source.text.replace(/^\s*@version\s+\d+\s*;\s*/, "").trim();
	const withDraft =
		draft && draft !== converted.text.trim()
			? `${converted.text}${converted.text ? "\n" : ""}/* Unapplied draft from the old editor:\n${draft.replaceAll("*/", "*\\/")}\n*/\n`
			: converted.text;
	// Never let the kept draft push the stylesheet over its size limit (reads would fail).
	const text =
		new TextEncoder().encode(withDraft).byteLength > SEMANTIC_CSS_LIMITS_V1.maxSourceBytes ? converted.text : withDraft;

	return { ...data, metadata: { ...data.metadata, stylesheet: { mode: "semantic", source: { ...converted, text } } } };
}

function parseApiResumeData(data: unknown, code: "BAD_REQUEST" | "INTERNAL_SERVER_ERROR", message: string): ResumeData {
	try {
		const parsed = adoptLegacyStyles(code === "BAD_REQUEST" ? parseResumeDataForWrite(data) : parseResumeData(data));
		const source = parsed.metadata.stylesheet?.source.text;
		if (source !== undefined && new TextEncoder().encode(source).byteLength > SEMANTIC_CSS_LIMITS_V1.maxSourceBytes) {
			throw new Error("The stylesheet source exceeds the Semantic CSS byte limit.");
		}
		return parsed;
	} catch (cause) {
		throw new ORPCError(code, {
			status: code === "BAD_REQUEST" ? 400 : 500,
			message,
			cause,
		});
	}
}

/** Validates data before it's saved, then writes each entry's date text from its structured dates. */
export const parseWritableResumeData = (data: unknown) => {
	const parsed = parseApiResumeData(data, "BAD_REQUEST", "Resume data does not match the canonical schema.");
	upgradeResumeDates(parsed);
	syncResumeDates(parsed);
	return parsed;
};

export const parseStoredResumeData = (data: unknown) =>
	parseApiResumeData(data, "INTERNAL_SERVER_ERROR", "Stored resume data does not match the canonical schema.");
