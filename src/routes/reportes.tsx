import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AssetLink, TipRow } from "@/components/ui/asset-link";
import {
  HelpTip,
  Monitor,
  PageHeader,
  TableWrap,
} from "@/components/ui/monitor";
import { Pager, usePager } from "@/components/ui/pager";
import { Tip } from "@/components/ui/tip";
import { getPortfolio, getPositionPerformance } from "@/lib/server/portfolio";
import { INCOME_KIND_META, INCOME_KINDS } from "@/lib/portfolio-math";
import {
  PERIOD_KINDS,
  addDaysIso,
  periodFor,
  shiftPeriod,
  type PeriodKind,
} from "@/lib/report-period";
import {
  assetPerformance,
  buildReport,
  periodHistory,
  type AssetPerformance,
  type AssetPerformanceRow,
  type HistoryPoint,
  type PeriodReport,
} from "@/lib/reports";
import { formatPct, formatUsd } from "@/lib/utils";

const KIND_VALUES = PERIOD_KINDS.map((k) => k.value) as readonly string[];

const CHART_TIP = {
  background: "#000",
  border: "1px solid #ff6d00",
  borderRadius: 0,
  fontSize: 11,
  fontFamily: "IBM Plex Mono",
  padding: "6px 8px",
};

export const Route = createFileRoute("/reportes")({
  /**
   * Period and anchor date live in the URL: a report is a thing you send
   * someone ("mirá el Q2"), and a link that reopens on whatever period is
   * current would show them a different report than the one you were reading.
   */
  validateSearch: (
    search: Record<string, unknown>,
  ): { p?: PeriodKind; d?: string } => {
    const raw = String(search.p ?? "").toUpperCase();
    const p = KIND_VALUES.includes(raw) ? (raw as PeriodKind) : undefined;
    const d = String(search.d ?? "");
    return {
      ...(p ? { p } : {}),
      ...(/^\d{4}-\d{2}-\d{2}$/.test(d) ? { d } : {}),
    };
  },
  // The per-position window depends on which period is being shown, so the
  // loader has to see the search params.
  loaderDeps: ({ search }) => ({ p: search.p, d: search.d }),
  loader: async ({ deps }) => {
    const today = new Date().toISOString().slice(0, 10);
    const period = periodFor(deps.p ?? "MONTH", deps.d ?? today);
    const [portfolio, positions] = await Promise.all([
      getPortfolio(),
      getPositionPerformance({
        data: {
          // The day before: a snapshot dated on day one already contains day
          // one's movements, so it is a closing value, not an opening one.
          openDate: addDaysIso(period.start, -1),
          closeDate: period.end < today ? period.end : today,
        },
      }),
    ]);
    return { portfolio, positions };
  },
  component: ReportsPage,
});

