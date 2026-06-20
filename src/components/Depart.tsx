import { DoorOpen, Wallet, BadgeEuro, CheckCircle2, XCircle, Info } from 'lucide-react';
import type { Inputs, Results } from '../lib/calc';
import { fmtJours, fmtEuro } from '../lib/calc';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';

/** Ligne « libellé · formule » → « valeur », alignée sur le panneau Résultats. */
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
    <div className={`flex items-center justify-between gap-3 px-4 py-3.5 ${accent ? 'bg-accent/60' : 'odd:bg-muted/40'}`}>
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

function SectionCard({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof DoorOpen;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="print-clean overflow-hidden">
      <CardHeader className="flex flex-row items-center gap-2 space-y-0 border-b">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Icon className="h-4 w-4" />
        </span>
        <CardTitle className="text-base font-bold uppercase tracking-wide text-secondary-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">{children}</CardContent>
    </Card>
  );
}

const INCLUS = [
  'Traitement indiciaire',
  'Indemnité de résidence',
  'Supplément familial de traitement',
  'Primes et indemnités réglementaires (régime indemnitaire / RIFSEEP)',
  'Heures supplémentaires annualisées',
];

const EXCLUS = [
  'Remboursements de frais',
  'Participation à la protection sociale complémentaire',
  'Versements exceptionnels / occasionnels (manière de servir, primo-affectation, mobilité, restructuration, fait générateur unique)',
  'Activités accessoires',
  'Heures supplémentaires ponctuelles',
];

export default function Depart({
  inputs,
  onChange,
  results,
}: {
  inputs: Inputs;
  onChange: (patch: Partial<Inputs>) => void;
  results: Results;
}) {
  return (
    <div className="animate-fade-up space-y-6">
      {/* Saisie spécifique au départ */}
      <Card className="no-print">
        <CardHeader className="space-y-1.5">
          <CardTitle className="flex items-center gap-2 text-base font-bold uppercase tracking-wide text-secondary-foreground">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <DoorOpen className="h-4 w-4" />
            </span>
            Données de départ
          </CardTitle>
          <p className="flex items-start gap-1.5 text-xs italic text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Calculé à partir de la saisie de l'onglet <strong className="not-italic">Calculateur</strong> (socle,
            quotité, période). Complétez ci-dessous les deux éléments propres au départ.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="dejaPris" className="mb-1.5">
                <Wallet className="h-3.5 w-3.5 text-primary" /> Congés déjà pris (j)
              </Label>
              <Input
                id="dejaPris"
                type="number"
                min={0}
                step={0.5}
                value={inputs.congesDejaPris}
                onChange={(e) => onChange({ congesDejaPris: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label htmlFor="remBrute" className="mb-1.5">
                <BadgeEuro className="h-3.5 w-3.5 text-primary" /> Rémunération mensuelle brute (€)
              </Label>
              <Input
                id="remBrute"
                type="number"
                min={0}
                step={10}
                value={inputs.remunerationBrute}
                onChange={(e) => onChange({ remunerationBrute: Number(e.target.value) })}
                placeholder="Dernière paie mensuelle complète"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Solde de congés au départ */}
      <SectionCard icon={Wallet} title="Solde de congés au départ">
        <div className="divide-y">
          <StatRow label="Congés annuels acquis" formula="CA proratisé à la date de départ" value={fmtJours(results.caAcquis)} />
          <StatRow label="Congés déjà pris" formula="rappel de la saisie" value={fmtJours(results.congesDejaPris)} />
          <StatRow
            label="Solde de congés payés"
            formula="à solder ou indemniser selon le statut"
            value={fmtJours(results.soldeConges)}
            accent
          />
        </div>
        <p className="border-t bg-muted/40 px-5 py-3 text-xs leading-relaxed text-muted-foreground">
          <strong>Titulaire</strong> : congés non pris à solder avant le départ (non indemnisables).{' '}
          <strong>Contractuel</strong> (fin de contrat / licenciement) : indemnité compensatrice de congés payés
          possible.
        </p>
      </SectionCard>

      {/* Indemnisation des congés non pris */}
      <SectionCard icon={BadgeEuro} title="Indemnisation des congés non pris">
        <div className="flex items-center gap-2 border-b px-5 py-2.5">
          <Badge variant="secondary">Décret n° 2025-564</Badge>
        </div>
        <div className="divide-y">
          <StatRow
            label="Rémunération mensuelle brute de référence"
            formula="dernière paie mensuelle complète (saisie)"
            value={fmtEuro(Math.max(0, inputs.remunerationBrute || 0))}
          />
          <StatRow
            label="Jours indemnisables (plafond 4 semaines)"
            formula="solde, limité à 4 semaines (20 × quotité)"
            value={fmtJours(results.joursIndemnisables)}
          />
          <StatRow
            label="Indemnité par jour"
            formula="(rémunération mensuelle brute × 12) ÷ 250"
            value={fmtEuro(results.indemniteParJour)}
          />
        </div>

        {/* Montant à payer — encart mis en avant */}
        <div className="flex items-center justify-between gap-3 bg-gradient-to-br from-trappes-800 to-trappes-600 px-5 py-4 text-white">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-trappes-100/90">Montant à payer (brut)</p>
            <p className="text-[11px] italic text-trappes-200/80">jours indemnisables × indemnité par jour</p>
          </div>
          <p className="shrink-0 text-2xl font-extrabold tabular-nums">{fmtEuro(results.montantIndemnisation)}</p>
        </div>

        {/* Composition de la rémunération de référence */}
        <div className="no-print space-y-3 px-5 py-4">
          <p className="text-xs font-semibold text-secondary-foreground">
            Composition de la rémunération brute de référence (arrêté du 21/06/2025) :
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-success/30 bg-success/10 p-3">
              <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-success">
                <CheckCircle2 className="h-3.5 w-3.5" /> Inclus
              </p>
              <ul className="space-y-1 text-xs leading-snug text-foreground/80">
                {INCLUS.map((x) => (
                  <li key={x}>· {x}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3">
              <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-destructive">
                <XCircle className="h-3.5 w-3.5" /> Exclus
              </p>
              <ul className="space-y-1 text-xs leading-snug text-foreground/80">
                {EXCLUS.map((x) => (
                  <li key={x}>· {x}</li>
                ))}
              </ul>
            </div>
          </div>
          <p className="flex items-start gap-1.5 text-xs italic leading-relaxed text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Indemnité due uniquement en fin de relation de travail, pour les congés non pris (4 premières
            semaines). À confirmer avec votre centre de gestion.
          </p>
        </div>
      </SectionCard>
    </div>
  );
}
