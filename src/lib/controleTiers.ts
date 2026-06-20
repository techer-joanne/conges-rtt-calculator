/**
 * Contrôle Tiers (rapprochement de paie) — Ville (001) & CCAS (004).
 *
 * Couche d'AFFICHAGE de la « phase 2 ». Les valeurs viennent du CSV produit par
 * l'outil compagnon (companion_controle_tiers.py) ; le navigateur ne lit pas les
 * PDF/CIRIL. La logique de rapprochement reproduit le pré-contrôle du compagnon.
 *
 * Format CSV compagnon (UTF-8-SIG, séparateur virgule), 6 colonnes :
 *   ENTITE, CODE_TIERS, LIBELLE, COLONNE, VALEUR, CONTROLE
 * COLONNE ∈ C..I (rapprochement par Code Tiers) :
 *   C = génération budgétaire (1) · D = état des charges (2) · E = décompte PAS (8)
 *   F = journal PAS (9) · G = bloc 81 (6) · H = bloc 50 (7) · I = trésorerie/paies (5)
 * Lignes spéciales : CODE_TIERS = "_TOTAL_CIRIL" (total par colonne) ou
 * "_TITRE_PAS" (VALEUR = OUI/NON : un titre d'arrondi du PAS est-il nécessaire).
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

/** Paramétrage par entité (codes Tiers — cf. OPS2CODE du compagnon). */
const PARAM: Record<EntiteKey, { pas: string; treso: string; urssaf: string; csg: string; ops: string[] }> = {
  VILLE: { pas: '24574', treso: '342', urssaf: '11788', csg: '11789', ops: ['10937', '10938', '11788', '11837', '11838'] },
  CCAS: { pas: '24574', treso: '342', urssaf: '1467', csg: '1468', ops: ['1348', '1467', '1479', '329'] },
};

export interface TierLigne {
  code: string;
  libelle: string;
  valeurs: Partial<Record<ColKey, number>>;
}

export interface EntiteData {
  tiers: TierLigne[];
  totaux: Partial<Record<ColKey, number>>;
  titrePasFlag?: boolean; // _TITRE_PAS = OUI / NON
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
  totalCiril?: number;
  totalPaie?: number;
  pasEcartArrondi?: number;
  titreArrondi: boolean;
  nbAnomalies: number;
  statut: Statut;
  renseigne: boolean;
}

export const TOLERANCE = 0.01; // €
export const TOLERANCE_ARRONDI = 0.5; // € — écart de centimes PAS toléré (→ titre)

const isNum = (v: unknown): v is number => typeof v === 'number';
const spread = (vals: number[]) => Math.max(...vals) - Math.min(...vals);

function reco(id: string, label: string, detail: string, diffs: number[], tol = TOLERANCE): Reconciliation {
  if (diffs.length === 0) return { id, label, detail, statut: 'na' };
  const ecart = Math.max(...diffs);
  return { id, label, detail, ecart, statut: ecart <= tol ? 'ok' : 'ko' };
}

