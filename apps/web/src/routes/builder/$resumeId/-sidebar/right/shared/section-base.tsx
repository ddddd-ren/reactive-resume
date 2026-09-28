import type { RightSidebarSection } from "@/libs/resume/section";
import { t } from "@lingui/core/macro";
import { CaretDownIcon } from "@phosphor-icons/react";
import { createContext, use } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@reactive-resume/ui/components/accordion";
import { Button } from "@reactive-resume/ui/components/button";
import { cn } from "@reactive-resume/utils/style";
import { getSectionIcon, getSectionTitle } from "@/libs/resume/section";
import { useSectionStore } from "../../../-store/section";

type Props = React.ComponentProps<typeof AccordionContent> & {
	type: RightSidebarSection;
};

/**
 * When a section is shown inside a host that already titles it (a dialog, a sheet or an editor mode),
 * it renders its content only, without the collapsible heading.
 */
const SectionChromeContext = createContext<"collapsible" | "bare">("collapsible");
export const BareSectionChrome = ({ children }: { children: React.ReactNode }) => (
	<SectionChromeContext value="bare">{children}</SectionChromeContext>
);

export function SectionBase({ type, className, ...props }: Props) {
	const chrome = use(SectionChromeContext);
	const collapsed = useSectionStore((state) => state.sections[type]?.collapsed ?? false);
	const toggleCollapsed = useSectionStore((state) => state.toggleCollapsed);
	const sectionTitle = getSectionTitle(type);

	if (chrome === "bare") {
		return (
			<div id={`sidebar-${type}`} className={cn("space-y-4", className)}>
				{props.children as React.ReactNode}
			</div>
		);
	}

	return (
		<Accordion
			className="space-y-4"
			id={`sidebar-${type}`}
			value={collapsed ? [] : [type]}
			onValueChange={() => toggleCollapsed(type)}
		>
			<AccordionItem value={type} className="group/accordion-item space-y-4">
				<div className="flex items-center">
					<AccordionTrigger
						className="me-2 items-center justify-center"
						render={
							<Button size="icon" variant="ghost" aria-label={t`Toggle ${sectionTitle} section`}>
								<CaretDownIcon className="transition-transform duration-200 group-data-closed/accordion-item:-rotate-90" />
							</Button>
						}
					/>

					<div className="flex flex-1 items-center gap-x-4">
						{getSectionIcon(type)}
						<h2 className="line-clamp-1 font-semibold text-2xl tracking-tight">{sectionTitle}</h2>
					</div>
				</div>

				<AccordionContent className={cn("overflow-hidden pb-0", className)} {...props} />
			</AccordionItem>
		</Accordion>
	);
}
