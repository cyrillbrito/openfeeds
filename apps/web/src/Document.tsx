import type { ParentProps } from 'solid-js';
import { HydrationScript } from '@solidjs/web';

// The document shell, in place of index.html: picked up by the
// src/Document.* convention, it must render the full <html> and head tags go
// here. Compiled only into the prerendered shell, so it ships no client JS.
// Delete this file to fall back to the plugin's built-in shell.
export default function Document(props: ParentProps) {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
        <title>OpenFeeds</title>
        <HydrationScript />
      </head>
      <body>{props.children}</body>
    </html>
  );
}
