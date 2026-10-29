import { clearSessionCookie, hasValidOrigin, type AdminRequest, type AdminResponse } from './_admin-auth.ts';

export default async function handler(req: AdminRequest, res: AdminResponse): Promise<void> {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ message: 'Método não permitido.' });
    return;
  }
  if (!hasValidOrigin(req)) {
    res.status(403).json({ message: 'Origem da solicitação não permitida.' });
    return;
  }

  res.setHeader('Set-Cookie', clearSessionCookie(req));
  res.status(200).json({ message: 'Sessão encerrada.' });
}
