// No "server-only" import so scripts/seed.ts can hash demo passwords too.
import { scrypt as _scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import bcrypt from "bcryptjs";

const scrypt = promisify(_scrypt) as (pw: string, salt: string, len: number) => Promise<Buffer>;

export const hashPassword = (pw: string) => bcrypt.hash(pw, 12);

/** bcrypt hashes, plus legacy `salt:hex` scrypt hashes from accounts created before the bcrypt switch. */
export async function verifyPassword(pw: string, stored: string) {
  if (stored.startsWith("$2")) return bcrypt.compare(pw, stored);
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const want = Buffer.from(hash, "hex");
  const got = await scrypt(pw, salt, want.length);
  return got.length === want.length && timingSafeEqual(got, want);
}
