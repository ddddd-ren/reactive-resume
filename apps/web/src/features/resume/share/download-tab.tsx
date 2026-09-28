import type { ResumeExportTarget } from "@reactive-resume/resume/export-sections";
import type { IconName } from "@reactive-resume/ui/components/icon";
import type { ExportFormat } from "@/features/resume/export/use-resume-export";
import { Radio } from "@base-ui/react/radio";
import { RadioGroup } from "@base-ui/react/radio-group";
import { t } from "@lingui/core/macro";
import { Plural, Trans } from "@lingui/react/macro";
import { useId, useState } from "react";
import { resumeHasCoverLetter } from "@reactive-resume/resume/export-sections";
import { Button } from "@reactive-resume/ui/components/button";
import { Checkbox } from "@reactive-resume/ui/components/checkbox";
import { Icon } from "@reactive-resume/ui/components/icon";
import { SegmentedControl, SegmentedControlItem } from "@reactive-resume/ui/components/segmented-control";
import { Spinner } from "@reactive-resume/ui/components/spinner";
import { toast } from "@reactive-resume/ui/components/toast";
import { downloadWithAnchor } from "@reactive-resume/utils/file";
import { cn } from "@reactive-resume/utils/style";
import { useCurrentResume } from "@/features/resume/builder/draft";
import { useOpenIssueCount } from "@/features/resume/editor/use-open-issue-count";
import { createExportFile, getDefaultFileName, sanitizeFileName } from "@/features/resume/export/use-resume-export";

type Format = { id: ExportFormat; label: string; extension: string; icon: IconName; description: string };

const getFormats = (): Format[] => [
	{
		id: "pdf",
		label: "PDF",
		extension: ".pdf",
		icon: "picture_as_pdf",
		description: t`Looks exactly like the page. Use it for applications and email.`,
	},
	{
		id: "docx",
		label: t`Word`,
		extension: ".docx",
		icon: "description",
		description: t`For portals or recruiters who ask for Word. Layout is simplified.`,
	},
	{
		id: "md",
		label: "Markdown",
		extension: ".md",
		icon: "notes",
		description: t`Plain text with headings. Paste into application forms and notes.`,
	},
	{
		id: "json",
		label: "JSON",
		extension: ".json",
		icon: "data_object",
		description: t`Complete data backup. Imports back into Reactive Resume or JSON Resume tools.`,
	},
];

type DownloadTabProps = {
	/** Opens Check; the note about open issues links there. */
	onReview: () => void;
};

/**
 * Download: every format explained by when to use it, the file name recruiters see, and a button that shows
 * its progress. Open Check issues are mentioned but never block. A failed file offers PDF instead.
 */
