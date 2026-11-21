import { defaultCache, PAGES_CACHE_NAME } from "@serwist/next/worker";
import {
  CacheFirst,
  ExpirationPlugin,
  NetworkFirst,
  NetworkOnly,
  Serwist,
  type PrecacheEntry,
  type RuntimeCaching,
  type SerwistGlobalConfig,
} from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const calculatorRuntimeCaching: RuntimeCaching[] = [
  // Never cache authentication mutations or session checks
  {
    matcher: ({ url: { pathname }, sameOrigin }) =>
      sameOrigin && pathname.startsWith("/api/auth/"),
    handler: new NetworkOnly(),
  },
  // Fast timeout NetworkFirst for core offline-capable routes (/calculator and /)
  // so weak substation connections fall back to cached HTML quickly.
  {
    matcher: ({ request, url: { pathname }, sameOrigin }) =>
      sameOrigin &&
      request.mode === "navigate" &&
      (pathname === "/" ||
        pathname === "/calculator" ||
        pathname.startsWith("/calculator/")),
    handler: new NetworkFirst({
      cacheName: PAGES_CACHE_NAME.html,
      networkTimeoutSeconds: 4,
      plugins: [
        new ExpirationPlugin({
          maxEntries: 16,
          maxAgeSeconds: 30 * 24 * 60 * 60,
        }),
      ],
    }),
  },
  // Cache public brand/PWA icons reliably even on offline cold start
  {
    matcher: ({ url: { pathname }, sameOrigin }) =>
      sameOrigin &&
      (pathname === "/logo.png" ||
        pathname === "/favicon.ico" ||
        pathname === "/apple-touch-icon.png" ||
        pathname.startsWith("/pwa-")),
    handler: new CacheFirst({
      cacheName: "brand-assets",
      plugins: [
        new ExpirationPlugin({
          maxEntries: 16,
          maxAgeSeconds: 30 * 24 * 60 * 60,
        }),
      ],
    }),
  },
  ...defaultCache,
];

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: calculatorRuntimeCaching,
  fallbacks: {
    entries: [
      {
        url: "/calculator",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

// Warm /calculator and / HTML pages during service worker installation
// so basic load calculations work offline even before visiting /calculator manually.
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(PAGES_CACHE_NAME.html);
        await Promise.allSettled([
          cache.add(new Request("/calculator", { cache: "reload" })),
          cache.add(new Request("/", { cache: "reload" })),
        ]);
      } catch {
        // Ignore warm-up failures if device is offline during SW install
      }
    })()
  );
});

// Allow the client app to trigger immediate activation and cache invalidation
// when an operator checks for or applies a PWA update.
self.addEventListener("message", (event) => {
  const type = event.data?.type;
  const replyPort = event.ports?.[0];

  if (type === "SKIP_WAITING") {
    self.skipWaiting();
    replyPort?.postMessage({ ok: true });
    return;
  }

  if (type === "CLEAR_CACHES") {
    event.waitUntil(
      (async () => {
        try {
          const keys = await caches.keys();
          await Promise.all(keys.map((key) => caches.delete(key)));
          replyPort?.postMessage({ ok: true, cleared: keys.length });
        } catch {
          replyPort?.postMessage({ ok: false, cleared: 0 });
        }
      })()
    );
  }
});

serwist.addEventListeners();
