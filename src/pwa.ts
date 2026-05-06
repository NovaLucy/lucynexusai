// Register the PWA service worker — but never on Lovable preview hosts.
const host = window.location.hostname;
const isLovablePreview =
  host.endsWith(".lovableproject.com") ||
  host.endsWith(".lovableproject-dev.com") ||
  host.includes("id-preview--") ||
  host.startsWith("preview--");
const inIframe = window.self !== window.top;

if (
  "serviceWorker" in navigator &&
  !isLovablePreview &&
  !inIframe &&
  import.meta.env.PROD
) {
  // Lazy import so the SW registration code is only included in prod builds.
  import("virtual:pwa-register")
    .then(({ registerSW }) => {
      registerSW({ immediate: true });
    })
    .catch(() => {
      // No-op — PWA optional.
    });
}

export {};
