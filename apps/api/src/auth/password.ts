import { hash, verify } from '@node-rs/argon2';

// argon2id mit OWASP-Empfehlung (19 MiB, 2 Iterationen) – auf dem Pi 4 ca. 50–100 ms pro Hash
const OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

/**
 * Hash für nicht existierende Benutzer: Die Prüfung dauert gleich lang,
 * damit sich über die Antwortzeit nicht herausfinden lässt, welche Namen es gibt.
 */
let dummyHash: Promise<string> | null = null;
export async function verifyDummy(password: string): Promise<void> {
  dummyHash ??= hashPassword('dummy-password-for-timing');
  await verifyPassword(await dummyHash, password);
}
