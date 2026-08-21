import { createServer } from 'vite';
const server = await createServer({ server:{ middlewareMode:true }, appType:'custom', logLevel:'error' });
const { xirr } = await server.ssrLoadModule('/src/lib/returns.ts');

let fail = 0;
const near = (a, b, tol, label) => {
  const ok = a !== null && Math.abs(a - b) < tol;
  console.log(ok ? 'PASS' : 'FAIL', label, '->', a === null ? 'null' : a.toFixed(6), 'esperado', b);
  if (!ok) fail++;
};
const isNull = (v, label) => {
  const ok = v === null;
  console.log(ok ? 'PASS' : 'FAIL', label, '->', v);
  if (!ok) fail++;
};

// 1000 -> 1100 en 1 año = 10%
// 2021->2022 son 365 dias exactos: debe dar 10% clavado
near(xirr([{date:'2021-01-01',amount:-1000},{date:'2022-01-01',amount:1100}]), 0.10, 1e-6, '10% en 365d');
// 2020->2021 son 366d (bisiesto). Con actual/365, igual que Excel:
near(xirr([{date:'2020-01-01',amount:-1000},{date:'2021-01-01',amount:1100}]), Math.pow(1.1,365/366)-1, 1e-6, '10% en 366d (actual/365)');
// sin ganancia = 0%
near(xirr([{date:'2020-01-01',amount:-1000},{date:'2021-01-01',amount:1000}]), 0.0, 1e-4, '0%');
// duplicar en 2 años = sqrt(2)-1 = 41.42%
near(xirr([{date:'2020-01-01',amount:-1000},{date:'2022-01-01',amount:2000}]), Math.SQRT2-1, 1e-3, 'duplica en 2y');
// perdida 50% en 1 año
near(xirr([{date:'2021-01-01',amount:-1000},{date:'2022-01-01',amount:500}]), -0.50, 1e-6, '-50% en 365d');
near(xirr([{date:'2020-01-01',amount:-1000},{date:'2021-01-01',amount:500}]), Math.pow(0.5,365/366)-1, 1e-6, '-50% en 366d');
// flujos multiples: aporta 1000 y 1000, termina en 2200
const multi = xirr([{date:'2020-01-01',amount:-1000},{date:'2021-01-01',amount:-1000},{date:'2022-01-01',amount:2200}]);
console.log('INFO multi-aporte ->', multi?.toFixed(6));
if (multi === null || multi < 0.03 || multi > 0.12) { console.log('FAIL rango multi'); fail++; } else console.log('PASS rango multi');
// con income intermedio
near(xirr([{date:'2020-01-01',amount:-1000},{date:'2020-07-01',amount:50},{date:'2021-01-01',amount:1050}]), 0.10, 5e-3, 'con cupon');
// degenerados
isNull(xirr([{date:'2020-01-01',amount:-1000}]), 'un solo flujo');
isNull(xirr([{date:'2020-01-01',amount:-1000},{date:'2021-01-01',amount:-500}]), 'todos negativos');
isNull(xirr([{date:'2020-01-01',amount:1000},{date:'2021-01-01',amount:500}]), 'todos positivos');
isNull(xirr([{date:'2020-01-01',amount:-1000},{date:'2020-01-01',amount:1100}]), 'misma fecha');
isNull(xirr([]), 'vacio');


// ---- bondMetrics ----
const { bondMetrics } = await server.ssrLoadModule('/src/lib/bonds.ts');
const asset = (id, value) => ({ id, name:id, ticker:id, type:'BOND', quantity:1,
  costBasis:value, currentValue:value, currency:'USD', purchaseDate:null, notes:null });
const tx = (id, assetId, date, amount) => ({ id, date, description:'pago', amount,
  currency:'USD', type:'COUPON', category:null, assetId, accountId:null });

// Cupon cero: 1000 hoy -> 1210 en exactamente 2 años (730d, sin bisiesto).
// YTM = 10%, Macaulay = 2.0, modified = 2/1.1 = 1.81818...
const zc = bondMetrics([asset('ZC',1000)], [tx('p1','ZC','2028-01-01',1210)], 1, '2026-01-01')[0];
near(zc.ytm, 0.10, 1e-6, 'cupon cero YTM 10%');
near(zc.macaulay, 2.0, 1e-6, 'cupon cero Macaulay 2y');
near(zc.modified, 2/1.1, 1e-6, 'cupon cero modified');

// Bono a la par: paga 10% anual y devuelve capital -> YTM = 10%, duration < plazo
const par = bondMetrics([asset('PAR',1000)], [
  tx('c1','PAR','2027-01-01',100), tx('c2','PAR','2028-01-01',100), tx('c3','PAR','2029-01-01',1100),
], 1, '2026-01-01')[0];
near(par.ytm, 0.10, 5e-3, 'bono a la par YTM ~10%');
if (par.macaulay !== null && par.macaulay > 2.5 && par.macaulay < 2.8) console.log('PASS Macaulay par en rango ->', par.macaulay.toFixed(4));
else { console.log('FAIL Macaulay par ->', par.macaulay); fail++; }
if (par.macaulay !== null && par.macaulay < 3.0) console.log('PASS duration < plazo');
else { console.log('FAIL duration >= plazo'); fail++; }
near(par.currentYield, 0.10, 1e-9, 'current yield 10%');
if (par.maturity === '2029-01-01' && par.payments === 3) console.log('PASS maturity y conteo');
else { console.log('FAIL maturity/conteo ->', par.maturity, par.payments); fail++; }

