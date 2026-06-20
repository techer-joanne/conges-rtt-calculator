import { BarChart3 } from 'lucide-react';
import type { Results } from '../lib/calc';
import { fmtJours, fmtPct } from '../lib/calc';
import { useCountUp } from '../hooks/useCountUp';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

function AnimatedNumber({ value, render }: { value: number; render: (v: number) => string }) {
  const animated = useCountUp(value);
  return <span>{render(animated)}</span>;
}

function Row({
  label,
  value,
  render,
  formula,
  accent = false,
}: {
  label: string;
  value: number;
  render: (v: number) => string;
  formula: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-3 px-4 py-3.5 ${
        accent ? 'bg-accent/60' : 'odd:bg-muted/40'
      }`}
    >
      <div className="min-w-0">
        <p className={`truncate text-sm font-semibold ${accent ? 'text-foreground' : 'text-secondary-foreground'}`}>
          {label}
        </p>
        <p className="mt-0.5 truncate text-xs italic text-muted-foreground">{formula}</p>
      </div>
      <div className={`shrink-0 text-right text-lg font-bold tabular-nums ${accent ? 'text-primary' : 'text-foreground'}`}>
        <AnimatedNumber value={value} render={render} />
      </div>
    </div>
  );
}

export default function ResultsPanel({ results }: { results: Results }) {
  return (
    <Card className="print-clean overflow-hidden">
      <CardHeader className="flex flex-row items-center gap-2 space-y-0 border-b">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <BarChart3 className="h-4 w-4" />
        </span>
        <CardTitle className="text-base font-bold uppercase tracking-wide text-secondary-foreground">
          Résultats
        </CardTitle>
      </CardHeader>

      <CardContent className="p-0">
        <div className="divide-y">
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
      </CardContent>
    </Card>
  );
}
