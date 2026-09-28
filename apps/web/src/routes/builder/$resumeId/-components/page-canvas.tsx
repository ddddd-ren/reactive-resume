import type { EditorSelection } from "@/features/resume/editor/store";
import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Plural, Trans } from "@lingui/react/macro";
import { useHotkey } from "@tanstack/react-hotkeys";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@reactive-resume/ui/components/icon";
import { useBreakpoint } from "@reactive-resume/ui/hooks/use-breakpoint";
import { cn } from "@reactive-resume/utils/style";
import { templates } from "@/dialogs/resume/template/data";
import { useCurrentBuilderResumeSelector, useResumeData } from "@/features/resume/builder/draft";
import { measureOverflow, runFit } from "@/features/resume/editor/design/fit";
import { PageOverlay } from "@/features/resume/editor/page-overlay";
import { useEditorStore, ZOOM_MAX, ZOOM_MIN, ZOOM_STEP } from "@/features/resume/editor/store";
import { revealSelectionInPanel } from "@/features/resume/editor/write/reveal";
import { ResumePreview } from "@/features/resume/preview/preview";
import { formatVersionTime, getVersionTitle } from "@/features/resume/share/format";
import { orpc } from "@/libs/orpc/client";
import { useEditorMode } from "./use-editor-mode";

// Page widths in PDF points; 1pt renders as 1 CSS px at 100%.
const PAGE_WIDTH = { a4: 595.28, letter: 612, "free-form": 595.28 } as const;
// Horizontal room the canvas keeps around the page: 40px each side, 16px on phones.
const CANVAS_GUTTER = { wide: 80, narrow: 32 } as const;

function useCanvasWidth() {
	const ref = useRef<HTMLDivElement>(null);
	const [width, setWidth] = useState(0);

	useEffect(() => {
		const element = ref.current;
		if (!element) return;
		const observer = new ResizeObserver(([entry]) => setWidth(entry?.contentRect.width ?? 0));
		observer.observe(element);
		return () => observer.disconnect();
	}, []);

	return [ref, width] as const;
}

/**
 * The page canvas: the live resume on the sunken desk, with a caption above the first page, a pointer layer
 * that links lines to entries, and the zoom bar.
 */
export function PageCanvas() {
	const data = useResumeData();
	const format = useCurrentBuilderResumeSelector((resume) => resume.data.metadata.page.format);
	const zoom = useEditorStore((state) => state.zoom);
	const select = useEditorStore((state) => state.select);
	const setDrawerOpen = useEditorStore((state) => state.setDrawerOpen);
	const previewTemplate = useEditorStore((state) => state.previewTemplate);
	const historyVersionId = useEditorStore((state) => state.historyVersionId);
	const sheetOpen = useEditorStore((state) => state.shareTab !== null);
	const resumeId = useCurrentBuilderResumeSelector((resume) => resume.id);
	const { i18n } = useLingui();
	const rendered = useEditorStore((state) => state.rendered);
	const setRendered = useEditorStore((state) => state.setRendered);
	const breakpoint = useBreakpoint();
	const [mode] = useEditorMode();
	const [canvasRef, canvasWidth] = useCanvasWidth();
	const isPhone = breakpoint === "mobile";
	const gutter = isPhone ? CANVAS_GUTTER.narrow : CANVAS_GUTTER.wide;

	const fitScale = canvasWidth > 0 ? Math.min(ZOOM_MAX, (canvasWidth - gutter) / PAGE_WIDTH[format]) : 1;
	const pageScale = zoom === "fit" ? Math.max(0.25, fitScale) : zoom;
	const formatLabel = { a4: "A4", letter: t`Letter`, "free-form": t`Free-form` }[format];

	// History: the picked version is drawn on the page, read-only, until the user restores it or goes back to now.
	const { data: version } = useQuery({
		...orpc.resume.getVersion.queryOptions({ input: { resumeId, versionId: historyVersionId ?? "" } }),
		enabled: historyVersionId !== null,
	});
	const viewing = historyVersionId !== null && version?.id === historyVersionId ? version : null;

	// Design: a hovered or focused template is drawn on the page until it's applied or the pointer leaves.
	const previewData = useMemo(
		() =>
			viewing
				? viewing.data
				: data && previewTemplate
					? { ...data, metadata: { ...data.metadata, template: previewTemplate } }
					: undefined,
		[data, previewTemplate, viewing],
	);
	const overflow = data && !previewTemplate && !viewing ? measureOverflow(data, rendered) : null;
	// Desktop: the page moves 120px aside so it stays visible beside the Share & export sheet.
	const shifted = sheetOpen && (breakpoint === "desktop" || breakpoint === "wide");

	const onSelect = (selection: EditorSelection) => {
		select(selection);
		// Tablet: tapping a line opens the drawer on that entry.
		if (breakpoint === "tablet") setDrawerOpen(true);
		// Phones show the page and the panel one at a time; the selection bar opens the entry instead.
		if (mode === "write" && !isPhone) revealSelectionInPanel(selection);
	};

	return (
		<div className="relative h-full min-h-0 bg-sunken">
			<div
				ref={canvasRef}
				// Tapping the page (not a line) closes the tablet drawer but keeps the selection; on phones it
				// dismisses the selection bar.
				onPointerDown={(event) => {
					if ((event.target as HTMLElement).closest("[data-kind]")) return;
					if (breakpoint === "tablet") setDrawerOpen(false);
					if (isPhone) select(null);
				}}
				className={cn("absolute inset-0 overflow-auto pt-7 pb-24", isPhone ? "px-4" : "px-10")}
			>
				<ResumePreview
					data={previewData}
					pageLayout="vertical"
					pageGap={24}
					pageScale={pageScale}
					className={cn(
						"mx-auto w-fit transition-transform duration-emphasized ease-enter",
						shifted && "-translate-x-[120px] rtl:translate-x-[120px]",
					)}
					pageClassName={cn("rounded-none shadow-page", viewing && "outline-2 outline-ink outline-offset-4")}
					onRender={setRendered}
					renderPageCaption={({ pageNumber }) =>
						pageNumber === 1 ? (
							<figcaption className="mb-2.5 flex min-h-8 flex-wrap items-center justify-center gap-2.5 text-center font-medium text-ink-3 text-xs">
								{viewing ? (
									<span
										role="status"
										className="flex h-8 items-center gap-2 rounded-lg bg-ink px-3 text-[13px] text-bg"
									>
										<Icon name="history" size={18} />
										<Trans>
											Viewing {formatVersionTime(viewing.createdAt, i18n.locale)} · {getVersionTitle(viewing)} ·
											read-only
										</Trans>
									</span>
								) : previewTemplate ? (
									<span
										role="status"
										className="flex h-8 items-center gap-2 rounded-lg bg-ink px-3 text-[13px] text-bg"
									>
										<Icon name="visibility" size={18} />
										<Trans>Previewing {templates[previewTemplate].name} · click to apply</Trans>
									</span>
								) : (
									<>
										<Trans>Page 1 · {formatLabel} · click any line to edit it</Trans>
										{overflow && <OverflowChip {...overflow} />}
									</>
								)}
							</figcaption>
						) : overflow && pageNumber > overflow.authored ? (
							// Content past the authored pages: a dashed warn line at the page boundary.
							<figcaption className="relative mb-2.5 border-warn border-t-[1.5px] border-dashed">
								<span className="absolute end-0 -top-2.5 rounded bg-sunken px-1.5 font-semibold text-[11px] text-warn-text">
									<Trans>Page {pageNumber}</Trans>
								</span>
							</figcaption>
						) : (
							<figcaption className="mb-2.5 text-center font-medium text-ink-3 text-xs">
								<Trans>Page {pageNumber}</Trans>
							</figcaption>
						)
					}
					renderPageOverlay={({ pageIndex, pageMap }) =>
						// A version from History is read-only: its lines don't open entries.
						viewing ? null : <PageOverlay pageIndex={pageIndex} pageMap={pageMap} onSelect={onSelect} />
					}
				/>
			</div>

			<ZoomBar fitScale={fitScale} pageCount={Math.max(1, rendered.pageCount)} />
		</div>
	);
}

