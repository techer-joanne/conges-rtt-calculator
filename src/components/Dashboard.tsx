import { useEffect, useState } from 'react';
import {
  Pie,
  PieChart,
  Cell,
  Bar,
  BarChart,
  XAxis,
  YAxis,
  CartesianGrid,
  LabelList,
} from 'recharts';
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
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from './ui/chart';

/** Évite le rendu de recharts côté serveur (SSR) : graphiques montés client only. */
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
    <Card className="print-clean overflow-hidden">
      <CardContent className="flex items-start justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="mt-1 truncate text-2xl font-extrabold tabular-nums text-foreground">{value}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{sub}</p>
        </div>
        <span
          className={
            tone === 'primary'
              ? 'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground'
              : 'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-primary'
          }
        >
          <Icon className="h-5 w-5" />
        </span>
      </CardContent>
    </Card>
  );
}

/* ----------------------------- Graphiques ---------------------------- */

const TONES = ['var(--color-c1)', 'var(--color-c2)', 'var(--color-c3)', 'var(--color-c4)'];

const paletteConfig: ChartConfig = {
  c1: { label: 'Série 1', color: 'hsl(var(--chart-1))' },
  c2: { label: 'Série 2', color: 'hsl(var(--chart-2))' },
  c3: { label: 'Série 3', color: 'hsl(var(--chart-3))' },
  c4: { label: 'Série 4', color: 'hsl(var(--chart-4))' },
};

