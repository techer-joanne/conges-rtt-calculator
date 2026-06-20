import { useEffect, useState } from 'react';
import { Pie, PieChart, Cell } from 'recharts';
import {
  CalendarCheck2,
  Timer,
  Layers,
  Wallet,
  BadgeEuro,
  Printer,
  ArrowRight,
  PieChart as PieIcon,
  Activity,
  type LucideIcon,
} from 'lucide-react';
import type { Inputs, Results, AnnualisationResults } from '../lib/calc';
import { fmtJours, fmtEuro, fmtPct } from '../lib/calc';
import type { TabId } from './Sidebar';
import { cn } from '../lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from './ui/chart';

/** Évite le rendu de recharts côté serveur (SSR) : graphique monté client only. */
function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

/* ------------------------------- KPIs -------------------------------- */

function Kpi({
  icon: Icon,
  label,
  value,
  sub,
  tone = 'default',
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  sub: string;
  tone?: 'default' | 'primary';
}) {
  return (
    <Card className={cn('print-clean overflow-hidden', tone === 'primary' && 'border-primary/30 bg-primary/[0.03]')}>
      <CardContent className="flex items-start justify-between gap-2 p-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase leading-tight tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="mt-1.5 truncate text-2xl font-extrabold tabular-nums text-foreground">{value}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{sub}</p>
        </div>
        <span
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
            tone === 'primary' ? 'bg-primary text-primary-foreground' : 'bg-muted text-primary',
          )}
        >
          <Icon className="h-5 w-5" />
        </span>
      </CardContent>
    </Card>
  );
}

/* ------------------------- Lignes d'analyse -------------------------- */

function AnalysisRow({
  icon: Icon,
  title,
  sub,
  value,
  valueTone = 'default',
  children,
}: {
  icon: LucideIcon;
  title: string;
  sub: string;
  value: string;
  valueTone?: 'default' | 'primary';
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-primary">
            <Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">{title}</p>
            <p className="text-xs text-muted-foreground">{sub}</p>
          </div>
        </div>
        <span
          className={cn(
            'shrink-0 whitespace-nowrap text-right text-base font-bold tabular-nums',
            valueTone === 'primary' ? 'text-primary' : 'text-foreground',
          )}
        >
          {value}
        </span>
      </div>
      {children}
    </div>
  );
}

/** Légende compacte « pastille + texte ». */
function Dot({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
      <span className={cn('h-2.5 w-2.5 rounded-[3px]', className)} />
      {children}
    </span>
  );
}

const donutConfig: ChartConfig = {
  c1: { label: 'Congés annuels', color: 'hsl(var(--chart-1))' },
  c2: { label: 'RTT réelles', color: 'hsl(var(--chart-2))' },
};

const fmtJ = (v: number | string) => `${fmtJours(Number(v))} j`;

