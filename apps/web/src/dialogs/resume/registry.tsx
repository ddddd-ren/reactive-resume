import type { AnyDialogRendererEntry } from "../schemas";
import { CreateResumeDialog, DuplicateResumeDialog, UpdateResumeDialog } from ".";
import { ImportResumeDialog } from "./import";
import { TemplateGalleryDialog } from "./template/gallery";

export const resumeDialogRenderers: readonly AnyDialogRendererEntry[] = [
	{ type: "resume.create", render: () => <CreateResumeDialog /> },
	{ type: "resume.update", render: ({ data }) => <UpdateResumeDialog data={data} /> },
	{ type: "resume.duplicate", render: ({ data }) => <DuplicateResumeDialog data={data} /> },
	{ type: "resume.import", render: () => <ImportResumeDialog /> },
	{ type: "resume.template.gallery", render: () => <TemplateGalleryDialog /> },
];
