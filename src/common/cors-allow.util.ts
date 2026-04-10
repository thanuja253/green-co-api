/**
 * Browsers reject `Access-Control-Allow-Headers: *` when `Access-Control-Allow-Credentials: true`.
 */
export const CORS_ALLOWED_HEADERS =
  'Content-Type, Authorization, Accept, X-Requested-With, Origin, Cache-Control, Pragma';

/**
 * Single place for "is this Origin allowed?" so main.ts and HttpExceptionFilter stay in sync.
 * Error responses must include CORS headers or the browser shows a misleading "CORS error".
 */
export function getAllowedCorsOrigin(origin: string | undefined): string | false {
  if (!origin) return false;

  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    return origin;
  }

  const envOrigins = process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL.split(',').map((url) => url.trim()).filter(Boolean)
    : [];

  const defaultOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'http://localhost:3015',
    'http://localhost:3019',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
    'http://127.0.0.1:3002',
    'http://127.0.0.1:3015',
    'http://127.0.0.1:3019',
    'https://cursor-greenco-mern.vercel.app',
    'https://cursor-greenco-admin.mern.vercel.app',
    'https://greenco-admin.mern.vercel.app',
  ];

  const allowed = new Set([...defaultOrigins, ...envOrigins]);
  if (allowed.has(origin)) return origin;
  if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin)) return origin;
  if (origin.startsWith('http://localhost:') || origin.startsWith('https://localhost:'))
    return origin;
  if (origin.startsWith('http://127.0.0.1:') || origin.startsWith('https://127.0.0.1:'))
    return origin;

  return false;
}

export function applyCorsHeadersToResponse(
  origin: string | undefined,
  setHeader: (name: string, value: string | number | string[]) => void,
): void {
  const allowed = getAllowedCorsOrigin(origin);
  if (!allowed) return;
  setHeader('Access-Control-Allow-Origin', allowed);
  setHeader('Access-Control-Allow-Credentials', 'true');
  setHeader('Vary', 'Origin');
}
