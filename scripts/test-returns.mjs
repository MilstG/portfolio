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

console.log(fail === 0 ? '\nTODOS OK' : `\n${fail} FALLARON`);
await server.close();
process.exit(fail === 0 ? 0 : 1);
