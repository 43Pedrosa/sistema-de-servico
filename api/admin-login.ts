import { createSessionToken, getStandaloneAdminCredentials, hasValidOrigin, sessionCookie, ADMIN_SESSION_TTL_SECONDS, type AdminProfile, type AdminRequest, type AdminResponse } from './_admin-auth.ts';
import { hashPassword, verifyPassword } from './_password.ts';

interface LoginRequestBody {
  username?: unknown;
  password?: unknown;
}

const LOGIN_RATE_LIMIT_MESSAGE = 'Muitas tentativas de acesso. Aguarde 15 minutos e tente novamente.';
const DUMMY_PASSWORD_HASH = hashPassword('not-a-real-account-password');
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILURES = 5;
const loginFailures = new Map<string, { count: number; expiresAt: number }>();

function getRateLimitKey(request: AdminRequest, username: string): string {
  return `${request.ip?.trim() || 'unknown'}:${username}`;
}

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const entry = loginFailures.get(key);
  if (!entry || entry.expiresAt <= now) {
    loginFailures.delete(key);
    return false;
  }
  return entry.count >= LOGIN_MAX_FAILURES;
}

function recordFailedAttempt(key: string): void {
  const now = Date.now();
  for (const [existingKey, entry] of loginFailures) {
    if (entry.expiresAt <= now) loginFailures.delete(existingKey);
  }
  if (loginFailures.size >= 10_000 && !loginFailures.has(key)) {
    const oldestKey = loginFailures.keys().next().value;
    if (oldestKey) loginFailures.delete(oldestKey);
  }

  const entry = loginFailures.get(key);
  if (entry && entry.expiresAt > now) {
    entry.count += 1;
    return;
  }
  loginFailures.set(key, { count: 1, expiresAt: now + LOGIN_WINDOW_MS });
}

export default async function handler(req: AdminRequest, res: AdminResponse): Promise<void> {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Vary', 'Cookie');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ message: 'Método não permitido.' });
    return;
  }
  if (!hasValidOrigin(req)) {
    res.status(403).json({ message: 'Origem da solicitação não permitida.' });
    return;
  }

  const body = req.body as LoginRequestBody | undefined;
  const username = typeof body?.username === 'string' ? body.username.trim().toLowerCase() : '';
  if (
    !/^[a-z0-9._-]{3,32}$/.test(username) ||
    typeof body?.password !== 'string' ||
    body.password.length < 12 ||
    body.password.length > 128
  ) {
    res.status(400).json({ message: 'Nome de usuário ou senha inválidos.' });
    return;
  }

  try {
    const credentials = getStandaloneAdminCredentials();
    const rateLimitKey = getRateLimitKey(req, username);
    if (isRateLimited(rateLimitKey)) {
      res.setHeader('Retry-After', '900');
      res.status(429).json({ message: LOGIN_RATE_LIMIT_MESSAGE });
      return;
    }

    const passwordHash = username === credentials.username
      ? credentials.passwordHash
      : await DUMMY_PASSWORD_HASH;
    const passwordMatches = await verifyPassword(body.password, passwordHash);
    if (username !== credentials.username || !passwordMatches) {
      recordFailedAttempt(rateLimitKey);
      res.status(401).json({ message: 'Nome de usuário ou senha incorretos.' });
      return;
    }

    const principal: AdminProfile = {
      id: null,
      username: credentials.username,
      name: credentials.name,
      role: 'admin',
      is_active: true,
    };
    const token = createSessionToken(principal);

    res.setHeader('Set-Cookie', sessionCookie(token, ADMIN_SESSION_TTL_SECONDS, req));
    res.status(200).json({
      user: {
        id: principal.id,
        username: principal.username,
        name: principal.name,
        role: principal.role,
      },
    });
  } catch (error) {
    console.error('Unexpected standalone administrator login error:', error);
    res.status(503).json({ message: 'Não foi possível validar o acesso. Confira a configuração do servidor.' });
  }
}
