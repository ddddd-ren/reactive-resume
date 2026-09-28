import { Radio } from "@base-ui/react/radio";
import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group";
import { cn } from "@reactive-resume/utils/style";

function RadioGroup({ className, ...props }: RadioGroupPrimitive.Props) {
	return <RadioGroupPrimitive data-slot="radio-group" className={cn("grid gap-2", className)} {...props} />;
}

/** An 18px circle with a 1.5px border; the chosen option shows an 8px accent dot. */
function RadioGroupItem({ className, ...props }: Radio.Root.Props) {
	return (
		<Radio.Root
			data-slot="radio-group-item"
			className={cn(
				"peer flex size-[18px] shrink-0 items-center justify-center rounded-full border-[1.5px] border-line-2 bg-raised outline-none transition-colors duration-quick data-disabled:cursor-not-allowed data-checked:border-accent data-disabled:opacity-50",
				className,
			)}
			{...props}
		>
			<Radio.Indicator data-slot="radio-group-indicator" className="size-2 rounded-full bg-accent" />
		</Radio.Root>
	);
}

export { RadioGroup, RadioGroupItem };
