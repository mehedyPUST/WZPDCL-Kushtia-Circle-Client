"use client";

import { useServerInsertedHTML } from "next/navigation";

/**
 * Injects the theme-init script directly into the SSR HTML stream,
 * bypassing React's hydration tree. This avoids the React 19 error:
 * "Encountered a script tag while rendering React component."
 */
export default function ThemeInitScript() {
    useServerInsertedHTML(() => {
        const script = `
      (function() {
        try {
          var saved = localStorage.getItem('wzpdcl-theme-choice');
          var theme = (saved === 'light' || saved === 'dark')
            ? saved
            : (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
          document.documentElement.dataset.theme = theme;
          document.documentElement.style.colorScheme = theme;
        } catch (e) {}
      })();
    `;
        return (
            <script
                id="wzpdcl-theme-init"
                dangerouslySetInnerHTML={{ __html: script }}
            />
        );
    });

    return null;
}