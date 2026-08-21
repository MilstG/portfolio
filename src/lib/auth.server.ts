/**
 * Server-only auth primitives for the single-owner PIN lock.
 *
 * - PIN hashes: scrypt + random salt, compared in constant time.
 * - Sessions: a random 256-bit token in an HttpOnly cookie; the database only
 *   stores its SHA-256 so a leaked table can't be replayed.
 * - Brute force: a small in-memory limiter keyed by client IP (this app runs
 *   as a single process, so no shared store is needed).
 */
import {
  randomBytes,
  scrypt as scryptCb,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { promisify } from "node:util";
import {
  deleteCookie,
  getCookie,
  getRequestIP,
  getRequestProtocol,
  setCookie,
} from "@tanstack/react-start/server";
import { getSql } from "@/lib/db";

const scrypt = promisify(scryptCb);

export const SESSION_COOKIE = "pat_session";
const SESSION_DAYS = 30;
const SESSION_MS = SESSION_DAYS * 24 * 60 * 60 * 1000;

// ── PIN hashing ──────────────────────────────────────────────────────────────

export async function hashPin(pin: string): Promise<string> {
  const salt = randomBytes(16);
  const key = (await scrypt(pin.normalize("NFKC"), salt, 64)) as Buffer;
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

export async function verifyPinHash(
  pin: string,
  stored: string,
): Promise<boolean> {
  const [scheme, saltHex, hashHex] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = (await scrypt(
    pin.normalize("NFKC"),
    Buffer.from(saltHex, "hex"),
    expected.length,
  )) as Buffer;
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

// ── Rate limiting (per IP, in-memory) ────────────────────────────────────────

const MAX_FAILURES = 5;
const LOCK_MS = 60_000;
const attempts = new Map<string, { failures: number; lockedUntil: number }>();

function clientKey(): string {
  try {
    return getRequestIP({ xForwardedFor: true }) ?? "unknown";
  } catch {
    return "unknown";
  }
}

/** Seconds the caller must still wait, or 0 when allowed. */
export function loginLockSeconds(): number {
  const entry = attempts.get(clientKey());
  if (!entry) return 0;
  const left = entry.lockedUntil - Date.now();
  return left > 0 ? Math.ceil(left / 1000) : 0;
}

export function recordLoginFailure(): void {
  const key = clientKey();
  const entry = attempts.get(key) ?? { failures: 0, lockedUntil: 0 };
  entry.failures += 1;
  if (entry.failures >= MAX_FAILURES) {
    // Exponential backoff: 1 min, 2 min, 4 min… capped at 1 hour.
    const factor = 2 ** Math.min(entry.failures - MAX_FAILURES, 6);
    entry.lockedUntil = Date.now() + Math.min(LOCK_MS * factor, 60 * 60_000);
  }
  attempts.set(key, entry);
}

export function clearLoginFailures(): void {
  attempts.delete(clientKey());
}

// ── Sessions ─────────────────────────────────────────────────────────────────

function tokenId(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function isSecureRequest(): boolean {
  try {
    return getRequestProtocol({ xForwardedProto: true }) === "https";
  } catch {
    return false;
  }
}

export async function createSession(): Promise<void> {
  const sql = await getSql();
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_MS);
  await sql.query(`insert into sessions (id, expires_at) values ($1, $2)`, [
    tokenId(token),
    expires.toISOString(),
  ]);
  // Opportunistic cleanup of expired rows.
  await sql.query(`delete from sessions where expires_at < now()`);
  setCookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isSecureRequest(),
    path: "/",
    maxAge: SESSION_MS / 1000,
  });
}

export async function destroySession(): Promise<void> {
  const token = getCookie(SESSION_COOKIE);
  if (token) {
    const sql = await getSql();
    await sql.query(`delete from sessions where id = $1`, [tokenId(token)]);
  }
  deleteCookie(SESSION_COOKIE, { path: "/" });
}

export async function destroyAllSessions(): Promise<void> {
  const sql = await getSql();
  await sql.query(`delete from sessions`);
  deleteCookie(SESSION_COOKIE, { path: "/" });
}

/** True when the request carries a valid, unexpired session cookie. */
export async function hasValidSession(): Promise<boolean> {
  const token = getCookie(SESSION_COOKIE);
  if (!token) return false;
  const sql = await getSql();
  const rows = await sql.query<{ id: string }>(
    `update sessions set last_seen_at = now()
      where id = $1 and expires_at > now()
      returning id`,
    [tokenId(token)],
  );
  return rows.length > 0;
}

export type PinRow = { pin_hash: string | null; pin_enabled: boolean };

export async function loadPinRow(): Promise<PinRow> {
  const sql = await getSql();
  const rows = await sql.query<PinRow>(
    `select pin_hash, pin_enabled from app_settings where id = 1`,
  );
  return rows[0] ?? { pin_hash: null, pin_enabled: false };
}

/** The lock is active only when a PIN is both set and enabled. */
export function pinActive(row: PinRow): boolean {
  return Boolean(row.pin_enabled && row.pin_hash);
}
