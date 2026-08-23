import { createServer } from 'vite';
const server = await createServer({ server:{ middlewareMode:true }, appType:'custom', logLevel:'error' });
const {
  unitCount,
  positionRows,
  positionStats,
  positionBreakdown,
  categoryPies,
  flowProjection,
  formatUnitPrice,
} = await server.ssrLoadModule('/src/lib/positions.ts');
const { allocationBuckets } = await server.ssrLoadModule('/src/lib/portfolio-math.ts');

let fail = 0;
const near = (a, b, tol, label) => {
  const ok = a !== null && a !== undefined && Math.abs(a - b) < tol;
  console.log(ok ? 'PASS' : 'FAIL', label, '->', a, 'esperado', b);
  if (!ok) fail++;
};
const eq = (a, b, label) => {
  const ok = a === b;
  console.log(ok ? 'PASS' : 'FAIL', label, '->', JSON.stringify(a), 'esperado', JSON.stringify(b));
  if (!ok) fail++;
};

const asset = (o) => ({
  id: o.id ?? 'x', name: o.name ?? 'X', ticker: o.ticker ?? null,
  type: o.type ?? 'STOCK', quantity: o.quantity ?? null,
  costBasis: o.costBasis ?? 0, currentValue: o.currentValue ?? 0,
  currency: o.currency ?? 'USD', purchaseDate: null, notes: null,
  priceId: null, unpriced: o.unpriced ?? false,
});

/* ------------------------------------------------------------- unitCount */
// 1 is the form's "left blank" sentinel, not a one-unit holding: dividing by it
// would print the whole position as if it were a unit price.
eq(unitCount({ quantity: null }), null, 'sin cantidad');
eq(unitCount({ quantity: 1 }), null, 'cantidad 1 = centinela');
eq(unitCount({ quantity: 0 }), null, 'cantidad 0');
eq(unitCount({ quantity: -5 }), null, 'cantidad negativa');
eq(unitCount({ quantity: 12.5 }), 12.5, 'cantidad fraccionaria');

/* ------------------------------------------------------- precios unitarios */
const fx = 1000;
const rows = positionRows([
  asset({ id: 'a', ticker: 'AAPL', type: 'STOCK', quantity: 10, costBasis: 1000, currentValue: 1500 }),
  asset({ id: 'b', ticker: 'ON1', type: 'BOND', quantity: 10000, costBasis: 9000, currentValue: 10443 }),
  asset({ id: 'c', ticker: 'BRKB', type: 'CEDEAR', quantity: null, costBasis: 80000, currentValue: 80000, unpriced: true }),
  asset({ id: 'd', ticker: 'MELI', type: 'CEDEAR', quantity: 100, costBasis: 400000, currentValue: 500000, currency: 'ARS' }),
  asset({ id: 'e', name: 'Depto', type: 'REAL_ESTATE', quantity: null, costBasis: 100000, currentValue: 120000 }),
], fx, { STOCK: 'Acciones', BOND: 'Bonos', CEDEAR: 'CEDEAR', REAL_ESTATE: 'Real Estate' });
const [aapl, on1, brkb, meli, depto] = rows;

near(aapl.buyPrice, 100, 1e-9, 'AAPL precio compra');
near(aapl.nowPrice, 150, 1e-9, 'AAPL precio actual');
near(aapl.pricePct, 50, 1e-9, 'AAPL var precio');
near(aapl.pnlPct, 50, 1e-9, 'AAPL P&L %');
eq(aapl.perHundred, false, 'AAPL no cotiza por 100');
eq(aapl.typeLabel, 'Acciones', 'AAPL label');

// Un bono cotiza cada 100 de nominal: 10443/10000 = 1.0443 en factor, 104.43
// en pantalla, que es lo que muestra el broker.
near(on1.buyPrice, 90, 1e-9, 'ON precio compra por 100 VN');
near(on1.nowPrice, 104.43, 1e-9, 'ON precio actual por 100 VN');
near(on1.pricePct, ((104.43 - 90) / 90) * 100, 1e-9, 'ON var precio');
eq(on1.perHundred, true, 'ON cotiza por 100');

// Sin cotización el currentValue es el costo haciendo de precio: no hay precio
// actual que informar, y decir "igual al costo" disfrazaría el fallback de
// mercado plano.
eq(brkb.nowPrice, null, 'sin cotización no hay precio actual');
eq(brkb.buyPrice, null, 'sin cantidad no hay precio de compra');
eq(brkb.pricePct, null, 'sin precios no hay variación');
eq(brkb.unpriced, true, 'flag sin precio');

// Los precios quedan en la moneda de la posición; sólo los totales van a USD.
near(meli.buyPrice, 4000, 1e-9, 'CEDEAR ARS precio compra en pesos');
near(meli.nowPrice, 5000, 1e-9, 'CEDEAR ARS precio actual en pesos');
near(meli.valueUsd, 500, 1e-9, 'CEDEAR ARS valor en USD');
near(meli.costUsd, 400, 1e-9, 'CEDEAR ARS costo en USD');
near(meli.pnlUsd, 100, 1e-9, 'CEDEAR ARS P&L USD');

