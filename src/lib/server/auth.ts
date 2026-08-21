import { createMiddleware, createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";

export const UNAUTHORIZED = "UNAUTHORIZED";

/**
 * Every server function that reads or writes portfolio data goes through this.
 * When no PIN is configured the app is open (single-owner tool, opt-in lock);
 * once a PIN is enabled, only requests with a valid session cookie get through.
 */
export const requireAuth = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const auth = await import("@/lib/auth.server");
    const row = await auth.loadPinRow();
    if (auth.pinActive(row) && !(await auth.hasValidSession())) {
      throw new Error(UNAUTHORIZED);
    }
    return next();
  },
);

export type AuthState = { pinEnabled: boolean; authenticated: boolean };

export const getAuthState = createServerFn({ method: "GET" }).handler(
  async (): Promise<AuthState> => {
    const auth = await import("@/lib/auth.server");
    const row = await auth.loadPinRow();
    const pinEnabled = auth.pinActive(row);
    return {
      pinEnabled,
      authenticated: !pinEnabled || (await auth.hasValidSession()),
    };
  },
);

export const login = createServerFn({ method: "POST" })
  .validator(z.object({ pin: z.string().min(1).max(128) }))
  .handler(async ({ data }) => {
    const auth = await import("@/lib/auth.server");
    const wait = auth.loginLockSeconds();
    if (wait > 0) return { ok: false as const, retryIn: wait };
    const row = await auth.loadPinRow();
    if (!auth.pinActive(row)) {
      await auth.createSession();
      return { ok: true as const };
    }
    const valid = await auth.verifyPinHash(data.pin, row.pin_hash!);
    if (!valid) {
      auth.recordLoginFailure();
      return { ok: false as const, retryIn: auth.loginLockSeconds() };
    }
    auth.clearLoginFailures();
    await auth.createSession();
    return { ok: true as const };
  });

export const logout = createServerFn({ method: "POST" }).handler(async () => {
  const auth = await import("@/lib/auth.server");
  await auth.destroySession();
  return { ok: true };
});

/**
 * Set, change or remove the PIN. Requires an active session when a PIN already
 * exists (via `requireAuth`). Changing it revokes every other session.
 */
export const setPin = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(z.object({ pin: z.string().min(4).max(128).nullable() }))
  .handler(async ({ data }) => {
    const auth = await import("@/lib/auth.server");
    const sql = await getSql();
    await sql.query(
      `insert into app_settings (id, pin_enabled) values (1, false) on conflict (id) do nothing`,
    );
    if (!data.pin) {
      await sql.query(
        `update app_settings set pin_hash = null, pin_enabled = false, updated_at = now() where id = 1`,
      );
      await auth.destroyAllSessions();
      return { ok: true, enabled: false };
    }
    const hash = await auth.hashPin(data.pin);
    await sql.query(
      `update app_settings set pin_hash = $1, pin_enabled = true, updated_at = now() where id = 1`,
      [hash],
    );
    await auth.destroyAllSessions();
    await auth.createSession();
    return { ok: true, enabled: true };
  });
