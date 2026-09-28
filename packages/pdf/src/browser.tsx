import type { ResumeData } from "@reactive-resume/schema/resume/data";
import type { Template } from "@reactive-resume/schema/templates";
import type { ResumeRenderOptions } from "./context";
import type { PageMap } from "./page-map";
import type { SectionTitleResolver } from "./section-title";
import { createElement } from "react";
import { parseResumeData } from "@reactive-resume/schema/resume/data";
import { pdf } from "#react-pdf-renderer";
import { ResumeDocument } from "./document";

export type CreateResumePdfBlobOptions = {
	data: ResumeData;
	template?: Template | undefined;
	renderOptions?: ResumeRenderOptions | undefined;
	resolveSectionTitle?: SectionTitleResolver | undefined;
	/** Receives the header, section and item boxes of this render (see `page-map.ts`). */
	onPageMap?: ((pageMap: PageMap) => void) | undefined;
};

export const createResumePdfBlob = async ({
	data: input,
	template,
	renderOptions,
	resolveSectionTitle,
	onPageMap,
}: CreateResumePdfBlobOptions): Promise<Blob> => {
	const data = parseResumeData(input);
	const document = createElement(ResumeDocument, {
		data,
		template: template ?? data.metadata.template,
		...(renderOptions ? { renderOptions } : {}),
		resolveSectionTitle,
		onPageMap,
	}) as Parameters<typeof pdf>[0];

	return await pdf(document).toBlob();
};
