/**
 * Contrôle Tiers (rapprochement de paie) — Ville (001) & CCAS (004).
 *
 * Reproduit la « phase 2 » du projet d'automatisation : la couche d'AFFICHAGE
 * (Synthèse + Détail) des 9 contrôles. Les valeurs proviennent soit d'un import
 * CSV (sortie de l'outil compagnon), soit de la saisie ; le navigateur ne lit
 * pas les PDF/CIRIL — c'est le rôle de l'outil compagnon.
 *
 * Référence des montants d'exemple : juin 2026 (procédure DRH Ville de Trappes).
 */

export type EntiteKey = 'VILLE' | 'CCAS';

/** Jeu de valeurs d'une entité pour un mois. Champs absents = undefined. */
export interface EntiteData {
  totalGeneral?: number; // 1 — génération budgétaire (total général)
  traitements?: number; // lot PAIE (Trésorerie)
  charges?: number; // lot CHAR (total des charges)
  urssaf?: number; // URSSAF + CSG (génération budgétaire / état des charges)
  urssafEtatCharges?: number; // 3 — total PDF « État des charges URSSAF »
  dsn2223?: number; // 4 — DSN bloc 22/23 (cotisations dues)
  bloc22?: number;
  bloc23?: number;
  bloc81Urssaf?: number; // 6 — DSN bloc 81 par organisme (OPS)
  bloc81Cnracl?: number;
  bloc81Ircantec?: number;
  bloc81Rafp?: number;
  bloc81Sre?: number;
  paiesNumeraires?: number; // 5 — total général des paies (virement)
  pasPreleve?: number; // 8 — décompte PAS : prélèvement effectué (avec cts)
  pasMiseEnPaiement?: number; // 8 — somme mise en paiement (sans cts) = budgétaire
  pasRegul?: number; // 8 — régularisation d'arrondi
  pasBloc50?: number; // 7 — DSN bloc 50 « 009 - Montant PAS »
  pasJournal?: number; // 9 — journal RUB 1691/1694/1697
}

export type Statut = 'ok' | 'ko' | 'na';

export interface Reconciliation {
  id: string;
  label: string;
  detail: string;
  valeurs: { label: string; value?: number }[];
  ecart?: number;
  statut: Statut;
}

export interface ControleLigne {
  n: number;
  label: string;
  source: string;
  value?: number;
  statut: Statut;
}

export interface EntiteResultat {
  entite: EntiteKey;
  reconciliations: Reconciliation[];
  controles: ControleLigne[];
  bloc81Total?: number;
  pasEcartArrondi?: number; // |prélèvement − mise en paiement|
  titreArrondi: boolean; // un titre d'arrondi PAS doit-il être émis ?
  statut: Statut; // statut global de l'entité
  renseigne: boolean; // au moins une valeur saisie
}

export const TOLERANCE = 0.01; // € — tolérance d'égalité (hors arrondi PAS)
export const SEUIL_ECART_DSN = 1; // € — écart DSN 22/23 toléré (procédure)

function maxEcart(values: number[]): number {
  return Math.max(...values) - Math.min(...values);
}

