import { Table2, Info } from 'lucide-react';
import type { SocleKey } from '../lib/calc';
import { SOCLES, QUOTITES, rttBareme, CA_BASE_ANNUEL, fmtJours } from '../lib/calc';

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-trappes-100 bg-white p-5 shadow-card">
      <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-trappes-700">{title}</h3>
      <div className="space-y-1.5 text-sm leading-relaxed text-trappes-600">{children}</div>
    </div>
  );
}

export default function Bareme({
  currentSocle,
  currentQuotite,
}: {
  currentSocle: SocleKey;
  currentQuotite: number;
}) {
  return (
    <div className="animate-fade-up space-y-6">
      <section className="overflow-hidden rounded-2xl border border-trappes-100 bg-white shadow-card">
        <div className="flex items-center gap-2 border-b border-trappes-100 px-5 py-4">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-trappes-600 text-white">
            <Table2 className="h-4 w-4" />
          </span>
          <h2 className="text-base font-bold uppercase tracking-wide text-trappes-800">
            Barème RTT / ARTT — socle × quotité
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-trappes-50 text-xs font-semibold uppercase tracking-wide text-trappes-500">
                <th className="px-4 py-3 text-left">Socle horaire</th>
                {QUOTITES.map((q) => (
                  <th
                    key={q}
                    className={`px-4 py-3 text-right ${
                      q === currentQuotite ? 'bg-trappes-100 text-trappes-800' : ''
                    }`}
                  >
                    {q} %
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-trappes-100">
              {SOCLES.map((s) => {
                const isRow = s.key === currentSocle;
                return (
                  <tr key={s.key} className={isRow ? 'bg-trappes-100/50 font-bold text-trappes-900' : 'text-trappes-700'}>
                    <td className="px-4 py-3 font-semibold">
                      {s.label}
                      {isRow && (
                        <span className="ml-2 rounded-full bg-trappes-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                          actuel
                        </span>
                      )}
                    </td>
                    {QUOTITES.map((q) => {
                      const cell = rttBareme(s.key, q);
                      const isCell = isRow && q === currentQuotite;
                      return (
                        <td
                          key={q}
                          className={`px-4 py-3 text-right tabular-nums ${
                            isCell
                              ? 'bg-trappes-600 font-bold text-white'
                              : q === currentQuotite
                                ? 'bg-trappes-100/70'
                                : ''
                          }`}
                        >
                          {fmtJours(cell)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="flex items-start gap-2 border-t border-trappes-100 bg-trappes-50/50 px-5 py-3 text-xs text-trappes-500">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          RTT / ARTT annuels (base année pleine) selon le socle horaire et la quotité. Les socles
          35 h et « Annualisation » n'ouvrent pas de RTT. Ces valeurs sont ensuite proratisées sur
          la période.
        </p>
      </section>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <InfoCard title="Congés annuels (CA)">
          <p>
            Base de <strong>{CA_BASE_ANNUEL} jours</strong> par an pour un agent à temps plein sur une
            année complète.
          </p>
          <p>
            CA = 25 × quotité × prorata, arrondi à l'<strong>entier le plus proche</strong> (règle du
            0,5 : à partir de 0,5, arrondi au jour supérieur).
          </p>
        </InfoCard>

        <InfoCard title="Prorata de la période">
          <p>
            Pour une prise de fonction ou un départ en cours d'année, les droits sont calculés au
            prorata.
          </p>
          <p>Prorata = nombre de jours calendaires de la période ÷ 365.</p>
        </InfoCard>

        <InfoCard title="RTT réelles (maladie)">
          <p>
            Pendant un congé de maladie, le temps de travail est ramené à 35 h (0 RTT). Les RTT sont
            réduites au prorata des jours ouvrés d'absence maladie.
          </p>
          <p>RTT réelles = RTT × (jours ouvrés − maladie) ÷ jours ouvrés.</p>
        </InfoCard>

        <InfoCard title="Journée de solidarité">
          <p>
            <strong>1 jour</strong> à effectuer, indiqué à titre d'information : il n'est{' '}
            <strong>pas déduit</strong> du total des droits.
          </p>
        </InfoCard>
      </div>
    </div>
  );
}
