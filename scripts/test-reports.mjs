import { createServer } from 'vite';
const server = await createServer({ server:{ middlewareMode:true }, appType:'custom', logLevel:'error' });
const {
  periodFor, shiftPeriod, bucketsFor, addDaysIso, daysBetween,
} = await server.ssrLoadModule('/src/lib/report-period.ts');
const { buildReport, classifyTx, fxAsOf, periodHistory, assetPerformance } = await server.ssrLoadModule('/src/lib/reports.ts');

let fail = 0;
const eq = (a, b, label) => {
  const ok = a === b;
  console.log(ok ? 'PASS' : 'FAIL', label, '->', JSON.stringify(a), 'esperado', JSON.stringify(b));
  if (!ok) fail++;
};
const near = (a, b, tol, label) => {
  const ok = a !== null && a !== undefined && Math.abs(a - b) < tol;
  console.log(ok ? 'PASS' : 'FAIL', label, '->', a, 'esperado', b);
  if (!ok) fail++;
};

/* --------------------------------------------------------------- períodos */
// 2026-08-23 es un domingo: con semanas de lunes a domingo cae en la que
// arranca el 17. Una semana que arrancara el domingo partiría en dos cada
// semana de liquidación.
const w = periodFor('WEEK', '2026-08-23');
eq(w.start, '2026-08-17', 'semana: lunes de arranque');
eq(w.end, '2026-08-23', 'semana: domingo de cierre');
eq(w.days, 7, 'semana: 7 días');
eq(periodFor('WEEK', '2026-08-17').start, '2026-08-17', 'semana: el lunes es su propio arranque');
eq(w.label, 'S34 2026', 'semana: número ISO');

// La semana que arranca el lunes 2024-12-30 es la 1 de 2025, no de 2024: tomar
// el año de la fecha de arranque titulaba el reporte con un año que no es el de
// la semana, y lo ordenaba antes de las 52 semanas que le siguen.
eq(periodFor('WEEK', '2024-12-30').label, 'S01 2025', 'semana a caballo del año lleva el año ISO');
eq(periodFor('WEEK', '2025-01-02').start, '2024-12-30', 'y arranca en diciembre');
eq(periodFor('WEEK', '2026-12-28').label, 'S53 2026', 'año con 53 semanas');

const m = periodFor('MONTH', '2026-08-23');
eq(m.start, '2026-08-01', 'mes: arranque');
eq(m.end, '2026-08-31', 'mes: cierre');
eq(m.days, 31, 'mes: 31 días');
eq(periodFor('MONTH', '2026-02-10').end, '2026-02-28', 'febrero no bisiesto');
eq(periodFor('MONTH', '2024-02-10').end, '2024-02-29', 'febrero bisiesto');

const q = periodFor('QUARTER', '2026-08-23');
eq(q.start, '2026-07-01', 'trimestre: arranque Q3');
eq(q.end, '2026-09-30', 'trimestre: cierre Q3');
eq(q.label, 'Q3 2026', 'trimestre: label');
eq(periodFor('QUARTER', '2026-01-01').label, 'Q1 2026', 'Q1');
eq(periodFor('QUARTER', '2026-12-31').label, 'Q4 2026', 'Q4');

// Se navega por unidad de calendario, no por N días: 91 días atrás se
// desalinearía dentro del año.
eq(shiftPeriod(m, -1).start, '2026-07-01', 'mes anterior');
eq(shiftPeriod(m, 1).start, '2026-09-01', 'mes siguiente');
eq(shiftPeriod(periodFor('MONTH', '2026-01-15'), -1).start, '2025-12-01', 'mes anterior cruzando el año');
eq(shiftPeriod(q, -1).label, 'Q2 2026', 'trimestre anterior');
eq(shiftPeriod(q, 1).label, 'Q4 2026', 'trimestre siguiente');
eq(shiftPeriod(w, -1).start, '2026-08-10', 'semana anterior');

