// Server connection and API configuration helper
// Automatically selects and falls back between poly-royale.onrender.com and poly-loyale.onrender.com
// when running on Firebase Hosting (Waseapp-games-poly-royale.web.app / *.web.app / *.firebaseapp.com)

export const PRIMARY_RENDER_SERVER_URL = 'https://poly-royale.onrender.com';
export const BACKUP_RENDER_SERVER_URL = 'https://poly-loyale.onrender.com';
export const DEFAULT_CLOUD_RUN_SERVER_URL = 'https://ais-pre-26lckcvht5rkxvj2a7rym3-554926909913.asia-northeast1.run.app';

export interface ServerEndpointOption {
  id: string;
  name: string;
  url: string;
  description: string;
}

export const KNOWN_BACKEND_SERVERS: ServerEndpointOption[] = [
  {
    id: 'poly_royale',
    name: 'Render メイン (poly-royale)',
    url: PRIMARY_RENDER_SERVER_URL,
    description: '標準接続先 (poly-royale.onrender.com)',
  },
  {
    id: 'poly_loyale',
    name: 'Render 予備 (poly-loyale)',
    url: BACKUP_RENDER_SERVER_URL,
    description: '帯域超過時・通信障害時の自動予備バックエンド (poly-loyale.onrender.com)',
  },
  {
    id: 'cloud_run',
    name: 'Google Cloud Run (東京・高速)',
    url: DEFAULT_CLOUD_RUN_SERVER_URL,
    description: '低遅延アジアリージョン Cloud Run サーバー',
  },
];

let cachedActiveServer: string | null = null;

export function getServerUrl(): string | undefined {
  if (import.meta.env.VITE_SERVER_URL) {
    return import.meta.env.VITE_SERVER_URL;
  }

  if (typeof window !== 'undefined') {
    // 1. Manual user override stored in localStorage (if explicitly selected by user)
    const customUrl = localStorage.getItem('poly_server_url');
    if (customUrl && customUrl.trim()) {
      return customUrl.trim();
    }

    const hostname = window.location.hostname;

    // 2. Localhost / Dev server / Cloud Run preview (always connect directly to local backend)
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname.includes('run.app')
    ) {
      return undefined; // Same-origin connect to local Node.js / Vite server
    }

    // 3. Firebase Hosting (Waseapp-games-poly-royale.web.app / *.web.app / *.firebaseapp.com)
    // Check if failover backup was activated, otherwise use primary poly-royale
    const activeFallback = localStorage.getItem('poly_active_render_backend') || cachedActiveServer;
    if (activeFallback) {
      return activeFallback;
    }

    if (hostname.includes('web.app') || hostname.includes('firebaseapp.com')) {
      return PRIMARY_RENDER_SERVER_URL;
    }

    // 4. Any other external static domain fallback
    return PRIMARY_RENDER_SERVER_URL;
  }
  return undefined;
}

/**
 * Switch backend server upon bandwidth limit exceeded, timeout, or connection error
 */
export function failoverToNextBackend(currentFailedUrl?: string): string {
  const current = currentFailedUrl || getServerUrl() || PRIMARY_RENDER_SERVER_URL;
  let nextUrl = PRIMARY_RENDER_SERVER_URL;

  if (current.includes('poly-royale.onrender.com')) {
    // Switch to backup server poly-loyale
    nextUrl = BACKUP_RENDER_SERVER_URL;
    console.warn(`[Backend Failover] Bandwidth or connection issue on poly-royale. Switching to ${BACKUP_RENDER_SERVER_URL}`);
  } else if (current.includes('poly-loyale.onrender.com')) {
    // Switch back to primary or Cloud Run
    nextUrl = PRIMARY_RENDER_SERVER_URL;
    console.warn(`[Backend Failover] Switching back to primary ${PRIMARY_RENDER_SERVER_URL}`);
  } else {
    nextUrl = BACKUP_RENDER_SERVER_URL;
  }

  cachedActiveServer = nextUrl;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('poly_active_render_backend', nextUrl);
    } catch {}
  }
  return nextUrl;
}

export function getApiUrl(endpoint: string): string {
  const base = getServerUrl();
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  if (base) {
    return `${base.replace(/\/+$/, '')}${cleanEndpoint}`;
  }
  return cleanEndpoint;
}

export function setCustomServerUrl(url: string | null) {
  if (typeof window === 'undefined') return;
  if (!url || !url.trim()) {
    localStorage.removeItem('poly_server_url');
  } else {
    localStorage.setItem('poly_server_url', url.trim());
  }
}

export async function pingServerHealth(serverUrl?: string): Promise<{ ok: boolean; latencyMs: number; onlineCount?: number }> {
  const targetUrl = serverUrl || getServerUrl() || window.location.origin;
  const start = performance.now();
  try {
    const res = await fetch(`${targetUrl.replace(/\/+$/, '')}/api/online-count`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(4000),
    });
    const latency = Math.round(performance.now() - start);
    if (res.ok) {
      const data = await res.json();
      return { ok: true, latencyMs: latency, onlineCount: data.count };
    }
    return { ok: false, latencyMs: latency };
  } catch {
    return { ok: false, latencyMs: -1 };
  }
}