export function DownloadTab({ onReview }: DownloadTabProps) {
	const resume = useCurrentResume();
	const issues = useOpenIssueCount();
	const fileNameId = useId();
	const hasLetter = resumeHasCoverLetter(resume.data);
	const [target, setTarget] = useState<ResumeExportTarget>("resume");
	const [format, setFormat] = useState<ExportFormat>("pdf");
	const [includeHeader, setIncludeHeader] = useState(false);
	const [fileName, setFileName] = useState<string | null>(null);
	const [state, setState] = useState<"idle" | "busy" | "error">("idle");

	const activeTarget = hasLetter ? target : "resume";
	// JSON is the whole document's data, so it isn't offered for the letter on its own.
	const activeFormat = activeTarget === "cover-letter" && format === "json" ? "pdf" : format;
	const formats = getFormats();
	const selected = formats.find((option) => option.id === activeFormat) ?? (formats[0] as Format);
	const name = fileName ?? getDefaultFileName(resume, activeTarget);

	const download = async (as: ExportFormat) => {
		const extension = formats.find((option) => option.id === as)?.extension ?? ".pdf";
		setState("busy");
		try {
			const blob = await createExportFile(resume, as, activeTarget, { includeCoverLetterHeader: includeHeader });
			const file = `${sanitizeFileName(name) || getDefaultFileName(resume, activeTarget)}${extension}`;
			downloadWithAnchor(blob, file);
			setState("idle");
			toast.add({ description: t`Downloaded ${file}` });
		} catch {
			setState("error");
		}
	};

	return (
		<div className="grid gap-4">
			{hasLetter && (
				<div className="grid gap-2">
					<SegmentedControl
						aria-label={t`What to download`}
						value={activeTarget}
						onValueChange={(value) => {
							setTarget(value as ResumeExportTarget);
							setFileName(null);
							setState("idle");
						}}
						className="w-full"
					>
						<SegmentedControlItem value="resume">
							<Trans>Resume</Trans>
						</SegmentedControlItem>
						<SegmentedControlItem value="cover-letter">
							<Trans>Cover letter</Trans>
						</SegmentedControlItem>
					</SegmentedControl>
					{activeTarget === "cover-letter" && (
						<div className="flex items-center gap-2.5 text-sm">
							<Checkbox
								id={`${fileNameId}-header`}
								checked={includeHeader}
								onCheckedChange={(checked) => setIncludeHeader(checked === true)}
							/>
							<label htmlFor={`${fileNameId}-header`} className="cursor-pointer">
								<Trans>Include the resume's header</Trans>
							</label>
						</div>
					)}
				</div>
			)}

			<RadioGroup
				aria-label={t`Format`}
				value={activeFormat}
				onValueChange={(value) => {
					setFormat(value as ExportFormat);
					setState("idle");
				}}
				className="grid gap-1.5"
			>
				{formats.map((option) => {
					const unavailable = option.id === "json" && activeTarget === "cover-letter";
					return (
						<Radio.Root
							key={option.id}
							value={option.id}
							disabled={unavailable}
							className="group/format flex cursor-pointer items-start gap-3 rounded-[10px] border border-line p-3 text-start transition-colors duration-quick hover:border-line-2 data-disabled:cursor-not-allowed data-checked:border-accent data-checked:bg-accent-soft data-disabled:opacity-45"
						>
							<span className="grid size-9 shrink-0 place-items-center rounded-lg bg-sunken text-ink-2">
								<Icon name={option.icon} size={22} />
							</span>
							<span className="grid min-w-0 flex-1 gap-0.5">
								<span className="flex flex-wrap items-center gap-2">
									<span className="font-semibold text-sm">{option.label}</span>
									<span className="font-medium font-mono text-[11px] text-ink-3">{option.extension}</span>
									{option.id === "pdf" && (
										<span className="rounded bg-accent-soft px-1.5 font-semibold text-[11px] text-accent-text leading-[18px]">
											<Trans>Best for applying</Trans>
										</span>
									)}
								</span>
								<span className="text-[13px] text-ink-2 leading-[18px]">{option.description}</span>
							</span>
							<span className="mt-0.5 grid size-[18px] shrink-0 place-items-center rounded-full border-[1.5px] border-line-2 group-data-checked/format:border-accent">
								<span className="size-2 rounded-full bg-accent opacity-0 group-data-checked/format:opacity-100" />
							</span>
						</Radio.Root>
					);
				})}
			</RadioGroup>

			<div className="grid gap-1.5">
				<label htmlFor={fileNameId} className="font-medium text-ink-2 text-xs">
					<Trans>File name</Trans>
				</label>
				<div className="flex h-[38px] items-center overflow-hidden rounded-lg border border-line-2 bg-raised focus-within:border-accent focus-within:ring-3 focus-within:ring-accent-soft">
					<input
						id={fileNameId}
						value={name}
						spellCheck={false}
						aria-describedby={`${fileNameId}-hint`}
						onChange={(event) => setFileName(sanitizeFileName(event.target.value))}
						className="h-full min-w-0 flex-1 bg-transparent ps-2.5 font-medium font-mono text-[13px] text-ink outline-none"
					/>
					<span className="px-2.5 font-medium font-mono text-[13px] text-ink-3">{selected.extension}</span>
				</div>
				<span id={`${fileNameId}-hint`} className="text-ink-3 text-xs">
					<Trans>Recruiters see this name. Your name plus “Resume” works well.</Trans>
				</span>
			</div>

			{issues > 0 && (
				<div className="flex gap-2.5 rounded-[10px] bg-warn-soft px-3 py-2.5 text-[13px] text-warn-text leading-[19px]">
					<Icon name="fact_check" size={20} />
					<span>
						<Plural
							value={issues}
							one="Check has # thing to review. You can still download."
							other="Check has # things to review. You can still download."
						/>{" "}
						<button type="button" className="font-medium underline underline-offset-2" onClick={onReview}>
							<Trans>Review</Trans>
						</button>
					</span>
				</div>
			)}

			{state === "error" && (
				<div
					role="alert"
					className="flex flex-wrap items-start gap-2.5 rounded-[10px] bg-danger-soft px-3 py-2.5 text-[13px] text-danger-text leading-[19px]"
				>
					<Icon name="error" size={20} />
					<span className="min-w-0 flex-1">
						<Trans>The {selected.label} file couldn't be generated. Try again, or download PDF instead.</Trans>
					</span>
					{activeFormat !== "pdf" && (
						<Button size="sm" variant="secondary" onClick={() => void download("pdf")}>
							<Trans>Download PDF instead</Trans>
						</Button>
					)}
				</div>
			)}

			<Button
				className={cn("h-11 gap-2 text-[15px]")}
				aria-busy={state === "busy"}
				disabled={state === "busy"}
				onClick={() => void download(activeFormat)}
			>
				{state === "busy" ? (
					<>
						<Spinner decorative className="size-4" />
						<Trans>Preparing {selected.label} file…</Trans>
					</>
				) : state === "error" ? (
					<>
						<Icon name="refresh" />
						<Trans>Try again</Trans>
					</>
				) : (
					<>
						<Icon name="download" />
						<Trans>Download {selected.label}</Trans>
					</>
				)}
			</Button>
		</div>
	);
}