eq(bucketsFor(w).length, 7, 'semana: un bucket por día');
eq(bucketsFor(m).length, 31, 'mes: un bucket por día');
// Un trimestre en días serían 92 barras de un pixel.
eq(bucketsFor(q).length, 14, 'trimestre: buckets semanales');
eq(bucketsFor(q)[0].start, '2026-06-29', 'trimestre: el primer bucket arranca el lunes que contiene el 1');

eq(addDaysIso('2026-02-28', 1), '2026-03-01', 'addDays cruza el mes');
eq(daysBetween('2026-01-01', '2026-12-31'), 364, 'daysBetween');

/* ------------------------------------------------------------ clasificación */
// Una compra no es una pérdida y una transferencia entre cuentas propias no es
// un ingreso; meter cualquiera de las dos en "egresos" convierte un mes de
// compras fuertes en un mes de pérdidas fuertes.
eq(classifyTx({ type: 'COUPON', amount: 100 }), 'INCOME', 'cupón = ingreso');
eq(classifyTx({ type: 'EXPENSE', amount: -50 }), 'EXPENSE', 'gasto');
eq(classifyTx({ type: 'BUY', amount: -1000 }), 'BUY', 'compra aparte');
eq(classifyTx({ type: 'TRANSFER', amount: -500 }), 'TRANSFER', 'transferencia aparte');
eq(classifyTx({ type: 'TRANSFER', amount: 500 }), 'TRANSFER', 'transferencia positiva tampoco es ingreso');

/* -------------------------------------------------------------- fx histórico */
const fxHist = [
  { date: '2026-07-01', official: 900, blue: 1000, mep: 1050, average: 1000 },
  { date: '2026-08-01', official: 1800, blue: 2000, mep: 2100, average: 2000 },
];
eq(fxAsOf(fxHist, '2026-08-15', 3000).rate, 2000, 'fx al 15/8 usa la fila del 1/8');
eq(fxAsOf(fxHist, '2026-08-15', 3000).fromHistory, true, 'viene del historial');
eq(fxAsOf(fxHist, '2026-06-01', 3000).rate, 3000, 'antes del historial cae al FX de hoy');
eq(fxAsOf(fxHist, '2026-06-01', 3000).fromHistory, false, 'y lo declara');

/* ------------------------------------------------------------------ reporte */
const portfolio = {
  assets: [
    { id: 'b1', name: 'ON CICAO', ticker: 'CICAO', type: 'BOND', quantity: 10000, costBasis: 9602, currentValue: 10443, currency: 'USD', purchaseDate: null, notes: null, priceId: null, unpriced: false },
    { id: 'r1', name: 'Depto', ticker: null, type: 'REAL_ESTATE', quantity: null, costBasis: 100000, currentValue: 120000, currency: 'USD', purchaseDate: null, notes: null, priceId: null, unpriced: false },
  ],
  accounts: [],
  recurring: [],
  transactions: [
    // dentro del período (agosto 2026)
    { id: 't1', date: '2026-08-05', description: 'Cupón CICAO', amount: 400, currency: 'USD', type: 'COUPON', category: 'Bonds', assetId: 'b1', accountId: null, liabilityId: null },
    { id: 't2', date: '2026-08-05', description: 'Comisión CICAO', amount: -4000, currency: 'ARS', type: 'EXPENSE', category: 'Fees', assetId: 'b1', accountId: null, liabilityId: null },
    { id: 't3', date: '2026-08-20', description: 'Alquiler Depto', amount: 1200, currency: 'USD', type: 'RENT', category: null, assetId: 'r1', accountId: null, liabilityId: null },
    { id: 't4', date: '2026-08-22', description: 'Compra ON', amount: -5000, currency: 'USD', type: 'BUY', category: null, assetId: 'b1', accountId: null, liabilityId: null },
    { id: 't5', date: '2026-08-22', description: 'Paso plata', amount: -300, currency: 'USD', type: 'TRANSFER', category: null, assetId: null, accountId: null, liabilityId: null },
    { id: 't6', date: '2026-08-10', description: 'Cupón de un bono vendido', amount: 90, currency: 'USD', type: 'COUPON', category: 'Bonds', assetId: null, accountId: null, liabilityId: null },
    // El libro también guarda el calendario de cupones: esta fila es del 30/8,
    // posterior a "hoy" (23/8). Es plata que todavía no entró.
    { id: 't10', date: '2026-08-30', description: 'Cupón CICAO agendado', amount: 500, currency: 'USD', type: 'COUPON', category: 'Bonds', assetId: 'b1', accountId: null, liabilityId: null },
    // período anterior (julio 2026)
    { id: 't7', date: '2026-07-15', description: 'Cupón CICAO', amount: 250, currency: 'USD', type: 'COUPON', category: 'Bonds', assetId: 'b1', accountId: null, liabilityId: null },
    { id: 't8', date: '2026-07-16', description: 'Comisión', amount: -50, currency: 'USD', type: 'EXPENSE', category: 'Fees', assetId: 'b1', accountId: null, liabilityId: null },
    // fuera de los dos
    { id: 't9', date: '2026-09-02', description: 'Cupón futuro', amount: 999, currency: 'USD', type: 'COUPON', category: 'Bonds', assetId: 'b1', accountId: null, liabilityId: null },
  ],
  snapshots: [
    { date: '2026-07-31', totalUsd: 100000 },
    { date: '2026-08-10', totalUsd: 104000 },
    { date: '2026-08-15', totalUsd: 101000 },
    { date: '2026-08-23', totalUsd: 110000 },
  ],
  fx: { official: 2700, blue: 3000, mep: 3050, average: 3000 },
  liabilities: [],
  goals: [], allocTargets: [], fxHistory: fxHist, settings: { pinEnabled: false, hasPin: false },
  taxLots: [], watchlist: [], lastPriceRun: null,
};

