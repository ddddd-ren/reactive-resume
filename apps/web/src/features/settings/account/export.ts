import type { RouterOutput } from "@/libs/orpc/client";
import { strToU8, zipSync } from "fflate";
import { slugify } from "@reactive-resume/utils/string";

type AccountExport = RouterOutput["auth"]["exportData"];

const json = (value: unknown) => strToU8(`${JSON.stringify(value, null, 2)}\n`);

// The id keeps two documents with the same name apart.
const fileName = (name: string, id: string) => `${slugify(name)}-${id.slice(0, 8)}.json`;

/**
 * "Export everything": one zip with the account, each resume and letter as its own JSON file, and the applications.
 * Every file is the stored data, so it can be imported again.
 */
export function buildAccountZip(data: AccountExport): Uint8Array {
	const files: Record<string, Uint8Array> = {
		"account.json": json({ exportedAt: data.exportedAt, user: data.user }),
		"applications.json": json(data.applications),
	};
	for (const resume of data.resumes) files[`resumes/${fileName(resume.name, resume.id)}`] = json(resume);
	for (const letter of data.coverLetters) files[`letters/${fileName(letter.name, letter.id)}`] = json(letter);
	return zipSync(files);
}
