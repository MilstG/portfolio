import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function num(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

export function toUsd(
  amount: number,
  currency: string,
  arsPerUsd: number,
): number {
  const c = (currency || "USD").toUpperCase();
  if (c === "USD" || c === "USDT") return amount;
  if (c === "ARS") return arsPerUsd > 0 ? amount / arsPerUsd : 0;
  return amount;
}

export function formatUsd(value: number, digits = 0) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatAmount(value: number, currency: string) {
  const c = currency.toUpperCase();
  if (c === "ARS") {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      maximumFractionDigits: 0,
    }).format(value);
  }
  return formatUsd(value, c === "USDT" ? 0 : 0);
}

export function formatPct(value: number) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

export function annualFactor(frequency: string) {
  switch (frequency) {
    case "WEEKLY":
      return 52;
    case "MONTHLY":
      return 12;
    case "QUARTERLY":
      return 4;
    case "SEMI_ANNUAL":
      return 2;
    case "ANNUAL":
      return 1;
    default:
      return 12;
  }
}

export const ASSET_TYPES = [
  { value: "CRYPTO", label: "Crypto" },
  { value: "STOCK", label: "Acciones" },
  { value: "CEDEAR", label: "CEDEAR" },
  { value: "BOND", label: "Bonos" },
  { value: "REAL_ESTATE", label: "Real Estate" },
  { value: "OTHER", label: "Otro" },
] as const;

export const ACCOUNT_TYPES = [
  { value: "bank", label: "Banco" },
  { value: "broker", label: "Broker" },
  { value: "exchange", label: "Exchange" },
  { value: "wallet", label: "Wallet" },
  { value: "physical", label: "Efectivo" },
] as const;

export const CURRENCIES = ["USD", "ARS", "USDT", "EUR"] as const;

export const FREQUENCIES = [
  { value: "MONTHLY", label: "Mensual" },
  { value: "QUARTERLY", label: "Trimestral" },
  { value: "SEMI_ANNUAL", label: "Semestral" },
  { value: "ANNUAL", label: "Anual" },
] as const;

export const TX_TYPES = [
  { value: "INCOME", label: "Ingreso" },
  { value: "EXPENSE", label: "Gasto" },
  { value: "RENT", label: "Alquiler" },
  { value: "DIVIDEND", label: "Dividendo" },
  { value: "COUPON", label: "Cupón" },
  { value: "BUY", label: "Compra" },
  { value: "SELL", label: "Venta" },
  { value: "TRANSFER", label: "Transferencia" },
] as const;

/**
 * Parse a human-typed amount, returning null when it isn't a number.
 *
 * "1.234" is genuinely ambiguous — 1234 grouped es-AR, or 1.234 with three
 * decimals. An earlier version assumed a dot before three digits was always a
 * thousands separator, which silently turned a 201.644 coupon into 201,644.
 * The rule now:
 *
 *   both . and ,   -> whichever comes last is the decimal separator
 *   one kind, once -> that is the decimal separator ("201.644" -> 201.644)
 *   one kind, many -> grouping ("1.234.567" -> 1234567)
 */
export function parseAmount(raw: string | null | undefined): number | null {
  const cleaned = (raw ?? "").trim().replace(/[^0-9,.-]/g, "");
  if (!cleaned || !/[0-9]/.test(cleaned)) return null;

  const lastDot = cleaned.lastIndexOf(".");
  const lastComma = cleaned.lastIndexOf(",");
  let normalised: string;

  if (lastDot >= 0 && lastComma >= 0) {
    const decimalIsComma = lastComma > lastDot;
    normalised = decimalIsComma
      ? cleaned.replace(/\./g, "").replace(",", ".")
      : cleaned.replace(/,/g, "");
  } else if (lastDot >= 0) {
    normalised =
      cleaned.split(".").length > 2 ? cleaned.replace(/\./g, "") : cleaned;
  } else if (lastComma >= 0) {
    normalised =
      cleaned.split(",").length > 2
        ? cleaned.replace(/,/g, "")
        : cleaned.replace(",", ".");
  } else {
    normalised = cleaned;
  }

  const value = Number(normalised);
  return Number.isFinite(value) ? value : null;
}
