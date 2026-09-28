import type { PageMap } from "@reactive-resume/pdf/page-map";
import type { ResumeData } from "@reactive-resume/schema/resume/data";
import type { Template } from "@reactive-resume/schema/templates";
import { useMemo } from "react";
import { createResumePdfBlob as createPdfBlob } from "@reactive-resume/pdf/browser";
import { ResumeDocument } from "@reactive-resume/pdf/document";
import { createSectionTitleResolverForLocale, useSectionTitleResolver } from "@/libs/resume/section-title-locale";

type ResumePdfRenderOptions = {
	includeCoverLetterHeader?: boolean;
};

type CreateResumePdfBlobExtras = {
	/** Receives the page map (header, section and item boxes) of this render; used by the editor canvas. */
	onPageMap?: (pageMap: PageMap) => void;
};

export const useLocalizedResumeDocument = (data?: ResumeData, template?: Template) => {
	const sectionTitleResolver = useSectionTitleResolver(data?.metadata.page.locale);

	return useMemo(() => {
		if (!data || !sectionTitleResolver) return null;

		return (
			<ResumeDocument
				data={data}
				template={template ?? data.metadata.template}
				resolveSectionTitle={sectionTitleResolver}
			/>
		);
	}, [data, template, sectionTitleResolver]);
};

export const createResumePdfBlob = async (
	data: ResumeData,
	template?: Template,
	renderOptions?: ResumePdfRenderOptions,
	{ onPageMap }: CreateResumePdfBlobExtras = {},
) => {
	const sectionTitleResolver = await createSectionTitleResolverForLocale(data.metadata.page.locale);

	return createPdfBlob({
		data,
		template,
		...(renderOptions ? { renderOptions } : {}),
		resolveSectionTitle: sectionTitleResolver,
		onPageMap,
	});
};
