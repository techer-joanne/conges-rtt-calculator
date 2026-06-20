/**
 * Contrôle Tiers (rapprochement de paie) — Ville (001) & CCAS (004).
 *
 * Couche d'AFFICHAGE de la « phase 2 ». Les valeurs viennent du CSV produit par
 * l'outil compagnon (le navigateur ne lit pas les PDF/CIRIL).
 *
 * Format CSV du compagnon (séparateur virgule, décimale point), 5 colonnes :
 *   ENTITE, CODE_TIERS, LIBELLE, COLONNE, VALEUR
 * où COLONNE ∈ C..I (rapprochement par Code Tiers) :
 *   C = génération budgétaire (1) · D = état des charges (2) · E = décompte PAS (8)
 *   F = journal PAS (9) · G = bloc 81 (6) · H = bloc 50 (7) · I = trésorerie / paies (5)
 * Lignes spéciales : CODE_TIERS = "_TOTAL_CIRIL" (total par colonne) ou
 * "_TITRE_PAS" (montant du titre d'arrondi).
 *
 * Exemple chiffré : juin 2026 (procédure DRH Ville de Trappes).
 */

export type EntiteKey = 'VILLE' | 'CCAS';
export type ColKey = 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I';
export type Statut = 'ok' | 'ko' | 'na';

export const COLONNES: { key: ColKey; n: number; court: string; label: string }[] = [
  { key: 'C', n: 1, court: 'Budgétaire', label: 'Génération budgétaire' },
  { key: 'D', n: 2, court: 'État charges', label: 'État des charges' },
  { key: 'E', n: 8, court: 'Décompte PAS', label: 'Décompte PAS' },
  { key: 'F', n: 9, court: 'Journal PAS', label: 'Journal RUB 1691/1694/1697' },
  { key: 'G', n: 6, court: 'Bloc 81', label: 'DSN bloc 81 (cotisations)' },
  { key: 'H', n: 7, court: 'Bloc 50', label: 'DSN bloc 50 (PAS)' },
  { key: 'I', n: 5, court: 'Trésorerie', label: 'Paies numéraires / Trésorerie' },
];
const COL_KEYS = COLONNES.map((c) => c.key);

/** Codes Tiers connus (mapping de la procédure). */
const CODE = {
  urssaf: '11788',
  cnracl: '11838',
  ircantec: '11837',
  rafp: '10937',
  sre: '10938',
  pasSie: '24574',
  journalPas: '24587',
  tresorerie: '342',
} as const;

export interface TierLigne {
  code: string;
  libelle: string;
  valeurs: Partial<Record<ColKey, number>>;
}

export interface EntiteData {
  tiers: TierLigne[];
  totaux: Partial<Record<ColKey, number>>;
  titrePas?: number;
}

export interface LigneResultat extends TierLigne {
  ecart?: number;
  statut: Statut;
  arrondi: boolean; // écart de centimes PAS attendu (→ titre)
}

export interface Reconciliation {
  id: string;
  label: string;
  detail: string;
  ecart?: number;
  statut: Statut;
}

export interface EntiteResultat {
  entite: EntiteKey;
  lignes: LigneResultat[];
  reconciliations: Reconciliation[];
  totaux: Partial<Record<ColKey, number>>;
  totalCiril?: number; // total fichier généré CIRIL (colonne C)
  totalPaie?: number; // colonne I
  titrePas?: number;
  pasEcartArrondi?: number;
  titreArrondi: boolean;
  nbAnomalies: number;
  statut: Statut;
  renseigne: boolean;
}

export const TOLERANCE = 0.01; // € — égalité stricte
export const TOLERANCE_ARRONDI = 0.5; // € — écart PAS toléré (centimes → titre)

const spread = (vals: number[]) => Math.max(...vals) - Math.min(...vals);

function reconciliation(
  id: string,
  label: string,
  detail: string,
  raw: (number | undefined)[],
  arrondi = false,
): Reconciliation {
  const vals = raw.filter((v): v is number => typeof v === 'number');
  if (vals.length < 2) return { id, label, detail, statut: 'na' };
  const ecart = spread(vals);
  const tol = arrondi ? TOLERANCE_ARRONDI : TOLERANCE;
  return { id, label, detail, ecart, statut: ecart <= tol ? 'ok' : 'ko' };
}

