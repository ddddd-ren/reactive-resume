import type { VariantProps } from "class-variance-authority";
import { Toggle as TogglePrimitive } from "@base-ui/react/toggle";
import { cva } from "class-variance-authority";
import { cn } from "@reactive-resume/utils/style";

const toggleVariants = cva(
	"group/toggle inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-medium text-ink-2 text-sm transition-colors duration-quick hover:bg-hover hover:text-ink disabled:pointer-events-none disabled:text-ink-3 aria-pressed:bg-sunken aria-pressed:text-ink [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
	{
		variants: {
			variant: {
				default: "bg-transparent",
				outline: "border border-line-2 bg-surface hover:bg-sunken",
			},
			size: {
				default: "h-9 min-w-9 px-2.5",
				sm: "h-7 min-w-7 rounded-sm px-2 text-[13px] [&_svg:not([class*='size-'])]:size-3.5",
				lg: "h-11 min-w-11 rounded-lg px-3 text-base",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	},
);

function Toggle({
	className,
	variant = "default",
	size = "default",
	...props
}: TogglePrimitive.Props & VariantProps<typeof toggleVariants>) {
	return <TogglePrimitive data-slot="toggle" className={cn(toggleVariants({ variant, size, className }))} {...props} />;
}

export { Toggle, toggleVariants };