/** Calcule les rapprochements + le statut d'une entité. */
export function computeEntite(entite: EntiteKey, d: EntiteData): EntiteResultat {
  const recos: Reconciliation[] = [];

  // R1 — URSSAF cohérent sur toutes les sources (cœur du contrôle tiers).
  {
    const vals = [d.urssaf, d.urssafEtatCharges, d.dsn2223, d.bloc81Urssaf];
    const present = vals.filter((v): v is number => typeof v === 'number');
    const ecart = present.length >= 2 ? maxEcart(present) : undefined;
    recos.push({
      id: 'urssaf',
      label: 'URSSAF concordant',
      detail: 'budgétaire = état des charges = DSN 22/23 = bloc 81',
      valeurs: [
        { label: 'Budgétaire', value: d.urssaf },
        { label: 'État charges', value: d.urssafEtatCharges },
        { label: 'DSN 22/23', value: d.dsn2223 },
        { label: 'Bloc 81', value: d.bloc81Urssaf },
      ],
      ecart,
      statut: ecart === undefined ? 'na' : ecart <= TOLERANCE ? 'ok' : 'ko',
    });
  }

  // R2 — DSN bloc 22 = bloc 23.
  {
    const { bloc22, bloc23 } = d;
    const ecart = bloc22 !== undefined && bloc23 !== undefined ? Math.abs(bloc22 - bloc23) : undefined;
    recos.push({
      id: 'dsn',
      label: 'DSN bloc 22 = bloc 23',
      detail: 'cotisations déclarées = dues',
      valeurs: [
        { label: 'Bloc 22', value: d.bloc22 },
        { label: 'Bloc 23', value: d.bloc23 },
      ],
      ecart,
      statut: ecart === undefined ? 'na' : ecart <= SEUIL_ECART_DSN ? 'ok' : 'ko',
    });
  }

  // R3 — Paies numéraires = traitements (budgétaire).
  {
    const { paiesNumeraires, traitements } = d;
    const ecart =
      paiesNumeraires !== undefined && traitements !== undefined ? Math.abs(paiesNumeraires - traitements) : undefined;
    recos.push({
      id: 'paies',
      label: 'Paies numéraires = traitements',
      detail: 'tout payé par virement',
      valeurs: [
        { label: 'Paies (virement)', value: d.paiesNumeraires },
        { label: 'Traitements', value: d.traitements },
      ],
      ecart,
      statut: ecart === undefined ? 'na' : ecart <= TOLERANCE ? 'ok' : 'ko',
    });
  }

  // R4 — Total général = traitements + charges.
  {
    const { totalGeneral, traitements, charges } = d;
    const somme = traitements !== undefined && charges !== undefined ? traitements + charges : undefined;
    const ecart = totalGeneral !== undefined && somme !== undefined ? Math.abs(totalGeneral - somme) : undefined;
    recos.push({
      id: 'total',
      label: 'Total général = traitements + charges',
      detail: 'équilibre du fichier généré',
      valeurs: [
        { label: 'Total général', value: d.totalGeneral },
        { label: 'Traitements + charges', value: somme },
      ],
      ecart,
      statut: ecart === undefined ? 'na' : ecart <= TOLERANCE ? 'ok' : 'ko',
    });
  }

  // R5 — Bouclage PAS : prélèvement = bloc 50 = journal ; mise en paiement = arrondi.
  {
    const chain = [d.pasPreleve, d.pasBloc50, d.pasJournal].filter((v): v is number => typeof v === 'number');
    const ecart = chain.length >= 2 ? maxEcart(chain) : undefined;
    recos.push({
      id: 'pas',
      label: 'Bouclage PAS',
      detail: 'décompte = bloc 50 = journal',
      valeurs: [
        { label: 'Prélèvement', value: d.pasPreleve },
        { label: 'Bloc 50', value: d.pasBloc50 },
        { label: 'Journal', value: d.pasJournal },
      ],
      ecart,
      statut: ecart === undefined ? 'na' : ecart <= TOLERANCE ? 'ok' : 'ko',
    });
  }

  const { bloc81Urssaf, bloc81Cnracl, bloc81Ircantec, bloc81Rafp, bloc81Sre } = d;
  const bloc81Total =
    bloc81Urssaf !== undefined &&
    bloc81Cnracl !== undefined &&
    bloc81Ircantec !== undefined &&
    bloc81Rafp !== undefined &&
    bloc81Sre !== undefined
      ? bloc81Urssaf + bloc81Cnracl + bloc81Ircantec + bloc81Rafp + bloc81Sre
      : undefined;

  // Titre d'arrondi PAS : écart de centimes entre prélèvement et mise en paiement.
  const { pasPreleve, pasMiseEnPaiement } = d;
  const pasEcartArrondi =
    pasPreleve !== undefined && pasMiseEnPaiement !== undefined ? Math.abs(pasPreleve - pasMiseEnPaiement) : undefined;
  const titreArrondi = pasEcartArrondi !== undefined && pasEcartArrondi > TOLERANCE;

  // Détail des 9 contrôles (valeur principale + statut hérité des rapprochements).
  const recoStatut = (id: string) => recos.find((r) => r.id === id)?.statut ?? 'na';
  const valStatut = (v?: number): Statut => (v === undefined ? 'na' : 'ok');
  const controles: ControleLigne[] = [
    { n: 1, label: 'Génération budgétaire', source: 'PDF', value: d.totalGeneral, statut: recoStatut('total') },
    { n: 2, label: 'État des charges', source: 'PDF', value: d.charges, statut: valStatut(d.charges) },
    { n: 3, label: 'URSSAF', source: 'PDF', value: d.urssaf ?? d.urssafEtatCharges, statut: recoStatut('urssaf') },
    { n: 4, label: 'DSN bloc 22/23', source: 'Tableur', value: d.dsn2223, statut: recoStatut('dsn') },
    { n: 5, label: 'Paies numéraires', source: 'PDF', value: d.paiesNumeraires, statut: recoStatut('paies') },
    { n: 6, label: 'DSN bloc 81', source: 'xlsm', value: bloc81Total, statut: valStatut(bloc81Total) },
    { n: 7, label: 'DSN bloc 50 (PAS)', source: 'SLK', value: d.pasBloc50, statut: recoStatut('pas') },
    { n: 8, label: 'Décompte PAS', source: 'PDF', value: d.pasPreleve, statut: recoStatut('pas') },
    { n: 9, label: 'Journal PAS', source: 'Tableur', value: d.pasJournal, statut: recoStatut('pas') },
  ];

  const renseigne = Object.values(d).some((v) => typeof v === 'number');
  const statuts = recos.map((r) => r.statut);
  const statut: Statut = !renseigne
    ? 'na'
    : statuts.includes('ko')
      ? 'ko'
      : statuts.includes('na')
        ? 'na'
        : 'ok';

  return { entite, reconciliations: recos, controles, bloc81Total, pasEcartArrondi, titreArrondi, statut, renseigne };
}