// El capital devuelto NO es yield: un bono que amortiza dentro del año daba
// current yield > 100% cuando se contaba la amortizacion como renta.
const amortTx = (id, assetId, date, amount, type) => ({ id, date, description:'pago', amount,
  currency:'USD', type, category:null, assetId, accountId:null });
const withAmort = bondMetrics([asset('AM',10000)], [
  amortTx('r1','AM','2026-06-01',400,'COUPON'),
  amortTx('a1','AM','2026-06-01',10000,'AMORT'),
], 1, '2026-01-01')[0];
near(withAmort.currentYield, 0.04, 1e-9, 'current yield excluye amortizacion');
if (withAmort.ytm !== null && withAmort.ytm > 0.05 && withAmort.ytm < 0.15) console.log('PASS YTM si usa el capital ->', (withAmort.ytm*100).toFixed(2)+'%');
else { console.log('FAIL YTM con amort ->', withAmort.ytm); fail++; }

// Sin schedule futuro no hay YTM que inventar
const empty = bondMetrics([asset('X',1000)], [], 1, '2026-01-01')[0];
isNull(empty.ytm, 'sin flujos futuros');


// ---- parseAmount ----
// Un "." antes de 3 digitos se asumia separador de miles, y eso convertia un
// cupon de 201.644 en 201644 al importar el schedule.
const { parseAmount } = await server.ssrLoadModule('/src/lib/utils.ts');
const amt = (raw, expected, label) => {
  const got = parseAmount(raw);
  const ok = expected === null ? got === null : (got !== null && Math.abs(got - expected) < 1e-9);
  console.log(ok ? 'PASS' : 'FAIL', 'parseAmount', JSON.stringify(raw), '->', got, 'esperado', expected);
  if (!ok) fail++;
};
amt('201.644', 201.644, '3 decimales');
amt('214.086', 214.086, '3 decimales');
amt('197.26', 197.26, '2 decimales');
amt('10000', 10000, 'entero');
amt('1.234.567', 1234567, 'miles con puntos');
amt('1.234.567,89', 1234567.89, 'miles punto + decimal coma');
amt('1,234.56', 1234.56, 'miles coma + decimal punto');
amt('1234,5', 1234.5, 'decimal coma');
amt('$ 9.905', 9.905, 'simbolo + 3 decimales');
amt('-500.25', -500.25, 'negativo');
amt('', null, 'vacio');
amt('basura', null, 'no numerico');


// ---- parsers de precios ----
// No hay red en el sandbox, asi que se testea la forma de la respuesta, que es
// donde estan los bugs de parseo.
const px = await server.ssrLoadModule('/src/lib/prices.ts');
const eq = (got, expected, label) => {
  const ok = JSON.stringify(got) === JSON.stringify(expected);
  console.log(ok ? 'PASS' : 'FAIL', label, '->', JSON.stringify(got));
  if (!ok) { console.log('   esperado', JSON.stringify(expected)); fail++; }
};

// dolarapi: MEP se llama "bolsa"; se usa el lado vendedor
eq(px.parseDolarApi([
  {casa:'oficial', compra:1000, venta:1050},
  {casa:'blue', compra:1200, venta:1250},
  {casa:'bolsa', compra:1180, venta:1210},
  {casa:'contadoconliqui', compra:1300, venta:1320},
]), {official:1050, blue:1250, mep:1210}, 'dolarapi casas');
// nombre en vez de casa, y numeros como string
eq(px.parseDolarApi([
  {nombre:'Dólar Oficial', venta:'1050.5'},
  {nombre:'Dólar Blue', venta:'1250'},
  {nombre:'Dólar MEP', venta:'1210'},
]), {official:1050.5, blue:1250, mep:1210}, 'dolarapi por nombre');
// sin MEP -> cae a blue
eq(px.parseDolarApi([{casa:'oficial',venta:1000},{casa:'blue',venta:1200}]),
   {official:1000, blue:1200, mep:1200}, 'dolarapi sin MEP');
// basura
eq(px.parseDolarApi(null), null, 'dolarapi null');
eq(px.parseDolarApi([{casa:'blue',venta:1200}]), null, 'dolarapi sin oficial');
eq(px.parseDolarApi([{casa:'oficial',venta:0},{casa:'blue',venta:-5}]), null, 'dolarapi valores invalidos');

// bluelytics
eq(px.parseBluelytics({oficial:{value_sell:1050},blue:{value_sell:1250}}),
   {official:1050, blue:1250, mep:1250}, 'bluelytics');
eq(px.parseBluelytics({oficial:{value_avg:1040},blue:{value_avg:1240}}),
   {official:1040, blue:1240, mep:1240}, 'bluelytics value_avg');
eq(px.parseBluelytics({}), null, 'bluelytics vacio');

// bonos: la cotizacion viene por 100 nominales -> factor
eq(px.parseBondQuotes([{symbol:'CICAO', c:104.4285}]), {CICAO:1.044285}, 'bono close/100');
eq(px.parseBondQuotes([{symbol:'gyc5o', px_bid:100, px_ask:104}]), {GYC5O:1.02}, 'bono medio bid/ask');
eq(px.parseBondQuotes([{symbol:'X', px_bid:98}]), {X:0.98}, 'bono solo bid');
eq(px.parseBondQuotes([{symbol:'Y'}]), {}, 'bono sin precio');
eq(px.parseBondQuotes('nada'), {}, 'bono respuesta no-array');

console.log(fail === 0 ? '\nTODOS OK' : `\n${fail} FALLARON`);
await server.close();
process.exit(fail === 0 ? 0 : 1);
