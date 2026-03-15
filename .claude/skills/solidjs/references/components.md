# Component Patterns (Project-Specific)

## LazyModal

Wraps `<dialog>` with `<Show>` — destroys content on close. Use for all modals.

```tsx
<LazyModal controller={(c) => { modalController = c; props.controller(c); }}>
  <ModalContent />
</LazyModal>
```

- Opens via `modalController.open()`, closes via `modalController.close()`
- Content is created on open, destroyed on close (no stale state)
- Uses native `<dialog>` + `showModal()` — renders in browser top-layer

## Dropdown

Uses native Popover API (`popover="auto"`), renders in browser top-layer.

- Immune to `overflow: hidden` and z-index issues
- No z-index on overlays — top-layer elements don't need it

## PageLayout

For simple pages (Header + single content area):

```tsx
<PageLayout title="Settings" headerActions={<button>...</button>}>
  ...content...
</PageLayout>
```

For complex pages (multiple sections, toolbars), use `<Header>` and `content-container` directly.

## Overlay Rules

1. **Modals**: Always use `LazyModal`. Never class-based modal patterns.
2. **Dropdown menus**: Always use the `Dropdown` component.
3. **Custom popovers** (e.g., tag selectors): Use `popover="auto"` with manual positioning.
4. **No z-index on overlays**: Top-layer handles it. Only use z-index for in-page stacking (sticky header `z-10`).
