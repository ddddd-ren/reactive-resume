import type { PageMap } from "@reactive-resume/pdf/page-map";
import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Trans } from "@lingui/react/macro";
import { useQuery } from "@tanstack/react-query";
import { useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { coverLetterTextToHtml } from "@reactive-resume/resume/cover-letter";
import { getStateIn } from "@reactive-resume/resume/proposals";
import { Icon } from "@reactive-resume/ui/components/icon";
import { useBreakpoint } from "@reactive-resume/ui/hooks/use-breakpoint";
import { cn } from "@reactive-resume/utils/style";
import { templates } from "@/dialogs/resume/template/data";
import { letterPageData, useLetterWords } from "@/features/letters/compose";
import { useLetterEditorStore } from "@/features/letters/store";
import { useLetterMode } from "@/features/letters/use-letter-mode";
import { CANVAS_GUTTER, PAGE_WIDTH, useCanvasWidth, ZoomBar } from "@/features/resume/editor/chrome";
import { markChange } from "@/features/resume/editor/proposals/proposals";
import { useEditorStore, ZOOM_MAX } from "@/features/resume/editor/store";
import { getScrollBehavior } from "@/features/resume/editor/write/reveal";
import { ResumePreview } from "@/features/resume/preview/preview";
import { formatVersionTime, getVersionTitle } from "@/features/resume/share/format";
import { orpc } from "@/libs/orpc/client";

const NONE: readonly never[] = [];

/** The latest value, at most every `ms`: a streaming draft re-renders the page a few times a second, not per word. */
function useThrottled<T>(value: T, ms: number) {
	const [shown, setShown] = useState(value);
	const last = useRef(0);

	useEffect(() => {
		const timeout = window.setTimeout(
			() => {
				last.current = Date.now();
				setShown(value);
			},
			Math.max(0, last.current + ms - Date.now()),
		);
		return () => window.clearTimeout(timeout);
	}, [value, ms]);

	return shown;
}

/**
 * The letter on the desk, as it prints: sender header, recipient and date, greeting, body and sign-off. A draft
 * shows in place on a green wash; History shows a version read-only; Design previews a hovered template.
 */
export function LetterPage() {
	const letter = useLetterEditorStore((state) => state.letter);
	const draft = useLetterEditorStore((state) => state.draft);
	const assistantProposals = useEditorStore((state) => (state.assistantOpen ? state.assistantProposals : NONE));
	const words = useLetterWords();
	const { i18n } = useLingui();
	const reducedMotion = useReducedMotion();
	const zoom = useEditorStore((state) => state.zoom);
	const previewTemplate = useEditorStore((state) => state.previewTemplate);
	const historyVersionId = useEditorStore((state) => state.historyVersionId);
	const sheetOpen = useEditorStore((state) => state.shareTab !== null);
	const rendered = useEditorStore((state) => state.rendered);
	const setRendered = useEditorStore((state) => state.setRendered);
	const breakpoint = useBreakpoint();
	const [canvasRef, canvasWidth] = useCanvasWidth();

	const { data: version } = useQuery({
		...orpc.coverLetters.getVersion.queryOptions({
			input: { id: letter?.id ?? "", versionId: historyVersionId ?? "" },
		}),
		enabled: Boolean(letter) && historyVersionId !== null,
	});
	const viewing = historyVersionId !== null && version?.id === historyVersionId ? version : null;

	// Reduced motion puts the whole draft on the page at once.
	const draftText =
		draft.phase === "ready" || (draft.phase === "streaming" && !reducedMotion) ? draft.text || null : null;
	const shownDraft = useThrottled(draftText, 400);

	const data = useMemo(() => {
		if (!letter) return undefined;
		if (viewing) return letterPageData({ ...letter, ...viewing.data }, words);
		// The assistant's pending edits show in the body: the old text struck through, the new highlighted.
		const content = shownDraft
			? coverLetterTextToHtml(shownDraft)
			: assistantProposals
					.filter((proposal) => getStateIn(letter.content, proposal) === "pending")
					.reduce(
						(html, proposal) => html.replace(proposal.before, () => markChange(proposal.before, proposal.after)),
						letter.content,
					);
		const page = letterPageData({ ...letter, content }, words);
		return previewTemplate ? { ...page, metadata: { ...page.metadata, template: previewTemplate } } : page;
	}, [letter, viewing, shownDraft, previewTemplate, words, assistantProposals]);

	if (!letter || !data) return null;

	const isPhone = breakpoint === "mobile";
	const format = data.metadata.page.format;
	const gutter = isPhone ? CANVAS_GUTTER.narrow : CANVAS_GUTTER.wide;
	const fitScale = canvasWidth > 0 ? Math.min(ZOOM_MAX, (canvasWidth - gutter) / PAGE_WIDTH[format]) : 1;
	const pageScale = zoom === "fit" ? Math.max(0.25, fitScale) : zoom;
	const formatLabel = { a4: "A4", letter: t`Letter`, "free-form": t`Free-form` }[format];
	// Desktop: the page moves aside so it stays visible beside the Share & export sheet.
	const shifted = sheetOpen && (breakpoint === "desktop" || breakpoint === "wide");

	return (
		<div className="relative h-full min-h-0 bg-sunken">
			<div ref={canvasRef} className={cn("absolute inset-0 overflow-auto pt-7 pb-24", isPhone ? "px-4" : "px-10")}>
				<ResumePreview
					data={data}
					includeCoverLetterHeader
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
									<Trans>Page 1 · {formatLabel}</Trans>
								)}
							</figcaption>
						) : (
							<figcaption className="mb-2.5 text-center font-medium text-ink-3 text-xs">
								<Trans>Page {pageNumber}</Trans>
							</figcaption>
						)
					}
					renderPageOverlay={({ pageIndex, pageMap }) =>
						viewing ? null : (
							<LetterOverlay
								pageIndex={pageIndex}
								pageMap={pageMap}
								itemId={letter.style.itemId}
								washed={Boolean(shownDraft)}
							/>
						)
					}
				/>
			</div>

			<ZoomBar fitScale={fitScale} pageCount={Math.max(1, rendered.pageCount)} />
		</div>
	);
}