/* ----------------------------- Exemple juin 2026 ----------------------------- */

export const DEMO_JUIN: Record<EntiteKey, EntiteData> = {
  VILLE: {
    totalGeneral: 3406242.95,
    traitements: 1906259.23,
    charges: 1499983.72,
    urssaf: 925561.32,
    urssafEtatCharges: 925561.32,
    dsn2223: 925561.32,
    bloc22: 925561.32,
    bloc23: 925561.32,
    bloc81Urssaf: 925561.32,
    bloc81Cnracl: 380018.77,
    bloc81Ircantec: 90001.6,
    bloc81Rafp: 15894.94,
    bloc81Sre: 4384.47,
    paiesNumeraires: 1906259.23,
    pasPreleve: 56260.29,
    pasMiseEnPaiement: 56260.0,
    pasRegul: -0.29,
    pasBloc50: 56260.29,
    pasJournal: 56260.29,
  },
  CCAS: {
    totalGeneral: 31218.03,
    urssaf: 8015.37,
    urssafEtatCharges: 8015.37,
    dsn2223: 8015.37,
    bloc22: 8015.37,
    bloc23: 8015.37,
    pasPreleve: 767.08,
    pasMiseEnPaiement: 767.08,
    pasRegul: 0,
    pasBloc50: 767.08,
    pasJournal: 767.08,
  },
};

/* ------------------------------- Import CSV --------------------------------- */

/** Clés reconnues (normalisées) → champ de EntiteData. */
const CLE_MAP: Record<string, keyof EntiteData> = {
  totalgeneral: 'totalGeneral',
  total: 'totalGeneral',
  generationbudgetaire: 'totalGeneral',
  traitements: 'traitements',
  paie: 'traitements',
  charges: 'charges',
  totalcharges: 'charges',
  urssaf: 'urssaf',
  urssafetatcharges: 'urssafEtatCharges',
  dsn2223: 'dsn2223',
  bloc2223: 'dsn2223',
  bloc22: 'bloc22',
  bloc23: 'bloc23',
  bloc81urssaf: 'bloc81Urssaf',
  bloc81cnracl: 'bloc81Cnracl',
  cnracl: 'bloc81Cnracl',
  bloc81ircantec: 'bloc81Ircantec',
  ircantec: 'bloc81Ircantec',
  bloc81rafp: 'bloc81Rafp',
  rafp: 'bloc81Rafp',
  bloc81sre: 'bloc81Sre',
  sre: 'bloc81Sre',
  paiesnumeraires: 'paiesNumeraires',
  paspreleve: 'pasPreleve',
  prelevement: 'pasPreleve',
  pasmiseenpaiement: 'pasMiseEnPaiement',
  miseenpaiement: 'pasMiseEnPaiement',
  pasregul: 'pasRegul',
  regularisation: 'pasRegul',
  pasbloc50: 'pasBloc50',
  bloc50: 'pasBloc50',
  pasjournal: 'pasJournal',
  journal: 'pasJournal',
};

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');

