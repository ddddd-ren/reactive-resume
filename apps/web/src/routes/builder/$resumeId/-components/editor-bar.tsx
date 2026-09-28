import type { EditorMode } from "@/features/resume/editor/store";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { Link } from "@tanstack/react-router";
import { Button, buttonVariants } from "@reactive-resume/ui/components/button";
import { ButtonGroup } from "@reactive-resume/ui/components/button-group";
import { Icon } from "@reactive-resume/ui/components/icon";
import { IconButton } from "@reactive-resume/ui/components/icon-button";
import { TabsList, TabsTrigger } from "@reactive-resume/ui/components/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@reactive-resume/ui/components/tooltip";
import { cn } from "@reactive-resume/utils/style";
import { useCurrentBuilderResumeSelector, useCurrentResume, useResumeStore } from "@/features/resume/builder/draft";
import { useEditorStore } from "@/features/resume/editor/store";
import { useOpenIssueCount } from "@/features/resume/editor/use-open-issue-count";
import { useResumeExport } from "@/features/resume/export/use-resume-export";
import { BuilderAiAssistant } from "./ai-assistant";
import { DocumentMenu } from "./document-menu";

type EditorBarProps = {
	layout: "desktop" | "tablet" | "mobile";
	/** Tablet in landscape: the panel can be pinned beside the page. */
	pinnable: boolean;
};

/**
 * The 56px editor bar. Desktop: back, name and save state · Write/Design/Check · undo, history, assistant,
 * Share and Download PDF. The mode switch stays centered through a `1fr auto 1fr` grid.
 */
export function EditorBar({ layout, pinnable }: EditorBarProps) {
	const resumeId = useCurrentBuilderResumeSelector((resume) => resume.id);
	// Download and Share need a connection.
	const offline = useResumeStore((state) => state.saveStatus === "offline");

	return (
		<header className="grid h-(--editor-bar) grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 border-line border-b bg-surface px-3">
			<div className="flex min-w-0 items-center gap-1.5">
				<BackLink />
				{layout === "tablet" && <DrawerControls pinnable={pinnable} />}
				<div className="flex min-w-0 flex-col items-start">
					<DocumentMenu />
				</div>
			</div>

			{layout === "mobile" ? <span /> : <ModeTabs />}

			<div className="flex items-center justify-end gap-1">
				{layout === "desktop" && (
					<>
						<UndoButton />
						<HistoryButton />
						<span className="me-1.5">
							<BuilderAiAssistant resumeId={resumeId} />
						</span>
					</>
				)}
				<ShareButton compact={layout !== "desktop"} disabled={offline} />
				<DownloadButtons compact={layout === "mobile"} disabled={offline} />
			</div>
		</header>
	);
}

/** Leaving the editor is navigation, so it's a link styled as an icon button. */
function BackLink() {
	const label = t`Back to documents`;

	return (
		<Tooltip>
			<TooltipTrigger
				render={
					<Link
						to="/dashboard/resumes"
						search={{ sort: "lastUpdatedAt", tags: [] }}
						aria-label={label}
						className={buttonVariants({ variant: "ghost", size: "icon", className: "text-ink-2" })}
					/>
				}
			>
				<Icon name="arrow_back" />
			</TooltipTrigger>
			<TooltipContent side="bottom">{label}</TooltipContent>
		</Tooltip>
	);
}

const MODE_ICONS = { write: "edit", design: "palette", check: "fact_check" } as const;

function ModeTabs() {
	const issueCount = useOpenIssueCount();
	const labels: Record<EditorMode, string> = { write: t`Write`, design: t`Design`, check: t`Check` };

	return (
		<TabsList aria-label={t`Editor mode`} className="h-9">
			{(Object.keys(MODE_ICONS) as EditorMode[]).map((mode) => (
				<TabsTrigger key={mode} value={mode} className="px-4">
					<Icon name={MODE_ICONS[mode]} size={18} />
					{labels[mode]}
					{mode === "check" && <CheckBadge count={issueCount} />}
				</TabsTrigger>
			))}
		</TabsList>
	);
}

function CheckBadge({ count }: { count: number }) {
	if (count === 0) {
		return (
			<span className="inline-flex text-accent-text">
				<Icon name="check" size={16} />
				<span className="sr-only">
					<Trans>No open issues</Trans>
				</span>
			</span>
		);
	}

	return (
		<span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-warn-soft px-[5px] font-semibold text-[11px] text-warn-text">
			{count}
			<span className="sr-only">
				<Trans>open issues</Trans>
			</span>
		</span>
	);
}