/** Calcule écarts par tiers, réconciliations clés et statut global d'une entité. */
export function computeEntite(entite: EntiteKey, data: EntiteData): EntiteResultat {
  const lignes: LigneResultat[] = data.tiers.map((t) => {
    const vals = COL_KEYS.map((k) => t.valeurs[k]).filter((v): v is number => typeof v === 'number');
    const ecart = vals.length >= 2 ? spread(vals) : undefined;
    const hasPas = t.valeurs.E !== undefined || t.valeurs.H !== undefined;
    let statut: Statut;
    let arrondi = false;
    if (vals.length === 0) statut = 'na';
    else if (ecart === undefined || ecart <= TOLERANCE) statut = 'ok';
    else if (hasPas && ecart <= TOLERANCE_ARRONDI) {
      statut = 'ok';
      arrondi = true;
    } else statut = 'ko';
    return { ...t, ecart, statut, arrondi };
  });

  const byCode = new Map(lignes.map((l) => [l.code, l]));
  const v = (code: string, col: ColKey) => byCode.get(code)?.valeurs[col];

  const reconciliations = [
    reconciliation('urssaf', 'URSSAF concordant', 'budgétaire = état charges = bloc 81', [
      v(CODE.urssaf, 'C'),
      v(CODE.urssaf, 'D'),
      v(CODE.urssaf, 'G'),
    ]),
    reconciliation(
      'pas',
      'Bouclage PAS',
      'décompte = bloc 50 = journal',
      [v(CODE.pasSie, 'C'), v(CODE.pasSie, 'E'), v(CODE.pasSie, 'H'), v(CODE.journalPas, 'F')],
      true,
    ),
    reconciliation('tresorerie', 'Paies = trésorerie', 'paies numéraires = budgétaire', [
      v(CODE.tresorerie, 'C'),
      v(CODE.tresorerie, 'I'),
    ]),
  ].filter((r) => r.statut !== 'na');

  const nbAnomalies = lignes.filter((l) => l.statut === 'ko').length;
  const renseigne = lignes.length > 0 || Object.keys(data.totaux).length > 0;
  const statut: Statut = !renseigne ? 'na' : nbAnomalies > 0 ? 'ko' : 'ok';

  const pasLigne = byCode.get(CODE.pasSie);
  const pasEcartArrondi =
    data.titrePas ?? (pasLigne?.arrondi ? pasLigne.ecart : undefined);
  const titreArrondi = (pasEcartArrondi ?? 0) > TOLERANCE;

  return {
    entite,
    lignes,
    reconciliations,
    totaux: data.totaux,
    totalCiril: data.totaux.C,
    totalPaie: data.totaux.I,
    titrePas: data.titrePas,
    pasEcartArrondi,
    titreArrondi,
    nbAnomalies,
    statut,
    renseigne,
  };
}

/* ----------------------------- Exemple juin 2026 ----------------------------- */

const tier = (code: string, libelle: string, valeurs: Partial<Record<ColKey, number>>): TierLigne => ({
  code,
  libelle,
  valeurs,
});

export const DEMO_JUIN: Record<EntiteKey, EntiteData> = {
  VILLE: {
    tiers: [
      tier(CODE.urssaf, 'URSSAF', { C: 925561.32, D: 925561.32, G: 925561.32 }),
      tier(CODE.cnracl, 'CNRACL', { C: 380018.77, D: 380018.77, G: 380018.77 }),
      tier(CODE.ircantec, 'IRCANTEC', { C: 90001.6, D: 90001.6, G: 90001.6 }),
      tier(CODE.rafp, 'RAFP', { C: 15894.94, D: 15894.94, G: 15894.94 }),
      tier(CODE.sre, 'SRE (pension civile)', { C: 4384.47, D: 4384.47, G: 4384.47 }),
      tier(CODE.pasSie, 'PAS / SIE', { C: 56260.0, E: 56260.0, H: 56260.29 }),
      tier(CODE.journalPas, 'Journal PAS', { F: 56260.29 }),
      tier(CODE.tresorerie, 'Trésorerie municipale', { C: 1906259.23, I: 1906259.23 }),
    ],
    totaux: { C: 3406242.95, I: 1906259.23 },
    titrePas: 0.29,
  },
  CCAS: {
    tiers: [
      tier(CODE.urssaf, 'URSSAF', { C: 8015.37, D: 8015.37, G: 8015.37 }),
      tier(CODE.pasSie, 'PAS / SIE', { C: 767.08, E: 767.08, H: 767.08 }),
      tier(CODE.journalPas, 'Journal PAS', { F: 767.08 }),
    ],
    totaux: { C: 31218.03 },
  },
};

