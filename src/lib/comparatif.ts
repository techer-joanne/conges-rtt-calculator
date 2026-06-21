/**
 * Comparatif NET à payer — par « train » (lot de paie).
 *
 * À partir de l'extraction mensuelle (deux colonnes de mois « MM-AAAA »), on
 * compare le NET de chaque agent et on calcule l'ÉCART (mois2 − mois1), regroupé
 * par train. PRIORITÉ : le train est lu DIRECTEMENT dans l'extraction (colonnes
 * « Train » n° + « Lib. Train ») ; la table CORRESP (matricule → train) ne sert
 * que de filet de sécurité si l'extraction n'a pas la colonne Train. Les agents
 * sans train vont dans « À AFFECTER ».
 *
 * Moteur PUR (aucune lecture de fichier ici) : il reçoit des lignes déjà lues
 * (string[][]) par SheetJS côté composant. Repérage des colonnes par INTITULÉ,
 * jamais par position.
 */

export type CorrespEntry = { no: number | ''; lib: string };
export type Corresp = Record<string, CorrespEntry>;
export type Source = 'extraction' | 'corresp' | 'aaffecter';

/** n° de train → libellé (valeurs par défaut, cf. macro). */
export const TRAIN_SEED: Record<number, string> = {
  2: 'Train Ville Elus',
  7: 'Train CCAS',
  14: 'Train Ville Julie',
  15: 'Train Ville Ruth',
  16: 'Train Ville Laetitia',
  17: 'Train Florian',
  18: 'Train Alex',
  19: 'Train Yasmine',
};
export const A_AFFECTER = 'À AFFECTER';
/** Ordre d'affichage privilégié (le reste en alpha, « À AFFECTER » en dernier). */
export const TRAIN_ORDER = [
  'Train Alex',
  'Train CCAS',
  'Train Florian',
  'Train Ville Elus',
  'Train Ville Julie',
  'Train Ville Laetitia',
  'Train Ville Ruth',
  'Train Yasmine',
];

export interface AgentRow {
  etab: string;
  libEtab: string;
  pos: string;
  libPos: string;
  trainNo: number | '';
  trainLib: string;
  matricule: string;
  identite: string;
  m1?: number;
  m2?: number;
  ecart: number;
  source: Source;
}

export interface TrainGroup {
  lib: string;
  no: number | '';
  agents: AgentRow[];
  total1: number;
  total2: number;
  totalEcart: number;
}

