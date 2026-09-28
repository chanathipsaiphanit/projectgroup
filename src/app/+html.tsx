import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

// Web-only HTML shell. translate="no" stops Chrome's auto-translate from
// rewriting text nodes, which makes React crash with
// "Failed to execute 'removeChild' on 'Node'".
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="th" translate="no">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <meta name="google" content="notranslate" />
        <ScrollViewStyleReset />
      </head>
      <body className="notranslate">{children}</body>
    </html>
  );
}