export default function Dashboard({
  inputs,
  results,
  annuResults,
  onNavigate,
}: {
  inputs: Inputs;
  results: Results;
  annuResults: AnnualisationResults;
  onNavigate: (t: TabId) => void;
}) {
  const mounted = useMounted();

  // Donut : composition congés annuels / RTT réelles.
  const donutData = [
    { key: 'c1', name: 'Congés annuels', value: results.congesAnnuels },
    { key: 'c2', name: 'RTT réelles', value: results.rttReelles },
  ];
  const donutTotal = results.congesAnnuels + results.rttReelles;

  // Impact maladie : part des RTT conservée après réduction maladie.
  const pror = results.rttProratises;
  const reel = results.rttReelles;
  const reelPct = pror > 0 ? Math.min(100, (reel / pror) * 100) : 0;
  const deltaMal = Math.max(0, pror - reel);

  // Solde au départ : acquis = pris + restant.
  const acquis = Math.max(0, results.caAcquis);
  const pris = Math.max(0, results.congesDejaPris);
  const restant = Math.max(0, results.soldeConges);
  const soldeDenom = Math.max(acquis, pris + restant, 1e-9);
  const prisPct = (pris / soldeDenom) * 100;
  const restantPct = (restant / soldeDenom) * 100;

  // Indemnisation : part du solde restant effectivement indemnisable (plafond 4 sem.).
  const indem = results.joursIndemnisables;
  const indemPct = restant > 0 ? Math.min(100, (indem / restant) * 100) : 0;

  return (
    <div className="animate-fade-up space-y-5">
      {/* En-tête */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight text-foreground">Tableau de bord</h2>
          <p className="text-sm text-muted-foreground">
            Synthèse pour <span className="font-semibold text-foreground">{inputs.nom || 'l’agent'}</span> ·
            prorata de la période {fmtPct(results.prorata)}
          </p>
        </div>
        <Button variant="outline" className="no-print" onClick={() => window.print()}>
          <Printer className="h-4 w-4" /> Imprimer / PDF
        </Button>
      </div>

      {/* 5 KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Kpi icon={CalendarCheck2} label="Congés annuels" value={fmtJours(results.congesAnnuels)} sub="jours (CA)" />
        <Kpi icon={Timer} label="RTT réelles" value={fmtJours(results.rttReelles)} sub="après maladie" />
        <Kpi icon={Layers} label="Total congés + RTT" value={fmtJours(results.total)} sub="jours de repos" tone="primary" />
        <Kpi icon={Wallet} label="Solde au départ" value={fmtJours(results.soldeConges)} sub="jours à solder" />
        <Kpi
          icon={BadgeEuro}
          label="Indemnisation (brut)"
          value={fmtEuro(results.montantIndemnisation, 0)}
          sub={`${fmtJours(results.joursIndemnisables)} j indemnisables`}
        />
      </div>

      {/* Analyse : donut compact + lignes à barres horizontales (denses) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Donut */}
        <Card className="print-clean lg:col-span-1">
          <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-muted text-primary">
              <PieIcon className="h-4 w-4" />
            </span>
            <div>
              <CardTitle className="text-sm font-bold uppercase tracking-wide text-secondary-foreground">
                Répartition des droits
              </CardTitle>
              <p className="text-xs font-medium text-muted-foreground">Congés annuels vs RTT réelles</p>
            </div>
          </CardHeader>
          <CardContent>
            <div className="relative mx-auto aspect-square max-h-[180px]">
              {mounted ? (
                <ChartContainer config={donutConfig} className="h-full w-full">
                  <PieChart>
                    <ChartTooltip content={<ChartTooltipContent formatter={fmtJ} />} />
                    <Pie data={donutData} dataKey="value" nameKey="name" innerRadius={54} outerRadius={80} paddingAngle={2} strokeWidth={2}>
                      {donutData.map((d) => (
                        <Cell key={d.key} fill={`var(--color-${d.key})`} />
                      ))}
                    </Pie>
                  </PieChart>
                </ChartContainer>
              ) : (
                <div className="h-full w-full animate-pulse rounded-full bg-muted/60" />
              )}
              {/* Total au centre */}
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-extrabold tabular-nums text-foreground">{fmtJours(donutTotal)}</span>
                <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">jours</span>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-center gap-5">
              <Dot className="bg-chart-1">CA · {fmtJours(results.congesAnnuels)} j</Dot>
              <Dot className="bg-chart-2">RTT · {fmtJours(results.rttReelles)} j</Dot>
            </div>
          </CardContent>
        </Card>

        {/* Lignes d'analyse */}
        <Card className="print-clean lg:col-span-2">
          <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-muted text-primary">
              <Activity className="h-4 w-4" />
            </span>
            <div>
              <CardTitle className="text-sm font-bold uppercase tracking-wide text-secondary-foreground">
                Analyse détaillée
              </CardTitle>
              <p className="text-xs font-medium text-muted-foreground">Maladie · solde · indemnisation</p>
            </div>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-border">
              {/* Impact maladie */}
              <AnalysisRow
                icon={Activity}
                title="Impact de la maladie"
                sub="RTT proratisés → réelles"
                value={`${fmtJours(pror)} → ${fmtJours(reel)} j`}
              >
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${reelPct}%` }} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {pror > 0 ? `${fmtPct(reel / pror, 0)} des RTT conservées` : 'aucun RTT'}
                  </span>
                  {deltaMal > 0 ? (
                    <Badge variant="destructive">− {fmtJours(deltaMal)} j</Badge>
                  ) : (
                    <Badge variant="success">Aucun impact</Badge>
                  )}
                </div>
              </AnalysisRow>

              {/* Solde au départ */}
              <AnalysisRow
                icon={Wallet}
                title="Solde au départ"
                sub="acquis = pris + restant"
                value={`${fmtJours(results.soldeConges)} j`}
                valueTone="primary"
              >
                <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-chart-4" style={{ width: `${prisPct}%` }} />
                  <div className="h-full bg-primary" style={{ width: `${restantPct}%` }} />
                </div>
                <div className="flex items-center gap-4">
                  <Dot className="bg-chart-4">Pris · {fmtJours(pris)} j</Dot>
                  <Dot className="bg-primary">Restant · {fmtJours(restant)} j</Dot>
                  <span className="ml-auto text-xs text-muted-foreground">acquis {fmtJours(acquis)} j</span>
                </div>
              </AnalysisRow>

              {/* Indemnisation */}
              <AnalysisRow
                icon={BadgeEuro}
                title="Indemnisation"
                sub="part indemnisable (plafond 4 sem.)"
                value={fmtEuro(results.montantIndemnisation, 0)}
                valueTone="primary"
              >
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${indemPct}%` }} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {fmtJours(indem)} j indemnisables sur {fmtJours(restant)} j de solde restant
                  </span>
                  <span className="text-xs font-semibold text-foreground">
                    {fmtEuro(results.indemniteParJour)}/j
                  </span>
                </div>
              </AnalysisRow>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Renvoi annualisation */}
      <Card className="print-clean">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-primary">
              <Timer className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">Agent annualisé ?</p>
              <p className="text-xs text-muted-foreground">
                Quotité de paie {fmtPct(annuResults.quotitePaie)} · {fmtJours(annuResults.congesAnnuels)} j de
                congés — voir l’onglet Annualisation.
              </p>
            </div>
          </div>
          <Button variant="ghost" className="no-print" onClick={() => onNavigate('annualisation')}>
            Ouvrir <ArrowRight className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>

      {!results.valid && (
        <Badge variant="destructive" className="no-print">
          Saisie du calculateur à corriger — résultats partiels.
        </Badge>
      )}
    </div>
  );
}
