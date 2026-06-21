import { useState } from 'react';
import { Printer, Check, ClipboardCopy, Sparkles } from 'lucide-react';
import type { Inputs, Results } from '../lib/calc';
import { fmtJours, fmtDateFr, socleLabel } from '../lib/calc';
import { useCountUp } from '../hooks/useCountUp';
import { Button } from './ui/button';

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/10 px-3 py-2 ring-1 ring-white/15">
      <p className="text-[11px] font-medium uppercase tracking-wide text-trappes-200/80">{label}</p>
      <p className="text-base font-bold tabular-nums text-white">{value}</p>
    </div>
  );
}

export default function TotalCard({ inputs, results }: { inputs: Inputs; results: Results }) {
  const animated = useCountUp(results.total, 750);
  const [copied, setCopied] = useState(false);

  const recap =
    `Calcul congés & RTT — DRH\n` +
    `Agent : ${inputs.nom || '—'}\n` +
    `Période : ${fmtDateFr(inputs.dateDebut)} → ${fmtDateFr(inputs.dateFin)} ` +
    `(${results.joursCalendaires} j calendaires, prorata ${fmtJours(results.prorata * 100)} %)\n` +
    `Socle ${socleLabel(inputs.socle)} · quotité ${inputs.quotite} %\n` +
    `— Congés annuels : ${fmtJours(results.congesAnnuels)} j\n` +
    `— RTT réelles : ${fmtJours(results.rttReelles)} j\n` +
    `=> TOTAL CONGÉS + RTT : ${fmtJours(results.total)} jours\n` +
    `(journée de solidarité : 1 j à effectuer, non déduite)`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(recap);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* presse-papiers indisponible (file://) : on ignore silencieusement */
    }
  }

  return (
    <section className="print-clean relative overflow-hidden rounded-lg bg-gradient-to-br from-trappes-900 via-trappes-800 to-trappes-700 p-6 text-white shadow-glow sm:p-7">
      <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-trappes-400/20 blur-3xl" />

      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-trappes-200">
            <Sparkles className="h-4 w-4" /> Total congés + RTT
          </p>
          <div className="mt-1 flex items-baseline gap-3">
            <span className="text-6xl font-extrabold tabular-nums leading-none drop-shadow-sm sm:text-7xl">
              {fmtJours(animated)}
            </span>
            <span className="text-xl font-semibold text-trappes-200">jours</span>
          </div>
          {inputs.nom && (
            <p className="mt-2 text-sm text-trappes-200/90">
              pour <span className="font-semibold text-white">{inputs.nom}</span> · {fmtDateFr(inputs.dateDebut)} → {fmtDateFr(inputs.dateFin)}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2.5 lg:max-w-xs">
          <Chip label="Congés annuels" value={fmtJours(results.congesAnnuels)} />
          <Chip label="RTT réelles" value={fmtJours(results.rttReelles)} />
        </div>
      </div>

      <div className="no-print relative mt-6 flex flex-wrap gap-3">
        <Button
          onClick={() => window.print()}
          className="bg-white text-trappes-800 shadow hover:bg-trappes-50"
        >
          <Printer className="h-4 w-4" /> Imprimer / PDF
        </Button>
        <Button
          variant="outline"
          onClick={copy}
          className="border-white/25 bg-white/10 text-white hover:bg-white/20 hover:text-white"
        >
          {copied ? <Check className="h-4 w-4 text-emerald-300" /> : <ClipboardCopy className="h-4 w-4" />}
          {copied ? 'Copié !' : 'Copier le récapitulatif'}
        </Button>
      </div>
    </section>
  );
}