const r = buildReport(portfolio, 'MONTH', '2026-08-15', '2026-08-23');
eq(r.period.start, '2026-08-01', 'reporte: período');
eq(r.previous.label, 'JUL 26', 'reporte: período anterior');

// La apertura es el último snapshot ANTES del período: uno fechado el día uno
// ya incluye los movimientos del día uno.
near(r.nwOpen, 100000, 1e-9, 'NW apertura');
eq(r.nwOpenDate, '2026-07-31', 'fecha de apertura');
near(r.nwClose, 110000, 1e-9, 'NW cierre');
near(r.nwChange, 10000, 1e-9, 'variación NW');
near(r.nwChangePct, 10, 1e-9, 'variación NW %');
eq(r.nwSeries.length, 3, 'serie: sólo los snapshots dentro de la ventana');
near(r.nwHigh, 110000, 1e-9, 'máximo');
near(r.nwLow, 101000, 1e-9, 'mínimo');
// 104000 -> 101000 es -2.88%; el rebote posterior no borra la caída.
near(r.drawdownPct, (101000 / 104000 - 1) * 100, 1e-9, 'drawdown intra-período');

// La comisión de agosto son ARS 4.000 al FX del 1/8 (2000), no al de hoy (3000):
// 4000/2000 = 2 USD. Al FX de hoy darían 1.33, que es otro número.
near(r.totals.incomeUsd, 400 + 1200 + 90, 1e-9, 'ingresos del período');
near(r.totals.expenseUsd, 2, 1e-9, 'egresos al FX de la fecha');
near(r.totals.buysUsd, 5000, 1e-9, 'compras aparte de los egresos');
near(r.totals.netFlowUsd, 1690 - 2, 1e-9, 'flujo neto');
eq(r.totals.txCount, 6, 'movimientos del período: la fila agendada no cuenta');
near(r.feesUsd, 2, 1e-9, 'comisiones');

near(r.prevTotals.incomeUsd, 250, 1e-9, 'ingresos del período anterior');
near(r.prevTotals.expenseUsd, 50, 1e-9, 'egresos del período anterior');

