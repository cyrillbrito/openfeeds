# SolidJS Reactivity Deep Dive

## Core Primitives

### createSignal — reactive state

```tsx
const [value, setValue] = createSignal<string>('initial');
value();           // read (tracks in reactive context)
setValue('new');    // write
setValue(prev => prev + '!');  // write with previous
```

Signals with custom equality (prevent updates when value is "equal"):

```tsx
const [user, setUser] = createSignal(
  { name: 'John', age: 30 },
  { equals: (prev, next) => prev.name === next.name && prev.age === next.age }
);
```

### createEffect — side effects

Auto-tracks all signals read inside. Runs after render. No dependency array.

```tsx
createEffect(() => {
  // Runs whenever count() or name() change
  console.log(`${name()} has count ${count()}`);
});
```

Effects can be nested. Inner effects don't re-trigger outer ones.

### createMemo — derived state (cached)

```tsx
const fullName = createMemo(() => `${firstName()} ${lastName()}`);
// Only recomputes when firstName or lastName changes
// Multiple reads of fullName() return cached value
```

### createResource — async data

```tsx
const [userId, setUserId] = createSignal('123');
const [user, { mutate, refetch }] = createResource(userId, async (id) => {
  const res = await fetch(`/api/users/${id}`);
  return res.json();
});

// States: user.loading, user.error, user.latest, user.state
// Integrates with <Suspense> and <ErrorBoundary>
```

## Reactive Rules

1. **Signals are only tracked inside reactive contexts** — `createEffect`, `createMemo`, JSX expressions, and `createResource` source functions.
2. **Top-level signal reads in component body are NOT tracked** — the body runs once.
3. **Conditional reads break tracking** — `if (flag) data()` only tracks `data` when `flag` is true.
4. **Stores for nested reactivity** — `createStore` for deep objects. Signals are for primitives and flat objects.

## onMount / onCleanup

```tsx
import { onMount, onCleanup } from 'solid-js';

onMount(() => {
  // Runs once after component is inserted into DOM
  // Does NOT track dependencies
  inputRef?.focus();
});

onCleanup(() => {
  // Runs when component is removed or effect re-runs
  clearInterval(timerId);
});
```

## Context

```tsx
import { createContext, useContext } from 'solid-js';

const ThemeContext = createContext<{ theme: () => string }>();

function ThemeProvider(props) {
  const [theme, setTheme] = createSignal('light');
  return (
    <ThemeContext.Provider value={{ theme }}>
      {props.children}
    </ThemeContext.Provider>
  );
}

function Child() {
  const ctx = useContext(ThemeContext);
  return <div>{ctx?.theme()}</div>;
}
```

## Batch Updates

Solid batches synchronous signal updates automatically. For explicit batching:

```tsx
import { batch } from 'solid-js';
batch(() => {
  setFirst('Jane');
  setLast('Smith');
  // Effects run once after batch, not twice
});
```