type OverflowChipProps = { authored: number; lines: number | null };

/** "Runs onto page 2 by about 6 lines" with Fit, which tightens the design until it fits (one undo step). */
function OverflowChip({ authored, lines }: OverflowChipProps) {
	const [fitting, setFitting] = useState(false);
	const next = authored + 1;

	return (
		<span className="flex min-h-8 items-center gap-2 rounded-lg bg-warn-soft py-1 ps-3 pe-1.5 text-[13px] text-warn-text">
			<Icon name="vertical_split" size={18} />
			{lines ? (
				<Plural
					value={lines}
					one={`Runs onto page ${next} by about # line`}
					other={`Runs onto page ${next} by about # lines`}
				/>
			) : (
				<Trans>Runs onto page {next}</Trans>
			)}
			<button
				type="button"
				disabled={fitting}
				onClick={() => {
					setFitting(true);
					void runFit().finally(() => setFitting(false));
				}}
				className="h-6 whitespace-nowrap rounded-md bg-surface px-2.5 font-semibold text-ink text-xs shadow-e1 disabled:opacity-60"
			>
				{authored === 1 ? <Trans>Fit to one page</Trans> : <Trans>Fit to {authored} pages</Trans>}
			</button>
		</span>
	);
}

type ZoomBarProps = {
	fitScale: number;
	pageCount: number;
};

/** − · Fit · + and the page count, floating 18px above the bottom of the canvas. Zoom runs from 60% to 150%. */
function ZoomBar({ fitScale, pageCount }: ZoomBarProps) {
	const zoom = useEditorStore((state) => state.zoom);
	const setZoom = useEditorStore((state) => state.setZoom);
	const current = zoom === "fit" ? fitScale : zoom;

	useHotkey("Mod+0", () => setZoom("fit"));

	const buttonClassName =
		"flex size-8 items-center justify-center rounded-[7px] text-ink-2 transition-colors duration-quick hover:bg-hover disabled:text-ink-3 disabled:hover:bg-transparent";

	return (
		<div className="absolute bottom-[18px] left-1/2 flex -translate-x-1/2 items-center gap-0.5 rounded-lg border border-line bg-raised p-1 shadow-e2">
			<button
				type="button"
				aria-label={t`Zoom out`}
				disabled={current <= ZOOM_MIN}
				className={buttonClassName}
				onClick={() => setZoom(current - ZOOM_STEP)}
			>
				<Icon name="remove" />
			</button>
			<button
				type="button"
				aria-label={t`Fit page to width`}
				className="h-8 min-w-[52px] rounded-[7px] px-1.5 font-medium font-mono text-ink text-xs transition-colors duration-quick hover:bg-hover"
				onClick={() => setZoom("fit")}
			>
				{zoom === "fit" ? <Trans>Fit</Trans> : `${Math.round(current * 100)}%`}
			</button>
			<button
				type="button"
				aria-label={t`Zoom in`}
				disabled={current >= ZOOM_MAX}
				className={buttonClassName}
				onClick={() => setZoom(current + ZOOM_STEP)}
			>
				<Icon name="add" />
			</button>
			<span className="whitespace-nowrap px-2 font-mono text-ink-3 text-xs">
				<Plural value={pageCount} one="# page" other="# pages" />
			</span>
		</div>
	);
}
