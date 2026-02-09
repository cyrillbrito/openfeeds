# UI Design Language

Design decisions and conventions for OpenFeeds UI.

## Philosophy

**Mobile-first.** Design for small screens, then enhance for larger viewports.

## Background Colors

Uses DaisyUI semantic colors with specific purpose:

| Color      | Usage                                                                      |
| ---------- | -------------------------------------------------------------------------- |
| `base-100` | Default app background (set globally on `<html>`)                          |
| `base-200` | Elevated surfaces: dropdowns, tooltips, hover states, info boxes in modals |
| `base-300` | Borders, dividers                                                          |

The global background is `base-100`. Components only need explicit `bg-base-100` when they must prevent content showing through (e.g., sticky headers, sidebars on mobile overlay).

## Content Width

- Main content area: `max-w-2xl` constraint for readability on large screens
- Full-width on mobile, centered with padding on desktop
- Pattern: `mx-auto w-full max-w-2xl px-2 py-3 sm:p-6`
- Article cards, feed lists, and management pages respect this constraint

## Spacing

- Tighter padding for content with visual bulk (images, thumbnails)
- More breathing room for text-only content
- Responsive: smaller spacing on mobile (`py-3`), larger on desktop (`md:py-4`)

## Interactive States

- Hover: `hover:bg-base-200` or `hover:bg-base-200/50` for subtle feedback
- Active/selected states use semantic colors (`text-primary`, `text-warning`, etc.)

## Responsive Breakpoints

Following Tailwind defaults, mobile-first:

- Default: mobile
- `sm:` (640px): small tablets
- `md:` (768px): tablets
- `lg:` (1024px): desktop (sidebar becomes always-visible)

## Overlays & Layering

All overlay UI must render in the browser's **top-layer** to avoid z-index wars and `overflow: hidden` clipping. Never use CSS-only positioning (e.g., `position: absolute` inside a parent) for overlay content.

### Overlay Types

| Type                 | Component         | Mechanism                                                     |
| -------------------- | ----------------- | ------------------------------------------------------------- |
| **Modal/Dialog**     | `LazyModal`       | Native `<dialog>` + `showModal()` — renders in top-layer      |
| **Dropdown menu**    | `Dropdown`        | Native Popover API (`popover="auto"`) — renders in top-layer  |
| **Popover (custom)** | Inline            | Native Popover API (`popover="auto"`) with manual positioning |
| **Toast**            | `ToastProvider`   | DaisyUI `toast` (fixed position)                              |
| **Tooltip**          | DaisyUI `tooltip` | CSS-only (acceptable — no overflow issues)                    |

### Rules

1. **Modals**: Always use `LazyModal`. Never use `<div class="modal modal-open">` or other class-based modal patterns.
2. **Dropdown menus**: Always use the `Dropdown` component. It uses the Popover API internally.
3. **Custom popovers** (e.g., tag selectors): Use `popover="auto"` with `showPopover()`/`hidePopover()` and manual `getBoundingClientRect()` positioning.
4. **No z-index on overlays**: Top-layer elements don't need z-index. Only use z-index for in-page stacking (e.g., sticky header `z-10`).
5. **No `overflow-hidden` on containers with overlays**: While the Popover API makes this safe, avoid `overflow-hidden` on containers where child elements might need to overflow, as a defensive measure.
