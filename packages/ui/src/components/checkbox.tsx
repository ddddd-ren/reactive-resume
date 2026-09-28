import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";
import { Icon } from "@reactive-resume/ui/components/icon";
import { cn } from "@reactive-resume/utils/style";

function Checkbox({ className, ...props }: CheckboxPrimitive.Root.Props) {
	return (
		<CheckboxPrimitive.Root
			data-slot="checkbox"
			className={cn(
				"peer touch-target relative flex size-[18px] shrink-0 items-center justify-center rounded-[5px] border-[1.5px] border-line-2 bg-raised outline-none transition-[background-color,border-color] duration-quick aria-invalid:border-danger data-disabled:cursor-not-allowed data-checked:border-accent data-indeterminate:border-accent data-checked:bg-accent data-indeterminate:bg-accent data-checked:text-on-accent data-indeterminate:text-on-accent data-disabled:opacity-50",
				className,
			)}
			{...props}
		>
			<CheckboxPrimitive.Indicator
				data-slot="checkbox-indicator"
				className="flex items-center justify-center text-current transition-opacity duration-quick data-ending-style:opacity-0 data-starting-style:opacity-0"
			>
				<Icon name={props.indeterminate ? "remove" : "check"} size={16} />
			</CheckboxPrimitive.Indicator>
		</CheckboxPrimitive.Root>
	);
}

export { Checkbox };