/* ------------------------------- Import CSV --------------------------------- */

/** Convertit « 925 561,32 », « 925561.32 », « -0,29 » → nombre. */
export function parseMontant(raw: string): number | undefined {
  if (!raw) return undefined;
  let s = raw.trim().replace(/[\u20AC\s\u00A0\u202F]/g, '');
  if (!s) return undefined;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

const detectEntite = (s: string): EntiteKey | undefined => {
  const n = s.toLowerCase();
  if (n.includes('ccas') || n.includes('004')) return 'CCAS';
  if (n.includes('ville') || n.includes('001')) return 'VILLE';
  return undefined;
};

function splitCsvLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (q && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else q = !q;
    } else if (c === delim && !q) {
      out.push(cur);
      cur = '';
    } else cur += c;
  }
  out.push(cur);
  return out.map((x) => x.trim());
}

export interface ParseResult {
  data: Partial<Record<EntiteKey, EntiteData>>;
  lignesReconnues: number;
  lignesIgnorees: number;
  erreur?: string;
}

/**
 * Import du CSV compagnon (5 colonnes : entité, code tiers, libellé, colonne, valeur).
 * Tolérant : séparateur `,` ou `;`, en-tête détecté, BOM géré.
 */
export function parseCsv(text: string): ParseResult {
  const data: Partial<Record<EntiteKey, EntiteData>> = {};
  let reconnues = 0;
  let ignorees = 0;

  const clean = text.replace(/^\uFEFF/, '');
  const lines = clean.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { data, lignesReconnues: 0, lignesIgnorees: 0, erreur: 'Fichier vide.' };

  const delim = (lines[0].match(/;/g)?.length ?? 0) > (lines[0].match(/,/g)?.length ?? 0) ? ';' : ',';
  const start = /entite|établissement|etablissement/i.test(lines[0]) ? 1 : 0;

  const ensure = (ent: EntiteKey): EntiteData => (data[ent] ??= { tiers: [], totaux: {} });
  const findTier = (ed: EntiteData, code: string, libelle: string): TierLigne => {
    let t = ed.tiers.find((x) => x.code === code);
    if (!t) {
      t = { code, libelle, valeurs: {} };
      ed.tiers.push(t);
    } else if (libelle && !t.libelle) t.libelle = libelle;
    return t;
  };

  for (let i = start; i < lines.length; i++) {
    const p = splitCsvLine(lines[i], delim);
    if (p.length < 5) {
      ignorees++;
      continue;
    }
    const ent = detectEntite(p[0]);
    const code = p[1];
    const libelle = p[2];
    const col = p[3].toUpperCase() as ColKey;
    const val = parseMontant(p[4]);
    if (!ent || !code) {
      ignorees++;
      continue;
    }
    const ed = ensure(ent);

    if (code === '_TITRE_PAS') {
      if (val !== undefined) ed.titrePas = val;
      reconnues++;
      continue;
    }
    if (val === undefined || !COL_KEYS.includes(col)) {
      ignorees++;
      continue;
    }
    if (code === '_TOTAL_CIRIL') {
      ed.totaux[col] = val;
      reconnues++;
      continue;
    }
    findTier(ed, code, libelle).valeurs[col] = val;
    reconnues++;
  }

  return { data, lignesReconnues: reconnues, lignesIgnorees: ignorees };
}

/** Modèle CSV (format compagnon) à partir de données — pour aligner / documenter. */
export function toCsvModele(d: Record<EntiteKey, EntiteData>): string {
  const fmt = (n: number) => n.toFixed(2);
  const lignes: string[] = ['ENTITE,CODE_TIERS,LIBELLE,COLONNE,VALEUR'];
  (Object.keys(d) as EntiteKey[]).forEach((ent) => {
    d[ent].tiers.forEach((t) => {
      COL_KEYS.forEach((k) => {
        const val = t.valeurs[k];
        if (typeof val === 'number') lignes.push(`${ent},${t.code},${t.libelle},${k},${fmt(val)}`);
      });
    });
    Object.entries(d[ent].totaux).forEach(([k, val]) => {
      if (typeof val === 'number') lignes.push(`${ent},_TOTAL_CIRIL,Total fichier CIRIL,${k},${fmt(val)}`);
    });
    if (typeof d[ent].titrePas === 'number') lignes.push(`${ent},_TITRE_PAS,Titre arrondi PAS,,${fmt(d[ent].titrePas!)}`);
  });
  return lignes.join('\n');
}
