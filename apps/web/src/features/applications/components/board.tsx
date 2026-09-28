import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import type { ApplicationStatus } from "@reactive-resume/schema/applications/data";
import type { Application } from "../types";
import {
	DndContext,
	DragOverlay,
	PointerSensor,
	pointerWithin,
	useDraggable,
	useDroppable,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import { t } from "@lingui/core/macro";
import { useState } from "react";
import { cn } from "@reactive-resume/utils/style";
import { getStageColor, getStageLabel, PIPELINE } from "../stages";
import { useApplicationActions } from "../use-application-actions";
import { ApplicationCard } from "./application-card";

type BoardProps = {
	applications: Application[];
	showClosed: boolean;
	onOpen: (application: Application) => void;
};

/**
 * A column per stage (Closed only when shown). Dropping a card on a column moves it, with the same toast as the
 * other ways to change stage; each card's menu has Move to… for the keyboard. Desktop and tablet only.
 */
export function ApplicationBoard({ applications, showClosed, onOpen }: BoardProps) {
	const { moveTo } = useApplicationActions();
	const [activeId, setActiveId] = useState<string | null>(null);

	// A small activation distance so a click still opens the detail sheet instead of starting a drag.
	const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
	const stages: ApplicationStatus[] = showClosed ? [...PIPELINE, "closed"] : [...PIPELINE];

	const byStage = new Map<ApplicationStatus, Application[]>(stages.map((stage) => [stage, []]));
	for (const application of applications) byStage.get(application.status)?.push(application);

	const active = activeId ? applications.find((application) => application.id === activeId) : null;

	const onDragStart = (event: DragStartEvent) => setActiveId(String(event.active.id));

	const onDragEnd = (event: DragEndEvent) => {
		setActiveId(null);
		const target = event.over?.id as ApplicationStatus | undefined;
		const application = applications.find((item) => item.id === event.active.id);
		if (!target || !application || application.status === target) return;
		moveTo(application, target);
	};

	return (
		<DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={onDragStart} onDragEnd={onDragEnd}>
			<div className="flex h-full min-h-0 gap-3 overflow-x-auto pb-4">
				{stages.map((stage) => (
					<Column key={stage} stage={stage} applications={byStage.get(stage) ?? []} onOpen={onOpen} />
				))}
			</div>

			{/* No drop animation: the optimistic move lands after an await, so the default would fly the card back. */}
			<DragOverlay dropAnimation={null}>
				{active ? <ApplicationCard application={active} dragging /> : null}
			</DragOverlay>
		</DndContext>
	);
}

// Cap the cards rendered per column so a stage with hundreds of applications doesn't mount hundreds of draggable
// nodes at once; the rest show in batches.
const COLUMN_PAGE_SIZE = 50;

type ColumnProps = {
	stage: ApplicationStatus;
	applications: Application[];
	onOpen: (application: Application) => void;
};

function Column({ stage, applications, onOpen }: ColumnProps) {
	const { setNodeRef, isOver } = useDroppable({ id: stage });
	const [visible, setVisible] = useState(COLUMN_PAGE_SIZE);
	const shown = applications.slice(0, visible);
	const remaining = applications.length - shown.length;

	return (
		<section
			aria-label={getStageLabel(stage)}
			className={cn(
				"flex w-[272px] shrink-0 flex-col rounded-xl border bg-sunken transition-colors duration-quick",
				isOver ? "border-accent bg-accent-soft" : "border-transparent",
			)}
		>
			<h3 className="flex items-center gap-2 px-3 py-2.5 font-semibold text-sm">
				<span aria-hidden="true" className="size-2 rounded-full" style={{ background: getStageColor(stage) }} />
				{getStageLabel(stage)}
				<span className="font-mono font-normal text-ink-3 text-xs">{applications.length}</span>
			</h3>
			<div ref={setNodeRef} className="flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
				{shown.map((application) => (
					<DraggableCard key={application.id} application={application} onOpen={() => onOpen(application)} />
				))}
				{remaining > 0 && (
					<button
						type="button"
						onClick={() => setVisible((count) => count + COLUMN_PAGE_SIZE)}
						className="rounded-lg border border-line border-dashed py-2 text-ink-3 text-xs hover:bg-hover"
					>
						{t`Show ${Math.min(remaining, COLUMN_PAGE_SIZE)} more`}
					</button>
				)}
			</div>
		</section>
	);
}

function DraggableCard({ application, onOpen }: { application: Application; onOpen: () => void }) {
	const { setNodeRef, attributes, listeners, isDragging } = useDraggable({ id: application.id });

	return (
		<div ref={setNodeRef} {...attributes} {...listeners} className={cn(isDragging && "opacity-40")}>
			<ApplicationCard application={application} onClick={onOpen} withMenu />
		</div>
	);
}
