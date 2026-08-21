import { annualFactor, toUsd } from "@/lib/utils";
import type { Account, Asset, Fx, RecurringIncome } from "@/lib/types";

export function netWorthUsd(p: {
  assets: Asset[];
  accounts: Account[];
  fx: Fx;
}) {
  const assets = p.assets.reduce(
    (s, a) => s + toUsd(a.currentValue, a.currency, p.fx.average),
    0,
  );
  const cash = p.accounts.reduce(
    (s, a) => s + toUsd(a.balance, a.currency, p.fx.average),
    0,
  );
  return assets + cash;
}

export function monthlyRecurringUsd(items: RecurringIncome[], fxAvg: number) {
  return items.reduce((s, r) => {
    const yearly = toUsd(r.amount, r.currency, fxAvg) * annualFactor(r.frequency);
    return s + yearly / 12;
  }, 0);
}

export function realEstateYield(assets: Asset[], rec: RecurringIncome[], fxAvg: number) {
  const re = assets.filter((a) => a.type === "REAL_ESTATE");
  const value = re.reduce((s, a) => s + toUsd(a.currentValue, a.currency, fxAvg), 0);
  if (value <= 0) return 0;
  const ids = new Set(re.map((a) => a.id));
  const yearly = rec
    .filter((r) => ids.has(r.assetId))
    .reduce((s, r) => s + toUsd(r.amount, r.currency, fxAvg) * annualFactor(r.frequency), 0);
  return (yearly / value) * 100;
}
