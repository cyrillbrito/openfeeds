---
name: solidjs
description: "SolidJS patterns and anti-patterns for this codebase. Use when writing UI components or debugging reactivity. Do not use for server-side code or domain logic."
user-invocable: false
---

# SolidJS Skill

This is a SolidJS codebase. NOT React. Component bodies run once, only signal reads in JSX are reactive, there is no virtual DOM or re-rendering.

## Critical Rules

### 1. Never destructure props

Destructuring breaks reactivity. Props are getter-backed — accessing `props.x` inside JSX tracks the dependency. Destructuring snapshots the value at call time.

```tsx
// WRONG — loses reactivity
function Card({ title, count }) {
  return <div>{title}: {count}</div>;
}

// CORRECT
function Card(props) {
  return <div>{props.title}: {props.count}</div>;
}

// For defaults, use mergeProps:
const merged = mergeProps({ count: 0 }, props);

// For splitting, use splitProps:
const [local, rest] = splitProps(props, ['title', 'count']);
```

### 2. Use `<Show>`, not `&&`

`{condition && <X/>}` does not properly unmount/remount in Solid.

```tsx
// WRONG
{isOpen() && <Modal />}

// CORRECT
<Show when={isOpen()}>
  <Modal />
</Show>

// With fallback and type narrowing
<Show when={user()} fallback={<Login />}>
  {(u) => <Profile user={u()} />}
</Show>
```

### 3. Use `<For>`, not `.map()`

`.map()` recreates all DOM nodes on every change. `<For>` tracks items by reference.

```tsx
// WRONG
{items().map(item => <Card item={item} />)}

// CORRECT
<For each={items()}>
  {(item, index) => <div>{index()}: {item.name}</div>}
</For>
```

Note: `index` is a signal (call as `index()`), `item` is the raw value.

### 4. Use `<Switch>`/`<Match>` for multiple conditions

```tsx
<Switch fallback={<Default />}>
  <Match when={loading()}>Loading...</Match>
  <Match when={error()}>Error: {error().message}</Match>
  <Match when={data()}>
    {(d) => <Content data={d()} />}
  </Match>
</Switch>
```

### 5. Use `createSignal`, not `useState`

Returns a getter function and setter. The getter must be called.

```tsx
const [count, setCount] = createSignal(0);
return <div>{count()}</div>;  // call the getter
setCount(prev => prev + 1);   // setter with previous value
```

### 6. Component bodies run once

The component function executes once and returns DOM nodes. Only signal reads inside JSX expressions are reactive. Do not place logic that should re-run in the component body — use `createEffect` instead.

```tsx
function Counter() {
  const [count, setCount] = createSignal(0);
  console.log('This logs ONCE, not on every count change');
  return <button onClick={() => setCount(c => c + 1)}>{count()}</button>;
}
```

### 7. Use `createEffect`, not `useEffect`

Auto-tracks dependencies. No dependency array. Runs when any signal read inside it changes.

```tsx
createEffect(() => {
  document.title = `Count: ${count()}`;  // auto-tracks count
});
```

### 8. Use `onCleanup`, not `useEffect` return

Can be called anywhere in a reactive scope, not just inside effects.

```tsx
function Timer() {
  const id = setInterval(() => {}, 1000);
  onCleanup(() => clearInterval(id));
}
```

### 9. Refs are variable assignments

```tsx
let ref!: HTMLDivElement;
return <div ref={ref}>...</div>;
```

### 10. Use `createMemo` for expensive derived state

Memoizes a computed value. Only recalculates when dependencies change. For simple derivations, a plain function works (no caching): `const doubled = () => count() * 2;`.

```tsx
const total = createMemo(() => items().reduce((a, b) => a + b, 0));
```

Read `references/reactivity.md` for createResource, stores, context, batch updates, and reactive rules.

## Codebase Conventions

Read `references/components.md` when creating modals, dropdowns, or page layouts.

Read `references/ui-design.md` when making styling decisions (DaisyUI colors, content-container, overlays, responsive breakpoints).

## Imports

- Use `~/` for cross-folder imports, `./` for same-folder. Never use `../`.
- SolidJS: `import { createSignal, Show, For } from 'solid-js'`
- Router: `import { useNavigate, useParams } from '@tanstack/solid-router'`
