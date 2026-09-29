import type { DateFormat } from "@reactive-resume/schema/resume/dates";
import type { ReactNode } from "react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useState } from "react";
import { defaultResumeData } from "@reactive-resume/schema/resume/default";
import { Button } from "@reactive-resume/ui/components/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@reactive-resume/ui/components/collapsible";
import { Icon } from "@reactive-resume/ui/components/icon";
import { NativeSelect } from "@reactive-resume/ui/components/native-select";
import { Tabs, TabsList, TabsTrigger } from "@reactive-resume/ui/components/tabs";
import { toast } from "@reactive-resume/ui/components/toast";
import { cn } from "@reactive-resume/utils/style";
import { useIsResumeLocked, useResumeData, useResumeStore, useUpdateResumeData } from "@/features/resume/builder/draft";
import { ColorGroup, PageGroup, TypeGroup } from "@/features/resume/editor/design/style-groups";
import { TemplateGroup } from "@/features/resume/editor/design/template-group";
import { OfflineBanner } from "@/features/resume/editor/save-status";
import { getScrollBehavior } from "@/features/resume/editor/write/reveal";
import { D2 } from "@/libs/motion";
import { getSectionTitle } from "@/libs/resume/section";
import { CustomStylesSectionBuilder } from "../-sidebar/right/sections/custom-styles";
import { DesignSectionBuilder } from "../-sidebar/right/sections/design";
import { LayoutSectionBuilder } from "../-sidebar/right/sections/layout";
import { PageSectionBuilder } from "../-sidebar/right/sections/page";
import { TypographySectionBuilder } from "../-sidebar/right/sections/typography";

const GROUPS = [
	{ id: "template", label: () => t`Template` },
	{ id: "type", label: () => t`Type` },
	{ id: "color", label: () => t`Color` },
	{ id: "page", label: () => t`Page` },
	{ id: "advanced", label: () => t`Advanced` },
] as const;

function Group({ id, title, children }: { id: string; title: ReactNode; children: ReactNode }) {
	return (
		<section id={`design-${id}`} aria-labelledby={`design-${id}-title`} className="grid scroll-mt-14 gap-3 px-4 py-5">
			<h2 id={`design-${id}-title`} className="font-semibold text-[15px]">
				{title}
			</h2>
			{children}
		</section>
	);
}

/**
 * Design: a sticky nav (Template · Type · Color · Page · Advanced) over groups divided by rules. Presets cover
 * the common choices; Advanced keeps every exact value, custom CSS and the reset.
 */
export function DesignPanel() {
	const locked = useIsResumeLocked();
	const [advancedOpen, setAdvancedOpen] = useState(false);

	return (
		<div>
			<nav
				aria-label={t`Design groups`}
				className="sticky top-0 z-10 flex gap-1 overflow-x-auto border-line border-b bg-surface px-3 py-2"
			>
				{GROUPS.map((group) => (
					<button
						key={group.id}
						type="button"
						onClick={() => {
							const target = document.getElementById(`design-${group.id}`);
							const scroll = () => target?.scrollIntoView({ behavior: getScrollBehavior() });
							// Advanced is collapsed until asked for: jumping to it opens it, then aims again once it has grown
							// (before that the panel may be too short to bring it to the top).
							if (group.id === "advanced" && !advancedOpen) {
								setAdvancedOpen(true);
								window.setTimeout(scroll, D2 * 1000);
							}
							scroll();
						}}
						className="h-8 shrink-0 rounded-full px-3 text-[13px] text-ink-2 transition-colors duration-quick hover:bg-hover hover:text-ink"
					>
						{group.label()}
					</button>
				))}
			</nav>

			<fieldset disabled={locked} className="m-0 min-w-0 divide-y divide-line border-0 p-0">
				<Group id="template" title={<Trans>Template</Trans>}>
					<TemplateGroup />
				</Group>
				<Group id="type" title={<Trans>Type</Trans>}>
					<TypeGroup />
				</Group>
				<Group id="color" title={<Trans>Color</Trans>}>
					<ColorGroup />
				</Group>
				<Group id="page" title={<Trans>Page</Trans>}>
					<PageGroup />
				</Group>
				<AdvancedGroup open={advancedOpen} onOpenChange={setAdvancedOpen} />
			</fieldset>
		</div>
	);
}

type SheetTab = "template" | "type" | "color" | "page";

/**
 * Phones: Design is a sheet over the lower half of the page, so every change shows above it. The handle
 * raises it to full height. Tabs replace the group nav; Advanced sits under Page.
 */
