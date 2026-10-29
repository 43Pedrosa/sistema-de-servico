import { getAdminSession, type AdminRequest, type AdminResponse } from './_admin-auth.ts';

export default async function handler(req: AdminRequest, res: AdminResponse): Promise<void> {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Vary', 'Cookie');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ message: 'Método não permitido.' });
    return;
  }

  try {
    const session = await getAdminSession(req);
    if (!session) {
      res.status(401).json({ message: 'Sessão administrativa inválida ou expirada.' });
      return;
    }
    res.status(200).json({ user: session.profile });
  } catch (error) {
    console.error('Administrative session validation failed:', error);
    res.status(503).json({ message: 'Não foi possível validar a sessão no servidor.' });
  }
}
