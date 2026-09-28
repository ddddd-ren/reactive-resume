import type * as React from "react";
import { Command as CommandPrimitive } from "cmdk";
import { Icon } from "@reactive-resume/ui/components/icon";
import { cn } from "@reactive-resume/utils/style";

function Command({ className, ...props }: React.ComponentProps<typeof CommandPrimitive>) {
	return (
		<CommandPrimitive
			data-slot="command"
			className={cn("flex size-full flex-col overflow-hidden bg-raised text-ink", className)}
			{...props}
		/>
	);
}

type CommandInputProps = React.ComponentProps<typeof CommandPrimitive.Input> & {
	/** Shown at the end of the search row, e.g. an "esc" key hint. */
	hint?: React.ReactNode;
};

/** The 52px search row of the command bar. */
function CommandInput({ className, hint, ...props }: CommandInputProps) {
	return (
		<div
			data-slot="command-input-wrapper"
			className="flex h-[52px] shrink-0 items-center gap-3 border-line border-b px-4"
		>
			<Icon name="search" className="text-ink-3" />
			<CommandPrimitive.Input
				data-slot="command-input"
				className={cn(
					"h-full w-full bg-transparent text-[15px] text-ink outline-hidden placeholder:text-ink-3 focus-visible:outline-none disabled:cursor-not-allowed",
					className,
				)}
				{...props}
			/>
			{hint}
		</div>
	);
}

function CommandList({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.List>) {
	return (
		<CommandPrimitive.List
			data-slot="command-list"
			className={cn(
				"no-scrollbar max-h-[min(420px,60svh)] scroll-py-1.5 overflow-y-auto overflow-x-hidden p-1.5 outline-none",
				className,
			)}
			{...props}
		/>
	);
}

function CommandEmpty({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Empty>) {
	return (
		<CommandPrimitive.Empty
			data-slot="command-empty"
			className={cn("py-8 text-center text-ink-3 text-sm", className)}
			{...props}
		/>
	);
}

function CommandGroup({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Group>) {
	return (
		<CommandPrimitive.Group
			data-slot="command-group"
			className={cn(
				"overflow-hidden text-ink **:[[cmdk-group-heading]]:px-3 **:[[cmdk-group-heading]]:pt-2.5 **:[[cmdk-group-heading]]:pb-1 **:[[cmdk-group-heading]]:font-semibold **:[[cmdk-group-heading]]:text-ink-3 **:[[cmdk-group-heading]]:text-xs",
				className,
			)}
			{...props}
		/>
	);
}

function CommandSeparator({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Separator>) {
	return (
		<CommandPrimitive.Separator
			data-slot="command-separator"
			className={cn("-mx-1.5 my-1.5 h-px bg-line", className)}
			{...props}
		/>
	);
}

/** A 40px row; the selected row is sunken and shows a ↵ hint unless the row has its own shortcut. */
function CommandItem({ className, children, ...props }: React.ComponentProps<typeof CommandPrimitive.Item>) {
	return (
		<CommandPrimitive.Item
			data-slot="command-item"
			className={cn(
				"group/command-item relative flex h-10 cursor-default select-none items-center gap-3 rounded-md px-3 text-ink text-sm outline-hidden data-[disabled=true]:pointer-events-none data-selected:bg-sunken data-[disabled=true]:text-ink-3 [&_[data-slot=icon]]:text-ink-2 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
				className,
			)}
			{...props}
		>
			{children}
			<Icon
				name="check"
				className="ms-auto hidden text-accent-text! group-data-[checked=true]/command-item:inline-block"
			/>
			<span
				aria-hidden="true"
				className="ms-auto hidden font-mono text-ink-3 text-xs group-has-data-[slot=command-shortcut]/command-item:hidden group-data-selected/command-item:inline group-data-[checked=true]/command-item:hidden"
			>
				↵
			</span>
		</CommandPrimitive.Item>
	);
}

function CommandShortcut({ className, ...props }: React.ComponentProps<"span">) {
	return (
		<span data-slot="command-shortcut" className={cn("ms-auto font-mono text-ink-3 text-xs", className)} {...props} />
	);
}

export {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	type CommandInputProps,
	CommandItem,
	CommandList,
	CommandSeparator,
	CommandShortcut,
};
