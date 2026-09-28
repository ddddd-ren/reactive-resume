import type { EditorSelection } from "@/features/resume/editor/store";
import { t } from "@lingui/core/macro";
import { Plural, Trans } from "@lingui/react/macro";
import { useHotkey } from "@tanstack/react-hotkeys";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@reactive-resume/ui/components/icon";
import { useBreakpoint } from "@reactive-resume/ui/hooks/use-breakpoint";
import { cn } from "@reactive-resume/utils/style";
import { useCurrentBuilderResumeSelector } from "@/features/resume/builder/draft";
import { PageOverlay } from "@/features/resume/editor/page-overlay";
import { useEditorStore, ZOOM_MAX, ZOOM_MIN, ZOOM_STEP } from "@/features/resume/editor/store";
import { ResumePreview } from "@/features/resume/preview/preview";
import { revealSelectionInPanel } from "./reveal-selection";
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
	const format = useCurrentBuilderResumeSelector((resume) => resume.data.metadata.page.format);
	const zoom = useEditorStore((state) => state.zoom);
	const select = useEditorStore((state) => state.select);
	const setDrawerOpen = useEditorStore((state) => state.setDrawerOpen);
	const breakpoint = useBreakpoint();
	const [mode] = useEditorMode();
	const [canvasRef, canvasWidth] = useCanvasWidth();
	const [pageCount, setPageCount] = useState(1);
	const isPhone = breakpoint === "mobile";
	const gutter = isPhone ? CANVAS_GUTTER.narrow : CANVAS_GUTTER.wide;

	const fitScale = canvasWidth > 0 ? Math.min(ZOOM_MAX, (canvasWidth - gutter) / PAGE_WIDTH[format]) : 1;
	const pageScale = zoom === "fit" ? Math.max(0.25, fitScale) : zoom;
	const formatLabel = { a4: "A4", letter: t`Letter`, "free-form": t`Free-form` }[format];

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
					pageLayout="vertical"
					pageGap={24}
					pageScale={pageScale}
					className="mx-auto w-fit"
					pageClassName="rounded-none shadow-page"
					onPageCount={setPageCount}
					renderPageCaption={({ pageNumber }) => (
						<figcaption className="mb-2.5 text-center font-medium text-ink-3 text-xs">
							{pageNumber === 1 ? (
								<Trans>Page 1 · {formatLabel} · click any line to edit it</Trans>
							) : (
								<Trans>Page {pageNumber}</Trans>
							)}
						</figcaption>
					)}
					renderPageOverlay={({ pageIndex, pageMap }) => (
						<PageOverlay pageIndex={pageIndex} pageMap={pageMap} onSelect={onSelect} />
					)}
				/>
			</div>

			<ZoomBar fitScale={fitScale} pageCount={pageCount} />
		</div>
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
