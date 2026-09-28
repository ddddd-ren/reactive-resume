---
version: 2.0-alpha
name: Reactive Resume · Desk & Paper
description: A quiet, warm desk around a bright page. The resume is the only white, detailed object on screen; one moss-green accent marks the next action. Light and dark themes, with the page always white.
colors:
  light:
    bg: "#F8F7F3"
    surface: "#FEFDFC"
    raised: "#FFFFFF"
    sunken: "#F0EFEB"
    line: "#DFDEDA"
    line-2: "#C5C4BE"
    ink: "#1C1B15"
    ink-2: "#4F4D47"
    ink-3: "#6D6C65"
    accent: "#337344"
    accent-hover: "#206133"
    on-accent: "#F7FEF8"
    accent-soft: "#DCF2DF"
    accent-text: "#195C2E"
    danger: "#BA3630"
    danger-soft: "#FFE7E4"
    danger-text: "#A92321"
    warn: "#D29922"
    warn-soft: "#FCEDCD"
    warn-text: "#81520A"
    info-soft: "#E0F1FF"
    info-text: "#1D5B92"
  dark:
    bg: "#100F0C"
    surface: "#171613"
    raised: "#1F1E1A"
    sunken: "#0B0A08"
    line: "#2C2B27"
    line-2: "#494843"
    ink: "#EFEEEB"
    ink-2: "#BCBAB5"
    ink-3: "#979590"
    accent: "#6FC082"
    accent-hover: "#83D494"
    on-accent: "#07150A"
    accent-soft: "#1A3520"
    accent-text: "#8FD89E"
    danger: "#D9544B"
    danger-soft: "#47211D"
    danger-text: "#FDA297"
    warn: "#E4B750"
    warn-soft: "#3E2D10"
    warn-text: "#EFCC83"
    info-soft: "#192F46"
    info-text: "#9DC9F7"
  paper: "#FFFFFF"
  stages:
    saved: "#908C7F"
    applied: "#5590CC"
    screening: "#00A0A6"
    interview: "#AF8433"
    offer: "#579F68"
    closed: "#C67067"
typography:
  display: { fontFamily: Newsreader, fontSize: 44px, lineHeight: 48px, fontWeight: 500, letterSpacing: -0.01em }
  title: { fontFamily: Newsreader, fontSize: 30px, lineHeight: 36px, fontWeight: 500 }
  sheet-title: { fontFamily: Newsreader, fontSize: 22px, lineHeight: 28px, fontWeight: 500 }
  heading: { fontFamily: Hanken Grotesk, fontSize: 20px, lineHeight: 28px, fontWeight: 600 }
  section-heading: { fontFamily: Hanken Grotesk, fontSize: 17px, lineHeight: 24px, fontWeight: 600 }
  label: { fontFamily: Hanken Grotesk, fontSize: 15px, lineHeight: 22px, fontWeight: 600 }
  body: { fontFamily: Hanken Grotesk, fontSize: 15px, lineHeight: 24px, fontWeight: 400 }
  ui: { fontFamily: Hanken Grotesk, fontSize: 14px, lineHeight: 20px, fontWeight: 400 }
  small: { fontFamily: Hanken Grotesk, fontSize: 13px, lineHeight: 18px, fontWeight: 400 }
  caption: { fontFamily: Hanken Grotesk, fontSize: 12px, lineHeight: 16px, fontWeight: 500 }
  mono: { fontFamily: JetBrains Mono, fontSize: 12px, lineHeight: 16px, fontWeight: 500 }
rounded:
  sm: 6px
  md: 8px
  lg: 10px
  xl: 12px
  2xl: 16px
  3xl: 18px
  full: 999px
spacing: [4, 8, 12, 16, 24, 32, 48, 64]
motion:
  quick: 120ms
  standard: 200ms
  emphasized: 320ms
  easing: cubic-bezier(0.2, 0.8, 0.2, 1)
  exit: 70% of the entering duration
---

## Overview

Reactive Resume's interface is a quiet, warm desk around a bright page. The resume or letter page is the only white, detailed object on screen; everything around it uses low-contrast warm neutrals, thin rules instead of boxes, and a single moss-green accent.

The full specification lives in the redesign handoff (`design_handoff_reactive_resume_redesign/README.md`, kept out of version control) and the milestone plan in `REDESIGN_PLAN.md`. This document records the rules the code follows.

Five principles decide most questions:

1. **The page is the interface.** The live page is on screen in every editor mode. Clicking a line on the page opens its field.
2. **One obvious next step.** Each view has at most one accent-filled button. Accent means "do this next" or "this is working" and is never decoration.
3. **Nothing is lost.** Everything autosaves and can be undone. Confirmation dialogs are only for irreversible actions.
4. **Detail on demand.** Defaults cover most people; advanced controls sit one disclosure deeper.
5. **AI proposes, you decide.** The assistant never writes directly; every change is a reviewable proposal.