eq(depto.buyPrice, null, 'inmueble sin precio unitario');
eq(depto.quantity, null, 'inmueble sin cantidad');
near(depto.pnlPct, 20, 1e-9, 'inmueble P&L %');

/* --------------------------------------------------------------- stats */
const st = positionStats(rows);
eq(st.count, 5, 'cantidad de posiciones');
near(st.valueUsd, 1500 + 10443 + 80000 + 500 + 120000, 1e-6, 'valor total');
near(st.costUsd, 1000 + 9000 + 80000 + 400 + 100000, 1e-6, 'costo total');
near(st.pnlUsd, st.valueUsd - st.costUsd, 1e-9, 'P&L total');
// Mejor/peor por porcentaje: por dólares en un libro con una posición grande
// el ranking siempre nombra esa misma posición.
eq(st.best.asset.id, 'a', 'mejor por %');
eq(st.worst.asset.id, 'c', 'peor por % (0% el sin precio)');
eq(st.unpricedCount, 1, 'conteo sin precio');
eq(st.noQuantityCount, 2, 'conteo sin cantidad');
near(st.topWeightPct, (120000 / st.valueUsd) * 100, 1e-9, 'concentración top');
eq(st.topName, 'Depto', 'nombre del top');

// Un set vacío no debe inventar ni dividir por cero.
const empty = positionStats([]);
eq(empty.count, 0, 'vacío: sin posiciones');
near(empty.pnlPct, 0, 1e-9, 'vacío: P&L 0');
near(empty.topWeightPct, 0, 1e-9, 'vacío: concentración 0');
eq(empty.best, null, 'vacío: sin mejor');

// Una sola posición no tiene "peor": sería la misma fila dos veces.
const one = positionStats([aapl]);
eq(one.best.asset.id, 'a', 'una sola: mejor');
eq(one.worst, null, 'una sola: sin peor');

/* ----------------------------------------------------------- breakdown */
const byType = positionBreakdown(rows, 'type');
eq(byType.length, 4, 'grupos por clase');
eq(byType[0].key, 'REAL_ESTATE', 'clase más grande primero');
eq(byType.find((b) => b.key === 'CEDEAR').count, 2, 'dos CEDEAR agrupados');
near(byType.find((b) => b.key === 'CEDEAR').valueUsd, 80500, 1e-6, 'valor CEDEAR agrupado');
near(byType.reduce((s, b) => s + b.weightPct, 0), 100, 1e-6, 'los pesos suman 100');

const byPos = positionBreakdown(rows, 'position');
eq(byPos.length, 5, 'una barra por posición');
eq(byPos[0].label, 'Depto', 'posición más grande primero');
near(byPos.reduce((s, b) => s + b.valueUsd, 0), st.valueUsd, 1e-6, 'las barras suman el total');

eq(positionBreakdown([], 'type').length, 0, 'breakdown vacío');

/* ------------------------------------------------------- formato de precio */
// Un token puede valer $0.0004 y un CEDEAR $12.340: dos decimales fijos
// imprimen el primero como $0.00, que no es un precio.
eq(formatUnitPrice(0.00042, 'USD'), '$0.00042', 'precio chico con decimales');
eq(formatUnitPrice(150, 'USD'), '$150', 'precio medio');
eq(formatUnitPrice(12340.5, 'USD'), '$12,341', 'precio grande sin decimales');
eq(formatUnitPrice(104.43, 'USD'), '$104.43', 'factor de bono');

/* --------------------------------- CEDEAR con bucket propio en allocation */
// Antes caían en OTHER, así que el donut mostraba acciones reales como "sin
// clasificar" y el click habría abierto una vista que no las contiene.
const { alloc } = allocationBuckets(
  [asset({ id: 'c1', type: 'CEDEAR', currentValue: 1000 }), asset({ id: 'o1', type: 'OTHER', currentValue: 500 })],
  [],
  fx,
);
eq(alloc.find((b) => b.key === 'CEDEAR')?.value, 1000, 'CEDEAR tiene bucket propio');
eq(alloc.find((b) => b.key === 'OTHER')?.value, 500, 'OTHER queda con lo suyo');

/* ------------------------------------------------ renta y retorno total */
// Un depto que no se movió de precio pero pagó dos años de alquiler no rindió
// 0%. P&L sigue siendo sólo precio; TOTAL es precio + renta.
const conRenta = positionRows(
  [
    asset({ id: 'p', name: 'Depto', type: 'REAL_ESTATE', costBasis: 100000, currentValue: 100000 }),
    asset({ id: 'b', ticker: 'ON1', type: 'BOND', quantity: 10000, costBasis: 9000, currentValue: 10000 }),
  ],
  fx,
  {},
  new Map([
    ['p', { incomeUsd: 24000, projectedIncomeUsd: 14400 }],
    ['b', { incomeUsd: 800, projectedIncomeUsd: 900 }],
  ]),
);
const [depto2, on2] = conRenta;
near(depto2.pnlUsd, 0, 1e-9, 'depto: sin movimiento de precio');
near(depto2.pnlPct, 0, 1e-9, 'depto: P&L 0%');
near(depto2.incomeUsd, 24000, 1e-9, 'depto: alquileres cobrados');
near(depto2.totalUsd, 24000, 1e-9, 'depto: retorno total = renta');
near(depto2.totalPct, 24, 1e-9, 'depto: +24% aunque el precio no se movió');
near(depto2.projectedIncomeUsd, 14400, 1e-9, 'depto: alquiler agendado 12M');
near(on2.pnlUsd, 1000, 1e-9, 'ON: P&L de precio');
near(on2.totalUsd, 1800, 1e-9, 'ON: precio + cupones');
near(on2.totalPct, 20, 1e-9, 'ON: +20% total contra +11.1% de precio');