function UndoButton() {
	const canUndo = useResumeStore((state) => state.canUndo);
	const undo = useResumeStore((state) => state.undo);

	return (
		<IconButton icon="undo" label={t`Undo`} shortcut="⌘Z" className="text-ink-2" disabled={!canUndo} onClick={undo} />
	);
}

/** Tablet: show or hide the panel drawer and, in landscape, pin it beside the page. */
function DrawerControls({ pinnable }: { pinnable: boolean }) {
	const open = useEditorStore((state) => state.drawerOpen);
	const pinned = useEditorStore((state) => state.drawerPinned) && pinnable;
	const setOpen = useEditorStore((state) => state.setDrawerOpen);
	const setPinned = useEditorStore((state) => state.setDrawerPinned);

	return (
		<>
			{!pinned && (
				<IconButton
					icon={open ? "left_panel_close" : "left_panel_open"}
					label={open ? t`Hide panel` : t`Show panel`}
					aria-expanded={open}
					className="text-ink-2"
					onClick={() => setOpen(!open)}
				/>
			)}
			{pinnable && (open || pinned) && (
				<IconButton
					icon="vertical_split"
					label={t`Keep the panel beside the page`}
					aria-pressed={pinned}
					className={cn("text-ink-2", pinned && "bg-accent-soft text-accent-text")}
					onClick={() => {
						// Unpinning leaves the drawer open over the page.
						setPinned(!pinned);
						setOpen(true);
					}}
				/>
			)}
		</>
	);
}

/** History lives in the Share & export sheet; the clock opens it there. */
function HistoryButton() {
	const setShareTab = useEditorStore((state) => state.setShareTab);

	return <IconButton icon="history" label={t`History`} className="text-ink-2" onClick={() => setShareTab("history")} />;
}

type ToolbarActionProps = {
	compact: boolean;
	disabled: boolean;
};

function ShareButton({ compact, disabled }: ToolbarActionProps) {
	const isPublic = useCurrentBuilderResumeSelector((resume) => resume.isPublic ?? false);
	const setShareTab = useEditorStore((state) => state.setShareTab);
	const liveDot = isPublic ? (
		<span aria-hidden="true" className="absolute end-1.5 top-1.5 size-[7px] rounded-full bg-accent" />
	) : null;

	if (compact) {
		return (
			<span className="relative">
				<IconButton
					icon="ios_share"
					label={t`Share`}
					shortcut="⌘⇧S"
					disabled={disabled}
					onClick={() => setShareTab("link")}
				/>
				{liveDot}
			</span>
		);
	}

	return (
		<Button variant="secondary" className="relative gap-1.5" disabled={disabled} onClick={() => setShareTab("link")}>
			<Icon name="ios_share" />
			<Trans>Share</Trans>
			{isPublic && (
				<span className="sr-only">
					<Trans>(link is live)</Trans>
				</span>
			)}
			{liveDot}
		</Button>
	);
}

/** Download PDF is the only filled button; the ▾ segment opens the Download tab with every format. */
function DownloadButtons({ compact, disabled }: ToolbarActionProps) {
	const resume = useCurrentResume();
	const { onDownloadPDF, isExporting } = useResumeExport(resume);
	const setShareTab = useEditorStore((state) => state.setShareTab);

	if (compact) {
		return (
			<IconButton
				icon="download"
				label={t`Download PDF`}
				shortcut="⌘P"
				disabled={disabled || isExporting}
				onClick={() => void onDownloadPDF()}
			/>
		);
	}

	return (
		<ButtonGroup aria-label={t`Download`}>
			<Button loading={isExporting} disabled={disabled} className="gap-1.5" onClick={() => void onDownloadPDF()}>
				{!isExporting && <Icon name="download" />}
				{isExporting ? <Trans>Preparing…</Trans> : <Trans>Download PDF</Trans>}
			</Button>
			<Button
				size="icon"
				disabled={disabled || isExporting}
				aria-label={t`More download formats`}
				className="w-8 border-s border-s-[oklch(1_0_0/0.25)]"
				onClick={() => setShareTab("download")}
			>
				<Icon name="expand_more" />
			</Button>
		</ButtonGroup>
	);
}
