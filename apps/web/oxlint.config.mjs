import { defineConfig } from "oxlint";
import solidV2 from "eslint-plugin-solid/configs/v2";

export default defineConfig({
  // Listing `plugins` replaces oxlint's defaults, so the three it enables on
  // its own (typescript, unicorn, oxc) are repeated here.
  plugins: ["typescript", "unicorn", "oxc", "vitest", "jsx-a11y"],
  jsPlugins: ["eslint-plugin-solid"],
  ignorePatterns: ["**/*.gen.ts", "dist"],
  settings: solidV2.settings,
  rules: {
    ...solidV2.rules,
    // STALE FOR SOLID 2. This rule says to import ValidComponent /
    // ComponentProps / JSX from "solid-js". In solid-js@2.0.0-rc.0 those are
    // not the usable types: `ValidComponent` there is `Component<any>` and
    // rejects intrinsic tags, so `<T extends ValidComponent = 'button'>`
    // fails with TS2344 (verified with tsc). The correct source is
    // @solidjs/web, which this project also sets as jsxImportSource.
    // Following the rule would produce code that does not compile.
    "solid/imports": "off",
    // Default depth is 2, which stops before label text wrapped in a layout
    // <span>.
    "jsx-a11y/label-has-associated-control": ["warn", { depth: 3 }],
  },
});
