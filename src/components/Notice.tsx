import { ListOrdered, Calculator, AlertTriangle, DoorOpen, CalendarRange, LayoutDashboard } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
        {n}
      </span>
      <div>
        <p className="font-semibold text-secondary-foreground">{title}</p>
        <p className="text-sm leading-relaxed text-muted-foreground">{children}</p>
      </div>
    </li>
  );
}

function SectionTitle({ icon: Icon, children }: { icon: typeof Calculator; children: React.ReactNode }) {
  return (
    <CardTitle className="flex items-center gap-2 text-base font-bold uppercase tracking-wide text-secondary-foreground">
      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
        <Icon className="h-4 w-4" />
      </span>
      {children}
    </CardTitle>
  );
}

export default function Notice() {
  return (
    <div className="animate-fade-up space-y-6">
      <Card>
        <CardHeader>
          <SectionTitle icon={ListOrdered}>Mode d'emploi</SectionTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-4">
            <Step n={1} title="Renseigner l'agent">
              Saisissez le nom de l'agent, son socle horaire et sa quotité de travail (100 % pour un temps plein,
              moins en cas de temps partiel).
            </Step>
            <Step n={2} title="Définir la période">
              Indiquez les dates de début et de fin. Pour une année complète, utilisez le 1er janvier et le 31
              décembre ; le prorata vaudra alors 100 %.
            </Step>
            <Step n={3} title="Ajouter les éléments d'ajustement">
              Indiquez les éventuels jours d'absence maladie (jours ouvrés). Pour un départ, renseignez les congés
              déjà pris et la rémunération brute dans l'onglet « Départ ».
            </Step>
            <Step n={4} title="Lire le résultat">
              Le total des jours de repos se met à jour automatiquement. Le <strong>Tableau de bord</strong>{' '}
              synthétise les indicateurs et graphiques ; « Imprimer / PDF » conserve la fiche.
            </Step>
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <SectionTitle icon={Calculator}>Méthode de calcul</SectionTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm leading-relaxed text-secondary-foreground">
            <p>
              <strong>Prorata</strong> = jours calendaires de la période ÷ 365.
            </p>
            <p>
              <strong>Congés annuels</strong> = 25 × quotité × prorata, arrondi à l'entier le plus proche (règle du
              0,5 : à partir de 0,5, arrondi au jour supérieur).
            </p>
            <p>
              <strong>RTT proratisés</strong> = barème (socle × quotité) de l'onglet Barème, proratisé sur la
              période et arrondi à l'entier le plus proche.
            </p>
            <p>
              <strong>RTT réelles</strong> : réduites au prorata des jours ouvrés d'absence maladie — RTT × (jours
              ouvrés − maladie) ÷ jours ouvrés. La maternité, la paternité et l'adoption ne réduisent pas les RTT.
            </p>
            <p>
              <strong>Journée de solidarité</strong> : 1 jour <em>à effectuer</em>, <strong>non déduit</strong> du
              total (information).
            </p>
            <p className="rounded-lg bg-muted px-4 py-3 font-semibold text-foreground">
              Total congés + RTT = Congés annuels + RTT réelles. La journée de solidarité (1 j) est à effectuer
              mais n'est pas déduite.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <SectionTitle icon={DoorOpen}>Départ de l'agent</SectionTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm leading-relaxed text-secondary-foreground">
            <p>
              L'onglet <strong>Départ de l'agent</strong> calcule, à partir de la même saisie, le{' '}
              <strong>solde de congés payés</strong> et son éventuelle <strong>indemnisation</strong>.
            </p>
            <p>
              <strong>Solde de congés payés</strong> = congés annuels acquis (proratisés) − congés déjà pris.
            </p>
            <p>
              <strong>Indemnisation des congés non pris</strong> (décret n° 2025-564) : versée uniquement en fin de
              relation de travail, plafonnée à 4 semaines (20 j × quotité). Indemnité par jour = (rémunération
              mensuelle brute × 12) ÷ 250 ; montant brut = jours indemnisables × indemnité par jour.
            </p>
            <p className="rounded-lg bg-muted px-4 py-3 text-foreground">
              <strong>Titulaire</strong> : solde à poser avant le départ (non indemnisable).{' '}
              <strong>Contractuel</strong> : indemnité compensatrice possible. À confirmer avec votre centre de
              gestion.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <SectionTitle icon={CalendarRange}>Annualisation</SectionTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm leading-relaxed text-secondary-foreground">
            <p>
              L'onglet <strong>Annualisation</strong> s'adresse aux agents dont le temps de travail est réparti sur
              l'année (planning variable). Méthode des centres de gestion : un temps plein effectue 1607 h/an.
            </p>
            <p>
              <strong>Heures annuelles (X)</strong> = heures hebdo × nombre de semaines travaillées.{' '}
              <strong>Équivalent hebdomadaire annualisé</strong> = (X × 35) ÷ 1607.{' '}
              <strong>Quotité de paie</strong> = X ÷ 1607 (12 bulletins mensuels identiques).
            </p>
            <p>
              <strong>Congés annuels</strong> = 25 × quotité × prorata, en jours ouvrés. Les agents annualisés{' '}
              <strong>n'ont pas de RTT</strong> : le temps non travaillé prend la forme de jours non travaillés
              planifiés.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <SectionTitle icon={LayoutDashboard}>Tableau de bord</SectionTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed text-secondary-foreground">
            Le <strong>Tableau de bord</strong> (page d'accueil) réunit 5 indicateurs clés (congés annuels, RTT
            réelles, total, solde au départ, indemnisation) et 4 graphiques : répartition CA / RTT, impact de la
            maladie, solde au départ et indemnisation. Tout reste imprimable au format PDF.
          </p>
        </CardContent>
      </Card>

      <Alert variant="warning">
        <AlertTriangle />
        <AlertDescription>
          Cet outil fournit une estimation indicative reproduisant le tableur de la DRH. En cas de situation
          particulière (mi-temps thérapeutique, congés spécifiques, report…), la Direction des Ressources Humaines
          reste l'unique référence.
        </AlertDescription>
      </Alert>
    </div>
  );
}