/** Convertit « 925 561,32 », « 925561.32 », « -0,29 » → nombre. */
export function parseMontant(raw: string): number | undefined {
  if (!raw) return undefined;
  let s = raw.trim().replace(/[\u20AC\s\u00A0\u202F]/g, '');
  if (!s) return undefined;
  // format français : virgule décimale, point/espace millier
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

const detectEntite = (s: string): EntiteKey | undefined => {
  const n = normalize(s);
  if (n.includes('ccas') || n === '004' || n.includes('004')) return 'CCAS';
  if (n.includes('ville') || n === '001' || n.includes('001')) return 'VILLE';
  return undefined;
};

export interface ParseResult {
  data: Partial<Record<EntiteKey, EntiteData>>;
  lignesReconnues: number;
  lignesIgnorees: number;
  erreur?: string;
}

/**
 * Import tolérant d'un CSV « long » : colonnes entité / clé / valeur (séparateur
 * `,` ou `;`, en-tête détecté par mots-clés). Toute clé/valeur non reconnue est
 * ignorée. Pensé pour la sortie de l'outil compagnon ; format à ajuster sur ton
 * exemple réel si besoin.
 */
export function parseCsv(text: string): ParseResult {
  const data: Partial<Record<EntiteKey, EntiteData>> = {};
  let reconnues = 0;
  let ignorees = 0;

  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { data, lignesReconnues: 0, lignesIgnorees: 0, erreur: 'Fichier vide.' };

  const delim = (lines[0].match(/;/g)?.length ?? 0) >= (lines[0].match(/,/g)?.length ?? 0) ? ';' : ',';
  const split = (l: string) => l.split(delim).map((c) => c.trim().replace(/^"|"$/g, ''));

  // Détection des colonnes via l'en-tête.
  const header = split(lines[0]).map(normalize);
  const findCol = (...keys: string[]) => header.findIndex((h) => keys.some((k) => h.includes(k)));
  let colEntite = findCol('entite', 'etablissement', 'entity');
  let colCle = findCol('cle', 'controle', 'libelle', 'key', 'rubrique', 'champ');
  let colVal = findCol('valeur', 'montant', 'value', 'total');
  let start = 1;
  // Sans en-tête identifiable : on suppose entité,clé,valeur.
  if (colCle < 0 || colVal < 0) {
    colEntite = 0;
    colCle = 1;
    colVal = 2;
    start = 0;
  }

  for (let i = start; i < lines.length; i++) {
    const cells = split(lines[i]);
    const ent = detectEntite(cells[colEntite] ?? '');
    const champ = CLE_MAP[normalize(cells[colCle] ?? '')];
    const val = parseMontant(cells[colVal] ?? '');
    if (!ent || !champ || val === undefined) {
      ignorees++;
      continue;
    }
    (data[ent] ??= {})[champ] = val;
    reconnues++;
  }

  return { data, lignesReconnues: reconnues, lignesIgnorees: ignorees };
}

/** Modèle CSV (clé,valeur par entité) à partir de données — pour aligner le compagnon. */
export function toCsvModele(d: Record<EntiteKey, EntiteData>): string {
  const lignes: string[] = ['entite;cle;valeur'];
  (Object.keys(d) as EntiteKey[]).forEach((ent) => {
    Object.entries(d[ent]).forEach(([cle, value]) => {
      if (typeof value === 'number') lignes.push(`${ent};${cle};${value.toFixed(2).replace('.', ',')}`);
    });
  });
  return lignes.join('\n');
}
