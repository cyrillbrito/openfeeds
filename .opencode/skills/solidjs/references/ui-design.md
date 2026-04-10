# UI Design Language

## Philosophy

**Mobile-first.** Design for small screens, then enhance for larger viewports.

## Background Colors

DaisyUI semantic colors:

| Color      | Usage                                                                      |
| ---------- | -------------------------------------------------------------------------- |
| `base-100` | Default app background (set globally on `<html>`)                          |
| `base-200` | Elevated surfaces: dropdowns, tooltips, hover states, info boxes in modals |
| `base-300` | Borders, dividers                                                          |

Components only need explicit `bg-base-100` when they must prevent content showing through (sticky headers, mobile sidebar overlay).

## Content Layout

The frame layout provides no padding — each page owns its content spacing.

### `content-container` utility

All page content, headers, and toolbars use `content-container` (defined in `app.css`):

- Mobile: 16px margin (`mx-4`)
- `sm` (640px): 24px margin (`mx-6`)
- `md` (768px+): auto-centered `max-w-2xl` (672px)
- `xl` (1280px+): widens to `max-w-3xl` (768px)

**Standard page container:** `content-container py-3 sm:py-6`

**List section below toolbar:** `content-container pb-3 sm:pb-6`

## Spacing

- Tighter padding for content with visual bulk (images, thumbnails)
- More breathing room for text-only content

## Interactive States

- Hover: `hover:bg-base-200` or `hover:bg-base-200/50`
- Active/selected: semantic colors (`text-primary`, `text-warning`, etc.)

## Responsive Breakpoints

Mobile-first (Tailwind defaults):

- Default: mobile
- `sm:` (640px): small tablets
- `md:` (768px): tablets
- `lg:` (1024px): desktop (sidebar always-visible)

## Overlay & Surface Elevation

DaisyUI only provides three base tones (`base-100`/`200`/`300`), which is not enough granularity to differentiate all the surfaces in the app — especially in dark mode where `base-100` and floating panels blend together.

**Current approach:** Floating popovers and modals use `bg-base-100` + a backdrop scrim (`bg-black/20`) + `shadow-2xl` to create visual separation. This works well in both themes.

**Rule:** Any large floating panel (popover, modal, command palette) that overlays the main content **must** include a backdrop scrim behind it. Without it, the panel is indistinguishable from the background in dark mode.

**Possible exploration:** Using alpha-based surface tokens (e.g. `base-100/95`, `base-200/80`) or intermediate tones (`base-50`, `base-150`) to create subtle differentiation between:

- Content area background
- Sidebar / toolbar background
- Inline panels (e.g. AI right drawer — pushes content, not floating)
- Floating panels (popovers, modals — overlay content)

This could let each surface level feel distinct without relying solely on borders and shadows. Worth revisiting when customizing the DaisyUI theme or switching to custom color tokens.