function ReportsPage() {
  const { portfolio: data, positions } = Route.useLoaderData();
  const search = Route.useSearch();
  const kind: PeriodKind = search.p ?? "MONTH";
  const today = new Date().toISOString().slice(0, 10);
  const anchor = search.d ?? today;

  const r = useMemo(
    () => buildReport(data, kind, anchor, today),
    [data, kind, anchor, today],
  );
  const history = useMemo(
    () => periodHistory(data, kind, anchor, kind === "QUARTER" ? 8 : 12, today),
    [data, kind, anchor, today],
  );
  const perf = useMemo(
    () => assetPerformance(positions, data.assets),
    [positions, data.assets],
  );

  const prev = shiftPeriod(r.period, -1);
  const next = shiftPeriod(r.period, 1);
  /**
   * Where to land when the granularity changes.
   *
   * Anchoring on the period's start sent MENSUAL → SEMANAL from a current
   * August to the week containing August 1st — three weeks in the past — and
   * toggling back and forth walked the report steadily backwards. Looking at a
   * period that contains today means today; looking at a past period keeps its
   * start.
   */
  const switchAnchor =
    r.period.start <= today && today <= r.period.end ? today : r.period.start;
  // A report for a period that has not started yet is a blank page; the arrow
  // is disabled rather than leading somewhere empty.
  const nextIsFuture = next.start > today;

  return (
    <div className="flex flex-col gap-2">
      <PageHeader
        title="REPORTES"
        meta={
          <p className="font-mono text-[11px] text-muted">
            {r.period.title}
            {r.partial ? (
              <span className="ml-2 text-accent">
                EN CURSO
                {/* "7/7 días" alongside "en curso" reads as a contradiction;
                    the count only says something while days are missing. */}
                {r.elapsedDays < r.period.days
                  ? ` · ${r.elapsedDays}/${r.period.days} DÍAS`
                  : ""}
              </span>
            ) : null}
          </p>
        }
        actions={
          <div className="flex items-center gap-1">
            <Link
              to="/reportes"
              search={{ p: kind, d: prev.start }}
              aria-label="Período anterior"
              className="border border-border px-1.5 py-1 text-muted hover:border-accent hover:text-accent"
            >
              <ChevronLeft className="size-3.5" />
            </Link>
            <Link
              to="/reportes"
              search={{ p: kind }}
              className="border border-border px-2 py-1 font-mono text-[11px] tracking-widest text-muted hover:border-accent hover:text-accent"
            >
              HOY
            </Link>
            {nextIsFuture ? (
              <span
                aria-disabled
                className="border border-border/50 px-1.5 py-1 text-subtle"
              >
                <ChevronRight className="size-3.5" />
              </span>
            ) : (
              <Link
                to="/reportes"
                search={{ p: kind, d: next.start }}
                aria-label="Período siguiente"
                className="border border-border px-1.5 py-1 text-muted hover:border-accent hover:text-accent"
              >
                <ChevronRight className="size-3.5" />
              </Link>
            )}
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-1">
        {PERIOD_KINDS.map((k) => (
          <Link
            key={k.value}
            to="/reportes"
            // The anchor is re-derived for the new granularity, so switching
            // from AGO to trimestral lands on the quarter containing August
            // rather than on today's quarter.
            search={{ p: k.value, d: periodFor(k.value, switchAnchor).start }}
            className={`border px-2 py-1 font-mono text-[11px] tracking-widest ${
              kind === k.value
                ? "border-accent text-accent"
                : "border-border text-muted hover:text-fg"
            }`}
          >
            {k.label}
          </Link>
        ))}
        <span className="ml-2 font-mono text-[11px] text-subtle">
          {r.period.start} → {r.period.end}
        </span>
      </div>

      <Tiles r={r} />
      <Quality r={r} />

      <div className="grid gap-2 lg:grid-cols-3">
        <NetWorthPanel r={r} />
        <AttributionPanel r={r} />
      </div>

      <div className="grid gap-2 lg:grid-cols-3">
        <FlowPanel r={r} />
        <KindPanel r={r} />
      </div>

      <PerformancePanel perf={perf} seriesStart={positions.seriesStart} r={r} />

      <HistoryPanel history={history} kind={kind} />

      <div className="grid gap-2 lg:grid-cols-2">
        <ByAssetPanel r={r} />
        <ComparePanel r={r} />
      </div>

      <div className="grid auto-rows-fr gap-2 lg:grid-cols-3">
        <TopPaymentsPanel r={r} />
        <FxPanel r={r} />
        <NextPanel r={r} />
      </div>

      <LedgerPanel r={r} />
    </div>
  );
}

/* ------------------------------------------------------------------ tiles */

function Tile({
  label,
  value,
  sub,
  tone,
  tip,
}: {
  label: string;
  value: string;
  sub?: React.ReactNode;
  tone?: "gain" | "loss" | "accent";
  tip?: React.ReactNode;
}) {
  const body = (
    <div className="min-w-0 border border-border bg-surface px-2 py-1.5">
      <p className="font-mono text-[10px] tracking-[0.14em] text-muted">
        {label}
      </p>
      <p
        className={`truncate font-mono text-lg tabular-nums ${
          tone === "gain"
            ? "text-gain"
            : tone === "loss"
              ? "text-loss"
              : tone === "accent"
                ? "text-accent"
                : "text-fg"
        }`}
      >
        {value}
      </p>
      {sub ? (
        <p className="truncate font-mono text-[10px] text-subtle">{sub}</p>
      ) : null}
    </div>
  );
  if (!tip) return body;
  return (
    <Tip content={tip} className="block">
      {body}
    </Tip>
  );
}

/** Change against the same figure in the previous period. */
function vsPrev(now: number, before: number): string {
  if (before === 0)
    return before === now
      ? "igual que el anterior"
      : "sin período previo comparable";
  const pct = ((now - before) / Math.abs(before)) * 100;
  return `${formatPct(pct)} vs ${formatUsd(before)} anterior`;
}

function Tiles({ r }: { r: PeriodReport }) {
  const t = r.totals;
  return (
    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-6">
      <Tile
        label="NW CIERRE"
        value={r.nwClose == null ? "—" : formatUsd(r.nwClose)}
        sub={
          r.nwCloseDate
            ? `snapshot ${r.nwCloseDate}`
            : "sin snapshot en la ventana"
        }
        tip={
          r.nwClose == null
            ? "No hay ningún snapshot de patrimonio en este período ni antes de su cierre. Los snapshots se graban al actualizar precios."
            : `Último snapshot al ${r.nwCloseDate}${r.nwCloseStaleDays > 0 ? `, ${r.nwCloseStaleDays} días antes del cierre` : ""}.`
        }
      />
      <Tile
        label="VARIACIÓN"
        value={r.nwChange == null ? "—" : formatUsd(r.nwChange)}
        sub={
          r.nwChangePct == null
            ? "falta la apertura"
            : `${formatPct(r.nwChangePct)} · desde ${formatUsd(r.nwOpen ?? 0)}`
        }
        tone={
          r.nwChange == null ? undefined : r.nwChange >= 0 ? "gain" : "loss"
        }
        tip={
          r.nwChange == null
            ? "Sin snapshot anterior al arranque del período no hay saldo de apertura, y una variación sin apertura sería una resta contra cualquier cosa."
            : `Apertura ${formatUsd(r.nwOpen ?? 0)} (snapshot ${r.nwOpenDate}) → cierre ${formatUsd(r.nwClose ?? 0)}.`
        }
      />
      <Tile
        label="COBRADO"
        value={formatUsd(t.incomeUsd)}
        sub={
          r.pendingUsd > 0
            ? `+${formatUsd(r.pendingUsd)} agendado en el período`
            : vsPrev(t.incomeUsd, r.prevTotals.incomeUsd)
        }
        tone="gain"
        tip={
          <div className="space-y-0.5">
            <p>
              Lo que efectivamente entró: cupones, alquileres, dividendos y
              amortizaciones con fecha de hoy o anterior. Las compras y
              transferencias no son ingreso.
            </p>
            {r.pendingUsd > 0 ? (
              <p className="mt-1 border-t border-line pt-1 text-subtle">
                El libro tiene además {r.pendingCount} cobro
                {r.pendingCount === 1 ? "" : "s"} por {formatUsd(r.pendingUsd)}{" "}
                con fecha posterior a hoy. Van aparte: todavía no se cobraron.
              </p>
            ) : null}
          </div>
        }
      />
      <Tile
        label="EGRESOS"
        value={formatUsd(t.expenseUsd)}
        sub={
          r.feesUsd > 0
            ? `${formatUsd(r.feesUsd)} en comisiones`
            : vsPrev(t.expenseUsd, r.prevTotals.expenseUsd)
        }
        tone={t.expenseUsd > 0 ? "loss" : undefined}
        tip="Gastos y comisiones registrados. Las compras van aparte: comprar no es perder."
      />
      <Tile
        label="FLUJO NETO"
        value={formatUsd(t.netFlowUsd)}
        sub={`${t.txCount} movimientos${t.buysUsd > 0 ? ` · ${formatUsd(t.buysUsd)} en compras` : ""}`}
        tone={t.netFlowUsd >= 0 ? "gain" : "loss"}
        tip="Ingresos menos egresos. Es caja, no rendimiento: el revalúo de las posiciones no pasa por el libro."
      />
      <Tile
        label="RESTO"
        value={r.residualUsd == null ? "—" : formatUsd(r.residualUsd)}
        sub="mercado, FX y no registrado"
        tone={
          r.residualUsd == null
            ? undefined
            : r.residualUsd >= 0
              ? "gain"
              : "loss"
        }
        tip="La parte de la variación del patrimonio que el libro no explica: revalúo de las posiciones, movimiento del dólar y cualquier compra o venta que no se cargó. No es una estimación de rendimiento."
      />
    </div>
  );
}

/** Anything that would make a number on this page mean less than it looks. */
function Quality({ r }: { r: PeriodReport }) {
  const notes: string[] = [];
  if (r.nwOpen == null)
    notes.push(
      "sin snapshot previo al arranque: no hay saldo de apertura ni variación",
    );
  else if (r.nwOpenStaleDays > 3)
    notes.push(
      `la apertura viene de un snapshot ${r.nwOpenStaleDays} días anterior (${r.nwOpenDate})`,
    );
  if (r.nwClose != null && r.nwCloseStaleDays > 3)
    notes.push(
      `el cierre viene de un snapshot ${r.nwCloseStaleDays} días anterior (${r.nwCloseDate})`,
    );
  if (r.fxFallbackCount > 0)
    notes.push(
      `${r.fxFallbackCount} ${r.fxFallbackCount === 1 ? "movimiento en pesos convertido" : "movimientos en pesos convertidos"} al dólar de hoy porque el historial de FX no llega a esa fecha`,
    );
  if (notes.length === 0) return null;
  return (
    <p className="border border-loss/40 bg-loss/5 px-2 py-1 font-mono text-[11px] text-loss">
      {notes.join(" · ")}
    </p>
  );
}

/* ------------------------------------------------------------- patrimonio */

function NetWorthPanel({ r }: { r: PeriodReport }) {
  const hasSeries = r.nwSeries.length >= 2;
  return (
    <Monitor
      title="PATRIMONIO EN EL PERÍODO"
      emphasis="primary"
      className="lg:col-span-2"
      action={
        <HelpTip content="Snapshots grabados dentro de la ventana. La línea punteada es el saldo de apertura." />
      }
    >
      <div className="h-48">
        {hasSeries ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={r.nwSeries}
              margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="nwFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4aa3ff" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#4aa3ff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="label"
                tick={{
                  fill: "#6b7280",
                  fontSize: 10,
                  fontFamily: "IBM Plex Mono",
                }}
                axisLine={false}
                tickLine={false}
                minTickGap={20}
              />
              <YAxis
                width={52}
                domain={["dataMin", "dataMax"]}
                tick={{
                  fill: "#6b7280",
                  fontSize: 10,
                  fontFamily: "IBM Plex Mono",
                }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => formatUsd(v)}
              />
              <Tooltip
                contentStyle={CHART_TIP}
                formatter={(v: number) => [formatUsd(v), "NW"]}
              />
              {r.nwOpen != null ? (
                <ReferenceLine
                  y={r.nwOpen}
                  stroke="#6b7280"
                  strokeDasharray="3 3"
                />
              ) : null}
              <Area
                type="monotone"
                dataKey="value"
                stroke="#4aa3ff"
                strokeWidth={1.5}
                fill="url(#nwFill)"
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <p className="flex h-full items-center font-mono text-xs text-muted">
            {r.nwSeries.length === 1
              ? "un solo snapshot en la ventana — hacen falta dos para dibujar una serie"
              : "sin snapshots en este período. Se graban cada vez que se actualizan precios."}
          </p>
        )}
      </div>
      <div className="mt-1 grid grid-cols-2 gap-x-4 border-t border-line pt-1 font-mono text-[11px] sm:grid-cols-4">
        <TipRow
          label="apertura"
          value={r.nwOpen == null ? "—" : formatUsd(r.nwOpen)}
        />
        <TipRow
          label="máximo"
          value={r.nwHigh == null ? "—" : formatUsd(r.nwHigh)}
        />
        <TipRow
          label="mínimo"
          value={r.nwLow == null ? "—" : formatUsd(r.nwLow)}
        />
        <TipRow
          label="drawdown"
          value={r.drawdownPct == null ? "—" : `${r.drawdownPct.toFixed(2)}%`}
          tone={r.drawdownPct != null && r.drawdownPct < 0 ? "loss" : "muted"}
        />
      </div>
    </Monitor>
  );
}

