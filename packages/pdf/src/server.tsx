import type { ResumeData } from "@reactive-resume/schema/resume/data";
import type { Template } from "@reactive-resume/schema/templates";
import type { SectionTitleResolver } from "./section-title";
import * as forme from "@formepdf/core";
import { renderResume } from "./forme/render";

export type CreateResumePdfFileOptions = {
	data: ResumeData;
	filename: string;
	template?: Template | undefined;
	resolveSectionTitle?: SectionTitleResolver | undefined;
};

export const createResumePdfFile = async ({ filename, ...input }: CreateResumePdfFileOptions): Promise<File> => {
	const { pdf } = await renderResume(forme, input);
	return new File([pdf as Uint8Array<ArrayBuffer>], filename, { type: "application/pdf" });
};