eq(r.incomeByKind.length, 2, 'dos tipos de ingreso');
eq(r.incomeByKind[0].kind, 'COUPON', 'cupones primero por orden canónico');
near(r.incomeByKind.find(k => k.kind === 'COUPON').amountUsd, 490, 1e-9, 'cupones');
eq(r.incomeByKind.find(k => k.kind === 'COUPON').count, 2, 'dos cupones');
near(r.incomeByKind.find(k => k.kind === 'RENT').amountUsd, 1200, 1e-9, 'alquiler');

// Un cupón de un bono vendido igual entró a la cuenta: descartarlo subestimaría
// los ingresos del período.
eq(r.incomeByAsset.length, 3, 'ingresos por activo, incluido el huérfano');
eq(r.incomeByAsset[0].name, 'Depto', 'el que más pagó primero');
eq(r.incomeByAsset.find(a => a.assetId === null).name, 'Sin activo asociado', 'el huérfano se nombra');
near(r.incomeByAsset.find(a => a.assetId === null).amountUsd, 90, 1e-9, 'monto del huérfano');

eq(r.buckets.length, 31, 'un bucket por día de agosto');
near(r.buckets.find(b => b.key === '2026-08-05').income, 400, 1e-9, 'bucket del 5');
near(r.buckets.find(b => b.key === '2026-08-05').expense, 2, 1e-9, 'gasto del 5');
near(r.buckets.reduce((s, b) => s + b.income, 0), r.totals.incomeUsd, 1e-9, 'los buckets suman los ingresos cobrados');
eq(r.buckets.find(b => b.key === '2026-08-22').income, 0, 'la compra no entra como ingreso');

eq(r.topPayments[0].tx.id, 't3', 'el pago más grande');
eq(r.topPayments.length, 3, 'sólo ingresos ya cobrados en el ranking');

// Un cupón con fecha posterior a hoy está en el calendario, no en la caja.
// Sumarlo reportaría los ingresos de un trimestre a mitad del trimestre.
near(r.pendingUsd, 500, 1e-9, 'agendado dentro del período');
eq(r.pendingCount, 1, 'un cobro agendado');
eq(r.rows.length, 7, 'el libro igual muestra la fila agendada');
eq(r.rows.find(x => x.tx.id === 't10').future, true, 'la fila agendada va marcada');
eq(r.rows.filter(x => !x.future).length, 6, 'seis filas ya ocurridas');
eq(r.incomeByAsset.find(a => a.assetId === 'b1').count, 1, 'el activo cuenta sólo el cupón cobrado');
eq(r.buckets.find(b => b.key === '2026-08-30').income, 0, 'el bucket del 30 queda vacío');
// Y una vez que el período cerró, esa misma fila ya es plata cobrada.
const cerrado = buildReport(portfolio, 'MONTH', '2026-08-15', '2026-09-15');
near(cerrado.totals.incomeUsd, 1690 + 500, 1e-9, 'con el mes cerrado el cupón ya cuenta');
eq(cerrado.pendingCount, 0, 'y no queda nada agendado');
eq(cerrado.partial, false, 'el mes ya cerró');

// El resto es lo que el libro no explica: revalúo, FX y lo no cargado.
near(r.residualUsd, 10000 - (1690 - 2), 1e-9, 'residual');

// Sin snapshot de apertura no hay residual que calcular, sólo una resta que
// parecería uno.
const sinSnap = buildReport({ ...portfolio, snapshots: [] }, 'MONTH', '2026-08-15', '2026-08-23');
eq(sinSnap.nwOpen, null, 'sin snapshots no hay apertura');
eq(sinSnap.nwChange, null, 'sin apertura no hay variación');
eq(sinSnap.residualUsd, null, 'sin apertura no hay residual');
near(sinSnap.totals.incomeUsd, 1690, 1e-9, 'los flujos siguen estando');

// FX del período: 2000 -> 2000 no se movió porque no hay fila nueva.
eq(r.fxOpen.date, '2026-07-01', 'fx de apertura');
eq(r.fxClose.date, '2026-08-01', 'fx de cierre');
near(r.blueChangePct, 100, 1e-9, 'blue duplicó');

