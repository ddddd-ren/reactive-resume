import type * as React from "react";
import { cn } from "@reactive-resume/utils/style";

/** Field labels sit above their control: 12px, medium weight, secondary ink. */
function Label({ className, htmlFor, ...props }: React.ComponentProps<"label">) {
	return (
		// biome-ignore lint/a11y/noLabelWithoutControl: label is a generic component
		<label
			htmlFor={htmlFor}
			data-slot="label"
			className={cn(
				"flex select-none items-center gap-2 font-medium text-ink-2 text-xs leading-4 peer-disabled:cursor-not-allowed peer-disabled:text-ink-3 group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:text-ink-3",
				className,
			)}
			{...props}
		/>
	);
}

export { Label };
