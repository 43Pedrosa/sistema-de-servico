import { createHmac, timingSafeEqual } from 'node:crypto';

export const ADMIN_SESSION_COOKIE = 'store_admin_session';
export const ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 8;

export interface AdminProfile {
  id: string | null;
  username: string;
  name: string;
  role: 'admin' | 'tecnico';
  is_active: boolean;
  password_hash?: string;
}

export interface StandaloneAdminCredentials {
  username: string;
  passwordHash: string;
  name: string;
}

interface AdminSessionPayload {
  username: string;
  name: string;
  role: 'admin';
  issuedAt: number;
  expiresAt: number;
  credentialVersion: string;
}

export interface AdminRequest {
  method?: string;
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
  query?: Record<string, string | string[] | undefined>;
}

export interface AdminResponse {
  setHeader(name: string, value: string): void;
  status(code: number): AdminResponse;
  json(body: unknown): void;
}

export function getStandaloneAdminCredentials(): StandaloneAdminCredentials {
  const username = process.env.ADMIN_USERNAME?.trim().toLowerCase();
  const passwordHash = process.env.ADMIN_PASSWORD_HASH;
  const name = process.env.ADMIN_DISPLAY_NAME?.trim() || 'Gerência';
  if (!username || !/^[a-z0-9._-]{3,32}$/.test(username) || !passwordHash) {
    throw new Error('Missing or invalid server-side ADMIN_USERNAME or ADMIN_PASSWORD_HASH.');
  }
  return { username, passwordHash, name };
}

function getSessionSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret || Buffer.byteLength(secret, 'utf8') < 32) {
    throw new Error('Missing or invalid server-side ADMIN_SESSION_SECRET.');
  }
  return secret;
}

export function getCookieValue(request: AdminRequest, cookieName: string): string | null {
  const rawCookie = request.headers.cookie;
  const cookieHeader = Array.isArray(rawCookie) ? rawCookie[0] : rawCookie;
  if (!cookieHeader) return null;

  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0 || part.slice(0, separator).trim() !== cookieName) continue;
    try {
      return decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      return null;
    }
  }
  return null;
}

export function hashCredentialVersion(passwordHash: string): string {
  return createHmac('sha256', getSessionSecret()).update(passwordHash).digest('base64url');
}

function signSessionPayload(payload: string): string {
  return createHmac('sha256', getSessionSecret()).update(payload).digest('base64url');
}

export function createSessionToken(profile: AdminProfile): string {
  if (profile.role !== 'admin' || profile.id !== null) {
    throw new Error('Only the standalone administrator can create this session.');
  }
  const now = Math.floor(Date.now() / 1000);
  const payload: AdminSessionPayload = {
    username: profile.username,
    name: profile.name,
    role: 'admin',
    issuedAt: now,
    expiresAt: now + ADMIN_SESSION_TTL_SECONDS,
    credentialVersion: hashCredentialVersion(getStandaloneAdminCredentials().passwordHash),
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${encodedPayload}.${signSessionPayload(encodedPayload)}`;
}

function secureCookieAttribute(request?: AdminRequest): string {
  const forwardedProto = request?.headers['x-forwarded-proto'];
  const proto = Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto;
  return process.env.NODE_ENV === 'production' || proto?.split(',')[0].trim() === 'https' ? '; Secure' : '';
}

export function sessionCookie(token: string, maxAge: number, request?: AdminRequest): string {
  const secure = secureCookieAttribute(request);
  return `${ADMIN_SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Strict; Max-Age=${maxAge}${secure}`;
}

function parseSessionToken(token: string): AdminSessionPayload | null {
  const [encodedPayload, signature, extra] = token.split('.');
  if (
    !encodedPayload ||
    !signature ||
    extra !== undefined ||
    !/^[A-Za-z0-9_-]+$/.test(encodedPayload) ||
    !/^[A-Za-z0-9_-]+$/.test(signature)
  ) return null;

  const expectedSignature = Buffer.from(signSessionPayload(encodedPayload), 'base64url');
  const actualSignature = Buffer.from(signature, 'base64url');
  if (
    expectedSignature.length !== actualSignature.length ||
    !timingSafeEqual(expectedSignature, actualSignature)
  ) return null;

  try {
    const value = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as Partial<AdminSessionPayload>;
    if (
      typeof value.username !== 'string' ||
      typeof value.name !== 'string' ||
      value.role !== 'admin' ||
      !Number.isInteger(value.issuedAt) ||
      !Number.isInteger(value.expiresAt) ||
      typeof value.credentialVersion !== 'string'
    ) return null;

    return value as AdminSessionPayload;
  } catch {
    return null;
  }
}

export function clearSessionCookie(request?: AdminRequest): string {
  const secure = secureCookieAttribute(request);
  return `${ADMIN_SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=Strict; Max-Age=0${secure}`;
}

export function hasValidOrigin(request: AdminRequest): boolean {
  const origin = request.headers.origin;
  const hostHeader = request.headers.host;
  const originValue = Array.isArray(origin) ? origin[0] : origin;
  const host = Array.isArray(hostHeader) ? hostHeader[0] : hostHeader;
  if (!originValue || !host) return false;
  try {
    const parsedOrigin = new URL(originValue);
    return ['http:', 'https:'].includes(parsedOrigin.protocol) &&
      parsedOrigin.host.toLowerCase() === host.toLowerCase();
  } catch {
    return false;
  }
}

export function getAdminSession(
  request: AdminRequest
): { profile: AdminProfile } | null {
  const token = getCookieValue(request, ADMIN_SESSION_COOKIE);
  if (!token || token.length > 2048) return null;
  const session = parseSessionToken(token);
  if (!session) return null;
  const credentials = getStandaloneAdminCredentials();
  const now = Math.floor(Date.now() / 1000);
  if (
    session.username !== credentials.username ||
    session.credentialVersion !== hashCredentialVersion(credentials.passwordHash) ||
    session.issuedAt > now ||
    session.expiresAt <= now ||
    session.expiresAt - session.issuedAt > ADMIN_SESSION_TTL_SECONDS
  ) return null;

  return {
    profile: {
      id: null,
      username: credentials.username,
      name: session.name,
      role: 'admin',
      is_active: true,
    },
  };
}
