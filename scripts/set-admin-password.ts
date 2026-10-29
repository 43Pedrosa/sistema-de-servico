import dotenv from 'dotenv';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { hashPassword } from '../api/_password';

dotenv.config({ path: '.env.local' });

function readHidden(prompt: string): Promise<string> {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') {
    throw new Error('Execute este comando em um terminal interativo para informar a senha com segurança.');
  }

  return new Promise((resolve, reject) => {
    const input = process.stdin;
    let value = '';
    process.stdout.write(prompt);
    input.setRawMode(true);
    input.resume();
    const onData = (chunk: Buffer) => {
      for (const character of chunk.toString('utf8')) {
        if (character === '\u0003') {
          input.setRawMode(false);
          input.pause();
          input.off('data', onData);
          process.stdout.write('\n');
          reject(new Error('Operação cancelada.'));
          return;
        }
        if (character === '\r' || character === '\n') {
          input.setRawMode(false);
          input.pause();
          input.off('data', onData);
          process.stdout.write('\n');
          resolve(value);
          return;
        }
        if (character === '\u007f' || character === '\b') {
          value = value.slice(0, -1);
          continue;
        }
        if (character >= ' ') value += character;
      }
    };
    input.on('data', onData);
  });
}

async function main(): Promise<void> {
  const username = (process.argv[2] || 'MINHALOJA2026').trim().toLowerCase();
  if (!username || !/^[a-z0-9._-]{3,32}$/.test(username)) {
    throw new Error('O nome de usuário deve ter entre 3 e 32 letras, números, pontos, sublinhados ou hífens.');
  }

  const password = await readHidden('Nova senha (mínimo 12 caracteres): ');
  const confirmation = await readHidden('Confirme a nova senha: ');
  if (password.length < 12 || password.length > 128) {
    throw new Error('A senha deve ter entre 12 e 128 caracteres.');
  }
  if (password !== confirmation) throw new Error('As senhas não coincidem.');

  const passwordHash = await hashPassword(password);
  const envPath = '.env.local';
  const existing = existsSync(envPath) ? readFileSync(envPath, 'utf8') : '';
  const configuredSessionSecret = /^\s*ADMIN_SESSION_SECRET\s*=\s*(.+?)\s*$/m.exec(existing)?.[1];
  const sessionSecret = process.env.ADMIN_SESSION_SECRET ||
    (configuredSessionSecret ? configuredSessionSecret.replace(/^["']|["']$/g, '') : '') ||
    randomBytes(32).toString('base64url');
  const settings = new Map([
    ['ADMIN_USERNAME', username],
    ['ADMIN_PASSWORD_HASH', passwordHash],
    ['ADMIN_SESSION_SECRET', sessionSecret],
  ]);
  const updatedLines = new Set<string>();
  const lines = existing.split(/\r?\n/).map(line => {
    const match = /^\s*(ADMIN_USERNAME|ADMIN_PASSWORD_HASH|ADMIN_SESSION_SECRET)\s*=/.exec(line);
    if (!match) return line;
    const key = match[1];
    updatedLines.add(key);
    return `${key}=${JSON.stringify(settings.get(key) || '')}`;
  });
  for (const [key, value] of settings) {
    if (!updatedLines.has(key)) lines.push(`${key}=${JSON.stringify(value)}`);
  }
  writeFileSync(envPath, `${lines.join('\n').replace(/\n+$/, '')}\n`, { mode: 0o600 });
  console.log(`Credenciais e segredo de sessão configurados em ${envPath}. A senha não foi exibida nem armazenada em texto puro.`);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