eq(r.fxFallbackCount, 0, 'ninguna fila necesitó el FX de hoy');
const viejo = buildReport(portfolio, 'MONTH', '2026-06-15', '2026-08-23');
eq(viejo.partial, false, 'junio ya cerró');

eq(r.partial, true, 'agosto todavía no cerró al 23');
eq(r.elapsedDays, 23, 'días transcurridos');

// Período vacío: nada inventado y nada que explote.
const vacio = buildReport(portfolio, 'WEEK', '2025-01-08', '2026-08-23');
eq(vacio.totals.txCount, 0, 'semana vacía: sin movimientos');
near(vacio.totals.incomeUsd, 0, 1e-9, 'semana vacía: sin ingresos');
eq(vacio.incomeByKind.length, 0, 'semana vacía: sin tipos');
eq(vacio.nwOpen, null, 'semana vacía: sin apertura');
eq(vacio.drawdownPct, null, 'semana vacía: sin drawdown');
eq(vacio.buckets.length, 7, 'semana vacía: igual tiene sus 7 días');

/* ---------------------------------------------------------------- histórico */
const hist = periodHistory(portfolio, 'MONTH', '2026-08-15', 3, '2026-08-23');
eq(hist.length, 3, 'histórico: tres períodos');
eq(hist.map(h => h.label).join('|'), 'JUN 26|JUL 26|AGO 26', 'histórico: cronológico, el actual último');
eq(hist[2].current, true, 'histórico: marca el período mostrado');
// Un mes a medias graficado al lado de meses completos se lee como un derrumbe
// de ingresos que no pasó.
eq(hist[2].partial, true, 'histórico: agosto sigue en curso');
eq(hist[1].partial, false, 'histórico: julio ya cerró');
near(hist[1].incomeUsd, 250, 1e-9, 'histórico: ingresos de julio');
near(hist[2].incomeUsd, 1690, 1e-9, 'histórico: agosto cuenta sólo lo cobrado');
near(hist[0].incomeUsd, 0, 1e-9, 'histórico: junio sin movimientos');
eq(hist[1].nwClose, 100000, 'histórico: NW al cierre de julio');
eq(hist[0].nwClose, null, 'histórico: junio sin snapshot');

/* ------------------------------------------------ rendimiento por posición */
const snap = (assetId, valueUsd, quantity, extra = {}) => ({
  assetId, date: '2026-08-01', valueUsd, quantity,
  costBasis: extra.costBasis ?? 0, unpriced: extra.unpriced ?? false,
});
const perfAssets = [
  { id: 'h', name: 'Held', ticker: 'HELD', type: 'STOCK' },
  { id: 'g', name: 'Grew', ticker: 'GREW', type: 'CRYPTO' },
  { id: 'n', name: 'New', ticker: 'NEW', type: 'BOND' },
  { id: 's', name: 'Sold', ticker: 'SOLD', type: 'STOCK' },
  { id: 'p', name: 'Depto', ticker: null, type: 'REAL_ESTATE' },
];
const perf = assetPerformance({
  seriesStart: '2026-08-01',
  open: [
    snap('h', 1000, 100),          // 100 @ 10
    snap('g', 1000, 100),          // 100 @ 10, después compra más
    snap('s', 500, 50),            // 50 @ 10, se vende entero
    snap('p', 120000, null),       // sin cantidad
  ],
  close: [
    { ...snap('h', 1200, 100), date: '2026-08-31' },   // 100 @ 12
    { ...snap('g', 1800, 150), date: '2026-08-31' },   // 150 @ 12
    { ...snap('n', 5000, 500), date: '2026-08-31' },   // comprado en el período
    { ...snap('p', 126000, null), date: '2026-08-31' },
  ],
}, perfAssets);

const byId = Object.fromEntries(perf.rows.map(r => [r.assetId, r]));

// Tenencia intacta: todo el movimiento es precio.
near(byId.h.priceUsd, 200, 1e-9, 'held: 100 unidades que subieron 2');
near(byId.h.flowUsd, 0, 1e-9, 'held: sin flujo');
near(byId.h.pricePct, 20, 1e-9, 'held: +20%');
eq(byId.h.estimated, false, 'held: split exacto');

