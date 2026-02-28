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

## Content Layout

The frame layout provides no padding — each page owns its content spacing.

### `content-container` utility

All page content, headers, and toolbars use the `content-container` CSS utility class (defined in `app.css`). It handles horizontal margin, max-width, and centering in one place:

- Mobile: 16px margin from viewport edge (`mx-4`)
- `sm` (640px): 24px margin (`mx-6`)
- `md` (768px+): auto-centered (`mx-auto`) — `max-w-2xl` (672px) is narrower than the viewport
- `xl` (1280px+): widens to `max-w-3xl` (768px)

Content inside the container fills its full width — important for media like YouTube iframes that need maximum width. Vertical padding is added per-use since it varies by page.

**Standard page container:**

```
content-container py-3 sm:py-6
```

**List section below a toolbar** (toolbar already provides top spacing):

```
content-container pb-3 sm:pb-6
```

### `PageLayout` component

For simple pages (Header + single content area), use `PageLayout` instead of manually composing Header + container:

```tsx
<PageLayout title="Settings" headerActions={<button>...</button>}>
  ...content...
</PageLayout>
```

For complex pages (multiple container sections, conditional rendering, toolbars between sections), use `<Header>` and `content-container` directly.

## Spacing

- Tighter padding for content with visual bulk (images, thumbnails)
- More breathing room for text-only content

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