export interface ComparatifResult {
  agents: AgentRow[];
  mois: { m1: string; m2: string };
  trains: TrainGroup[];
  nbAffecter: number;
  hasTrainCol: boolean;
  total1: number;
  total2: number;
  totalEcart: number;
  erreur?: string;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const norm = (s: unknown) =>
  String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
const MOIS_RE = /^\d{2}-\d{4}$/;

/** « 1 234,56 € » / « 1234.56 » / « -0,29 » → nombre, sinon undefined. */
export function parseMontant(raw: unknown): number | undefined {
  if (raw === null || raw === undefined) return undefined;
  let s = String(raw).trim().replace(/[€\s  ]/g, '');
  if (s === '') return undefined;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

const isNum = (v: unknown): boolean => v !== '' && v !== null && v !== undefined && Number.isFinite(Number(v));

// Sécurité : clés dangereuses (pollution de prototype) à ignorer dans les tables
// indexées par une valeur issue d'un fichier (matricule).
const DANGEROUS_KEY = new Set(['__proto__', 'constructor', 'prototype']);
const safeKey = (k: string) => !DANGEROUS_KEY.has(k);

// Sécurité : neutralise l'injection de formules CSV (valeur débutant par = + - @ tab CR)
// et échappe les champs contenant un séparateur / guillemet / saut de ligne.
function csvField(v: unknown): string {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[",;\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

function numFromLib(lib: string): number | '' {
  const n = norm(lib);
  for (const [k, v] of Object.entries(TRAIN_SEED)) if (norm(v) === n) return Number(k);
  return '';
}

/* ----------------------------- Détection des colonnes ----------------------------- */

interface ColMap {
  hdr: number;
  etab: number;
  libEtab: number;
  pos: number;
  libPos: number;
  mat: number;
  id: number;
  trainNo: number;
  trainLib: number;
  m1: number;
  m2: number;
}

function findHeaderRow(rows: string[][]): number {
  const n = Math.min(rows.length, 40);
  for (let r = 0; r < n; r++) {
    const row = rows[r] ?? [];
    for (let c = 0; c < Math.min(row.length, 30); c++) {
      if (norm(row[c]).includes('matricule')) return r;
    }
  }
  return 8; // repli (HDR = 9 en 1-based dans la macro)
}

function colContains(rows: string[][], hdr: number, needle: string, excl?: string): number {
  const row = rows[hdr] ?? [];
  for (let c = 0; c < Math.min(row.length, 30); c++) {
    const v = norm(row[c]);
    if (v.includes(needle) && (!excl || !v.includes(excl))) return c;
  }
  return -1;
}
function colBoth(rows: string[][], hdr: number, a: string, b: string): number {
  const row = rows[hdr] ?? [];
  for (let c = 0; c < Math.min(row.length, 30); c++) {
    const v = norm(row[c]);
    if (v.includes(a) && v.includes(b)) return c;
  }
  return -1;
}

function detectColumns(rows: string[][]): ColMap {
  const hdr = findHeaderRow(rows);
  const or = (v: number, def: number) => (v >= 0 ? v : def);
  // Mois : en-têtes « MM-AAAA ».
  let m1 = -1;
  let m2 = -1;
  const row = rows[hdr] ?? [];
  for (let c = 0; c < Math.min(row.length, 30); c++) {
    if (MOIS_RE.test(norm(row[c]))) {
      if (m1 < 0) m1 = c;
      else if (m2 < 0) m2 = c;
    }
  }
  return {
    hdr,
    etab: or(colContains(rows, hdr, 'etablissement', 'lib'), 0),
    libEtab: or(colBoth(rows, hdr, 'lib', 'etablissement'), 1),
    pos: or(colContains(rows, hdr, 'position administrative', 'lib'), 2),
    libPos: or(colBoth(rows, hdr, 'lib', 'position administrative'), 3),
    mat: or(colContains(rows, hdr, 'matricule'), 6),
    id: or(colContains(rows, hdr, 'identit'), 7),
    trainNo: colContains(rows, hdr, 'train', 'lib'), // -1 si absent
    trainLib: colBoth(rows, hdr, 'lib', 'train'), // -1 si absent
    m1: or(m1, 8),
    m2: or(m2, 9),
  };
}

/* ----------------------------- Résolution du train ----------------------------- */

export function resolveTrain(
  noRaw: unknown,
  libRaw: unknown,
  matricule: string,
  corresp: Corresp,
): { no: number | ''; lib: string; source: Source } {
  const libCell = String(libRaw ?? '').trim();
  // 1) directement depuis l'extraction
  if (libCell) {
    return { lib: libCell, no: isNum(noRaw) ? Number(noRaw) : numFromLib(libCell), source: 'extraction' };
  }
  if (isNum(noRaw)) {
    const no = Number(noRaw);
    return { no, lib: TRAIN_SEED[no] ?? `Train ${no}`, source: 'extraction' };
  }
  // 2) filet de sécurité : CORRESP (par matricule) — accès protégé
  const ce = safeKey(matricule) ? corresp[matricule] : undefined;
  if (ce && ce.lib) return { no: ce.no, lib: ce.lib, source: 'corresp' };
  // 3) à affecter
  return { no: '', lib: A_AFFECTER, source: 'aaffecter' };
}

/* ----------------------------- Construction du comparatif ----------------------------- */

function groupTrains(agents: AgentRow[]): TrainGroup[] {
  const by = new Map<string, AgentRow[]>();
  for (const a of agents) {
    if (!by.has(a.trainLib)) by.set(a.trainLib, []);
    by.get(a.trainLib)!.push(a);
  }
  const libs = [...by.keys()];
  const rank = (lib: string) => {
    if (lib === A_AFFECTER) return 9999;
    const i = TRAIN_ORDER.indexOf(lib);
    return i >= 0 ? i : 1000;
  };
  libs.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b, 'fr'));
  return libs.map((lib) => {
    const list = by.get(lib)!;
    const total1 = round2(list.reduce((s, a) => s + (a.m1 ?? 0), 0));
    const total2 = round2(list.reduce((s, a) => s + (a.m2 ?? 0), 0));
    return { lib, no: list[0]?.trainNo ?? '', agents: list, total1, total2, totalEcart: round2(total2 - total1) };
  });
}

export function buildComparatif(rows: string[][], corresp: Corresp = {}): ComparatifResult {
  const empty: ComparatifResult = {
    agents: [],
    mois: { m1: 'Mois N-1', m2: 'Mois N' },
    trains: [],
    nbAffecter: 0,
    hasTrainCol: false,
    total1: 0,
    total2: 0,
    totalEcart: 0,
  };
  if (!rows || rows.length === 0) return { ...empty, erreur: 'Fichier vide.' };

  const col = detectColumns(rows);
  const hRow = rows[col.hdr] ?? [];
  const moisLabel = (c: number, def: string) => {
    const v = String(hRow[c] ?? '').trim();
    return v || def;
  };
  const mois = { m1: moisLabel(col.m1, 'Mois N-1'), m2: moisLabel(col.m2, 'Mois N') };
  const hasTrainCol = col.trainNo >= 0 || col.trainLib >= 0;

  const agents: AgentRow[] = [];
  for (let r = col.hdr + 1; r < rows.length; r++) {
    const row = rows[r] ?? [];
    const matricule = String(row[col.mat] ?? '').trim();
    if (!matricule) continue;
    const m1 = parseMontant(row[col.m1]);
    const m2 = parseMontant(row[col.m2]);
    const t = resolveTrain(
      col.trainNo >= 0 ? row[col.trainNo] : '',
      col.trainLib >= 0 ? row[col.trainLib] : '',
      matricule,
      corresp,
    );
    agents.push({
      etab: String(row[col.etab] ?? '').trim(),
      libEtab: String(row[col.libEtab] ?? '').trim(),
      pos: String(row[col.pos] ?? '').trim(),
      libPos: String(row[col.libPos] ?? '').trim(),
      trainNo: t.no,
      trainLib: t.lib,
      matricule,
      identite: String(row[col.id] ?? '').trim(),
      m1,
      m2,
      ecart: round2((m2 ?? 0) - (m1 ?? 0)),
      source: t.source,
    });
  }

  if (agents.length === 0) return { ...empty, mois, hasTrainCol, erreur: 'Aucun agent détecté (vérifiez le fichier d’extraction).' };

  const trains = groupTrains(agents);
  const total1 = round2(agents.reduce((s, a) => s + (a.m1 ?? 0), 0));
  const total2 = round2(agents.reduce((s, a) => s + (a.m2 ?? 0), 0));
  return {
    agents,
    mois,
    trains,
    nbAffecter: agents.filter((a) => a.trainLib === A_AFFECTER).length,
    hasTrainCol,
    total1,
    total2,
    totalEcart: round2(total2 - total1),
  };
}

/** Réapplique des affectations manuelles (matricule → libellé de train) puis regroupe. */
export function applyAffectations(res: ComparatifResult, choix: Record<string, string>): ComparatifResult {
  if (Object.keys(choix).length === 0) return res;
  const agents = res.agents.map((a) => {
    const lib = choix[a.matricule];
    if (!lib || lib === a.trainLib) return a;
    return { ...a, trainLib: lib, trainNo: numFromLib(lib), source: 'corresp' as Source };
  });
  const trains = groupTrains(agents);
  return { ...res, agents, trains, nbAffecter: agents.filter((a) => a.trainLib === A_AFFECTER).length };
}

/* ----------------------------- CORRESP : parsing & export ----------------------------- */

/** Lit la feuille CORRESP (Matricule | Train n° | Lib. Train) en table matricule→train. */
export function parseCorrespRows(rows: string[][]): Corresp {
  const out: Corresp = Object.create(null);
  if (!rows?.length) return out;
  // En-tête = 1re ligne contenant « matricule » ; sinon on part de 0.
  let hdr = 0;
  for (let r = 0; r < Math.min(rows.length, 10); r++) {
    if ((rows[r] ?? []).some((c) => norm(c).includes('matricule'))) {
      hdr = r;
      break;
    }
  }
  for (let r = hdr + 1; r < rows.length; r++) {
    const row = rows[r] ?? [];
    const mat = String(row[0] ?? '').trim();
    if (!mat || !safeKey(mat)) continue;
    const no = isNum(row[1]) ? Number(row[1]) : '';
    const lib = String(row[2] ?? '').trim();
    if (lib) out[mat] = { no, lib };
  }
  return out;
}

/** Ajoute à CORRESP les matricules affectés à un train réel (mémorisation). Renvoie le nb d'ajouts. */
export function memoriserNouveaux(corresp: Corresp, agents: AgentRow[]): number {
  let n = 0;
  for (const a of agents) {
    if (!safeKey(a.matricule)) continue;
    if (a.trainLib && a.trainLib !== A_AFFECTER && !corresp[a.matricule]) {
      corresp[a.matricule] = { no: a.trainNo === '' ? numFromLib(a.trainLib) : a.trainNo, lib: a.trainLib };
      n++;
    }
  }
  return n;
}

export function correspToCsv(corresp: Corresp): string {
  const lignes = ['Matricule,Train,Lib. Train'];
  for (const [mat, e] of Object.entries(corresp))
    lignes.push(`${csvField(mat)},${csvField(e.no === '' ? '' : e.no)},${csvField(e.lib)}`);
  return '﻿' + lignes.join('\n');
}

export function parseCorrespCsv(text: string): Corresp {
  const clean = text.replace(/^﻿/, '');
  const lines = clean.split(/\r?\n/).filter((l) => l.trim());
  const rows = lines.map((l) => {
    const delim = (l.match(/;/g)?.length ?? 0) > (l.match(/,/g)?.length ?? 0) ? ';' : ',';
    return l.split(delim).map((x) => x.trim().replace(/^"|"$/g, ''));
  });
  return parseCorrespRows(rows);
}

/* ----------------------------- Démo (tests) ----------------------------- */

/** Petit jeu de démonstration : extraction avec colonne Train + un agent à affecter. */
export const DEMO_EXTRACTION: string[][] = [
  ['Edition comparative — NET à payer'],
  [],
  ['Etablissement', 'Lib. Etablissement', 'Position', 'Lib. position administrative', 'Train', 'Lib. Train', 'Matricule', 'Identité', '05-2026', '06-2026'],
  ['001', 'MAIRIE', 'A', 'Titulaire', '18', 'Train Alex', '174569', 'DUPONT Jean', '2 100,00', '2 150,50'],
  ['001', 'MAIRIE', 'A', 'Titulaire', '', '', '999999', 'NOUVEAU Agent', '1 800,00', '1 800,00'],
  ['004', 'CCAS', 'C', 'Contractuel', '7', 'Train CCAS', '174880', 'MARTIN Lea', '1 500,00', '1 450,00'],
];