export function DesignSheet() {
	const locked = useIsResumeLocked();
	const [tab, setTab] = useState<SheetTab>("template");
	const [expanded, setExpanded] = useState(false);

	return (
		<section
			aria-label={t`Design`}
			className={cn(
				"absolute inset-x-0 bottom-0 z-20 flex flex-col rounded-t-2xl border-line border-t bg-surface shadow-e3 transition-[height] duration-emphasized ease-enter",
				expanded ? "h-[calc(100%-1rem)]" : "h-1/2",
			)}
		>
			<button
				type="button"
				aria-expanded={expanded}
				aria-label={expanded ? t`Lower the design sheet` : t`Raise the design sheet`}
				onClick={() => setExpanded(!expanded)}
				className="flex h-6 shrink-0 items-center justify-center"
			>
				<span className="h-1 w-9 rounded-full bg-line-2" />
			</button>

			<Tabs value={tab} onValueChange={(value) => setTab(value as SheetTab)} className="min-h-0 flex-1 gap-0">
				<TabsList variant="line" className="w-full shrink-0 justify-around px-4">
					{GROUPS.filter((group) => group.id !== "advanced").map((group) => (
						<TabsTrigger key={group.id} value={group.id}>
							{group.label()}
						</TabsTrigger>
					))}
				</TabsList>

				<fieldset disabled={locked} className="m-0 min-h-0 min-w-0 flex-1 overflow-y-auto border-0 px-4 py-4">
					<OfflineBanner className="mb-4" />
					{tab === "template" && <TemplateGroup layout="strip" />}
					{tab === "type" && <TypeGroup />}
					{tab === "color" && <ColorGroup />}
					{tab === "page" && (
						<div className="-mx-4 divide-y divide-line">
							<div className="px-4 pb-5">
								<PageGroup />
							</div>
							<AdvancedGroup />
						</div>
					)}
				</fieldset>
			</Tabs>
		</section>
	);
}

const DATE_FORMATS: { value: DateFormat; label: string }[] = [
	{ value: "short", label: "Mar 2022" },
	{ value: "long", label: "March 2022" },
	{ value: "numeric", label: "03/2022" },
	{ value: "iso", label: "2022-03" },
];

// The exact-value editors, each under its own heading. They mount only while Advanced is open.
const EXACT_SECTIONS = [
	["typography", TypographySectionBuilder],
	["design", DesignSectionBuilder],
	["page", PageSectionBuilder],
	["layout", LayoutSectionBuilder],
	["styles", CustomStylesSectionBuilder],
] as const;

/** Every exact value, the date format, custom CSS and Reset to template defaults, collapsed until asked for. */
// The phone sheet leaves it uncontrolled; the desktop panel controls it so its nav can open it.
type AdvancedGroupProps = { open?: boolean; onOpenChange?: (open: boolean) => void };

function AdvancedGroup({ open, onOpenChange }: AdvancedGroupProps) {
	const data = useResumeData();
	const updateResumeData = useUpdateResumeData();

	const reset = () => {
		updateResumeData(
			(draft) => {
				const defaults = defaultResumeData.metadata;
				draft.metadata.typography = structuredClone(defaults.typography);
				draft.metadata.design = structuredClone(defaults.design);
				draft.metadata.layout.sidebarWidth = defaults.layout.sidebarWidth;
				// Paper, language, date format, section placement and custom CSS are the user's, not the look's; they stay.
				const { gapX, gapY, marginX, marginY, hideIcons, hideLinkUnderline, hideSectionIcons } = defaults.page;
				Object.assign(draft.metadata.page, {
					gapX,
					gapY,
					marginX,
					marginY,
					hideIcons,
					hideLinkUnderline,
					hideSectionIcons,
				});
			},
			{ newStep: true },
		);
		toast.add({
			description: t`Design reset to the template defaults`,
			actionProps: { children: t`Undo`, onClick: () => useResumeStore.getState().undo() },
		});
	};

	return (
		<Collapsible id="design-advanced" open={open} onOpenChange={onOpenChange} className="scroll-mt-14 px-4 py-5">
			<CollapsibleTrigger className="group/advanced flex w-full cursor-pointer items-center justify-between text-start font-semibold text-[15px]">
				<Trans>Advanced</Trans>
				<Icon
					name="expand_more"
					className="text-ink-2 transition-transform duration-standard ease-enter group-data-panel-open/advanced:rotate-180"
				/>
			</CollapsibleTrigger>

			<CollapsibleContent>
				<div className="@container grid gap-6 pt-4">
					<div className="grid gap-1.5">
						<label htmlFor="design-date-format" className="font-medium text-[13px]">
							<Trans>Date format</Trans>
						</label>
						<NativeSelect
							id="design-date-format"
							value={data?.metadata.page.dateFormat ?? "short"}
							onChange={(event) =>
								updateResumeData(
									(draft) => {
										draft.metadata.page.dateFormat = event.target.value as DateFormat;
									},
									{ newStep: true },
								)
							}
						>
							{DATE_FORMATS.map((format) => (
								<option key={format.value} value={format.value}>
									{format.label}
								</option>
							))}
						</NativeSelect>
					</div>

					{EXACT_SECTIONS.map(([type, Section]) => (
						<section key={type} aria-labelledby={`design-advanced-${type}`} className="grid gap-3">
							<h3 id={`design-advanced-${type}`} className="font-semibold text-[13px] text-ink-2">
								{getSectionTitle(type)}
							</h3>
							<Section />
						</section>
					))}

					<Button variant="secondary" className="w-fit" onClick={reset}>
						<Icon name="restart_alt" size={18} />
						<Trans>Reset to template defaults</Trans>
					</Button>
				</div>
			</CollapsibleContent>
		</Collapsible>
	);
}
