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
  type LucideIcon,
} from 'lucide-react';
import type { Inputs, Results, AnnualisationResults } from '../lib/calc';
import { fmtJours, fmtEuro, fmtPct } from '../lib/calc';
import type { TabId } from './Sidebar';
import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from './ui/chart';

/** Évite le rendu de recharts côté serveur (SSR) : donut monté client only. */
function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

const NUM = "font-['Space_Grotesk'] tabular-nums";

/* ------------------------------ Cartes ------------------------------- */

function Hero({
  icon: Icon,
  label,
  value,
  sub,
  chip,
  variant,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  sub: string;
  chip?: string;
  variant: 'blue' | 'teal';
}) {
  const grad =
    variant === 'blue'
      ? 'from-trappes-500 via-trappes-600 to-trappes-800'
      : 'from-[#22b2ac] via-[#2a8fc0] to-[#2f66ab]';
  return (
    <div className={cn('dash-hero relative overflow-hidden rounded-2xl bg-gradient-to-br p-[18px] text-white shadow-lg', grad)}>
      <div className="pointer-events-none absolute -right-7 -top-7 h-28 w-28 rounded-full bg-white/10" />
      <div className="relative flex items-start justify-between">
        <span className="text-[12.5px] font-bold text-white/90">{label}</span>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div className={cn('relative mt-4 text-[34px] font-bold leading-none', NUM)}>{value}</div>
      <div className="relative mt-3 flex flex-wrap items-center gap-2">
        {chip && (
          <span className="rounded-md bg-white/20 px-1.5 py-0.5 text-[11px] font-bold">{chip}</span>
        )}
        <span className="text-[11px] font-medium text-white/75">{sub}</span>
      </div>
    </div>
  );
}

function Counter({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  sub: string;
  accent: string;
}) {
  return (
    <div className="dash-card flex flex-col justify-center rounded-2xl border border-white/[0.06] bg-[#111c31] p-4">
      <div className="flex items-center gap-2.5">
        <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg', accent)}>
          <Icon className="h-4 w-4" />
        </span>
        <span className="text-[12px] font-bold text-slate-300">{label}</span>
      </div>
      <div className={cn('mt-2.5 text-[26px] font-bold leading-none text-white', NUM)}>{value}</div>
      <div className="mt-1 text-[11px] text-slate-400">{sub}</div>
    </div>
  );
}

function DarkCard({
  icon: Icon,
  title,
  hint,
  className,
  children,
}: {
  icon: LucideIcon;
  title: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('dash-card rounded-2xl border border-white/[0.06] bg-[#111c31] p-5', className)}>
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-white/[0.06] text-trappes-300">
          <Icon className="h-4 w-4" />
        </span>
        <div>
          <div className="text-sm font-bold text-white">{title}</div>
          {hint && <div className="text-[11px] font-medium text-slate-400">{hint}</div>}
        </div>
      </div>
      {children}
    </div>
  );
}

function AnalysisRow({
  icon: Icon,
  title,
  sub,
  value,
  children,
}: {
  icon: LucideIcon;
  title: string;
  sub: string;
  value: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white/[0.06] text-trappes-300">
            <Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-100">{title}</p>
            <p className="text-xs text-slate-400">{sub}</p>
          </div>
        </div>
        <span className={cn('shrink-0 whitespace-nowrap text-right text-base font-bold text-white', NUM)}>{value}</span>
      </div>
      {children}
    </div>
  );
}

function Dot({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
      <span className={cn('h-2.5 w-2.5 rounded-[3px]', color)} />
      {children}
    </span>
  );
}