type LetterOverlayProps = { pageIndex: number; pageMap: PageMap | undefined; itemId: string; washed: boolean };

/**
 * Pointer layer over the page: the sender's header leads to From, the letter to its body in the panel. A draft
 * lies on a green wash until it's kept.
 */
function LetterOverlay({ pageIndex, pageMap, itemId, washed }: LetterOverlayProps) {
	const [mode, setMode] = useLetterMode();
	const page = pageMap?.pages[pageIndex];
	if (!pageMap || !page || page.width <= 0 || page.height <= 0) return null;

	const nodes = pageMap.nodes.filter(
		(node) => node.page === pageIndex && (node.kind === "header" || (node.kind === "item" && node.itemId === itemId)),
	);

	const reveal = (target: "from" | "body") => {
		if (mode !== "write") setMode("write");
		useEditorStore.getState().setMobileView("write");
		useEditorStore.getState().setDrawerOpen(true);
		window.setTimeout(() => {
			if (target === "body") {
				const editor = document.getElementById("letter-body-editor");
				if (editor) return editor.focus();
			}
			document
				.getElementById(target === "from" ? "letter-from" : "letter-body")
				?.scrollIntoView({ behavior: getScrollBehavior(), block: "start" });
		}, 50);
	};

	return (
		// A pointer shortcut, hidden from assistive tech: the panel reaches the same fields by keyboard.
		<div aria-hidden="true" className="absolute inset-0">
			{nodes.map((node) => (
				// biome-ignore lint/a11y/noStaticElementInteractions: hidden from assistive tech, see above.
				// biome-ignore lint/a11y/useKeyWithClickEvents: the panel offers the same by keyboard.
				<div
					key={`${node.key}:${node.y}`}
					onClick={() => reveal(node.kind === "header" ? "from" : "body")}
					className={cn(
						"absolute cursor-pointer rounded-[4px] transition-[background-color,outline-color] duration-standard",
						washed && node.kind === "item"
							? "bg-[oklch(0.93_0.05_150/0.55)] mix-blend-multiply outline-[1.5px] outline-[oklch(0.5_0.1_150)] outline-solid"
							: "hover:bg-[oklch(0.5_0.1_150/0.06)]",
					)}
					style={{
						left: `calc(${(node.x / page.width) * 100}% - 4px)`,
						top: `calc(${(node.y / page.height) * 100}% - 3px)`,
						width: `calc(${(node.width / page.width) * 100}% + 8px)`,
						height: `calc(${(node.height / page.height) * 100}% + 6px)`,
					}}
				/>
			))}
		</div>
	);
}
