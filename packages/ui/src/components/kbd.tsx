import { cn } from "@reactive-resume/utils/style";

function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
	return (
		<kbd
			data-slot="kbd"
			className={cn(
				"pointer-events-none inline-flex h-5 w-fit min-w-5 select-none items-center justify-center gap-1 rounded-sm bg-sunken in-data-[slot=tooltip-content]:bg-bg/15 px-1 font-medium font-mono in-data-[slot=tooltip-content]:text-bg text-ink-3 text-xs [&_svg:not([class*='size-'])]:size-3",
				className,
			)}
			{...props}
		/>
	);
}

export { Kbd };