/** Calcule écarts par tiers, réconciliations clés et statut global d'une entité. */
export function computeEntite(entite: EntiteKey, data: EntiteData): EntiteResultat {
  const P = PARAM[entite];
  const byCode = new Map(data.tiers.map((t) => [t.code, t]));
  const val = (code: string, col: ColKey) => byCode.get(code)?.valeurs[col];

  // ---- Écart + statut par tiers (affichage) ----
  const lignes: LigneResultat[] = data.tiers.map((t) => {
    const v = t.valeurs;
    const isPas = t.code === P.pas && (v.E !== undefined || v.F !== undefined || v.H !== undefined);
    if (isPas) {
      const vals = [v.C, v.E, v.F, v.H].filter(isNum);
      const ecart = vals.length >= 2 ? spread(vals) : undefined;
      if (ecart === undefined || ecart <= TOLERANCE) return { ...t, ecart, statut: 'ok', arrondi: false };
      if (ecart <= TOLERANCE_ARRONDI) return { ...t, ecart, statut: 'ok', arrondi: true };
      return { ...t, ecart, statut: 'ko', arrondi: false };
    }
    const pairs: number[] = [];
    if (isNum(v.C) && isNum(v.D)) pairs.push(Math.abs(v.C - v.D)); // budgétaire vs état charges
    if (isNum(v.C) && isNum(v.I)) pairs.push(Math.abs(v.C - v.I)); // trésorerie
    if (pairs.length === 0) {
      const any = COL_KEYS.some((k) => v[k] !== undefined);
      return { ...t, statut: any ? 'ok' : 'na', arrondi: false };
    }
    const ecart = Math.max(...pairs);
    return { ...t, ecart, statut: ecart <= TOLERANCE ? 'ok' : 'ko', arrondi: false };
  });

  // ---- Réconciliations (pré-contrôle, façon compagnon) ----
  const diffCD = data.tiers
    .map((t) => (isNum(t.valeurs.C) && isNum(t.valeurs.D) ? Math.abs(t.valeurs.C - t.valeurs.D) : undefined))
    .filter(isNum);

  const diffBloc81: number[] = [];
  for (const code of P.ops) {
    const g = val(code, 'G');
    if (!isNum(g)) continue;
    let base = val(code, 'C');
    if (code === P.urssaf) base = (val(P.urssaf, 'C') ?? 0) + (val(P.csg, 'C') ?? 0); // URSSAF = URSSAF + CSG
    if (isNum(base)) diffBloc81.push(Math.abs(g - base));
  }

  const diffPas: number[] = [];
  const pH = val(P.pas, 'H');
  const pF = val(P.pas, 'F');
  const pE = val(P.pas, 'E');
  const pC = val(P.pas, 'C');
  if (isNum(pH) && isNum(pF)) diffPas.push(Math.abs(pH - pF)); // bloc 50 = journal
  if (isNum(pE) && isNum(pC)) diffPas.push(Math.abs(pE - pC)); // décompte = budgétaire

  const diffTreso: number[] = [];
  const tI = val(P.treso, 'I');
  const tC = val(P.treso, 'C');
  if (isNum(tI) && isNum(tC)) diffTreso.push(Math.abs(tI - tC));

  const reconciliations = [
    reco('budget', 'Budgétaire = état des charges', 'rapprochement par Code Tiers', diffCD),
    reco('bloc81', 'Bloc 81 = budgétaire', 'cotisations DSN = comptabilité', diffBloc81),
    reco('pas', 'Bouclage PAS', 'décompte = budgétaire · bloc 50 = journal', diffPas),
    reco('treso', 'Paies = trésorerie', 'tout payé par virement', diffTreso),
  ].filter((r) => r.statut !== 'na');

  const nbAnomalies = reconciliations.filter((r) => r.statut === 'ko').length;
  const renseigne = data.tiers.length > 0 || Object.keys(data.totaux).length > 0;
  const statut: Statut = !renseigne ? 'na' : nbAnomalies > 0 ? 'ko' : 'ok';

  // ---- Titre d'arrondi PAS ----
  const pasVals = [pC, pE, pF, pH].filter(isNum);
  const pasEcartArrondi = pasVals.length >= 2 ? spread(pasVals) : undefined;
  const titreArrondi = data.titrePasFlag ?? ((pasEcartArrondi ?? 0) > TOLERANCE);

  const totalPaie = val(P.treso, 'I') ?? data.totaux.I;

  return {
    entite,
    lignes,
    reconciliations,
    totaux: data.totaux,
    totalCiril: data.totaux.C,
    totalPaie,
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
      tier('11788', 'URSSAF', { C: 925561.32, D: 925561.32, G: 925561.32 }),
      tier('11838', 'CNRACL', { C: 380018.77, D: 380018.77, G: 380018.77 }),
      tier('11837', 'IRCANTEC', { C: 90001.6, D: 90001.6, G: 90001.6 }),
      tier('10937', 'RAFP', { C: 15894.94, D: 15894.94, G: 15894.94 }),
      tier('10938', 'Pension civile (SRE)', { C: 4384.47, D: 4384.47, G: 4384.47 }),
      tier('24574', 'PAS / SIE', { C: 56260.0, E: 56260.0, F: 56260.29, H: 56260.29 }),
      tier('342', 'Trésorerie municipale', { C: 1906259.23, I: 1906259.23 }),
    ],
    totaux: { C: 3406242.95, E: 56260.29 },
    titrePasFlag: true,
  },
  CCAS: {
    tiers: [
      tier('1467', 'URSSAF', { C: 8015.37, D: 8015.37, G: 8015.37 }),
      tier('24574', 'PAS / SIE', { C: 767.08, E: 767.08, F: 767.08, H: 767.08 }),
    ],
    totaux: { C: 31218.03 },
    titrePasFlag: false,
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
  if (n.includes('ville') || n.includes('001') || n.includes('mairie')) return 'VILLE';
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

/** Import du CSV compagnon. Tolérant : séparateur `,`/`;`, BOM, guillemets, en-tête. */
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
    if (!ent || !code) {
      ignorees++;
      continue;
    }
    const ed = ensure(ent);

    if (code === '_TITRE_PAS') {
      ed.titrePasFlag = /^o/i.test((p[4] ?? '').trim()); // OUI / NON
      reconnues++;
      continue;
    }
    const v = parseMontant(p[4]);
    if (v === undefined || !COL_KEYS.includes(col)) {
      ignorees++;
      continue;
    }
    if (code === '_TOTAL_CIRIL') {
      ed.totaux[col] = v;
      reconnues++;
      continue;
    }
    findTier(ed, code, libelle).valeurs[col] = v;
    reconnues++;
  }

  return { data, lignesReconnues: reconnues, lignesIgnorees: ignorees };
}

/** Modèle CSV (format compagnon) à partir de données — pour aligner / documenter. */
export function toCsvModele(d: Record<EntiteKey, EntiteData>): string {
  const fmt = (n: number) => n.toFixed(2);
  const lignes: string[] = ['ENTITE,CODE_TIERS,LIBELLE,COLONNE,VALEUR,CONTROLE'];
  (Object.keys(d) as EntiteKey[]).forEach((ent) => {
    d[ent].tiers.forEach((t) => {
      COL_KEYS.forEach((k) => {
        const v = t.valeurs[k];
        if (isNum(v)) lignes.push(`${ent},${t.code},${t.libelle},${k},${fmt(v)},${COLONNES.find((c) => c.key === k)?.n ?? ''}`);
      });
    });
    Object.entries(d[ent].totaux).forEach(([k, v]) => {
      if (isNum(v)) lignes.push(`${ent},_TOTAL_CIRIL,,${k},${fmt(v)},`);
    });
    if (d[ent].titrePasFlag !== undefined) lignes.push(`${ent},_TITRE_PAS,,,${d[ent].titrePasFlag ? 'OUI' : 'NON'},8`);
  });
  return lignes.join('\n');
}
