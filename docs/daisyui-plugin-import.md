# daisyUI Tailwind v4 plugin import

## Why `@plugin 'daisyui/index.js'` instead of `@plugin 'daisyui'`

daisyUI 5.x's `package.json` declares:

```json
"main": "./index.js",
"module": "./index.js",
"browser": "./daisyui.css"
```

Tailwind's `@plugin` resolver follows the `browser` field for bare specifiers, so `@plugin 'daisyui'` resolves to the raw stylesheet `node_modules/daisyui/daisyui.css` instead of the JS plugin entry. The plugin loader then crashes iterating CSS plugin entries:

```
[vite] Internal server error: ".../node_modules/daisyui/daisyui.css" is not an Object.
  (evaluating '"__isOptionsFunction" in y.plugin')
  Plugin: @tailwindcss/vite:generate:serve
```

The deep import `daisyui/index.js` bypasses package.json field selection entirely.

**Revisit when:** daisyUI removes the `browser` field or adds an `exports` map that disambiguates JS vs CSS entry points.

**Affects:** any app importing daisyUI as a Tailwind v4 plugin. Currently `apps/web/src/styles/tokens.css` only.
