/**
 * Moteur de calcul des congés annuels (CA) et RTT.
 *
 * Reproduit FIDÈLEMENT le classeur Excel de la DRH (Ville de Trappes) :
 * feuilles « Calculateur » + « Barèmes ». Vérifiable avec l'exemple du classeur
 * (38 h, 100 %, année pleine 01/01 → 31/12, 0 maladie) :
 *   CA = 25 · RTT = 18 · TOTAL (congés + RTT) = 43
 * et, pour le départ (2 400 € brut) : indemnité 115,20 €/j · montant 2 304 €.
 *
 * Règles (cf. feuille « Notice » du classeur) :
 *  - CA              = ROUND(25 × quotité × prorata) — entier le plus proche (0,5 → sup.)
 *  - RTT proratisés  = ROUND(barème(socle, quotité) × prorata) — table « Barèmes »
 *  - RTT réelles     = ROUND(RTT × (jours ouvrés − maladie) ÷ jours ouvrés)
 *  - Prorata         = jours calendaires ÷ 365
 *  - Total           = CA + RTT réelles  (la journée de solidarité, 1 j, est à
 *                      effectuer mais N'EST PAS déduite — info)
 *
 * Départ de l'agent :
 *  - Solde de congés payés = CA acquis − congés déjà pris
 *  - Indemnisation (décret n° 2025-564), fin de relation de travail :
 *      jours indemnisables = min(max(0, solde), 20 × quotité)   (plafond 4 sem.)
 *      indemnité/jour      = (rémunération mensuelle brute × 12) ÷ 250
 *      montant brut        = jours indemnisables × indemnité/jour
 */

export const CA_BASE_ANNUEL = 25; // congés annuels base 100 % (Barèmes!B14)
export const JOURNEE_SOLIDARITE = 1; // jour à effectuer, non déduit (Barèmes!B15)
export const DIVISEUR_PRORATA = 365; // jours / an (Barèmes!B16)
export const PLAFOND_INDEMNISATION_JOURS = 20; // 4 semaines × 5 j (× quotité) — décret 2025-564
export const DIVISEUR_INDEMNITE = 250; // (rém. mensuelle brute × 12) ÷ 250 = indemnité/jour

// ---- Annualisation du temps de travail (cahier des charges DRH / méthode CDG) ----
export const DUREE_LEGALE_ANNUELLE = 1607; // heures/an pour un temps plein (journée de solidarité incluse)
export const HEURES_HEBDO_TEMPS_PLEIN = 35; // base hebdomadaire d'un temps plein
export const JOURS_OUVRES_SEMAINE = 5; // jours travaillés / semaine (conversion heures ↔ jours)

export type SocleKey = '35' | '37' | '37.5' | '38' | '39' | 'annu';

/** Socles disponibles (colonnes de la feuille « Barèmes »). */
export const SOCLES: { key: SocleKey; label: string }[] = [
  { key: '35', label: '35 h' },
  { key: '37', label: '37 h' },
  { key: '37.5', label: '37 h 30' },
  { key: '38', label: '38 h' },
  { key: '39', label: '39 h' },
  { key: 'annu', label: 'Annualisation' },
];

/** Quotités disponibles (lignes de la feuille « Barèmes »), en %. */
export const QUOTITES = [100, 90, 80, 70, 60, 50];

/**
 * Table RTT / ARTT par socle (colonne) et quotité (ligne) — recopie EXACTE de la
 * feuille « Barèmes » du classeur. Les socles 35 h et Annualisation n'ouvrent pas
 * de RTT.
 */
const RTT_TABLE: Record<SocleKey, Record<number, number>> = {
  '35': { 100: 0, 90: 0, 80: 0, 70: 0, 60: 0, 50: 0 },
  '37': { 100: 12, 90: 11, 80: 9.5, 70: 8.5, 60: 7, 50: 6 },
  '37.5': { 100: 15, 90: 13.5, 80: 12, 70: 10.5, 60: 9, 50: 7.5 },
  '38': { 100: 18, 90: 16, 80: 14.5, 70: 12.5, 60: 11, 50: 9 },
  '39': { 100: 23, 90: 20, 80: 18.5, 70: 16, 60: 14, 50: 11.5 },
  annu: { 100: 0, 90: 0, 80: 0, 70: 0, 60: 0, 50: 0 },
};

