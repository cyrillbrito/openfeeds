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