Resume templates keep their Pokémon names (Azurill, Onyx, Glalie…), their own fonts and their own colors. None of the rules below apply inside a template.

## Tokens

Tokens are CSS custom properties in `packages/ui/src/styles/globals.css`, light on `:root` and dark on `.dark`. The source of truth is oklch; the hex values above are sRGB approximations. Tailwind exposes each one under the same name: `bg-bg`, `bg-surface`, `bg-raised`, `bg-sunken`, `border-line`, `border-line-2`, `text-ink`, `text-ink-2`, `text-ink-3`, `bg-accent`, `text-on-accent`, `bg-accent-soft`, `text-accent-text`, `bg-danger`, `bg-danger-soft`, `text-danger-text`, `bg-warn`, `bg-warn-soft`, `text-warn-text`, `bg-info-soft`, `text-info-text`, `bg-hover`, `bg-press`, `bg-scrim`, `bg-paper` and `bg-stage-*`.

- **Surfaces:** `bg` is the app desk, `surface` holds panels and cards, `raised` holds menus, dialogs and inputs, `sunken` is for wells, tracks and the page canvas.
- **Text:** `ink` for primary text, `ink-2` for secondary text, `ink-3` for meta and placeholders. `ink-3` is the lightest color allowed for text (about 4.9:1).
- **Signals:** `danger` for errors and irreversible actions, `warn` for check issues and things to review, `info` for neutral guidance and the assistant's questions. Success uses `accent-soft`.
- **Overlays:** `hover` and `press` are translucent, so they work on any surface.
- **Paper:** `--paper` is white in both themes. Pages never invert.
- **Stages:** application stage colors share lightness and chroma. They appear only as 8px dots or 6px stepper bars, always next to the stage name.

The previous shadcn-style names (`background`, `foreground`, `primary`, `muted`, `border`, `input`, `ring`, `destructive`, `card`, `popover`, `sidebar-*`) still resolve to these tokens so screens that haven't been rebuilt stay legible. Don't use them in new code; they're removed once every screen has moved.

## Typography

- **Newsreader** (display serif, optical sizes 6–72) is only for page titles, dialog and sheet titles, empty-state headlines and large stat numerals. Use `font-display`.
- **Hanken Grotesk** handles everything functional. It's the default `font-sans`.
- **JetBrains Mono** is for shortcuts, URLs and slugs, file names, counts and section eyebrows. Use `font-mono`.
- Field labels are 12px, medium weight, `ink-2`, above the control with a 5–6px gap. Uppercase group eyebrows are 12px semibold `ink-3` with 0.02em tracking.
- Inputs render at 16px on touch devices so iOS doesn't zoom.
- All three fonts are self-hosted through `@fontsource-variable`.

## Iconography

App icons are **Material Symbols Rounded** at weight 300, rendered by `Icon` from `@reactive-resume/ui/components/icon`. The font is a self-hosted subset that contains only the glyphs listed in `packages/ui/src/icons/names.ts`:

1. Add the name to that list (TypeScript then accepts it in `<Icon name="…" />`).
2. Run `pnpm icons:build`. The script checks every name against the published codepoints, downloads the subset and updates the manifest. A unit test fails if the manifest and the list disagree.

Rules:

- 20px on desktop, 24px on touch. Outline by default; `filled` only for the selected navigation item.
- Icons always sit beside a text label, except back, close, more, undo/redo, history, assistant and zoom. Those use `IconButton`, which requires a label and shows it in a tooltip with the shortcut.
- `Icon` is `aria-hidden` and `translate="no"`, so the ligature text never becomes an accessible name.
- Directional icons (arrows, chevrons, undo, redo) mirror in right-to-left layouts automatically.
- Icons inside resumes are a separate system: Phosphor, because resume data stores Phosphor names and the PDF renderer draws them.

## Space, shape and elevation

- **Spacing** follows a 4pt scale: 4, 8, 12, 16, 24, 32, 48, 64. Cards use 16px padding, panels 16–24px, the mobile margin is 16px and the desktop page margin 32–40px.
- **Radius:** `rounded-sm` 6px for chips and small buttons, `rounded-md` 8px for controls and inputs, `rounded-lg` 10px for list items, `rounded-xl` 12px for cards and menus, `rounded-2xl` 16px for dialogs, `rounded-3xl` 18px for mobile sheets, `rounded-full` for pills.
- **Elevation:** `shadow-e1` for cards, `shadow-e2` for menus, popovers and hover-lifted cards, `shadow-e3` for dialogs, sheets and toasts, `shadow-page` for the resume page on the canvas.
- **Control heights:** 28px small, 36px default, 44px touch. Icon buttons are 32–36px on desktop and 44px on touch.
- **Layout constants** are CSS variables: `--editor-bar` 56px, `--editor-panel` 400px, `--app-sidebar` 240px, `--sheet-share` 440px, `--sheet-detail` 480px, `--assistant` 400px.

