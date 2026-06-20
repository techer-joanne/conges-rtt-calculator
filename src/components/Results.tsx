import { BarChart3 } from 'lucide-react';
import type { Results } from '../lib/calc';
import { fmtJours, fmtPct } from '../lib/calc';
import { useCountUp } from '../hooks/useCountUp';

function AnimatedNumber({
  value,
  render,
}: {
  value: number;
  render: (v: number) => string;
}) {
  const animated = useCountUp(value);
  return <span>{render(animated)}</span>;
}

function Row({
  label,
  value,
  render,
  formula,
  accent = false,
  negative = false,
}: {
  label: string;
  value: number;
  render: (v: number) => string;
  formula: string;
  accent?: boolean;
  negative?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-3 px-4 py-3.5 transition-colors ${
        accent ? 'bg-trappes-50/70' : 'odd:bg-trappes-50/30'
      }`}
    >
      <div className="min-w-0">
        <p className={`truncate text-sm font-semibold ${accent ? 'text-trappes-900' : 'text-trappes-800'}`}>
          {label}
        </p>
        <p className="mt-0.5 truncate text-xs italic text-trappes-400">{formula}</p>
      </div>
      <div
        className={`shrink-0 tabular-nums text-right text-lg font-bold ${
          negative ? 'text-rose-600' : accent ? 'text-trappes-700' : 'text-trappes-900'
        }`}
      >
        <AnimatedNumber value={value} render={render} />
      </div>
    </div>
  );
}

export default function ResultsPanel({ results }: { results: Results }) {
  return (
    <section className="print-clean overflow-hidden rounded-2xl border border-trappes-100 bg-white shadow-card">
      <div className="flex items-center gap-2 border-b border-trappes-100 bg-white px-5 py-4">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-trappes-600 text-white">
          <BarChart3 className="h-4 w-4" />
        </span>
        <h2 className="text-base font-bold uppercase tracking-wide text-trappes-800">Résultats</h2>
      </div>

      <div className="divide-y divide-trappes-100">
        <Row
          label="Nombre de jours (période)"
          value={results.joursCalendaires}
          render={(v) => Math.round(v).toLocaleString('fr-FR')}
          formula="jours calendaires"
        />
        <Row
          label="Jours ouvrés (période)"
          value={results.joursOuvres}
          render={(v) => Math.round(v).toLocaleString('fr-FR')}
          formula="lundi – vendredi"
        />
        <Row
          label="Prorata de la période"
          value={results.prorata}
          render={(v) => fmtPct(v)}
          formula="jours période ÷ 365"
        />
        <Row
          label="Congés annuels (CA)"
          value={results.congesAnnuels}
          render={(v) => fmtJours(v)}
          formula="25 × quotité × prorata"
          accent
        />
        <Row
          label="RTT / ARTT proratisés"
          value={results.rttProratises}
          render={(v) => fmtJours(v)}
          formula={`barème ${fmtJours(results.rttBareme)} j (socle × quotité) × prorata`}
        />
        <Row
          label="RTT réelles (après maladie)"
          value={results.rttReelles}
          render={(v) => fmtJours(v)}
          formula="réduit au prorata des jours d'absence maladie"
          accent
        />
        <Row
          label="Journée de solidarité"
          value={results.journeeSolidarite}
          render={(v) => fmtJours(v)}
          formula="à effectuer · non déduite du total"
        />
      </div>
    </section>
  );
}