/** Barème RTT pour un couple (socle, quotité). 0 si non répertorié (IFERROR Excel). */
export function rttBareme(socle: SocleKey, quotite: number): number {
  return RTT_TABLE[socle]?.[quotite] ?? 0;
}

export function socleLabel(key: SocleKey): string {
  return SOCLES.find((s) => s.key === key)?.label ?? String(key);
}

export interface Inputs {
  nom: string;
  socle: SocleKey;
  quotite: number; // quotité en % (100, 90, 80, 70, 60, 50)
  dateDebut: string; // ISO yyyy-mm-dd
  dateFin: string; // ISO yyyy-mm-dd (date de fin / de départ)
  joursMaladie: number; // jours ouvrés d'absence maladie
  congesDejaPris: number; // CA déjà posés (solde au départ)
  remunerationBrute: number; // rémunération mensuelle brute de référence (€)
}

export interface Results {
  joursCalendaires: number;
  joursOuvres: number;
  prorata: number; // 0–1
  congesAnnuels: number;
  rttBareme: number; // valeur de la table (socle × quotité), avant prorata
  rttProratises: number;
  rttReelles: number;
  journeeSolidarite: number; // 1 = jour à effectuer (info, NON déduit du total)
  total: number; // congés annuels + RTT réelles
  // Volet « Départ de l'agent »
  caAcquis: number; // CA acquis (proratisé) à la date de départ
  congesDejaPris: number; // rappel de la saisie
  soldeConges: number; // CA acquis − congés déjà pris
  joursIndemnisables: number; // min(max(0, solde), 20 × quotité)
  indemniteParJour: number; // (rém. brute × 12) ÷ 250 — 0 si rém. = 0
  montantIndemnisation: number; // jours indemnisables × indemnité/jour (brut)
  valid: boolean;
  errors: string[];
}

/** Arrondi « Excel » ROUND(x, 0) : entier le plus proche, 0,5 arrondi au supérieur. */
export function roundExcel(x: number): number {
  if (!Number.isFinite(x)) return 0;
  const s = x < 0 ? -1 : 1;
  return s * Math.round(Math.abs(x) + 1e-9);
}

/** Différence de dates inclusive, en jours calendaires (bornes comprises). */
export function joursCalendaires(debut: string, fin: string): number {
  const d = parseDate(debut);
  const f = parseDate(fin);
  if (!d || !f) return 0;
  const ms = f.getTime() - d.getTime();
  if (ms < 0) return 0;
  return Math.round(ms / 86_400_000) + 1;
}

