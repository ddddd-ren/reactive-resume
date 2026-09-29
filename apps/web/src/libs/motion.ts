// Motion (JS) mirrors of the CSS motion tokens in packages/ui/src/styles/globals.css (--d1/--d2/--d3, --ease,
// --ease-in-out-strong). Durations are in seconds, Motion's unit; multiply by 1000 for APIs that take ms (dnd-kit).

/** --ease / `ease-enter`: everything entering, exiting or changing state. */
export const EASE = [0.2, 0.8, 0.2, 1] as const;
/** --ease-in-out-strong / `ease-in-out-strong`: things moving across the screen (indicators, reorder, settling). */
export const EASE_MOVE = [0.77, 0, 0.175, 1] as const;
/** --d1 / `duration-quick`: hover, press, toggle, checkbox, focus ring. */
export const D1 = 0.12;
/** --d2 / `duration-standard`: menus, popovers, expand/collapse, content swaps, dialogs. */
export const D2 = 0.2;
/** --d3 / `duration-emphasized`: side and bottom sheets, toasts, the assistant. */
export const D3 = 0.32;
/** Exits run at 70% of the enter duration, e.g. `D2 * EXIT`. */
export const EXIT = 0.7;

/** --ease-out-strong. Landing page only (features/homepage/site-footer.tsx); app code uses EASE. */
export const EASE_OUT_STRONG = [0.23, 1, 0.32, 1] as const;
