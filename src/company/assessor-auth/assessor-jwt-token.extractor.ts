import type { Request } from 'express';
import { ExtractJwt } from 'passport-jwt';

/**
 * Same sources as AssessorJwtStrategy — keep in sync for optional auth on myprojects-style routes.
 */
export const ASSESSOR_JWT_TOKEN_EXTRACTORS = [
  ExtractJwt.fromAuthHeaderAsBearerToken(),
  (req: Request) => {
    const xAccessToken = req?.headers?.['x-access-token'];
    if (typeof xAccessToken === 'string' && xAccessToken.trim()) return xAccessToken.trim();
    if (Array.isArray(xAccessToken) && xAccessToken[0]?.trim()) return xAccessToken[0].trim();
    return null;
  },
  (req: Request) => {
    const tokenHeader = req?.headers?.token;
    if (typeof tokenHeader === 'string' && tokenHeader.trim()) return tokenHeader.trim();
    if (Array.isArray(tokenHeader) && tokenHeader[0]?.trim()) return tokenHeader[0].trim();
    return null;
  },
  (req: Request) => {
    const q = (req?.query || {}) as Record<string, string | string[] | undefined>;
    const pick = (k: string) => {
      const v = q[k];
      return typeof v === 'string' && v.trim() ? v.trim() : null;
    };
    return pick('token') || pick('access_token') || pick('accessToken') || null;
  },
  (req: Request) => {
    const cookieHeader = req?.headers?.cookie;
    if (typeof cookieHeader !== 'string') return null;
    const parts = cookieHeader.split(';').map((p) => p.trim());
    for (const part of parts) {
      const [k, ...rest] = part.split('=');
      if (!k || !rest.length) continue;
      if (k === 'token' || k === 'access_token' || k === 'accessToken') {
        const value = rest.join('=').trim();
        if (value) return decodeURIComponent(value);
      }
    }
    return null;
  },
  (req: Request) => {
    const auth = req?.headers?.authorization;
    if (typeof auth !== 'string' || !auth.trim()) return null;
    const t = auth.trim();
    if (!t.toLowerCase().startsWith('bearer ') && t.split('.').length === 3) {
      return t;
    }
    return null;
  },
];

export function extractAssessorJwtToken(req: Request): string | null {
  for (const extractor of ASSESSOR_JWT_TOKEN_EXTRACTORS) {
    const token = extractor(req);
    if (typeof token === 'string' && token.trim()) return token.trim();
  }
  return null;
}
