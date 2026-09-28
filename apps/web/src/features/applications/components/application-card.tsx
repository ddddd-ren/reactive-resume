import type { Application } from "../types";
import { useLingui } from "@lingui/react";
import { Icon } from "@reactive-resume/ui/components/icon";
import { cn } from "@reactive-resume/utils/style";
import { describeNextStep, getNextStep } from "../next-step";
import { ApplicationActionsMenu } from "./application-actions-menu";

type ApplicationCardProps = {
	application: Application;
	onClick?: () => void;
	/** The ⋯ menu (Move to…, Close…, Delete); cards dragged in the overlay go without. */
	withMenu?: boolean;
	dragging?: boolean;
};

/** A board card: the company's initial, role and company, and the next step (warn when it's overdue). */
export function ApplicationCard({ application, onClick, withMenu = false, dragging = false }: ApplicationCardProps) {
	const { i18n } = useLingui();
	const next = describeNextStep(getNextStep(application), application, i18n.locale);

	return (
		<div
			className={cn(
				"group relative grid gap-2 rounded-[10px] border border-line bg-surface p-3 shadow-e1 transition-colors duration-quick hover:border-line-2",
				dragging && "rotate-1 shadow-e3",
			)}
		>
			<div className="flex items-start gap-2.5">
				<span
					aria-hidden="true"
					className="grid size-7 shrink-0 place-items-center rounded-[7px] bg-sunken font-semibold text-ink-2 text-xs"
				>
					{application.company.slice(0, 1).toUpperCase()}
				</span>
				<button
					type="button"
					onClick={onClick}
					className="grid min-w-0 flex-1 text-start after:absolute after:inset-0 after:rounded-[10px]"
				>
					<span className="truncate font-semibold text-sm">{application.role}</span>
					<span className="truncate text-ink-3 text-xs">{application.company}</span>
				</button>
				{withMenu && <ApplicationActionsMenu application={application} className="relative z-10 -me-1.5 -mt-1.5" />}
			</div>
			<span
				className={cn(
					"flex items-center gap-1.5 text-xs",
					next.tone === "warn" ? "text-warn-text" : next.tone === "muted" ? "text-ink-3" : "text-ink-2",
				)}
			>
				<Icon name={next.icon} size={15} className="shrink-0" />
				<span className="truncate">{next.title}</span>
			</span>
		</div>
	);
}