## Motion

| Token | Duration | Use |
|---|---|---|
| `duration-quick` | 120ms | hover, press, toggle, checkbox, focus |
| `duration-standard` | 200ms | menus, popovers, expand and collapse, mode switch, dialogs |
| `duration-emphasized` | 320ms | side and bottom sheets, toasts, the assistant column |

- Everything that enters uses `ease-enter` (`cubic-bezier(0.2, 0.8, 0.2, 1)`). Exits run at 70% of the duration.
- Motion explains where something went. Nothing loops, bounces or plays on load; loading placeholders stay still. Reflowing the page after an edit is never animated.
- With `prefers-reduced-motion`, the duration tokens become 1ms and every CSS transition collapses; spinners keep turning because they're status.
- Motion (`motion/react`) animations run under `MotionConfig reducedMotion="user"`; mirror the tokens in `apps/web/src/libs/motion.ts` when one needs them.

## Components

Generic primitives live in `packages/ui/src/components` and wrap Base UI (and cmdk for the command bar). Feature-specific UI lives with its feature in `apps/web`.

- **Buttons:** `primary` (accent fill, the one filled button per view), `secondary` (bordered surface), `ghost`, `danger`, `link`. Sizes `sm` 28, `default` 36, `lg` 44 (touch), plus icon sizes. `loading` shows a spinner, sets `aria-busy` and blocks activation; pair it with a present-participle label ("Preparing…").
- **Inputs:** 36px (44px on touch), `raised` background, `line-2` border. Focus is an accent border plus a 3px `accent-soft` ring. Errors appear after the first blur, in `danger-text`, with an icon and words that say how to fix it.
- **Switches:** prefer `SwitchRow`, where the whole row is the switch. Checkboxes are 18px with a 5px radius; radios are 18px with an 8px accent dot.
- **Segmented controls:** `SegmentedControl` for 2–4 options (a radio group); `Tabs` with the default variant when segments switch panels, `Tabs variant="line"` for underline tabs.
- **Menus** (dropdown, context, combobox lists): 220px minimum width, 12px radius, 36px items, destructive items last after a separator.
- **Layers, lightest to heaviest:** menu, popover, sheet, dialog. Sheets are for tasks beside the page and become bottom sheets on mobile. Dialogs are for decisions; destructive confirmations use `AlertDialog` and the cancel label says what is kept.
- **Toasts:** one at a time, bottom center, ink on the desk color, 6 seconds, with an optional underlined Undo action.
- **Alerts:** `info`, `success`, `warn` and `error`; only errors are announced (`role="alert"`).
- **Empty states:** a Newsreader 22px headline, a 14px body up to 300px wide, then a primary and a secondary action.

## Accessibility

WCAG 2.2 AA is the floor.

- Every interactive element shows a 2px accent focus ring with a 2px gap on `:focus-visible`. Never remove it; inputs replace it with their accent border and soft ring.
- Pointer targets are at least 24px and touch targets at least 44px. Every drag has a keyboard and a menu alternative.
- Color is never the only signal: stages, issues and states always pair color with text and an icon.
- Sheets and dialogs trap focus; Esc closes the top layer and returns focus to its trigger. Save state and toasts announce through a polite live region.

## Themes

The theme cookie holds `light`, `dark` or `system` (the default); `system` follows `prefers-color-scheme` live. `ThemeProvider` owns the `.dark` class on `<html>`, and an inline script in `index.html` sets it before first paint. Resumes and letters always render on white paper, whatever the theme.

## Internationalization

- Every user-facing string goes through Lingui (`t`, `msg`, `<Trans>`); catalogs are PO files in `apps/web/locales`. Primitives in `packages/ui` can't use Lingui, so they take labels as props (for example `closeLabel`).
- 55 interface languages, including right-to-left ones. `<html dir>` follows the locale and `DirectionProvider` passes it to Base UI.
- Use logical properties (`ps`, `pe`, `ms`, `me`, `inset-s`, `inset-e`) instead of physical ones.
- Translations run 30–50% longer than English; avoid fixed widths on text.

## Do and don't

- **Do** keep one accent-filled button per view, and keep accent for next actions and working states.
- **Do** use `ink-3` as the lightest text color, and pair every color signal with text.
- **Do** build states in full: empty, loading (placeholders at their real size), error (why and what to do) and success.
- **Don't** hard-code colors, including Tailwind palette classes such as `amber-600`; use the semantic tokens.
- **Don't** use Newsreader for anything smaller than a sheet title.
- **Don't** ask for confirmation for something that can be undone; use an undo toast instead.
- **Don't** skip `data-slot` on primitives; tests and styles rely on it.