const stRenta = positionStats(conRenta);
near(stRenta.incomeUsd, 24800, 1e-9, 'stats: renta cobrada');
near(stRenta.projectedIncomeUsd, 15300, 1e-9, 'stats: renta agendada');
near(stRenta.totalUsd, 25800, 1e-9, 'stats: retorno total');
near(stRenta.totalPct, (25800 / 109000) * 100, 1e-9, 'stats: retorno total %');
// Sin renta cargada, el retorno total es exactamente el P&L de precio.
const stSinRenta = positionStats(rows);
near(stSinRenta.totalUsd, stSinRenta.pnlUsd, 1e-9, 'sin renta: total == P&L');

/* ------------------------------------------------------ tortas por clase */
// El % de una posición es sobre SU clase, no sobre el patrimonio: mezclar los
// dos denominadores hace leer un 60% del crypto como 60% del libro.
const pies = categoryPies(rows);
eq(pies.length, 4, 'una torta por clase');
eq(pies[0].type, 'REAL_ESTATE', 'la clase más grande primero');
const cedearPie = pies.find(p => p.type === 'CEDEAR');
eq(cedearPie.items.length, 2, 'dos ítems en CEDEAR');
near(cedearPie.items.reduce((s, i) => s + i.pct, 0), 100, 1e-9, 'los % de la clase suman 100');
near(cedearPie.items[0].pct, (80000 / 80500) * 100, 1e-9, 'BRKB dentro de CEDEAR');
near(cedearPie.bookPct, (80500 / 212443) * 100, 1e-9, 'y la clase sobre el libro va aparte');
eq(cedearPie.items[0].label, 'BRKB', 'ítem etiquetado por ticker');
eq(cedearPie.items[0].unpriced, true, 'el sin precio queda marcado');
near(pies.reduce((s, p) => s + p.bookPct, 0), 100, 1e-9, 'las clases suman el libro');
eq(categoryPies([]).length, 0, 'sin posiciones no hay tortas');

/* -------------------------------------------------- flujos proyectados */
const ml = (k) => k;
const flows = flowProjection(
  [
    { date: '2026-09-10', name: 'Cupón A', amountUsd: 100, assetId: 'a' },
    { date: '2026-09-25', name: 'Cupón A', amountUsd: 50, assetId: 'a' },
    { date: '2026-09-15', name: 'Alquiler', amountUsd: 1200, assetId: 'p' },
    { date: '2027-03-10', name: 'Cupón A', amountUsd: 100, assetId: 'a' },
    { date: '2026-09-10', name: 'Ajeno', amountUsd: 999, assetId: 'zzz' },
    { date: '2026-10-01', name: 'Cuota', amountUsd: -400, assetId: 'a' },
  ],
  new Set(['a', 'p']),
  ml,
  10000,
);
eq(flows.months.length, 2, 'sólo los meses que pagan aparecen');
eq(flows.months[0].key, '2026-09', 'orden cronológico');
near(flows.months[0].totalUsd, 1350, 1e-9, 'total de septiembre');
// Dos cupones del mismo bono en un mes son una línea, no dos.
eq(flows.months[0].items.length, 2, 'un renglón por activo que paga');
near(flows.months[0].items.find(i => i.assetId === 'a').amountUsd, 150, 1e-9, 'los dos cupones se suman');
eq(flows.months[0].items[0].name, 'Alquiler', 'el que más paga primero');
near(flows.totalUsd, 1450, 1e-9, 'total de la ventana, sin lo ajeno ni lo negativo');
eq(flows.eventCount, 4, 'eventos contados');
// Un libro de ONs semestrales paga en dos meses de doce: dividir por doce
// describe un ingreso mensual que nunca llega.
eq(flows.payingMonths, 2, 'meses que pagan');
near(flows.avgPerPayingMonth, 725, 1e-9, 'promedio sobre los meses que pagan');
eq(flows.peak.key, '2026-09', 'mes pico');
near(flows.yieldPct, 14.5, 1e-9, 'yield sobre el valor de las posiciones');
const sinFlujos = flowProjection([], new Set(['a']), ml, 100);
eq(sinFlujos.eventCount, 0, 'sin eventos');
near(sinFlujos.avgPerPayingMonth, 0, 1e-9, 'sin eventos no divide por cero');
eq(sinFlujos.peak, null, 'sin pico');

await server.close();
console.log(fail === 0 ? '\nOK' : `\n${fail} FALLAS`);
process.exit(fail === 0 ? 0 : 1);