const donutConfig: ChartConfig = {
  c1: { label: 'Congés annuels', color: '#5b9bd5' },
  c2: { label: 'RTT réelles', color: '#2dd4bf' },
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

  const donutData = [
    { key: 'c1', name: 'Congés annuels', value: results.congesAnnuels },
    { key: 'c2', name: 'RTT réelles', value: results.rttReelles },
  ];
  const donutTotal = results.congesAnnuels + results.rttReelles;

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
    <div
      className="dash-dark animate-fade-up rounded-2xl border border-white/[0.06] bg-[#0b1322] p-4 text-slate-200 shadow-glow sm:p-5"
      style={{ backgroundImage: 'radial-gradient(900px 480px at 85% -12%, rgba(74,134,197,0.14), transparent 60%)' }}
    >
      {/* En-tête */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className={cn('text-xl font-bold tracking-tight text-white', NUM)}>Synthèse des droits</h2>
          <p className="text-sm text-slate-400">
            <span className="font-semibold text-slate-200">{inputs.nom || 'Agent'}</span> · prorata de la
            période {fmtPct(results.prorata)}
          </p>
        </div>
        <Button
          variant="outline"
          className="no-print border-white/15 bg-white/10 text-white hover:bg-white/20 hover:text-white"
          onClick={() => window.print()}
        >
          <Printer className="h-4 w-4" /> Imprimer / PDF
        </Button>
      </div>

      {/* Rangée 1 : 2 héros dégradés + 2 compteurs */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Hero
          icon={Layers}
          variant="blue"
          label="Total congés + RTT"
          value={fmtJours(results.total)}
          chip={`${fmtJours(results.congesAnnuels)} CA · ${fmtJours(results.rttReelles)} RTT`}
          sub="jours de repos"
        />
        <Hero
          icon={BadgeEuro}
          variant="teal"
          label="Indemnisation (brut)"
          value={fmtEuro(results.montantIndemnisation, 0)}
          chip={`${fmtEuro(results.indemniteParJour)}/j`}
          sub={`${fmtJours(results.joursIndemnisables)} j indemnisables`}
        />
        <Counter
          icon={CalendarCheck2}
          label="Congés annuels"
          value={fmtJours(results.congesAnnuels)}
          sub="jours (CA)"
          accent="bg-trappes-400/15 text-trappes-200"
        />
        <Counter
          icon={Timer}
          label="RTT réelles"
          value={fmtJours(results.rttReelles)}
          sub="après maladie"
          accent="bg-teal-400/15 text-teal-300"
        />
      </div>

      {/* Rangée 2 : donut + analyse */}
      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
        <DarkCard icon={PieIcon} title="Répartition des droits" hint="Congés annuels vs RTT réelles" className="lg:col-span-1">
          <div className="relative mx-auto aspect-square max-h-[180px]">
            {mounted ? (
              <ChartContainer config={donutConfig} className="h-full w-full">
                <PieChart>
                  <ChartTooltip content={<ChartTooltipContent formatter={fmtJ} />} />
                  <Pie data={donutData} dataKey="value" nameKey="name" innerRadius={54} outerRadius={80} paddingAngle={2} strokeWidth={0}>
                    {donutData.map((d) => (
                      <Cell key={d.key} fill={`var(--color-${d.key})`} />
                    ))}
                  </Pie>
                </PieChart>
              </ChartContainer>
            ) : (
              <div className="h-full w-full animate-pulse rounded-full bg-white/10" />
            )}
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className={cn('text-2xl font-bold text-white', NUM)}>{fmtJours(donutTotal)}</span>
              <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">jours</span>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-center gap-5">
            <Dot color="bg-[#5b9bd5]">CA · {fmtJours(results.congesAnnuels)} j</Dot>
            <Dot color="bg-[#2dd4bf]">RTT · {fmtJours(results.rttReelles)} j</Dot>
          </div>
        </DarkCard>

        <DarkCard icon={Wallet} title="Analyse détaillée" hint="Solde au départ · indemnisation" className="lg:col-span-2">
          <div className="divide-y divide-white/[0.06]">
            <AnalysisRow
              icon={Wallet}
              title="Solde au départ"
              sub="acquis = pris + restant"
              value={`${fmtJours(results.soldeConges)} j`}
            >
              <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-white/10">
                <div className="h-full bg-white/30" style={{ width: `${prisPct}%` }} />
                <div className="h-full bg-trappes-400" style={{ width: `${restantPct}%` }} />
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <Dot color="bg-white/30">Pris · {fmtJours(pris)} j</Dot>
                <Dot color="bg-trappes-400">Restant · {fmtJours(restant)} j</Dot>
                <span className="ml-auto text-xs text-slate-400">acquis {fmtJours(acquis)} j</span>
              </div>
            </AnalysisRow>

            <AnalysisRow
              icon={BadgeEuro}
              title="Indemnisation"
              sub="part indemnisable (plafond 4 sem.)"
              value={fmtEuro(results.montantIndemnisation, 0)}
            >
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-teal-400 transition-all" style={{ width: `${indemPct}%` }} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  {fmtJours(indem)} j indemnisables sur {fmtJours(restant)} j de solde restant
                </span>
                <span className="text-xs font-semibold text-slate-200">{fmtEuro(results.indemniteParJour)}/j</span>
              </div>
            </AnalysisRow>
          </div>
        </DarkCard>
      </div>

      {/* Renvoi annualisation */}
      <div className="dash-card mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/[0.06] bg-[#111c31] p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.06] text-trappes-300">
            <Timer className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-white">Agent annualisé ?</p>
            <p className="text-xs text-slate-400">
              Quotité de paie {fmtPct(annuResults.quotitePaie)} · {fmtJours(annuResults.congesAnnuels)} j de
              congés — voir l’onglet Annualisation.
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          className="no-print text-slate-300 hover:bg-white/10 hover:text-white"
          onClick={() => onNavigate('annualisation')}
        >
          Ouvrir <ArrowRight className="h-4 w-4" />
        </Button>
      </div>

      {!results.valid && (
        <div className="no-print mt-3 rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-200">
          Saisie du calculateur à corriger — résultats partiels.
        </div>
      )}
    </div>
  );
}
