import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';

const SCRYPT_COST = 32768;
const SCRYPT_BLOCK_SIZE = 8;
const SCRYPT_PARALLELIZATION = 1;
const KEY_LENGTH = 64;

function deriveKey(
  password: string,
  salt: Buffer,
  length: number,
  options: { N: number; r: number; p: number; maxmem: number }
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, length, options, (error, key) => {
      if (error) reject(error);
      else resolve(key as Buffer);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derivedKey = await deriveKey(password, salt, KEY_LENGTH, {
    N: SCRYPT_COST,
    r: SCRYPT_BLOCK_SIZE,
    p: SCRYPT_PARALLELIZATION,
    maxmem: 64 * 1024 * 1024,
  }) as Buffer;

  return [
    'scrypt',
    SCRYPT_COST,
    SCRYPT_BLOCK_SIZE,
    SCRYPT_PARALLELIZATION,
    salt.toString('base64url'),
    derivedKey.toString('base64url'),
  ].join('$');
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [algorithm, costValue, blockValue, parallelValue, saltValue, keyValue, extra] = storedHash.split('$');
  if (algorithm !== 'scrypt' || extra !== undefined || !saltValue || !keyValue) return false;

  const cost = Number(costValue);
  const blockSize = Number(blockValue);
  const parallelization = Number(parallelValue);
  if (
    !Number.isInteger(cost) || cost < 16384 || cost > 262144 ||
    !Number.isInteger(blockSize) || blockSize < 1 || blockSize > 16 ||
    !Number.isInteger(parallelization) || parallelization < 1 || parallelization > 4
  ) return false;

  try {
    const salt = Buffer.from(saltValue, 'base64url');
    const expectedKey = Buffer.from(keyValue, 'base64url');
    if (salt.length !== 16 || expectedKey.length !== KEY_LENGTH) return false;

    const actualKey = await deriveKey(password, salt, expectedKey.length, {
      N: cost,
      r: blockSize,
      p: parallelization,
      maxmem: 256 * 1024 * 1024,
    }) as Buffer;
    return timingSafeEqual(actualKey, expectedKey);
  } catch {
    return false;
  }
}
