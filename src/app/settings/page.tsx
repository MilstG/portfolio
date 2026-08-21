export default function SettingsPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold tracking-tight text-white">
        Configuración
      </h1>
      <p className="mt-2 text-sm text-zinc-400">
        Próximamente: tipo de cambio, preferencias, exportación, etc.
      </p>

      <div className="mt-8 max-w-lg space-y-4">
        <div className="rounded-xl border border-zinc-800 bg-[#12141c] p-5">
          <p className="text-sm font-medium text-zinc-300">Tipo de cambio</p>
          <p className="mt-1 text-xs text-zinc-500">
            Actualmente usando promedio de Oficial + Blue + MEP
          </p>
          <p className="mt-3 text-lg font-semibold text-white">$1.451,67</p>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-[#12141c] p-5">
          <p className="text-sm font-medium text-zinc-300">Moneda base</p>
          <p className="mt-1 text-xs text-zinc-500">
            Todos los totales se muestran en USD
          </p>
        </div>
      </div>
    </div>
  );
}
