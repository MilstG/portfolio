import { createServer } from 'vite';
const server = await createServer({ server:{ middlewareMode:true }, appType:'custom', logLevel:'error' });
const { xirr } = await server.ssrLoadModule('/src/lib/returns.ts');

let fail = 0;
const near = (a, b, tol, label) => {
  if (typeof a === 'string' || typeof b === 'string') {
    const ok = a === b;
    console.log(ok ? 'PASS' : 'FAIL', label, '->', a, 'esperado', b);
    if (!ok) fail++;
    return;
  }
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


// ---- ventana corta ----
// Anualizar unas semanas convierte un movimiento chico en una tasa enorme:
// +5% en 36 dias se lee como +65%/año, que es aritmetica, no informacion.
{
  const { portfolioReturn } = await server.ssrLoadModule('/src/lib/returns.ts');
  const mk = (purchaseDate, cost, value) => ({
    assets: [{ id:'a', name:'A', ticker:'A', type:'STOCK', quantity:1,
      costBasis:cost, currentValue:value, currency:'USD', purchaseDate, notes:null,
      priceId:null, unpriced:false }],
    accounts:[], recurring:[], transactions:[], snapshots:[],
    fx:{official:1,blue:1,mep:1,average:1}, liabilities:[], goals:[],
    allocTargets:[], fxHistory:[], settings:{pinEnabled:false,hasPin:false},
    taxLots:[], watchlist:[], lastPriceRun:null,
  });
  // 36 dias, +5%: no debe anualizar ni encabezar con la extrapolacion
  const corto = portfolioReturn(mk('2026-07-16', 1000, 1050), '2026-08-21');
  console.log(corto.annualised === null || !corto.annualisedLeads ? 'PASS' : 'FAIL',
    'ventana corta no encabeza anualizado ->',
    'anual', corto.annualised, 'lidera', corto.annualisedLeads,
    'span', corto.spanYears.toFixed(3));
  if (!(corto.annualised === null || !corto.annualisedLeads)) fail++;
  near(corto.simple, 0.05, 1e-9, 'ventana corta: total +5%');

  // 10 dias: ni siquiera se calcula
  const muyCorto = portfolioReturn(mk('2026-08-11', 1000, 1050), '2026-08-21');
  isNull(muyCorto.annualised, 'menos de 30 dias no anualiza');

  // 3 años: aca si el anualizado es una medicion
  const largo = portfolioReturn(mk('2023-08-21', 1000, 1400), '2026-08-21');
  console.log(largo.annualisedLeads ? 'PASS' : 'FAIL', 'ventana larga encabeza anualizado ->',
    largo.annualised && (largo.annualised*100).toFixed(2)+'%');
  if (!largo.annualisedLeads) fail++;
}

// ---- denominador del retorno ----
// El span de la posicion mas vieja no es el periodo que la tasa refleja. Con
// mucha plata puesta hace poco, un libro de 1.5 años de span puede promediar
// 0.5 y dar +5.1% total con +11% anualizado sin contradiccion.
{
  const { portfolioReturn } = await server.ssrLoadModule('/src/lib/returns.ts');
  const mk = (list) => ({
    assets: list.map((x,i)=>({ id:'w'+i, name:'W'+i, ticker:'W'+i, type:'BOND', quantity:1,
      costBasis:x.cost, currentValue:x.value, currency:'USD', purchaseDate:x.date,
      notes:null, priceId:null, unpriced:false })),
    accounts:[], recurring:[], transactions:[], snapshots:[],
    fx:{official:1,blue:1,mep:1,average:1}, liabilities:[], goals:[],
    allocTargets:[], fxHistory:[], settings:{pinEnabled:false,hasPin:false},
    taxLots:[], watchlist:[], lastPriceRun:null,
  });
  const r = portfolioReturn(mk([
    { date:'2025-02-18', cost:20000,  value:21000 },
    { date:'2026-05-07', cost:200000, value:210000 },
    { date:'2026-02-01', cost:170069, value:178800 },
  ]), '2026-08-21');
  near(r.spanYears, 1.5, 0.02, 'span = posicion mas vieja');
  near(r.weightedYears, 0.47, 0.02, 'tenencia promedio ponderada por costo');
  // el anualizado tiene que ser coherente con el total sobre la tenencia promedio
  const esperado = Math.pow(1 + r.simple, 1 / r.weightedYears) - 1;
  near(r.annualised, esperado, 0.01, 'XIRR coherente con total/tenencia promedio');
  // y con menos de un año promedio, el titular debe ser el total
  console.log(!r.annualisedLeads ? 'PASS' : 'FAIL',
    'con tenencia < 1 año encabeza el total -> lidera', r.annualisedLeads);
  if (r.annualisedLeads) fail++;
}

// ---- ingresos proyectados ----
// Un libro comprado el mes pasado no cobro nada todavia, asi que la columna
// mostraba guiones aunque cada bono tenga su schedule de cupones.
{
  const { portfolioReturn } = await server.ssrLoadModule('/src/lib/returns.ts');
  const tx = (id, assetId, date, amount, type) => ({ id, date, description:'Cupón X',
    amount, currency:'USD', type, category:null, assetId, accountId:null });
  const p = {
    assets: [{ id:'b1', name:'ON X', ticker:'X', type:'BOND', quantity:10000,
      costBasis:9000, currentValue:10000, currency:'USD', purchaseDate:'2026-08-01',
      notes:null, priceId:null, unpriced:false }],
    accounts:[], recurring:[],
    // dos dentro de la ventana de 12 meses y uno fuera, para fijar el borde
    transactions:[ tx('c1','b1','2026-12-01',400,'COUPON'),
                   tx('c2','b1','2027-06-01',400,'COUPON'),
                   tx('c3','b1','2029-01-01',9999,'COUPON') ],
    snapshots:[], fx:{official:1,blue:1,mep:1,average:1}, liabilities:[], goals:[],
    allocTargets:[], fxHistory:[], settings:{pinEnabled:false,hasPin:false},
    taxLots:[], watchlist:[], lastPriceRun:null,
  };
  const r = portfolioReturn(p, '2026-08-21');
  const row = r.perAsset[0];
  near(row.incomeUsd, 0, 1e-9, 'sin cobrar todavia: ingreso cobrado 0');
  // los dos cupones dentro de 12 meses; el de 2029 queda afuera
  near(row.projectedIncomeUsd, 800, 1e-9, 'proyectado 12m suma solo la ventana');
}

// ---- ventana de la columna de ingresos ----
// La columna dice 12M: lo cobrado tiene que ser de 12 meses, no de toda la
// tenencia, o una fila de 1.4 años no es comparable con una proyeccion a 12m.
{
  const { portfolioReturn } = await server.ssrLoadModule('/src/lib/returns.ts');
  const tx = (id, date, amount) => ({ id, date, description:'Cupón', amount,
    currency:'USD', type:'COUPON', category:null, assetId:'z1', accountId:null });
  const p = {
    assets: [{ id:'z1', name:'ON Z', ticker:'Z', type:'BOND', quantity:10000,
      costBasis:9000, currentValue:10000, currency:'USD', purchaseDate:'2025-01-10',
      notes:null, priceId:null, unpriced:false }],
    accounts:[], recurring:[],
    transactions:[
      tx('v1','2025-03-01',300),   // fuera de los 12 meses
      tx('v2','2025-06-01',300),   // fuera
      tx('v3','2025-12-01',400),   // dentro
      tx('v4','2026-06-01',400),   // dentro
    ],
    snapshots:[], fx:{official:1,blue:1,mep:1,average:1}, liabilities:[], goals:[],
    allocTargets:[], fxHistory:[], settings:{pinEnabled:false,hasPin:false},
    taxLots:[], watchlist:[], lastPriceRun:null,
  };
  const row = portfolioReturn(p, '2026-08-21').perAsset[0];
  near(row.incomeUsd, 1400, 1e-9, 'ingreso total desde la compra');
  near(row.income12mUsd, 800, 1e-9, 'ingreso de los ultimos 12 meses');
}

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


// ---- prestamos ----
{
  const L = await server.ssrLoadModule('/src/lib/loans.ts');
  // Caso con resultado analitico: 100.000 al 5% anual a 24 meses.
  // cuota = P*i/(1-(1+i)^-n) con i = 0.05/12
  const cuota = L.loanPayment(100000, 5, 24, 'MONTHLY');
  near(cuota, 4387.138973, 1e-6, 'cuota francesa');
  // tasa cero reparte parejo en vez de dividir por cero
  near(L.loanPayment(120000, 0, 12, 'MONTHLY'), 10000, 1e-9, 'tasa cero');
  near(L.loanPayment(0, 5, 24), 0, 1e-9, 'sin capital no hay cuota');

  const sch = L.amortizationSchedule(100000, 5, 24, '2026-01-10', 'MONTHLY');
  console.log(sch.length === 24 ? 'PASS' : 'FAIL', 'schedule de 24 cuotas ->', sch.length);
  if (sch.length !== 24) fail++;
  // el saldo tiene que cerrar exactamente en cero
  near(sch[sch.length-1].balance, 0, 1e-9, 'saldo final exacto');
  // capital devuelto = principal
  near(sch.reduce((s,r)=>s+r.principal,0), 100000, 1e-6, 'capital suma el principal');
  near(sch.reduce((s,r)=>s+r.interest,0), 5291.3354, 1e-3, 'interes total');
  // la primera cuota es casi todo interes, la ultima casi todo capital
  console.log(sch[0].interest > sch[23].interest ? 'PASS' : 'FAIL',
    'el interes decrece ->', sch[0].interest.toFixed(2), '->', sch[23].interest.toFixed(2));
  if (!(sch[0].interest > sch[23].interest)) fail++;
  near(sch[0].date, '2026-02-10', 0, 'primera cuota un mes despues');

  // estado a mitad de camino
  const liab = { id:'l1', name:'Hipoteca', type:'loan', balance:0, currency:'USD',
    interestRate:5, linkedAssetId:null, notes:null,
    principal:100000, termPeriods:24, startDate:'2026-01-10', paymentFrequency:'MONTHLY' };
  // Sin pagos registrados el calendario ya no cuenta cuotas como pagas: haber
  // pasado la fecha no es prueba de que se pago.
  const st = L.loanStatus(liab, '2026-07-15');
  console.log(st.paid === 0 && st.remaining === 24 ? 'PASS' : 'FAIL',
    'sin registros no hay cuotas pagas ->', st.paid, '/', st.remaining);
  if (!(st.paid === 0 && st.remaining === 24)) fail++;
  console.log(st.nextDate === '2026-08-10' ? 'PASS' : 'FAIL',
    'proxima cuota pendiente ->', st.nextDate);
  if (st.nextDate !== '2026-08-10') fail++;

  // ---- saldo desde pagos reales ----
  const pagos = (arr) => arr.map(([date,amount])=>({date,amount}));
  // sin pagos registrados el saldo es el capital: el calendario no es prueba de pago
  const sinPagos = L.loanStatus(liab, '2026-07-15', []);
  near(sinPagos.outstanding, 100000, 1e-9, 'sin pagos registrados el saldo es el capital');
  console.log(!sinPagos.fromPayments ? 'PASS' : 'FAIL', 'sin pagos: fromPayments false');
  if (sinPagos.fromPayments) fail++;

  // seis cuotas puntuales: el saldo replicado debe coincidir con el schedule
  const seis = L.amortizationSchedule(100000, 5, 24, '2026-01-10').slice(0,6);
  const conPagos = L.loanStatus(liab, '2026-07-15', pagos(seis.map(r=>[r.date, r.payment])));
  console.log(conPagos.fromPayments ? 'PASS' : 'FAIL', 'con pagos: fromPayments true');
  if (!conPagos.fromPayments) fail++;
  near(conPagos.outstanding, seis[5].balance, 1.0, 'replay coincide con el schedule');
  console.log(conPagos.paid === 6 ? 'PASS' : 'FAIL', 'cuotas pagas por conteo real ->', conPagos.paid);
  if (conPagos.paid !== 6) fail++;

  // pago extra de capital: el saldo baja mas que en el schedule
  const extra = L.replayLoan(liab, pagos([['2026-02-10', 4387.14], ['2026-03-10', 20000]]), '2026-03-11');
  const soloDos = L.amortizationSchedule(100000, 5, 24, '2026-01-10')[1].balance;
  console.log(extra.balance < soloDos - 15000 ? 'PASS' : 'FAIL',
    'pago extra baja mas el capital ->', extra.balance.toFixed(2), 'vs', soloDos.toFixed(2));
  if (!(extra.balance < soloDos - 15000)) fail++;

  // cuota que no cubre ni el interes: el saldo crece
  const corta = L.replayLoan(liab, pagos([['2027-01-10', 1]]), '2027-01-11');
  console.log(corta.balance > 100000 ? 'PASS' : 'FAIL',
    'pago menor al interes hace crecer el saldo ->', corta.balance.toFixed(2));
  if (!(corta.balance > 100000)) fail++;

  // sin datos suficientes no se inventa un schedule
  const plano = L.loanStatus({...liab, principal:null}, '2026-07-15');
  console.log(!plano.scheduled ? 'PASS' : 'FAIL', 'sin principal no hay schedule');
  if (plano.scheduled) fail++;
}

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


// ---- resolucion de cripto y cedears ----
// GP (Graphite Protocol) no estaba en la lista fija de 16 monedas, asi que
// nunca se cotizaba y quedaba en 0.
eq(px.pickCoin({coins:[
  {id:'graphite-protocol', symbol:'GP', market_cap_rank:900},
  {id:'otro-gp', symbol:'GP', market_cap_rank:null},
  {id:'algo', symbol:'ALGO', market_cap_rank:50},
]}, 'GP'), 'graphite-protocol', 'cripto: elige por market cap');
eq(px.pickCoin({coins:[{id:'x', symbol:'XX', market_cap_rank:1}]}, 'GP'), null, 'cripto: sin match exacto');
eq(px.pickCoin(null, 'GP'), null, 'cripto: respuesta nula');
eq(px.pickCoin({coins:[
  {id:'sin-rank', symbol:'GP'},
  {id:'con-rank', symbol:'GP', market_cap_rank:120},
]}, 'gp'), 'con-rank', 'cripto: rankeado le gana al sin rank');

// un id fijado a mano se usa tal cual, sin pasar por el buscador
{
  const id = await px.resolveCoinId('graphite-protocol');
  const ok = id === 'graphite-protocol';
  console.log(ok ? 'PASS' : 'FAIL', 'cripto: id fijado se respeta ->', id);
  if (!ok) fail++;
}
{
  const id = await px.resolveCoinId('BTC');
  const ok = id === 'bitcoin';
  console.log(ok ? 'PASS' : 'FAIL', 'cripto: override de simbolo ->', id);
  if (!ok) fail++;
}

// contract address: la unica forma inequivoca de identificar un token
eq(px.classifyPriceKey('31k88G5Mq7ptbRDf3AM13HAq6wRQHXHikR8hik7wPygk'),
   {kind:'contract', chain:'solana', address:'31k88G5Mq7ptbRDf3AM13HAq6wRQHXHikR8hik7wPygk'},
   'clave: address de solana');
eq(px.classifyPriceKey('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'),
   {kind:'contract', chain:'ethereum', address:'0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'},
   'clave: address EVM');
eq(px.classifyPriceKey('solana:31k88G5Mq7ptbRDf3AM13HAq6wRQHXHikR8hik7wPygk'),
   {kind:'contract', chain:'solana', address:'31k88G5Mq7ptbRDf3AM13HAq6wRQHXHikR8hik7wPygk'},
   'clave: chain explicita');
eq(px.classifyPriceKey('graphite-protocol'), {kind:'id', value:'graphite-protocol'}, 'clave: id de coingecko');
eq(px.classifyPriceKey('BTC'), {kind:'symbol', value:'BTC'}, 'clave: simbolo');
eq(px.classifyPriceKey('  '), null, 'clave: vacia');

eq(px.parseTokenPrice({'31k88G5Mq7ptbRDf3AM13HAq6wRQHXHikR8hik7wPygk':{usd:0.0123}},
   '31k88G5Mq7ptbRDf3AM13HAq6wRQHXHikR8hik7wPygk'), 0.0123, 'token: precio');
eq(px.parseTokenPrice({'0xABC':{usd:5}}, '0xabc'), 5, 'token: case-insensitive');
eq(px.parseTokenPrice({}, '0xabc'), null, 'token: sin match');
eq(px.parseTokenPrice(null, '0xabc'), null, 'token: nulo');

// CEDEARs: cotizan en pesos y ya incluyen el ratio -> ARS / MEP = USD por unidad
eq(px.parseCedearQuotes([{symbol:'ASTS', c:6608}]), {ASTS:6608}, 'cedear: precio ARS crudo');
eq(px.parseCedearQuotes([{symbol:'brkb', px_bid:32800, px_ask:33000}]), {BRKB:32900}, 'cedear: medio bid/ask');
eq(px.parseCedearQuotes([{symbol:'X'}]), {}, 'cedear: sin precio');

console.log(fail === 0 ? '\nTODOS OK' : `\n${fail} FALLARON`);
await server.close();
process.exit(fail === 0 ? 0 : 1);
