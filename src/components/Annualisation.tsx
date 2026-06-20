import {
  CalendarRange,
  User,
  Clock,
  CalendarDays,
  CalendarCheck2,
  HeartPulse,
  Info,
  HelpCircle,
  Gauge,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import type { AnnualisationInputs, AnnualisationResults } from '../lib/calc';
import {
  fmtJours,
  fmtPct,
  fmtHeures,
  fmtHeuresMinutes,
  DUREE_LEGALE_ANNUELLE,
  HEURES_HEBDO_TEMPS_PLEIN,
} from '../lib/calc';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';

function FieldTip({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className="text-muted-foreground hover:text-primary" aria-label={text}>
          <HelpCircle className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent>{text}</TooltipContent>
    </Tooltip>
  );
}

function StatRow({
  label,
  formula,
  value,
  accent = false,
}: {
  label: string;
  formula: string;
  value: string;
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
        {value}
      </div>
    </div>
  );
}

export default function Annualisation({
  inputs,
  onChange,
  results,
}: {
  inputs: AnnualisationInputs;
  onChange: (patch: Partial<AnnualisationInputs>) => void;
  results: AnnualisationResults;
}) {
  // Statut du contrôle de cohérence (heures réelles vs 1607 h proratisées).
  const ecart = results.ecartCoherence;
  const coherence =
    Math.abs(ecart) < 0.5
      ? { variant: 'success' as const, text: 'Cohérent avec un temps plein (≈ 1607 h).' }
      : ecart < 0
        ? {
            variant: 'secondary' as const,
            text: `Équivaut à un temps partiel — ${fmtPct(results.quotitePaie)} d’un temps plein.`,
          }
        : {
            variant: 'destructive' as const,
            text: `Dépassement de ${fmtHeures(ecart)} — heures supplémentaires à régulariser.`,
          };

  const quotitePct = Math.min(100, Math.max(0, results.quotitePaie * 100));

  return (
    <div className="animate-fade-up space-y-6">
      {/* Saisie */}
      <Card className="no-print">
        <CardHeader className="flex flex-row items-center gap-2 space-y-0">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <CalendarRange className="h-4 w-4" />
          </span>
          <CardTitle className="text-base font-bold uppercase tracking-wide text-secondary-foreground">
            Annualisation du temps de travail
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="flex items-start gap-1.5 text-xs italic text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Pour les agents dont le temps de travail est réparti sur l’année (planning variable). Méthode des
            centres de gestion : un temps plein = {DUREE_LEGALE_ANNUELLE} h/an.
          </p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="annu-nom" className="mb-1.5">
                <User className="h-3.5 w-3.5 text-primary" /> Nom de l'agent
              </Label>
              <Input
                id="annu-nom"
                value={inputs.nom}
                placeholder="Ex. : Dupont Marie (ATSEM)"
                onChange={(e) => onChange({ nom: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="annu-h" className="mb-1.5">
                <Clock className="h-3.5 w-3.5 text-primary" /> Heures hebdo (période travaillée)
                <FieldTip text="Nombre d'heures travaillées par semaine pendant les périodes d'activité (ex. semaines scolaires)." />
              </Label>
              <Input
                id="annu-h"
                type="number"
                min={0}
                step={0.5}
                value={inputs.heuresHebdo}
                onChange={(e) => onChange({ heuresHebdo: Number(e.target.value) })}
              />
            </div>

            <div>
              <Label htmlFor="annu-sem" className="mb-1.5">
                <CalendarDays className="h-3.5 w-3.5 text-primary" /> Nombre de semaines travaillées
                <FieldTip text="Nombre de semaines effectivement travaillées sur l'année (ex. 36 pour un rythme scolaire)." />
              </Label>
              <Input
                id="annu-sem"
                type="number"
                min={0}
                step={1}
                value={inputs.nbSemaines}
                onChange={(e) => onChange({ nbSemaines: Number(e.target.value) })}
              />
            </div>

            <div>
              <Label htmlFor="annu-debut" className="mb-1.5">
                <CalendarDays className="h-3.5 w-3.5 text-primary" /> Début de période (option)
              </Label>
              <Input
                id="annu-debut"
                type="date"
                value={inputs.dateDebut}
                onChange={(e) => onChange({ dateDebut: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="annu-fin" className="mb-1.5">
                <CalendarDays className="h-3.5 w-3.5 text-primary" /> Fin de période (option)
                <FieldTip text="Renseignez une période uniquement si l'année est incomplète (arrivée / départ en cours d'année)." />
              </Label>
              <Input
                id="annu-fin"
                type="date"
                value={inputs.dateFin}
                onChange={(e) => onChange({ dateFin: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="annu-feries" className="mb-1.5">
                <CalendarCheck2 className="h-3.5 w-3.5 text-primary" /> Jours fériés travaillés (option)
                <FieldTip text="Jours fériés tombant sur un jour habituellement travaillé — déduits du volume réel (modalité à valider avec la DRH)." />
              </Label>
              <Input
                id="annu-feries"
                type="number"
                min={0}
                step={1}
                value={inputs.joursFeries}
                onChange={(e) => onChange({ joursFeries: Number(e.target.value) })}
              />
            </div>

            <div>
              <Label htmlFor="annu-mal" className="mb-1.5">
                <HeartPulse className="h-3.5 w-3.5 text-primary" /> Absence maladie (jours, option)
              </Label>
              <Input
                id="annu-mal"
                type="number"
                min={0}
                step={1}
                value={inputs.joursMaladie}
                onChange={(e) => onChange({ joursMaladie: Number(e.target.value) })}
              />
            </div>
          </div>

          {!results.valid && (
            <Alert variant="warning">
              <AlertTriangle />
              <AlertTitle>Saisie à corriger</AlertTitle>
              <AlertDescription>
                <ul className="mt-1 list-inside list-disc">
                  {results.errors.map((err) => (
                    <li key={err}>{err}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Quotité de paie — jauge */}
      <Card className="print-clean overflow-hidden bg-gradient-to-br from-trappes-900 via-trappes-800 to-trappes-700 text-white">
        <CardContent className="p-6">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-trappes-200">
            <Gauge className="h-4 w-4" /> Quotité de paie (/35e)
          </p>
          <div className="mt-1 flex items-baseline gap-3">
            <span className="text-5xl font-extrabold tabular-nums sm:text-6xl">
              {fmtPct(results.quotitePaie)}
            </span>
            <span className="text-lg font-semibold text-trappes-200">
              {fmtHeures(results.equivalentHebdo)}/sem.
            </span>
          </div>
          <p className="mt-1 text-sm text-trappes-200/90">
            soit {fmtHeuresMinutes(results.equivalentHebdo)} par semaine en moyenne · 12 bulletins mensuels
            identiques
          </p>
          <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-white/15">
            <div className="h-full rounded-full bg-trappes-300" style={{ width: `${quotitePct}%` }} />
          </div>
        </CardContent>
      </Card>

      {/* Détail du calcul */}
      <Card className="print-clean overflow-hidden">
        <CardHeader className="flex flex-row items-center gap-2 space-y-0 border-b">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <CalendarRange className="h-4 w-4" />
          </span>
          <CardTitle className="text-base font-bold uppercase tracking-wide text-secondary-foreground">
            Détail du calcul
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            <StatRow
              label="Heures annuelles travaillées (X)"
              formula="heures hebdo × nombre de semaines"
              value={fmtHeures(results.heuresAnnuelles)}
            />
            <StatRow
              label="Équivalent hebdomadaire annualisé"
              formula={`(X × ${HEURES_HEBDO_TEMPS_PLEIN}) ÷ ${DUREE_LEGALE_ANNUELLE}`}
              value={fmtHeures(results.equivalentHebdo)}
            />
            <StatRow
              label="Quotité de paie"
              formula={`X ÷ ${DUREE_LEGALE_ANNUELLE}`}
              value={fmtPct(results.quotitePaie)}
              accent
            />
            <StatRow
              label="Prorata de la période"
              formula="jours calendaires ÷ 365 (1 si année pleine)"
              value={fmtPct(results.prorata)}
            />
            <StatRow
              label="Congés annuels"
              formula="ROUND(25 × quotité × prorata) — jours ouvrés"
              value={`${fmtJours(results.congesAnnuels)} j`}
              accent
            />
            <StatRow
              label="RTT / ARTT"
              formula="les agents annualisés n'ouvrent pas de RTT"
              value="0 j"
            />
          </div>
        </CardContent>
      </Card>

      {/* Contrôle de cohérence */}
      <Card className="print-clean overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 border-b">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <CheckCircle2 className="h-4 w-4" />
            </span>
            <CardTitle className="text-base font-bold uppercase tracking-wide text-secondary-foreground">
              Contrôle de cohérence
            </CardTitle>
          </div>
          <Badge variant={coherence.variant}>{fmtHeures(results.heuresReelles)} réelles</Badge>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            <StatRow
              label="Volume planifié"
              formula="heures hebdo × semaines (X)"
              value={fmtHeures(results.heuresAnnuelles)}
            />
            <StatRow
              label="Déductions fériés / maladie"
              formula="(jours fériés + maladie) × heures par jour"
              value={`− ${fmtHeures(results.heuresDeduites)}`}
            />
            <StatRow
              label="Volume réel travaillé"
              formula="X − déductions"
              value={fmtHeures(results.heuresReelles)}
            />
            <StatRow
              label="Référence temps plein"
              formula={`${DUREE_LEGALE_ANNUELLE} h × prorata`}
              value={fmtHeures(results.volumeReference)}
            />
            <StatRow
              label="Écart de cohérence"
              formula="volume réel − référence temps plein"
              value={`${ecart >= 0 ? '+' : '−'} ${fmtHeures(Math.abs(ecart))}`}
              accent
            />
          </div>
          <Separator />
          <div className="p-4">
            <Alert variant={coherence.variant === 'destructive' ? 'destructive' : 'default'}>
              <Info />
              <AlertDescription>{coherence.text}</AlertDescription>
            </Alert>
          </div>
        </CardContent>
      </Card>

      {/* Note méthodo */}
      <Alert variant="warning" className="no-print">
        <AlertTriangle />
        <AlertDescription>
          Estimation indicative (méthode CDG, décret n° 85-1250 — congés décomptés en jours). Le traitement des
          jours fériés et le report en cas de maladie restent à valider avec la DRH. La DRH demeure l’unique
          référence.
        </AlertDescription>
      </Alert>
    </div>
  );
}
