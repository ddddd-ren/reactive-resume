import { t } from "@lingui/core/macro";
import { Plural, Trans } from "@lingui/react/macro";
import { useHotkey } from "@tanstack/react-hotkeys";
import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { buttonVariants } from "@reactive-resume/ui/components/button";
import { Icon } from "@reactive-resume/ui/components/icon";
import { IconButton } from "@reactive-resume/ui/components/icon-button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@reactive-resume/ui/components/tooltip";
import { cn } from "@reactive-resume/utils/style";
import { useEditorStore, ZOOM_MAX, ZOOM_MIN, ZOOM_STEP } from "./store";

// The editor chrome resumes and letters share: the back link and drawer controls in the bar, the canvas width
// and the zoom bar.

const LANDSCAPE_QUERY = "(orientation: landscape)";

function subscribeToOrientation(onChange: () => void) {
	const list = window.matchMedia(LANDSCAPE_QUERY);
	list.addEventListener("change", onChange);
	return () => list.removeEventListener("change", onChange);
}

/** Tablets in landscape can pin the panel beside the page. */
export const useIsLandscape = () =>
	useSyncExternalStore(
		subscribeToOrientation,
		() => window.matchMedia(LANDSCAPE_QUERY).matches,
		() => false,
	);

// Page widths in PDF points; 1pt renders as 1 CSS px at 100%.
export const PAGE_WIDTH = { a4: 595.28, letter: 612, "free-form": 595.28 } as const;
// Horizontal room the canvas keeps around the page: 40px each side, 16px on phones.
export const CANVAS_GUTTER = { wide: 80, narrow: 32 } as const;

export function useCanvasWidth() {
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

/** Leaving the editor is navigation, so it's a link styled as an icon button. */
export function BackLink() {
	const label = t`Back to documents`;

	return (
		<Tooltip>
			<TooltipTrigger
				render={
					<Link
						to="/dashboard"
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

/** Tablet: show or hide the panel drawer and, in landscape, pin it beside the page. */
export function DrawerControls({ pinnable }: { pinnable: boolean }) {
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

type ZoomBarProps = {
	fitScale: number;
	pageCount: number;
};

/** − · Fit · + and the page count, floating 18px above the bottom of the canvas. Zoom runs from 60% to 150%. */
export function ZoomBar({ fitScale, pageCount }: ZoomBarProps) {
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