// Comprar 50 más no es una ganancia de 600. Las 100 que ya tenía subieron 2.
near(byId.g.priceUsd, 200, 1e-9, 'grew: rindió lo mismo que held');
near(byId.g.flowUsd, 600, 1e-9, 'grew: 50 unidades nuevas a 12');
near(byId.g.changeUsd, 800, 1e-9, 'grew: el movimiento total');
near(byId.g.priceUsd + byId.g.flowUsd, byId.g.changeUsd, 1e-9, 'grew: precio + flujo cierra');
near(byId.g.pricePct, 20, 1e-9, 'grew: +20%, no +80%');

// Una posición nueva no es la mejor del mes por existir.
near(byId.n.priceUsd, 0, 1e-9, 'nueva: no rindió nada todavía');
near(byId.n.flowUsd, 5000, 1e-9, 'nueva: entró plata');
eq(byId.n.opened, true, 'nueva: marcada');
eq(byId.n.pricePct, null, 'nueva: sin base contra la cual medir');

// Vendida: la caída es un flujo, no una pérdida.
near(byId.s.priceUsd, 0, 1e-9, 'vendida: no es pérdida');
near(byId.s.flowUsd, -500, 1e-9, 'vendida: salió plata');
eq(byId.s.closed, true, 'vendida: marcada');

// Sin cantidad no hay con qué partir el movimiento: se informa entero como
// precio y la fila queda marcada.
near(byId.p.priceUsd, 6000, 1e-9, 'inmueble: movimiento entero como precio');
eq(byId.p.estimated, true, 'inmueble: split asumido');
eq(perf.estimatedCount, 1, 'un solo split asumido');

near(perf.totalPriceUsd, 200 + 200 + 6000, 1e-9, 'precio total');
near(perf.totalFlowUsd, 600 + 5000 - 500, 1e-9, 'flujo total');
near(perf.totalChangeUsd, perf.totalPriceUsd + perf.totalFlowUsd, 1e-9, 'el total cierra');
// La base son las posiciones que se tuvieron de punta a punta.
near(perf.openBaseUsd, 1000 + 1000 + 120000, 1e-9, 'base de apertura');
near(perf.totalPricePct, (6400 / 122000) * 100, 1e-9, 'rendimiento ponderado');

eq(perf.winners.map(r => r.assetId).join('|'), 'p|h|g', 'ganadores por dólares de precio');
eq(perf.losers.length, 0, 'sin perdedores');
eq(perf.empty, false, 'hay historia');

// Sin historia previa el panel no tiene nada que decir, y lo dice.
const vacia = assetPerformance({ seriesStart: null, open: [], close: [] }, perfAssets);
eq(vacia.empty, true, 'sin snapshots de apertura: vacío');
eq(vacia.rows.length, 0, 'sin filas');
eq(vacia.totalPricePct, null, 'sin rendimiento');

// Una caída real sí es una pérdida.
const caida = assetPerformance({
  seriesStart: '2026-08-01',
  open: [snap('h', 1000, 100)],
  close: [{ ...snap('h', 700, 100), date: '2026-08-31' }],
}, perfAssets);
near(caida.rows[0].priceUsd, -300, 1e-9, 'caída: pérdida de precio');
near(caida.rows[0].pricePct, -30, 1e-9, 'caída: -30%');
eq(caida.losers[0].assetId, 'h', 'aparece en perdedores');

// Un activo borrado igual describe un movimiento real.
const borrado = assetPerformance({
  seriesStart: '2026-08-01',
  open: [snap('zz', 900, 10)],
  close: [],
}, perfAssets);
eq(borrado.rows[0].name, 'Posición eliminada', 'se nombra el borrado');
near(borrado.rows[0].flowUsd, -900, 1e-9, 'y su salida es flujo');

await server.close();
console.log(fail === 0 ? '\nOK' : `\n${fail} FALLAS`);
process.exit(fail === 0 ? 0 : 1);
