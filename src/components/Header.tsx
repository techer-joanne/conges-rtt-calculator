import { CalendarCheck2 } from 'lucide-react';

export default function Header() {
  return (
    <header className="relative overflow-hidden bg-gradient-to-br from-trappes-950 via-trappes-900 to-trappes-700 text-white">
      {/* Halo décoratif */}
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-trappes-400/20 blur-3xl" />
      <div className="pointer-events-none absolute -left-16 bottom-0 h-56 w-56 rounded-full bg-trappes-500/10 blur-3xl" />

      <div className="relative mx-auto flex max-w-6xl flex-col gap-4 px-5 py-8 sm:flex-row sm:items-center sm:justify-between sm:py-10">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20 backdrop-blur">
            <CalendarCheck2 className="h-7 w-7 text-trappes-200" strokeWidth={2} />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl">
              Calculateur de congés annuels &amp; RTT
            </h1>
            <p className="mt-1 text-sm font-medium text-trappes-200/90">
              Ville de Trappes — Direction des Ressources Humaines
            </p>
          </div>
        </div>

        <div className="hidden shrink-0 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-right backdrop-blur sm:block">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-trappes-300">
            Année de référence
          </p>
          <p className="text-lg font-bold">{new Date().getFullYear()}</p>
        </div>
      </div>
    </header>
  );
}
