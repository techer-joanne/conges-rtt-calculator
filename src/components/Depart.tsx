import { DoorOpen, Wallet, BadgeEuro, CheckCircle2, XCircle, Info } from 'lucide-react';
import type { Inputs, Results } from '../lib/calc';
import { fmtJours, fmtEuro } from '../lib/calc';

/** Ligne « libellé · formule » → « valeur », style aligné sur le panneau Résultats. */
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
          accent ? 'text-trappes-700' : 'text-trappes-900'
        }`}
      >
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
    <section className="print-clean overflow-hidden rounded-2xl border border-trappes-100 bg-white shadow-card">
      <div className="flex items-center gap-2 border-b border-trappes-100 bg-white px-5 py-4">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-trappes-600 text-white">
          <Icon className="h-4 w-4" />
        </span>
        <h2 className="text-base font-bold uppercase tracking-wide text-trappes-800">{title}</h2>
      </div>
      {children}
    </section>
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
      <section className="no-print rounded-2xl border border-trappes-100 bg-white p-5 shadow-card sm:p-6">
        <div className="mb-1 flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-trappes-600 text-white">
            <DoorOpen className="h-4 w-4" />
          </span>
          <h2 className="text-base font-bold uppercase tracking-wide text-trappes-800">
            Données de départ
          </h2>
        </div>
        <p className="mb-5 flex items-start gap-1.5 text-xs italic text-trappes-500">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Calculé à partir de la saisie de l'onglet <strong className="not-italic">Calculateur</strong>{' '}
          (socle, quotité, période). Complétez ci-dessous les deux éléments propres au départ.
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="field-label" htmlFor="dejaPris">
              <Wallet className="h-3.5 w-3.5 text-trappes-500" /> Congés déjà pris (j)
            </label>
            <input
              id="dejaPris"
              type="number"
              min={0}
              step={0.5}
              value={inputs.congesDejaPris}
              onChange={(e) => onChange({ congesDejaPris: Number(e.target.value) })}
              className="field-input"
            />
          </div>
          <div>
            <label className="field-label" htmlFor="remBrute">
              <BadgeEuro className="h-3.5 w-3.5 text-trappes-500" /> Rémunération mensuelle brute (€)
            </label>
            <input
              id="remBrute"
              type="number"
              min={0}
              step={10}
              value={inputs.remunerationBrute}
              onChange={(e) => onChange({ remunerationBrute: Number(e.target.value) })}
              placeholder="Dernière paie mensuelle complète"
              className="field-input"
            />
          </div>
        </div>
      </section>

      {/* Solde de congés au départ */}
      <SectionCard icon={Wallet} title="Solde de congés au départ">
        <div className="divide-y divide-trappes-100">
          <StatRow
            label="Congés annuels acquis"
            formula="CA proratisé à la date de départ"
            value={fmtJours(results.caAcquis)}
          />
          <StatRow
            label="Congés déjà pris"
            formula="rappel de la saisie"
            value={fmtJours(results.congesDejaPris)}
          />
          <StatRow
            label="Solde de congés payés"
            formula="à solder ou indemniser selon le statut"
            value={fmtJours(results.soldeConges)}
            accent
          />
        </div>
        <p className="border-t border-trappes-100 bg-trappes-50/40 px-5 py-3 text-xs leading-relaxed text-trappes-600">
          <strong>Titulaire</strong> : congés non pris à solder avant le départ (non indemnisables).{' '}
          <strong>Contractuel</strong> (fin de contrat / licenciement) : indemnité compensatrice de
          congés payés possible.
        </p>
      </SectionCard>

      {/* Indemnisation des congés non pris */}
      <SectionCard icon={BadgeEuro} title="Indemnisation des congés non pris">
        <p className="border-b border-trappes-100 px-5 py-2.5 text-xs font-semibold uppercase tracking-wide text-trappes-500">
          Décret n° 2025-564
        </p>
        <div className="divide-y divide-trappes-100">
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
            <p className="text-xs font-semibold uppercase tracking-wide text-trappes-100/90">
              Montant à payer (brut)
            </p>
            <p className="text-[11px] italic text-trappes-200/80">
              jours indemnisables × indemnité par jour
            </p>
          </div>
          <p className="shrink-0 text-2xl font-extrabold tabular-nums">
            {fmtEuro(results.montantIndemnisation)}
          </p>
        </div>

        {/* Composition de la rémunération de référence */}
        <div className="space-y-3 px-5 py-4">
          <p className="text-xs font-semibold text-trappes-700">
            Composition de la rémunération brute de référence (arrêté du 21/06/2025) :
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
              <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-emerald-700">
                <CheckCircle2 className="h-3.5 w-3.5" /> Inclus
              </p>
              <ul className="space-y-1 text-xs leading-snug text-emerald-900">
                {INCLUS.map((x) => (
                  <li key={x}>· {x}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
              <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-rose-700">
                <XCircle className="h-3.5 w-3.5" /> Exclus
              </p>
              <ul className="space-y-1 text-xs leading-snug text-rose-900">
                {EXCLUS.map((x) => (
                  <li key={x}>· {x}</li>
                ))}
              </ul>
            </div>
          </div>
          <p className="flex items-start gap-1.5 text-xs italic leading-relaxed text-trappes-500">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Indemnité due uniquement en fin de relation de travail, pour les congés non pris
            (4 premières semaines). À confirmer avec votre centre de gestion.
          </p>
        </div>
      </SectionCard>
    </div>
  );
}
