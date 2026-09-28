/**
 * Shared look for dropdown menus, context menus and combobox lists: 12px radius, e2, 4px padding,
 * 36px items with an 8px radius. Destructive items go last, after a separator, in danger text.
 */
export const menuPopupClassName =
	"relative z-50 max-h-(--available-height) min-w-[220px] origin-(--transform-origin) overflow-y-auto overflow-x-hidden rounded-xl bg-raised p-1 text-ink shadow-e2 outline-none transition-[opacity,scale,translate] duration-standard ease-enter data-ending-style:-translate-y-1 data-starting-style:-translate-y-1 data-ending-style:scale-[0.98] data-starting-style:scale-[0.98] data-closed:overflow-hidden data-ending-style:opacity-0 data-starting-style:opacity-0 data-instant:transition-none data-ending-style:duration-[calc(var(--d2)*0.7)]";

export const menuItemClassName =
	"relative flex min-h-9 cursor-default select-none items-center gap-2.5 rounded-md px-2.5 text-ink text-sm outline-hidden data-disabled:pointer-events-none data-highlighted:bg-hover data-inset:ps-9 data-disabled:text-ink-3 data-[variant=destructive]:text-danger-text [&_[data-slot=icon]]:text-ink-2 data-[variant=destructive]:[&_[data-slot=icon]]:text-danger-text [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0";

export const menuLabelClassName =
	"px-2.5 pt-2 pb-1 font-semibold text-[12px] text-ink-3 uppercase tracking-[0.02em] data-inset:ps-9";

export const menuSeparatorClassName = "-mx-1 my-1 h-px bg-line";

export const menuShortcutClassName = "ms-auto font-mono text-ink-3 text-xs";