/* ------------------------------------------------------------ atribución */

/**
 * What moved the number.
 *
 * Deliberately three bars from zero rather than a waterfall: a waterfall of a
 * $1,700 flow against a $250,000 balance needs an axis that starts at the
 * balance, and then the opening and closing bars run off the chart. These are
 * the components, and the opening and closing balances are stated in words.
 */
function AttributionPanel({ r }: { r: PeriodReport }) {
  const rows = [
    { name: "INGRESOS", value: r.totals.incomeUsd },
    { name: "EGRESOS", value: -r.totals.expenseUsd },
    ...(r.residualUsd != null ? [{ name: "RESTO", value: r.residualUsd }] : []),
  ];
  return (
    <Monitor
      title="QUÉ MOVIÓ EL PATRIMONIO"
      action={
        <HelpTip content="Ingresos y egresos salen del libro. RESTO es lo que queda de la variación: revalúo, dólar y movimientos sin cargar." />
      }
    >
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={rows}
            layout="vertical"
            margin={{ top: 4, right: 8, left: 4, bottom: 0 }}
          >
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="name"
              width={62}
              tick={{
                fill: "#9aa0a6",
                fontSize: 10,
                fontFamily: "IBM Plex Mono",
              }}
              axisLine={false}
              tickLine={false}
            />
            <ReferenceLine x={0} stroke="#2a2a2a" />
            <Tooltip
              cursor={{ fill: "#ffffff0d" }}
              contentStyle={CHART_TIP}
              formatter={(v: number) => [formatUsd(v), ""]}
            />
            <Bar dataKey="value" isAnimationActive={false} barSize={18}>
              {rows.map((row) => (
                <Cell
                  key={row.name}
                  fill={row.value >= 0 ? "#22c55e" : "#ef4444"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1 border-t border-line pt-1 font-mono text-[11px] text-subtle">
        {r.nwOpen == null || r.nwClose == null
          ? "sin snapshots de apertura y cierre no se puede cerrar la cuenta"
          : `${formatUsd(r.nwOpen)} → ${formatUsd(r.nwClose)}`}
      </p>
    </Monitor>
  );
}

/* ----------------------------------------------------------------- flujos */

function FlowPanel({ r }: { r: PeriodReport }) {
  const active = INCOME_KINDS.filter((k) =>
    r.buckets.some((b) => (b[k] ?? 0) > 0),
  );
  const any = r.buckets.some((b) => b.income > 0 || b.expense > 0);
  return (
    <Monitor
      title="MOVIMIENTOS DEL PERÍODO"
      className="lg:col-span-2"
      action={
        <HelpTip content="Ingresos apilados por tipo, egresos hacia abajo. Cada barra es un día (o una semana, en el trimestral). Sólo lo ya cobrado: los cupones agendados a futuro no dibujan barra." />
      }
    >
      <div className="h-44">
        {any ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={r.buckets}
              margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
              stackOffset="sign"
              maxBarSize={44}
            >
              <XAxis
                dataKey="label"
                tick={{
                  fill: "#6b7280",
                  fontSize: 9,
                  fontFamily: "IBM Plex Mono",
                }}
                axisLine={false}
                tickLine={false}
                minTickGap={14}
              />
              <YAxis
                width={46}
                tick={{
                  fill: "#6b7280",
                  fontSize: 10,
                  fontFamily: "IBM Plex Mono",
                }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => formatUsd(v)}
              />
              <ReferenceLine y={0} stroke="#2a2a2a" />
              <Tooltip
                cursor={{ fill: "#ffffff0d" }}
                contentStyle={CHART_TIP}
                content={<BucketTip />}
              />
              {active.map((k) => (
                <Bar
                  key={k}
                  dataKey={k}
                  stackId="flow"
                  fill={INCOME_KIND_META[k].color}
                  isAnimationActive={false}
                />
              ))}
              <Bar
                dataKey={(row: { expense: number }) => -row.expense}
                name="Egresos"
                stackId="flow"
                fill="#ef4444"
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="flex h-full items-center font-mono text-xs text-muted">
            sin movimientos registrados en este período
          </p>
        )}
      </div>
    </Monitor>
  );
}

type BucketRowLike = {
  label: string;
  income: number;
  expense: number;
  net: number;
} & Partial<Record<string, number>>;

function BucketTip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload?: BucketRowLike }[];
}) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  const parts = INCOME_KINDS.filter((k) => (row[k] ?? 0) > 0);
  if (parts.length === 0 && row.expense === 0) return null;
  return (
    <div className="z-[100] max-w-xs border border-accent bg-black px-2 py-1.5 font-mono text-[12px] leading-snug text-fg">
      <p className="mb-1 border-b border-line pb-1 text-accent">{row.label}</p>
      {parts.map((k) => (
        <div key={k} className="flex justify-between gap-4">
          <span className="inline-flex items-center gap-1 text-subtle">
            <span
              className="inline-block size-2"
              style={{ background: INCOME_KIND_META[k].color }}
            />
            {INCOME_KIND_META[k].label}
          </span>
          <span className="tabular-nums">{formatUsd(row[k] ?? 0)}</span>
        </div>
      ))}
      {row.expense > 0 ? (
        <TipRow
          label="Egresos"
          value={`-${formatUsd(row.expense)}`}
          tone="loss"
        />
      ) : null}
      <div className="mt-1 border-t border-line pt-1">
        <TipRow
          label="NETO"
          value={formatUsd(row.net)}
          tone={row.net >= 0 ? "gain" : "loss"}
        />
      </div>
    </div>
  );
}

