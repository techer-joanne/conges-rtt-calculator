import { HelpCircle, RotateCcw, User, Clock, Percent, CalendarDays, HeartPulse } from 'lucide-react';
import type { Inputs, Results, SocleKey } from '../lib/calc';
import { SOCLES, QUOTITES } from '../lib/calc';

function Tip({ text }: { text: string }) {
  return (
    <span className="tip" tabIndex={0} aria-label={text}>
      <HelpCircle className="h-3.5 w-3.5 text-trappes-400 hover:text-trappes-600" />
      <span className="tip-body" role="tooltip">
        {text}
      </span>
    </span>
  );
}

export default function InputForm({
  inputs,
  onChange,
  onReset,
  results,
}: {
  inputs: Inputs;
  onChange: (patch: Partial<Inputs>) => void;
  onReset: () => void;
  results: Results;
}) {
  return (
    <section className="rounded-2xl border border-trappes-100 bg-white p-5 shadow-card sm:p-6">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-base font-bold uppercase tracking-wide text-trappes-800">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-trappes-600 text-white">
            <User className="h-4 w-4" />
          </span>
          Saisie
        </h2>
        <button
          onClick={onReset}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-trappes-500 transition hover:bg-trappes-50 hover:text-trappes-700"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Réinitialiser
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Nom */}
        <div className="sm:col-span-2">
          <label className="field-label" htmlFor="nom">
            <User className="h-3.5 w-3.5 text-trappes-500" /> Nom de l'agent
          </label>
          <input
            id="nom"
            type="text"
            value={inputs.nom}
            placeholder="Ex. : Dupont Marie"
            onChange={(e) => onChange({ nom: e.target.value })}
            className="field-input"
          />
        </div>

        {/* Socle horaire */}
        <div>
          <label className="field-label" htmlFor="socle">
            <Clock className="h-3.5 w-3.5 text-trappes-500" /> Socle horaire
            <Tip text="Temps de travail hebdomadaire de référence. Au-delà de 35 h, l'écart génère des jours RTT (voir l'onglet Barème). 35 h et Annualisation n'ouvrent pas de RTT." />
          </label>
          <select
            id="socle"
            value={inputs.socle}
            onChange={(e) => onChange({ socle: e.target.value as SocleKey })}
            className="field-input cursor-pointer"
          >
            {SOCLES.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        {/* Quotité */}
        <div>
          <label className="field-label" htmlFor="quotite">
            <Percent className="h-3.5 w-3.5 text-trappes-500" /> Quotité de travail
            <Tip text="Part du temps plein effectivement travaillée (temps partiel). Le barème RTT dépend du couple socle × quotité (feuille Barèmes)." />
          </label>
          <select
            id="quotite"
            value={inputs.quotite}
            onChange={(e) => onChange({ quotite: Number(e.target.value) })}
            className="field-input cursor-pointer"
          >
            {QUOTITES.map((q) => (
              <option key={q} value={q}>
                {q} %
              </option>
            ))}
          </select>
        </div>

        {/* Dates */}
        <div>
          <label className="field-label" htmlFor="debut">
            <CalendarDays className="h-3.5 w-3.5 text-trappes-500" /> Date de début
          </label>
          <input
            id="debut"
            type="date"
            value={inputs.dateDebut}
            onChange={(e) => onChange({ dateDebut: e.target.value })}
            className="field-input cursor-pointer"
          />
        </div>

        <div>
          <label className="field-label" htmlFor="fin">
            <CalendarDays className="h-3.5 w-3.5 text-trappes-500" /> Date de fin / de départ
          </label>
          <input
            id="fin"
            type="date"
            value={inputs.dateFin}
            onChange={(e) => onChange({ dateFin: e.target.value })}
            className="field-input cursor-pointer"
          />
        </div>

        {/* Maladie */}
        <div className="sm:col-span-2">
          <label className="field-label" htmlFor="maladie">
            <HeartPulse className="h-3.5 w-3.5 text-trappes-500" /> Absence maladie (jours ouvrés)
            <Tip text="Jours ouvrés d'arrêt maladie sur la période. Les RTT sont réduites au prorata des jours ouvrés d'absence maladie (la maternité, la paternité et l'adoption ne réduisent pas les RTT)." />
          </label>
          <input
            id="maladie"
            type="number"
            min={0}
            value={inputs.joursMaladie}
            onChange={(e) => onChange({ joursMaladie: Number(e.target.value) })}
            className="field-input"
          />
        </div>
      </div>

      {/* Bandeau de validation */}
      <div
        className={`mt-5 flex items-start gap-2 rounded-xl border px-4 py-3 text-sm font-medium ${
          results.valid
            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
            : 'border-amber-200 bg-amber-50 text-amber-800'
        }`}
      >
        {results.valid ? (
          <>
            <span aria-hidden>✓</span>
            <span>Saisie valide — résultats calculés ci-contre.</span>
          </>
        ) : (
          <div>
            <p className="font-semibold">Saisie à corriger :</p>
            <ul className="mt-1 list-inside list-disc">
              {results.errors.map((err) => (
                <li key={err}>{err}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