/** Nombre de jours ouvrés (lundi → vendredi) entre deux dates, bornes comprises (= NETWORKDAYS). */
export function joursOuvres(debut: string, fin: string): number {
  const d = parseDate(debut);
  const f = parseDate(fin);
  if (!d || !f || f.getTime() < d.getTime()) return 0;
  let count = 0;
  const cur = new Date(d.getTime());
  while (cur.getTime() <= f.getTime()) {
    const day = cur.getDay(); // 0 = dimanche, 6 = samedi
    if (day !== 0 && day !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

function parseDate(iso: string): Date | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const da = Number(m[3]);
  const d = new Date(y, mo, da);
  if (d.getFullYear() !== y || d.getMonth() !== mo || d.getDate() !== da) return null;
  return d;
}

function validate(input: Inputs): string[] {
  const errors: string[] = [];
  const d = parseDate(input.dateDebut);
  const f = parseDate(input.dateFin);
  if (!d) errors.push('Date de début invalide.');
  if (!f) errors.push('Date de fin invalide.');
  if (d && f && f.getTime() < d.getTime()) {
    errors.push('La date de fin doit être postérieure (ou égale) à la date de début.');
  }
  if (!QUOTITES.includes(input.quotite)) {
    errors.push('Quotité de travail non reconnue.');
  }
  if (input.joursMaladie < 0) errors.push("Les jours d'absence maladie ne peuvent pas être négatifs.");
  if (input.congesDejaPris < 0) errors.push('Les congés déjà pris ne peuvent pas être négatifs.');
  if (input.remunerationBrute < 0) errors.push('La rémunération brute ne peut pas être négative.');
  return errors;
}

/** Calcul complet. Renvoie toujours un objet (valeurs à 0 si saisie invalide). */
export function computeResults(input: Inputs): Results {
  const errors = validate(input);
  const valid = errors.length === 0;

  const nbCal = joursCalendaires(input.dateDebut, input.dateFin);
  const nbOuvres = joursOuvres(input.dateDebut, input.dateFin);
  const prorata = nbCal > 0 ? nbCal / DIVISEUR_PRORATA : 0;
  const q = Math.max(0, (input.quotite || 0) / 100);

  const baremeRttVal = rttBareme(input.socle, input.quotite);

  const congesAnnuels = valid ? roundExcel(CA_BASE_ANNUEL * q * prorata) : 0;
  const rttProratises = valid ? roundExcel(baremeRttVal * prorata) : 0;

  // RTT réelles : réduction AU PRORATA des jours ouvrés d'absence maladie.
  const maladie = Math.max(0, input.joursMaladie || 0);
  const rttReelles = valid
    ? nbOuvres > 0
      ? roundExcel((rttProratises * Math.max(0, nbOuvres - maladie)) / nbOuvres)
      : 0
    : 0;

  // Journée de solidarité : 1 jour à EFFECTUER, non déduit (info).
  const journeeSolidarite = valid ? JOURNEE_SOLIDARITE : 0;
  const total = valid ? congesAnnuels + rttReelles : 0;

  // ---- Volet « Départ de l'agent » ----
  const caAcquis = congesAnnuels; // CA proratisé à la date de départ (= date de fin)
  const dejaPris = Math.max(0, input.congesDejaPris || 0);
  const soldeConges = valid ? caAcquis - dejaPris : 0;
  const plafondJours = PLAFOND_INDEMNISATION_JOURS * q; // 20 × quotité (4 semaines)
  const joursIndemnisables = valid ? Math.min(Math.max(0, soldeConges), plafondJours) : 0;
  const rem = Math.max(0, input.remunerationBrute || 0);
  const indemniteParJour = valid && rem > 0 ? (rem * 12) / DIVISEUR_INDEMNITE : 0;
  const montantIndemnisation = valid && rem > 0 ? joursIndemnisables * indemniteParJour : 0;

  return {
    joursCalendaires: nbCal,
    joursOuvres: nbOuvres,
    prorata,
    congesAnnuels,
    rttBareme: baremeRttVal,
    rttProratises,
    rttReelles,
    journeeSolidarite,
    total,
    caAcquis,
    congesDejaPris: dejaPris,
    soldeConges,
    joursIndemnisables,
    indemniteParJour,
    montantIndemnisation,
    valid,
    errors,
  };
}

/* --------------------------- Annualisation --------------------------- */
/**
 * Calcul de l'annualisation du temps de travail (cahier des charges DRH,
 * méthode des centres de gestion — ex. CDG27).
 *
 *  - X (heures annuelles travaillées) = heures hebdo × nb de semaines travaillées
 *  - Équivalent hebdomadaire annualisé = (X × 35) ÷ 1607
 *  - Quotité de paie                   = équivalent ÷ 35 = X ÷ 1607
 *  - Congés annuels                    = ROUND(25 × quotité × prorata) — jours ouvrés
 *  - Volume de référence (temps plein) = 1607 × prorata
 *  - Contrôle de cohérence             = heures réelles − volume de référence
 *
 * Les agents annualisés n'ont pas de RTT (le temps non travaillé prend la forme
 * de jours non travaillés planifiés). Vérifiable avec l'exemple ATSEM CDG27 :
 *   20 h × 36 semaines = 720 h → équivalent 15,68 h/sem · quotité 44,8 % · CA 11 j.
 */
export interface AnnualisationInputs {
  nom: string;
  heuresHebdo: number; // heures travaillées par semaine en période travaillée
  nbSemaines: number; // nombre de semaines travaillées sur l'année
  dateDebut: string; // période (facultative) si année incomplète — ISO yyyy-mm-dd
  dateFin: string;
  joursFeries: number; // jours fériés tombant un jour travaillé (option)
  joursMaladie: number; // jours d'absence maladie (option)
}

export interface AnnualisationResults {
  heuresAnnuelles: number; // X = heures hebdo × nb semaines (planifié)
  heuresParJour: number; // heures hebdo ÷ 5
  heuresDeduites: number; // (fériés + maladie) × heures/jour
  heuresReelles: number; // X − déductions (≥ 0)
  equivalentHebdo: number; // (X × 35) ÷ 1607
  quotitePaie: number; // X ÷ 1607 (0–1)
  prorata: number; // jours calendaires ÷ 365 (1 si pas de période saisie)
  volumeReference: number; // 1607 × prorata
  congesAnnuels: number; // ROUND(25 × quotité × prorata)
  ecartCoherence: number; // heures réelles − volume de référence
  valid: boolean;
  errors: string[];
}

function validateAnnualisation(input: AnnualisationInputs): string[] {
  const errors: string[] = [];
  if (input.heuresHebdo < 0) errors.push('Les heures hebdomadaires ne peuvent pas être négatives.');
  if (input.heuresHebdo > 60) errors.push('Heures hebdomadaires irréalistes (supérieures à 60 h).');
  if (input.nbSemaines < 0) errors.push('Le nombre de semaines ne peut pas être négatif.');
  if (input.nbSemaines > 53) errors.push('Le nombre de semaines ne peut pas dépasser 53.');
  if (input.joursFeries < 0) errors.push('Les jours fériés ne peuvent pas être négatifs.');
  if (input.joursMaladie < 0) errors.push("Les jours d'absence maladie ne peuvent pas être négatifs.");
  if (input.dateDebut && input.dateFin) {
    const d = parseDate(input.dateDebut);
    const f = parseDate(input.dateFin);
    if (!d || !f) errors.push('Période : date invalide.');
    else if (f.getTime() < d.getTime()) errors.push('La date de fin doit être postérieure à la date de début.');
  }
  return errors;
}

/** Calcul d'annualisation. Renvoie toujours un objet (valeurs à 0 si saisie invalide). */
export function computeAnnualisation(input: AnnualisationInputs): AnnualisationResults {
  const errors = validateAnnualisation(input);
  const valid = errors.length === 0;

  const heuresHebdo = Math.max(0, input.heuresHebdo || 0);
  const nbSemaines = Math.max(0, input.nbSemaines || 0);
  const feries = Math.max(0, input.joursFeries || 0);
  const maladie = Math.max(0, input.joursMaladie || 0);

  // Période : prorata = jours calendaires ÷ 365 (1 si aucune période saisie).
  const hasDates = Boolean(input.dateDebut && input.dateFin);
  const nbCal = hasDates ? joursCalendaires(input.dateDebut, input.dateFin) : 0;
  const prorata = hasDates && nbCal > 0 ? nbCal / DIVISEUR_PRORATA : 1;

  const heuresAnnuelles = valid ? heuresHebdo * nbSemaines : 0; // X
  const heuresParJour = heuresHebdo / JOURS_OUVRES_SEMAINE;
  const heuresDeduites = valid ? (feries + maladie) * heuresParJour : 0;
  const heuresReelles = Math.max(0, heuresAnnuelles - heuresDeduites);

  const quotitePaie = valid ? heuresAnnuelles / DUREE_LEGALE_ANNUELLE : 0; // X ÷ 1607
  const equivalentHebdo = quotitePaie * HEURES_HEBDO_TEMPS_PLEIN; // (X × 35) ÷ 1607
  const volumeReference = valid ? DUREE_LEGALE_ANNUELLE * prorata : 0;
  const congesAnnuels = valid ? roundExcel(CA_BASE_ANNUEL * quotitePaie * prorata) : 0;
  const ecartCoherence = valid ? heuresReelles - volumeReference : 0;

  return {
    heuresAnnuelles,
    heuresParJour,
    heuresDeduites,
    heuresReelles,
    equivalentHebdo,
    quotitePaie,
    prorata,
    volumeReference,
    congesAnnuels,
    ecartCoherence,
    valid,
    errors,
  };
}

/* ------------------------------ Formatage ------------------------------ */

export function fmtJours(n: number): string {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 1 });
}

export function fmtPct(ratio: number, decimals = 1): string {
  return (
    (ratio * 100).toLocaleString('fr-FR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }) + ' %'
  );
}

export function fmtEuro(n: number, decimals = 2): string {
  return (
    n.toLocaleString('fr-FR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }) + ' €'
  );
}

export function fmtDateFr(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

/** Heures décimales → « 15,68 h ». */
export function fmtHeures(n: number, decimals = 2): string {
  return (
    n.toLocaleString('fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals,
    }) + ' h'
  );
}

/** Heures décimales → « 15 h 41 » (heures et minutes). */
export function fmtHeuresMinutes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0 h';
  const h = Math.floor(n);
  const min = Math.round((n - h) * 60);
  if (min === 60) return `${h + 1} h`;
  return min === 0 ? `${h} h` : `${h} h ${String(min).padStart(2, '0')}`;
}