/* --------------------------------------------------------- ingresos x tipo */

function KindPanel({ r }: { r: PeriodReport }) {
  const total = r.incomeByKind.reduce((s, k) => s + k.amountUsd, 0);
  return (
    <Monitor
      title="INGRESOS POR TIPO"
      action={
        <HelpTip content="Composición de lo cobrado en el período. El tipo se infiere del tipo de movimiento y del texto." />
      }
    >
      {r.incomeByKind.length === 0 ? (
        <p className="flex h-40 items-center font-mono text-xs text-muted">
          sin ingresos registrados
        </p>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <div className="h-[124px] w-[124px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={r.incomeByKind}
                  dataKey="amountUsd"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  innerRadius={34}
                  outerRadius={56}
                  paddingAngle={2}
                  stroke="#0a0a0a"
                  strokeWidth={2}
                  isAnimationActive={false}
                >
                  {r.incomeByKind.map((k) => (
                    <Cell key={k.kind} fill={k.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={CHART_TIP}
                  formatter={(v: number, name: string) => [
                    `${formatUsd(Number(v))} · ${((Number(v) / (total || 1)) * 100).toFixed(1)}%`,
                    name,
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="w-full space-y-1">
            {r.incomeByKind.map((k) => (
              <div
                key={k.kind}
                className="flex items-center gap-2 font-mono text-[11px]"
              >
                <span
                  className="size-2 shrink-0"
                  style={{ background: k.color }}
                />
                <span className="flex-1 truncate text-muted">{k.label}</span>
                <span className="shrink-0 tabular-nums text-subtle">
                  {k.count}×
                </span>
                <span className="w-20 shrink-0 text-right tabular-nums text-gain">
                  {formatUsd(k.amountUsd)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Monitor>
  );
}

/* ------------------------------------------------------- ingresos x activo */

function ByAssetPanel({ r }: { r: PeriodReport }) {
  return (
    <Monitor
      title="INGRESOS POR ACTIVO"
      bodyClassName="p-0"
      action={
        <HelpTip content="Quién pagó en el período. Un cobro de un bono vendido o nunca cargado aparece como sin activo asociado: igual entró plata." />
      }
    >
      <TableWrap className="mx-0 px-0">
        <table className="w-full font-mono text-[12px]">
          <thead>
            <tr className="border-b border-border text-left text-[11px] tracking-widest text-accent">
              <th className="px-2 py-1.5">ACTIVO</th>
              <th className="px-2 py-1.5">TIPO</th>
              <th className="px-2 py-1.5 text-right">PAGOS</th>
              <th className="px-2 py-1.5 text-right">COBRADO</th>
              <th className="px-2 py-1.5 text-right">%</th>
            </tr>
          </thead>
          <tbody>
            {r.incomeByAsset.map((row) => {
              const total = r.totals.incomeUsd || 1;
              return (
                <tr
                  key={row.assetId ?? "__none"}
                  className="border-b border-border/50 hover:bg-raised/40"
                >
                  <td className="px-2 py-1.5">
                    {row.assetId ? (
                      <AssetLink id={row.assetId} name={row.name} />
                    ) : (
                      <span className="text-subtle">{row.name}</span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-muted">
                    {row.kinds.map((k) => INCOME_KIND_META[k].label).join(", ")}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-muted">
                    {row.count}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-gain">
                    {formatUsd(row.amountUsd)}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-subtle">
                    {((row.amountUsd / total) * 100).toFixed(1)}%
                  </td>
                </tr>
              );
            })}
            {r.incomeByAsset.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-2 py-8 text-center text-muted">
                  sin cobros en este período
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </TableWrap>
    </Monitor>
  );
}

/* ------------------------------------------------------ vs período anterior */

function ComparePanel({ r }: { r: PeriodReport }) {
  const rows = [
    {
      name: "INGRESOS",
      actual: r.totals.incomeUsd,
      previo: r.prevTotals.incomeUsd,
    },
    {
      name: "EGRESOS",
      actual: r.totals.expenseUsd,
      previo: r.prevTotals.expenseUsd,
    },
    {
      name: "NETO",
      actual: r.totals.netFlowUsd,
      previo: r.prevTotals.netFlowUsd,
    },
    {
      name: "COMPRAS",
      actual: r.totals.buysUsd,
      previo: r.prevTotals.buysUsd,
    },
  ];
  return (
    <Monitor
      title={`${r.period.label} vs ${r.previous.label}`}
      action={
        <HelpTip content="El mismo corte sobre el período anterior. Si el actual está en curso la comparación es contra un período completo, así que va a quedar corta." />
      }
    >
      {r.partial && r.elapsedDays < r.period.days ? (
        <p className="mb-1 font-mono text-[10px] text-accent">
          período en curso: {r.elapsedDays} de {r.period.days} días contra uno
          completo
        </p>
      ) : null}
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={rows}
            margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
          >
            <XAxis
              dataKey="name"
              tick={{
                fill: "#6b7280",
                fontSize: 10,
                fontFamily: "IBM Plex Mono",
              }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              width={46}
              tick={{
                fill: "#6b7280",
                fontSize: 10,
                fontFamily: "IBM Plex Mono",
              }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => formatUsd(v)}
            />
            <ReferenceLine y={0} stroke="#2a2a2a" />
            <Tooltip
              cursor={{ fill: "#ffffff0d" }}
              contentStyle={CHART_TIP}
              formatter={(v: number, n: string) => [formatUsd(v), n]}
            />
            <Bar
              dataKey="previo"
              name={r.previous.label}
              fill="#4b5563"
              isAnimationActive={false}
            />
            <Bar
              dataKey="actual"
              name={r.period.label}
              fill="#4aa3ff"
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Monitor>
  );
}

/* ------------------------------------------------ rendimiento por posición */

/**
 * What each holding did, with buying and selling taken out of it.
 *
 * The reason this panel could not exist before is that only the net worth total
 * was recorded over time. It now reads two dates of per-position history, and
 * it will be empty for any period before that history began — which it says,
 * rather than filling the gap with a number.
 */
function PerformancePanel({
  perf,
  seriesStart,
  r,
}: {
  perf: AssetPerformance;
  seriesStart: string | null;
  r: PeriodReport;
}) {
  if (perf.empty) {
    return (
      <Monitor title="RENDIMIENTO POR POSICIÓN" emphasis="primary">
        <p className="py-6 font-mono text-xs leading-relaxed text-muted">
          {seriesStart == null ? (
            <>
              Todavía no hay historial por posición. Se empieza a grabar en el
              próximo refresh de precios, y desde ahí cada reporte va a poder
              decir qué ganó y qué perdió cada tenencia.
            </>
          ) : (
            <>
              El historial por posición arranca el{" "}
              <span className="text-fg">{seriesStart}</span>. Para medir{" "}
              {r.period.label} haría falta un registro del{" "}
              <span className="text-fg">{addDaysIso(r.period.start, -1)}</span>{" "}
              o anterior, y no existe: lo que valía cada posición antes de esa
              fecha no quedó grabado en ningún lado, y no se inventa.
            </>
          )}
        </p>
      </Monitor>
    );
  }

  const chart = [...perf.winners].reverse().concat(perf.losers);
  return (
    <Monitor
      title="RENDIMIENTO POR POSICIÓN"
      emphasis="primary"
      action={
        <HelpTip content="Cuánto rindió cada tenencia, sacando lo que se compró y se vendió. Comprar más no es ganar." />
      }
    >
      <div className="grid gap-2 lg:grid-cols-5">
        <div className="lg:col-span-2">
          {/* The chart is the extremes, the table is everything — saying so
              stops the two from looking like they disagree. */}
          <p className="mb-1 font-mono text-[10px] tracking-[0.14em] text-muted">
            MAYORES MOVIMIENTOS
          </p>
          <div style={{ height: Math.max(140, chart.length * 24 + 20) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chart}
                layout="vertical"
                margin={{ top: 4, right: 8, left: 4, bottom: 0 }}
              >
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey={(row: AssetPerformanceRow) => row.ticker || row.name}
                  width={70}
                  tick={{
                    fill: "#9aa0a6",
                    fontSize: 10,
                    fontFamily: "IBM Plex Mono",
                  }}
                  axisLine={false}
                  tickLine={false}
                />
                <ReferenceLine x={0} stroke="#2a2a2a" />
                <Tooltip
                  cursor={{ fill: "#ffffff0d" }}
                  contentStyle={CHART_TIP}
                  content={<PerfTip />}
                />
                <Bar dataKey="priceUsd" isAnimationActive={false} barSize={14}>
                  {chart.map((row) => (
                    <Cell
                      key={row.assetId}
                      fill={row.priceUsd >= 0 ? "#22c55e" : "#ef4444"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-3">
          <p className="mb-1 font-mono text-[10px] tracking-[0.14em] text-muted">
            TODAS · {perf.rows.length}
          </p>
          <TableWrap className="mx-0 max-h-[340px] overflow-y-auto px-0">
            <table className="w-full font-mono text-[12px]">
              <thead className="sticky top-0 bg-surface">
                <tr className="border-b border-border text-left text-[11px] tracking-widest text-accent">
                  <th className="px-2 py-1">POSICIÓN</th>
                  <th className="hidden px-2 py-1 text-right md:table-cell">
                    APERTURA
                  </th>
                  <th className="hidden px-2 py-1 text-right md:table-cell">
                    CIERRE
                  </th>
                  <th className="px-2 py-1 text-right">RENDIMIENTO</th>
                  <th className="px-2 py-1 text-right">%</th>
                  <th className="hidden px-2 py-1 text-right sm:table-cell">
                    COMPRA/VENTA
                  </th>
                </tr>
              </thead>
              <tbody>
                {perf.rows.map((row) => (
                  <tr
                    key={row.assetId}
                    className="border-b border-border/50 hover:bg-raised/40"
                  >
                    <td className="px-2 py-1">
                      <AssetLink
                        id={row.assetId}
                        name={row.ticker || row.name}
                      />
                      {row.opened ? (
                        <span
                          className="ml-1 text-[10px] text-accent"
                          title="Se compró dentro del período: no hay apertura contra la cual medir rendimiento."
                        >
                          NUEVA
                        </span>
                      ) : null}
                      {row.closed ? (
                        <span
                          className="ml-1 text-[10px] text-accent"
                          title="Ya no está en el libro. La baja se cuenta como venta, no como pérdida."
                        >
                          CERRADA
                        </span>
                      ) : null}
                      {row.estimated ? (
                        <span
                          className="ml-1 text-[10px] text-loss"
                          title="Falta la cantidad en alguna de las dos puntas, así que no se puede separar el precio de la compra. Se informa el movimiento entero como precio."
                        >
                          SIN CANTIDAD
                        </span>
                      ) : null}
                    </td>
                    <td className="hidden px-2 py-1 text-right tabular-nums text-subtle md:table-cell">
                      {row.openUsd == null ? "—" : formatUsd(row.openUsd)}
                    </td>
                    <td className="hidden px-2 py-1 text-right tabular-nums text-muted md:table-cell">
                      {row.closeUsd == null ? "—" : formatUsd(row.closeUsd)}
                    </td>
                    <td
                      className={`px-2 py-1 text-right tabular-nums ${
                        row.priceUsd > 0
                          ? "text-gain"
                          : row.priceUsd < 0
                            ? "text-loss"
                            : "text-subtle"
                      }`}
                    >
                      {row.priceUsd === 0 ? "—" : formatUsd(row.priceUsd)}
                    </td>
                    <td
                      className={`px-2 py-1 text-right tabular-nums ${
                        row.pricePct == null
                          ? "text-subtle"
                          : row.pricePct >= 0
                            ? "text-gain"
                            : "text-loss"
                      }`}
                    >
                      {row.pricePct == null ? "—" : formatPct(row.pricePct)}
                    </td>
                    <td className="hidden px-2 py-1 text-right tabular-nums text-subtle sm:table-cell">
                      {row.flowUsd === 0 ? "—" : formatUsd(row.flowUsd)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </div>
      </div>

      <div className="mt-1 grid grid-cols-2 gap-x-4 border-t border-line pt-1 font-mono text-[11px] sm:grid-cols-4">
        <TipRow
          label="rindió"
          value={formatUsd(perf.totalPriceUsd)}
          tone={perf.totalPriceUsd >= 0 ? "gain" : "loss"}
        />
        <TipRow
          label="sobre"
          value={formatUsd(perf.openBaseUsd)}
          tone="muted"
        />
        <TipRow
          label="retorno"
          value={
            perf.totalPricePct == null ? "—" : formatPct(perf.totalPricePct)
          }
          tone={
            perf.totalPricePct == null
              ? "muted"
              : perf.totalPricePct >= 0
                ? "gain"
                : "loss"
          }
        />
        <TipRow
          label="compras netas"
          value={formatUsd(perf.totalFlowUsd)}
          tone="muted"
        />
      </div>
      {perf.estimatedCount > 0 ? (
        <p className="mt-1 font-mono text-[10px] text-loss">
          {perf.estimatedCount}{" "}
          {perf.estimatedCount === 1 ? "posición" : "posiciones"} sin cantidad:
          su movimiento se informa entero como precio. Si le cargaste o sacaste
          plata en el período, ese número está inflado.
        </p>
      ) : null}
      <p className="mt-1 font-mono text-[10px] text-subtle">
        RENDIMIENTO es lo que hizo lo que ya tenías; COMPRA/VENTA es lo que
        entró o salió. Los dos suman la variación total de cada posición.
      </p>
    </Monitor>
  );
}

function PerfTip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload?: AssetPerformanceRow }[];
}) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  return (
    <div className="z-[100] max-w-xs border border-accent bg-black px-2 py-1.5 font-mono text-[12px] leading-snug text-fg">
      <p className="mb-1 border-b border-line pb-1 text-accent">
        {row.ticker || row.name}
      </p>
      <TipRow
        label="apertura"
        value={row.openUsd == null ? "sin registro" : formatUsd(row.openUsd)}
        tone="muted"
      />
      <TipRow
        label="cierre"
        value={row.closeUsd == null ? "sin registro" : formatUsd(row.closeUsd)}
        tone="muted"
      />
      <TipRow
        label="rendimiento"
        value={`${formatUsd(row.priceUsd)}${row.pricePct == null ? "" : ` · ${formatPct(row.pricePct)}`}`}
        tone={row.priceUsd >= 0 ? "gain" : "loss"}
      />
      <TipRow
        label="compra/venta"
        value={row.flowUsd === 0 ? "—" : formatUsd(row.flowUsd)}
        tone="muted"
      />
      {row.openQty != null && row.closeQty != null ? (
        <TipRow
          label="cantidad"
          value={`${row.openQty.toLocaleString("es-AR")} → ${row.closeQty.toLocaleString("es-AR")}`}
          tone="muted"
        />
      ) : null}
      {row.estimated ? (
        <p className="mt-1 border-t border-line pt-1 text-loss">
          Sin cantidad: no se puede separar el precio de la compra.
        </p>
      ) : null}
      {row.unpriced ? (
        <p className="mt-1 border-t border-line pt-1 text-loss">
          Alguna punta se apoyó en el costo por falta de cotización.
        </p>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------- histórico */

/**
 * The same cut over the last N periods.
 *
 * The single-period numbers above answer "how was August"; this answers
 * "is this normal", which is the question a report exists for.
 */
function HistoryPanel({
  history,
  kind,
}: {
  history: HistoryPoint[];
  kind: PeriodKind;
}) {
  const hasNw = history.some((h) => h.nwClose != null);
  const unit =
    kind === "WEEK" ? "semanas" : kind === "MONTH" ? "meses" : "trimestres";
  const avg =
    history.filter((h) => !h.partial).reduce((s, h) => s + h.incomeUsd, 0) /
    Math.max(1, history.filter((h) => !h.partial).length);
  return (
    <Monitor
      title={`HISTÓRICO · ÚLTIMOS ${history.length} ${unit.toUpperCase()}`}
      emphasis="primary"
      action={
        <HelpTip content="Ingresos y egresos por período, con el patrimonio al cierre de cada uno. El período en curso va rayado: todavía no terminó, así que su barra no es comparable." />
      }
    >
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={history}
            margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
          >
            <XAxis
              dataKey="label"
              tick={{
                fill: "#6b7280",
                fontSize: 9,
                fontFamily: "IBM Plex Mono",
              }}
              axisLine={false}
              tickLine={false}
              minTickGap={4}
            />
            <YAxis
              yAxisId="flow"
              width={48}
              tick={{
                fill: "#6b7280",
                fontSize: 10,
                fontFamily: "IBM Plex Mono",
              }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => formatUsd(v)}
            />
            {hasNw ? (
              <YAxis
                yAxisId="nw"
                orientation="right"
                width={52}
                domain={["dataMin", "dataMax"]}
                tick={{
                  fill: "#4aa3ff",
                  fontSize: 10,
                  fontFamily: "IBM Plex Mono",
                }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => formatUsd(v)}
              />
            ) : null}
            <Tooltip
              cursor={{ fill: "#ffffff0d" }}
              contentStyle={CHART_TIP}
              content={<HistoryTip />}
            />
            <ReferenceLine yAxisId="flow" y={0} stroke="#2a2a2a" />
            <Bar
              yAxisId="flow"
              dataKey="incomeUsd"
              name="Ingresos"
              isAnimationActive={false}
            >
              {history.map((h) => (
                <Cell
                  key={h.start}
                  fill="#22c55e"
                  // The unfinished period is dimmed rather than dropped: it is
                  // real money, it is just not a full period's worth.
                  fillOpacity={h.partial ? 0.35 : h.current ? 1 : 0.75}
                />
              ))}
            </Bar>
            <Bar
              yAxisId="flow"
              dataKey={(h: HistoryPoint) => -h.expenseUsd}
              name="Egresos"
              isAnimationActive={false}
            >
              {history.map((h) => (
                <Cell
                  key={h.start}
                  fill="#ef4444"
                  fillOpacity={h.partial ? 0.35 : h.current ? 1 : 0.75}
                />
              ))}
            </Bar>
            {hasNw ? (
              <Line
                yAxisId="nw"
                type="monotone"
                dataKey="nwClose"
                name="NW al cierre"
                stroke="#4aa3ff"
                strokeWidth={1.5}
                dot={{ r: 2, fill: "#4aa3ff" }}
                connectNulls
                isAnimationActive={false}
              />
            ) : null}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1 border-t border-line pt-1 font-mono text-[11px] text-subtle">
        Promedio de ingresos por período cerrado: {formatUsd(avg)}
        {hasNw
          ? " · la línea azul es el patrimonio al cierre (eje derecho)"
          : ""}
      </p>
    </Monitor>
  );
}

function HistoryTip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload?: HistoryPoint }[];
}) {
  const h = payload?.[0]?.payload;
  if (!active || !h) return null;
  return (
    <div className="z-[100] max-w-xs border border-accent bg-black px-2 py-1.5 font-mono text-[12px] leading-snug text-fg">
      <p className="mb-1 border-b border-line pb-1 text-accent">
        {h.label}
        {h.partial ? " · en curso" : ""}
      </p>
      <TipRow label="ingresos" value={formatUsd(h.incomeUsd)} tone="gain" />
      <TipRow label="egresos" value={formatUsd(h.expenseUsd)} tone="loss" />
      <TipRow label="neto" value={formatUsd(h.netFlowUsd)} />
      <TipRow
        label="NW al cierre"
        value={h.nwClose == null ? "sin snapshot" : formatUsd(h.nwClose)}
        tone="muted"
      />
    </div>
  );
}

/* ------------------------------------------------------------- top cobros */

function TopPaymentsPanel({ r }: { r: PeriodReport }) {
  return (
    <Monitor
      title="TOP COBROS"
      bodyClassName="p-0"
      action={
        <HelpTip content="Los pagos más grandes que entraron en el período." />
      }
    >
      <TableWrap className="mx-0 px-0">
        <table className="w-full font-mono text-[12px]">
          <tbody>
            {r.topPayments.map((p) => (
              <tr
                key={p.tx.id}
                className="border-b border-border/50 hover:bg-raised/40"
              >
                <td className="px-2 py-1 whitespace-nowrap text-subtle">
                  {p.tx.date}
                </td>
                <td className="px-2 py-1">
                  {p.tx.assetId ? (
                    <AssetLink id={p.tx.assetId} name={p.tx.description} />
                  ) : (
                    <span className="truncate text-fg">{p.tx.description}</span>
                  )}
                </td>
                <td className="px-2 py-1 text-right tabular-nums text-gain">
                  {formatUsd(p.amountUsd)}
                </td>
              </tr>
            ))}
            {r.topPayments.length === 0 ? (
              <tr>
                <td className="px-2 py-8 text-center text-muted">sin cobros</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </TableWrap>
    </Monitor>
  );
}

/* ------------------------------------------------------------------- fx */

function FxPanel({ r }: { r: PeriodReport }) {
  const rows: {
    label: string;
    open: number | undefined;
    close: number | undefined;
  }[] = [
    { label: "OFICIAL", open: r.fxOpen?.official, close: r.fxClose?.official },
    { label: "BLUE", open: r.fxOpen?.blue, close: r.fxClose?.blue },
    { label: "MEP", open: r.fxOpen?.mep, close: r.fxClose?.mep },
  ];
  const ars = (v: number | undefined) =>
    v == null ? "—" : `$${Math.round(v).toLocaleString("es-AR")}`;
  return (
    <Monitor
      title="DÓLAR EN EL PERÍODO"
      action={
        <HelpTip content="De fx_history, que suma una fila cada vez que se actualizan precios. Sin filas en la ventana no hay movimiento que mostrar." />
      }
    >
      {r.fxOpen == null && r.fxClose == null ? (
        <p className="flex h-32 items-center font-mono text-xs text-muted">
          sin historial de dólar en esta ventana
        </p>
      ) : (
        <table className="w-full font-mono text-[12px]">
          <thead>
            <tr className="border-b border-line text-left text-[11px] text-muted">
              <th className="py-1">TIPO</th>
              <th className="py-1 text-right">APERTURA</th>
              <th className="py-1 text-right">CIERRE</th>
              <th className="py-1 text-right">VAR</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const pct =
                row.open && row.close && row.open > 0
                  ? (row.close / row.open - 1) * 100
                  : null;
              return (
                <tr key={row.label} className="border-b border-line/50">
                  <td className="py-1 text-muted">{row.label}</td>
                  <td className="py-1 text-right tabular-nums text-subtle">
                    {ars(row.open)}
                  </td>
                  <td className="py-1 text-right tabular-nums text-fg">
                    {ars(row.close)}
                  </td>
                  <td
                    className={`py-1 text-right tabular-nums ${
                      pct == null
                        ? "text-subtle"
                        : pct >= 0
                          ? "text-loss"
                          : "text-gain"
                    }`}
                  >
                    {pct == null ? "—" : formatPct(pct)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {r.fxOpen != null || r.fxClose != null ? (
        <p className="mt-1 font-mono text-[10px] text-subtle">
          Un dólar que sube encarece el peso: en un libro medido en dólares eso
          resta, por eso la suba va en rojo.
        </p>
      ) : null}
    </Monitor>
  );
}

/* ----------------------------------------------------------- lo que viene */

function NextPanel({ r }: { r: PeriodReport }) {
  const next = shiftPeriod(r.period, 1);
  return (
    <Monitor
      title="PRÓXIMO PERÍODO"
      action={
        <HelpTip content="Ingresos ya agendados para el período siguiente, desde los flujos recurrentes y el calendario de cupones. Es un plan, no un cobro." />
      }
    >
      <div className="flex h-full flex-col justify-center gap-1">
        <p className="font-mono text-[11px] text-muted">{next.title}</p>
        <p className="font-mono text-2xl tabular-nums text-gain">
          {formatUsd(r.projectedNextUsd)}
        </p>
        <p className="font-mono text-[11px] text-subtle">
          {r.projectedNextCount}{" "}
          {r.projectedNextCount === 1 ? "cobro agendado" : "cobros agendados"}
        </p>
        {r.pendingUsd > 0 ? (
          <p className="mt-2 border-t border-line pt-2 font-mono text-[11px] text-muted">
            Antes de eso quedan {formatUsd(r.pendingUsd)} por cobrar en{" "}
            {r.period.label} ({r.pendingCount})
          </p>
        ) : null}
        {r.debtPaymentCount > 0 ? (
          <p className="mt-2 border-t border-line pt-2 font-mono text-[11px] text-loss">
            {formatUsd(r.debtPaidUsd)} en cuotas de deuda pagadas este período (
            {r.debtPaymentCount})
          </p>
        ) : null}
      </div>
    </Monitor>
  );
}

/* ------------------------------------------------------------ movimientos */

function LedgerPanel({ r }: { r: PeriodReport }) {
  const pager = usePager(r.rows, 20);
  return (
    <Monitor
      title="LIBRO DEL PERÍODO"
      bodyClassName="p-0"
      action={
        <HelpTip content="Todo lo registrado entre las dos fechas. Los pesos se convierten al dólar de la fecha del movimiento, no al de hoy." />
      }
    >
      <TableWrap className="mx-0 px-0">
        <table className="w-full font-mono text-[12px] md:min-w-[720px]">
          <thead>
            <tr className="border-b border-border text-left text-[11px] tracking-widest text-accent">
              <th className="px-2 py-1.5">FECHA</th>
              <th className="px-2 py-1.5">DESCRIPCIÓN</th>
              <th className="hidden px-2 py-1.5 sm:table-cell">CLASE</th>
              <th className="hidden px-2 py-1.5 text-right md:table-cell">
                ORIGINAL
              </th>
              <th className="px-2 py-1.5 text-right">USD</th>
            </tr>
          </thead>
          <tbody>
            {pager.slice.map((row) => (
              <tr
                key={row.tx.id}
                className="border-b border-border/50 hover:bg-raised/40"
              >
                <td className="px-2 py-1.5 whitespace-nowrap text-subtle">
                  {row.tx.date}
                </td>
                <td className="px-2 py-1.5">
                  {row.tx.assetId ? (
                    <AssetLink id={row.tx.assetId} name={row.tx.description} />
                  ) : (
                    <span className="text-fg">{row.tx.description}</span>
                  )}
                </td>
                <td className="hidden px-2 py-1.5 text-muted sm:table-cell">
                  {CLASS_LABEL[row.cls]}
                  {row.future ? (
                    <span
                      className="ml-1 text-[10px] tracking-wide text-accent"
                      title="Fecha posterior a hoy: está en el calendario, todavía no se cobró. No suma a los totales del período."
                    >
                      AGENDADO
                    </span>
                  ) : null}
                </td>
                <td className="hidden px-2 py-1.5 text-right tabular-nums text-subtle md:table-cell">
                  {row.tx.currency === "USD"
                    ? "—"
                    : `${row.tx.amount.toLocaleString("es-AR")} ${row.tx.currency}`}
                  {!row.fxFromHistory ? (
                    <span
                      className="ml-1 text-[10px] text-loss"
                      title="Convertido al dólar de hoy: el historial de FX no llega a esta fecha."
                    >
                      FX HOY
                    </span>
                  ) : null}
                </td>
                <td
                  className={`px-2 py-1.5 text-right tabular-nums ${
                    row.future
                      ? "text-subtle"
                      : row.cls === "INCOME"
                        ? "text-gain"
                        : row.cls === "EXPENSE"
                          ? "text-loss"
                          : "text-muted"
                  }`}
                >
                  {formatUsd(row.amountUsd)}
                </td>
              </tr>
            ))}
            {r.rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-2 py-10 text-center text-muted">
                  sin movimientos en este período
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </TableWrap>
      <div className="px-2 pb-1">
        <Pager
          page={pager.page}
          totalPages={pager.totalPages}
          total={pager.total}
          from={pager.from}
          to={pager.to}
          onChange={pager.setPage}
        />
      </div>
    </Monitor>
  );
}

const CLASS_LABEL: Record<string, string> = {
  INCOME: "Ingreso",
  EXPENSE: "Egreso",
  BUY: "Compra",
  TRANSFER: "Transferencia",
};
