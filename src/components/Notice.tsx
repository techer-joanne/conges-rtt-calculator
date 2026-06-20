import { ListOrdered, Calculator, AlertTriangle, DoorOpen } from 'lucide-react';

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-trappes-600 text-sm font-bold text-white">
        {n}
      </span>
      <div>
        <p className="font-semibold text-trappes-800">{title}</p>
        <p className="text-sm leading-relaxed text-trappes-600">{children}</p>
      </div>
    </li>
  );
}

export default function Notice() {
  return (
    <div className="animate-fade-up space-y-6">
      <section className="rounded-2xl border border-trappes-100 bg-white p-6 shadow-card">
        <h2 className="mb-4 flex items-center gap-2 text-base font-bold uppercase tracking-wide text-trappes-800">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-trappes-600 text-white">
            <ListOrdered className="h-4 w-4" />
          </span>
          Mode d'emploi
        </h2>
        <ol className="space-y-4">
          <Step n={1} title="Renseigner l'agent">
            Saisissez le nom de l'agent, son socle horaire et sa quotité de travail (100 % pour un
            temps plein, moins en cas de temps partiel).
          </Step>
          <Step n={2} title="Définir la période">
            Indiquez les dates de début et de fin. Pour une année complète, utilisez le 1er janvier
            et le 31 décembre ; le prorata vaudra alors 100 %.
          </Step>
          <Step n={3} title="Ajouter les éléments d'ajustement">
            Indiquez les éventuels jours d'absence maladie (jours ouvrés). Pour un départ,
            renseignez les congés déjà pris et la rémunération brute dans l'onglet « Départ ».
          </Step>
          <Step n={4} title="Lire le résultat">
            Le total des jours de repos se met à jour automatiquement. Utilisez « Imprimer / PDF »
            ou « Copier le récapitulatif » pour conserver la fiche.
          </Step>
        </ol>
      </section>

      <section className="rounded-2xl border border-trappes-100 bg-white p-6 shadow-card">
        <h2 className="mb-4 flex items-center gap-2 text-base font-bold uppercase tracking-wide text-trappes-800">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-trappes-600 text-white">
            <Calculator className="h-4 w-4" />
          </span>
          Méthode de calcul
        </h2>
        <div className="space-y-3 text-sm leading-relaxed text-trappes-700">
          <p>
            <strong>Prorata</strong> = jours calendaires de la période ÷ 365.
          </p>
          <p>
            <strong>Congés annuels</strong> = 25 × quotité × prorata, arrondi à l'entier le plus
            proche (règle du 0,5 : à partir de 0,5, arrondi au jour supérieur).
          </p>
          <p>
            <strong>RTT proratisés</strong> = barème (socle × quotité) de l'onglet Barème,
            proratisé sur la période et arrondi à l'entier le plus proche.
          </p>
          <p>
            <strong>RTT réelles</strong> : réduites au prorata des jours ouvrés d'absence maladie —
            RTT × (jours ouvrés − maladie) ÷ jours ouvrés. La maternité, la paternité et l'adoption
            ne réduisent pas les RTT.
          </p>
          <p>
            <strong>Journée de solidarité</strong> : 1 jour <em>à effectuer</em>,{' '}
            <strong>non déduit</strong> du total (information).
          </p>
          <p className="rounded-lg bg-trappes-50 px-4 py-3 font-semibold text-trappes-800">
            Total congés + RTT = Congés annuels + RTT réelles. La journée de solidarité (1 j) est à
            effectuer mais n'est pas déduite.
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-trappes-100 bg-white p-6 shadow-card">
        <h2 className="mb-4 flex items-center gap-2 text-base font-bold uppercase tracking-wide text-trappes-800">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-trappes-600 text-white">
            <DoorOpen className="h-4 w-4" />
          </span>
          Départ de l'agent
        </h2>
        <div className="space-y-3 text-sm leading-relaxed text-trappes-700">
          <p>
            L'onglet <strong>Départ de l'agent</strong> calcule, à partir de la même saisie, le{' '}
            <strong>solde de congés payés</strong> et son éventuelle{' '}
            <strong>indemnisation</strong>.
          </p>
          <p>
            <strong>Solde de congés payés</strong> = congés annuels acquis (proratisés) − congés
            déjà pris.
          </p>
          <p>
            <strong>Indemnisation des congés non pris</strong> (décret n° 2025-564) : versée
            uniquement en fin de relation de travail, plafonnée à 4 semaines
            (20 j × quotité). Indemnité par jour = (rémunération mensuelle brute × 12) ÷ 250 ;
            montant brut = jours indemnisables × indemnité par jour.
          </p>
          <p className="rounded-lg bg-trappes-50 px-4 py-3 text-trappes-800">
            <strong>Titulaire</strong> : solde à poser avant le départ (non indemnisable).{' '}
            <strong>Contractuel</strong> : indemnité compensatrice possible. À confirmer avec votre
            centre de gestion.
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
        <p className="flex items-start gap-2 text-sm leading-relaxed text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Cet outil fournit une estimation indicative reproduisant le tableur de la DRH. En cas de
            situation particulière (mi-temps thérapeutique, congés spécifiques, report…), la
            Direction des Ressources Humaines reste l'unique référence.
          </span>
        </p>
      </section>
    </div>
  );
}
