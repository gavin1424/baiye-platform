export const DEMO_MODE =
  import.meta.env.VITE_APP_MODE === "demo" ||
  (typeof window !== "undefined" && window.location.hostname.endsWith(".pages.dev"));

export const DEMO_BLOCK_MESSAGE = "此為範例展示站，正式資料異動功能已停用。";

const DEMO_READ_BLOCK_MESSAGE = "此為範例展示站，不會連線或顯示正式客戶資料。";

export function installDemoNetworkGuard() {
  if (!DEMO_MODE || typeof window === "undefined") return;
  const guardedWindow = window as Window & { __baiyeDemoFetchGuard?: boolean };
  if (guardedWindow.__baiyeDemoFetchGuard) return;

  const productionFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const requestUrl = new URL(input instanceof Request ? input.url : String(input), window.location.href);
    if (requestUrl.origin !== window.location.origin) {
      const method = (init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
      const message = method === "GET" || method === "HEAD" ? DEMO_READ_BLOCK_MESSAGE : DEMO_BLOCK_MESSAGE;
      return new Response(JSON.stringify({ error: message, demo: true }), {
        status: 403,
        headers: { "content-type": "application/json; charset=utf-8", "x-baiye-demo-mode": "blocked" },
      });
    }
    return productionFetch(input, init);
  };
  guardedWindow.__baiyeDemoFetchGuard = true;
}

export function applyDemoDocumentMetadata() {
  if (!DEMO_MODE || typeof document === "undefined") return;

  let robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
  if (!robots) {
    robots = document.createElement("meta");
    robots.name = "robots";
    document.head.appendChild(robots);
  }
  robots.content = "noindex,nofollow";

  let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement("link");
    canonical.rel = "canonical";
    document.head.appendChild(canonical);
  }
  canonical.href = "https://baiyeconnect.com/";
}