function ChartCard({
  icon: Icon,
  title,
  hint,
  children,
}: {
  icon: LucideIcon;
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="print-clean">
      <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-muted text-primary">
          <Icon className="h-4 w-4" />
        </span>
        <div>
          <CardTitle className="text-sm font-bold uppercase tracking-wide text-secondary-foreground">
            {title}
          </CardTitle>
          <p className="text-xs font-medium text-muted-foreground">{hint}</p>
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function ChartFallback() {
  return <div className="aspect-video w-full animate-pulse rounded-md bg-muted/60" />;
}

const fmtJ = (v: number | string) => `${fmtJours(Number(v))} j`;
const fmtE = (v: number | string) => fmtEuro(Number(v));

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

  const maladieData = [
    { key: 'proratises', name: 'RTT proratisés', value: results.rttProratises, fill: TONES[0] },
    { key: 'reelles', name: 'RTT réelles', value: results.rttReelles, fill: TONES[1] },
  ];

  const soldeData = [
    { key: 'acquis', name: 'Acquis', value: results.caAcquis, fill: TONES[0] },
    { key: 'pris', name: 'Pris', value: results.congesDejaPris, fill: TONES[3] },
    { key: 'restant', name: 'Restant', value: results.soldeConges, fill: TONES[1] },
  ];

  const indemData = [
    { key: 'restant', name: 'Solde restant', value: results.soldeConges, fill: TONES[2] },
    { key: 'indem', name: 'Indemnisables (4 sem.)', value: results.joursIndemnisables, fill: TONES[1] },
  ];

  return (
    <div className="animate-fade-up space-y-6">
      {/* En-tête du tableau de bord */}
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
        <Kpi
          icon={CalendarCheck2}
          label="Congés annuels"
          value={fmtJours(results.congesAnnuels)}
          sub="jours (CA)"
        />
        <Kpi icon={Timer} label="RTT réelles" value={fmtJours(results.rttReelles)} sub="jours (après maladie)" />
        <Kpi
          icon={Layers}
          label="Total congés + RTT"
          value={fmtJours(results.total)}
          sub="jours de repos"
          tone="primary"
        />
        <Kpi icon={Wallet} label="Solde au départ" value={fmtJours(results.soldeConges)} sub="jours à solder" />
        <Kpi
          icon={BadgeEuro}
          label="Indemnisation (brut)"
          value={fmtEuro(results.montantIndemnisation, 0)}
          sub={`${fmtJours(results.joursIndemnisables)} j indemnisables`}
        />
      </div>

      {/* 4 graphiques */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Donut CA / RTT réelles */}
        <ChartCard icon={PieIcon} title="Répartition des droits" hint="Congés annuels vs RTT réelles">
          {mounted ? (
            <ChartContainer config={paletteConfig} className="mx-auto aspect-square max-h-[260px]">
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent formatter={fmtJ} />} />
                <Pie
                  data={donutData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={62}
                  outerRadius={96}
                  paddingAngle={2}
                  strokeWidth={2}
                >
                  {donutData.map((d) => (
                    <Cell key={d.key} fill={`var(--color-${d.key})`} />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
          ) : (
            <ChartFallback />
          )}
          <div className="mt-2 flex items-center justify-center gap-5 text-xs">
            <span className="flex items-center gap-1.5 font-medium text-muted-foreground">
              <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: 'hsl(var(--chart-1))' }} />
              Congés annuels · {fmtJours(results.congesAnnuels)} j
            </span>
            <span className="flex items-center gap-1.5 font-medium text-muted-foreground">
              <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: 'hsl(var(--chart-2))' }} />
              RTT réelles · {fmtJours(results.rttReelles)} j
            </span>
          </div>
          <p className="mt-1 text-center text-sm font-bold text-foreground">
            Total {fmtJours(donutTotal)} jours
          </p>
        </ChartCard>

        {/* Impact maladie */}
        <ChartCard icon={Activity} title="Impact de la maladie" hint="RTT proratisés vs RTT réelles">
          {mounted ? (
            <ChartContainer config={paletteConfig} className="aspect-video max-h-[260px] w-full">
              <BarChart data={maladieData} margin={{ top: 18, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={11} />
                <YAxis tickLine={false} axisLine={false} fontSize={11} allowDecimals={false} />
                <ChartTooltip content={<ChartTooltipContent formatter={fmtJ} hideLabel />} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={84}>
                  {maladieData.map((d) => (
                    <Cell key={d.key} fill={d.fill} />
                  ))}
                  <LabelList dataKey="value" position="top" fontSize={12} fontWeight={700} formatter={fmtJ} />
                </Bar>
              </BarChart>
            </ChartContainer>
          ) : (
            <ChartFallback />
          )}
        </ChartCard>

        {/* Solde au départ */}
        <ChartCard icon={Wallet} title="Solde au départ" hint="Acquis · pris · restant">
          {mounted ? (
            <ChartContainer config={paletteConfig} className="aspect-video max-h-[260px] w-full">
              <BarChart data={soldeData} margin={{ top: 18, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={11} />
                <YAxis tickLine={false} axisLine={false} fontSize={11} allowDecimals={false} />
                <ChartTooltip content={<ChartTooltipContent formatter={fmtJ} hideLabel />} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={72}>
                  {soldeData.map((d) => (
                    <Cell key={d.key} fill={d.fill} />
                  ))}
                  <LabelList dataKey="value" position="top" fontSize={12} fontWeight={700} formatter={fmtJ} />
                </Bar>
              </BarChart>
            </ChartContainer>
          ) : (
            <ChartFallback />
          )}
        </ChartCard>

        {/* Indemnisation */}
        <ChartCard icon={BadgeEuro} title="Indemnisation" hint="Solde restant vs jours indemnisables (plafond 4 sem.)">
          {mounted ? (
            <ChartContainer config={paletteConfig} className="aspect-video max-h-[260px] w-full">
              <BarChart data={indemData} margin={{ top: 18, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={11} />
                <YAxis tickLine={false} axisLine={false} fontSize={11} allowDecimals={false} />
                <ChartTooltip content={<ChartTooltipContent formatter={fmtJ} hideLabel />} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={84}>
                  {indemData.map((d) => (
                    <Cell key={d.key} fill={d.fill} />
                  ))}
                  <LabelList dataKey="value" position="top" fontSize={12} fontWeight={700} formatter={fmtJ} />
                </Bar>
              </BarChart>
            </ChartContainer>
          ) : (
            <ChartFallback />
          )}
          <p className="mt-2 text-center text-sm font-bold text-foreground">
            Montant estimé · {fmtE(results.montantIndemnisation)} brut
          </p>
        </ChartCard>
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
