/**
 * Contrôle Tiers — EXTRACTION en navigateur (port de companion_controle_tiers.py).
 *
 * Lit les fichiers bruts CIRIL DIRECTEMENT dans le navigateur, sans Python :
 *   - PDF  → texte reconstruit via pdf.js (mime `pdftotext -layout`) ;
 *   - .xlsx/.xlsm/.slk → lignes via SheetJS (xlsx) — qui lit aussi le SLK.
 * Chaque fichier est identifié PAR SON CONTENU (signatures du BRIEF §11), jamais
 * par son nom. Les extracteurs x_ctrl1..x_ctrl9 reproduisent companion.py.
 *
 * IMPORTANT : pdfjs-dist et xlsx sont importés de façon PARESSEUSE
 * (`await import(...)`) à l'intérieur des fonctions. Aucun import top-level :
 * le smoke-test SSR (smoke-test.mjs) rend <App/> dans Node, où pdf.js / xlsx
 * planteraient au chargement du module. La page Contrôle Tiers doit rester
 * importable en Node.
 *
 * Les vrais PDF/xlsx ne sont PAS disponibles dans cet environnement : le code
 * est fidèle au .py et abondamment commenté, mais la lecture de fichiers réels
 * reste à valider sur poste. Le MOTEUR de réconciliation est, lui, testé sur le
 * jeu de juin 2026 (cf. controleTiers.ts / verify-calc.mjs).
 */
import type { EntiteKey, EntiteData, ColKey } from './controleTiers';

/* ----------------------------- Paramétrage (cf. .py) ----------------------------- */

// Correspondance organisme DSN (bloc 81, col. 7) -> Code Tiers, par entité.
export const OPS2CODE: Record<EntiteKey, Record<string, string | null>> = {
  VILLE: { RAFP: '10937', SRE: '10938', URSSAF: '11788', IRCANTEC: '11837', CNRACL: '11838' },
  CCAS: { RAFP: '1348', SRE: null, URSSAF: '1467', IRCANTEC: '1479', CNRACL: '329' },
};
const PAS_TIERS = '24574';
const TRESO = '342';

// Libellés (NAMES du .py) — utilisés pour étiqueter les lignes importées.
const NAMES: Record<string, string> = {
  '10937': 'RAFP', '10938': 'PENSION CIVILE/SRE', '11788': 'URSSAF', '11789': 'URSSAF CSG',
  '11837': 'IRCANTEC', '11838': 'CNRACL', '13983': 'CAREL', '1403': 'CIG', '16780': 'ATIACL',
  '19425': 'HARMONIE', '24574': 'PAS/SIE', '342': 'TRESORERIE', '391': 'MNT', '392': 'PREFON',
  '1348': 'RAFP', '1467': 'URSSAF', '1468': 'URSSAF CSG', '1479': 'IRCANTEC', '329': 'CNRACL',
  '2301': 'ATIACL', '3000': 'CIG',
};

/* ----------------------------- Lecture des fichiers ----------------------------- */

let workerConfigured = false;

/**
 * Lit un PDF et reconstruit le TEXTE par lignes (mime `pdftotext -layout`) :
 * pour chaque page, on regroupe les items de texte par ordonnée y (transform[5],
 * arrondie) puis on les trie par abscisse x ; chaque ligne = items joints par
 * des espaces ; toutes les lignes jointes par "\n".
 */
export async function readPdfText(file: File): Promise<string> {
  // Import paresseux — JAMAIS au top-level (sinon le SSR Node plante).
  const pdfjs = await import('pdfjs-dist');
  if (!workerConfigured) {
    // Worker résolu par Vite (bundle navigateur).
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url,
    ).toString();
    workerConfigured = true;
  }

  const buf = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buf) });
  const pdf = await loadingTask.promise;
  const out: string[] = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    // Regrouper par ligne (y arrondi). transform = [a,b,c,d,e,f] ; x=e (idx4), y=f (idx5).
    const lines = new Map<number, { x: number; s: string }[]>();
    for (const item of content.items as { str: string; transform: number[] }[]) {
      if (typeof item.str !== 'string') continue;
      const y = Math.round(item.transform[5]);
      const x = item.transform[4];
      (lines.get(y) ?? lines.set(y, []).get(y)!).push({ x, s: item.str });
    }
    // y décroissant (haut → bas), x croissant (gauche → droite).
    const ys = [...lines.keys()].sort((a, b) => b - a);
    for (const y of ys) {
      const parts = lines.get(y)!.sort((a, b) => a.x - b.x);
      out.push(parts.map((q) => q.s).join(' '));
    }
  }
  await loadingTask.destroy(); // libère le worker
  return out.join('\n');
}

/**
 * Lit un tableur (.xlsx/.xlsm/.slk) en tableau de lignes de chaînes.
 * SheetJS lit nativement le SLK. `sheetName` optionnel pour cibler une feuille
 * (ex. bloc 81 : « Edition_DSN_-_Cotisation_indivi »).
 */
export async function readSheetRows(file: File, sheetName?: string): Promise<string[][]> {
  const XLSX = await import('xlsx');
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const name =
    (sheetName && wb.SheetNames.includes(sheetName) ? sheetName : undefined) ?? wb.SheetNames[0];
  const ws = wb.Sheets[name];
  if (!ws) return [];
  // header:1 → tableau de tableaux ; raw:false → valeurs formatées en chaînes.
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: false, defval: '' });
  return rows.map((r) => (r ?? []).map((c) => (c == null ? '' : String(c))));
}

/** Noms de feuilles du classeur (sans tout charger en mémoire applicative). */
async function readSheetNames(file: File): Promise<string[]> {
  const XLSX = await import('xlsx');
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', bookSheets: true });
  return wb.SheetNames;
}

/* ----------------------------- Helpers numériques (cf. .py) ----------------------------- */

/**
 * `amounts(line)` du .py : extrait les montants « 12 345.67 » d'une ligne PDF.
 * Découpe sur ≥ 2 espaces, garde les jetons -?\d+\.\d{2} (après retrait des
 * espaces internes de milliers).
 */
export function amounts(line: string): number[] {
  return line
    .trim()
    .split(/\s{2,}/)
    .map((t) => t.replace(/\s/g, ''))
    .filter((t) => /^-?\d+\.\d{2}$/.test(t))
    .map((t) => parseFloat(t));
}

/** `fnum(x)` du .py : « 925 561,32 » / « 925561.32 » → nombre, sinon undefined. */
export function fnum(x: unknown): number | undefined {
  if (x == null) return undefined;
  const s = String(x).replace(/,/g, '.').replace(/\s/g, '');
  if (s === '') return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/* ----------------------------- Détection entité (cf. .py `entity`) ----------------------------- */

export function detectEntite(text: string): EntiteKey | '?' {
  if (/Etablissement(?:\s+de\s+gestion)?\s*[:=]\s*004|004\s*-\s*CCAS/.test(text)) return 'CCAS';
  if (/Etablissement(?:\s+de\s+gestion)?\s*[:=]\s*001|001\s*-\s*Mairie|Mairie de Trappes/.test(text))
    return 'VILLE';
  if (/\bCCAS\b/.test(text)) return 'CCAS';
  return '?';
}

/* ----------------------------- Extracteurs (port x_ctrl1..9) ----------------------------- */

/** 1 — Génération budgétaire : `Total tiers <code> … <montant>` (DERNIER montant) ; `Total général`. */
export function xCtrl1(t: string): { tiers: Record<string, number>; total: number | null } {
  const d: Record<string, number> = {};
  let tg: number | null = null;
  for (const l of t.split('\n')) {
    const m = /[Tt]otal tiers\s+(\d+)/.exec(l);
    const a = amounts(l);
    if (m && a.length) d[m[1]] = a[a.length - 1];
    if (l.includes('Total g') && a.length) tg = a[a.length - 1];
  }
  return { tiers: d, total: tg };
}

/** 2 — État des charges : `Total Tiers <code>` = PREMIER montant (avec centimes). PAS absent. */
export function xCtrl2(t: string): { tiers: Record<string, number>; total: number | null } {
  const d: Record<string, number> = {};
  for (const l of t.split('\n')) {
    const m = /Total Tiers\s+(\d+)/.exec(l);
    const a = amounts(l);
    if (m && a.length) d[m[1]] = a[0];
  }
  const vals = Object.values(d);
  return { tiers: d, total: vals.length ? round2(vals.reduce((s, v) => s + v, 0)) : null };
}

/** 3 — État des charges URSSAF : total cotisation (ligne 11788/1467, 2e montant ; sinon Total général). */
export function xCtrl3(t: string): { urssaf: number | null } {
  const lines = t.split('\n');
  let ln = lines.filter((l) => l.includes('Total Tiers 11788') || l.includes('Total Tiers 1467'));
  if (!ln.length) ln = lines.filter((l) => l.includes('Total g'));
  if (!ln.length) return { urssaf: null };
  const a = amounts(ln[ln.length - 1]);
  return { urssaf: a.length > 1 ? a[1] : a.length ? a[a.length - 1] : null };
}

/** 5 — Paies numéraires : `Total général` (net payé, dernier montant) → tiers 342, col I. */
export function xCtrl5(t: string): { total: number | null } {
  const ln = t.split('\n').filter((l) => l.includes('Total g'));
  if (!ln.length) return { total: null };
  const a = amounts(ln[ln.length - 1]);
  return { total: a.length ? a[a.length - 1] : null };
}

/**
 * 6 — DSN bloc 81 : somme du montant de cotisation (col. 12 → idx 11) groupée par
 * Code OPS (col. 7 → idx 6) pour {RAFP, SRE, URSSAF, IRCANTEC, CNRACL}.
 * Les clés OPS valides sont celles de OPS2CODE (Ville couvre le sur-ensemble).
 */
export function xCtrl6(rows: string[][]): { ops: Record<string, number> } {
  const agg: Record<string, number> = {};
  const opsKeys = new Set(Object.keys(OPS2CODE.VILLE)); // RAFP, SRE, URSSAF, IRCANTEC, CNRACL
  for (const r of rows) {
    if (r.length <= 11) continue;
    const ops = (r[6] ?? '').trim();
    if (!opsKeys.has(ops)) continue;
    const v = fnum(r[11]);
    if (v === undefined) continue;
    agg[ops] = round2((agg[ops] ?? 0) + v);
  }
  return { ops: agg };
}

/**
 * 7 — DSN bloc 50 : total de la colonne « 009 - Montant PAS » (col. 7 → idx 6).
 * Comme le .py : on somme idx 6 des lignes dont la 1re cellule est numérique.
 */
export function xCtrl7(rows: string[][]): { total: number } {
  let tot = 0;
  for (const r of rows) {
    if (r.length <= 6) continue;
    if (!/^\d+$/.test((r[0] ?? '').trim())) continue;
    tot += fnum(r[6]) ?? 0;
  }
  return { total: round2(tot) };
}

/**
 * 8 — Décompte global du PAS : ligne `Total Etablissement` →
 *   prélèvement effectué (avant-avant-dernier), régul (avant-dernier), somme (dernier).
 */
export function xCtrl8(t: string): {
  prelev: number | null;
  regul: number | null;
  somme: number | null;
} {
  const ln = t.split('\n').filter((l) => l.includes('Total Etablissement'));
  const a = ln.length ? amounts(ln[ln.length - 1]) : [];
  if (a.length >= 3) return { prelev: a[a.length - 3], regul: a[a.length - 2], somme: a[a.length - 1] };
  return { prelev: null, regul: null, somme: null };
}

/**
 * 9 — Journal RUB 1691/1694/1697 : somme de « Mt Sal rub » (col. 10 → idx 9, `jcol`)
 * des rubriques (col. 3 → idx 2) 1691/1694/1697, en VALEUR ABSOLUE.
 */
export function xCtrl9(rows: string[][], jcol = 9): { total: number } {
  let tot = 0;
  for (const r of rows) {
    if (r.length <= jcol) continue;
    const rub = (r[2] ?? '').trim();
    if (rub === '1691' || rub === '1694' || rub === '1697') tot += fnum(r[jcol]) ?? 0;
  }
  return { total: Math.abs(round2(tot)) };
}

/* ----------------------------- Classification (cf. .py `classify`) ----------------------------- */

export type Ctrl = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
type CtrlData = Record<string, unknown> | null;

interface Classified {
  entite: EntiteKey | '?';
  ctrl: Ctrl;
  data: CtrlData;
}

const ext = (name: string) => {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i).toLowerCase() : '';
};

async function classify(file: File): Promise<Classified> {
  const e = ext(file.name);

  // -------- PDF (pdf.js) --------
  if (e === '.pdf') {
    const t = await readPdfText(file);
    const head = t.slice(0, 4000);
    const ent = detectEntite(t);
    // Ordre des signatures = BRIEF §11.
    if (head.includes('interface comptable')) return { entite: ent, ctrl: 1, data: xCtrl1(t) };
    if (head.includes('S21.G00.22') || head.includes('Bordereau de cotisation'))
      return { entite: ent, ctrl: 4, data: null }; // contrôle 4 (DSN 22/23) : non porté côté valeurs
    if (head.includes('Etat des charges URSSAF')) return { entite: ent, ctrl: 3, data: xCtrl3(t) };
    if (head.includes('Etat des charges')) return { entite: ent, ctrl: 2, data: xCtrl2(t) };
    if (head.includes('Edition nominative des paies')) return { entite: ent, ctrl: 5, data: xCtrl5(t) };
    if (head.includes('compte global du PAS')) return { entite: ent, ctrl: 8, data: xCtrl8(t) };
    return { entite: ent, ctrl: 0, data: null };
  }

  // -------- Tableur (.xlsx/.xlsm/.slk) via SheetJS --------
  if (e === '.xlsx' || e === '.xlsm' || e === '.slk') {
    const names = await readSheetNames(file);
    const namesJoined = names.join(' ');
    // Détection bloc 81 : feuille « Cotisation_indivi » ou « Code OPS » dans l'en-tête.
    const cotiSheet = names.find((n) => n.includes('Cotisation_indivi'));
    if (cotiSheet) {
      const rows = await readSheetRows(file, cotiSheet);
      return { entite: detectEntite(rowsHead(rows)), ctrl: 6, data: xCtrl6(rows) };
    }
    // Lire la 1re feuille pour détecter le reste par contenu.
    const rows = await readSheetRows(file);
    const flat = rowsHead(rows);
    const ent = detectEntite(flat);
    if (flat.includes('Code OPS') || flat.includes('Cotisation individuelle'))
      return { entite: ent, ctrl: 6, data: xCtrl6(rows) };
    if (/journal/i.test(namesJoined) || flat.includes('1691'))
      return { entite: ent, ctrl: 9, data: xCtrl9(rows, 9) };
    if (flat.includes('Code de cotisation') || flat.includes('Total 23'))
      return { entite: ent, ctrl: 4, data: null }; // contrôle 4 (DSN 22/23) : non porté côté valeurs
    if (flat.includes('009') && (flat.includes('Montant PAS') || flat.includes('Net')))
      return { entite: ent, ctrl: 7, data: xCtrl7(rows) };
    return { entite: ent, ctrl: 0, data: null };
  }

  return { entite: '?', ctrl: 0, data: null };
}

/** Concatène les ~20 premières lignes d'un tableur pour la détection par contenu. */
function rowsHead(rows: string[][]): string {
  return rows
    .slice(0, 20)
    .map((r) => r.filter((c) => c !== '').join(' '))
    .join(' ');
}

/* ----------------------------- Agrégation (port de `run` / `put`) ----------------------------- */

export interface AggregateResult {
  data: Record<EntiteKey, EntiteData>;
  log: { name: string; entite: EntiteKey | '?'; controle: Ctrl }[];
  errors: string[];
}

const emptyEntite = (): EntiteData => ({ tiers: [], totaux: {} });

/**
 * Reproduit companion `run()` : classe chaque fichier, puis remplit la table par
 * entité via la même cartographie `put(code, col, val)` :
 *   ctrl1 → C par tiers + total CIRIL C
 *   ctrl2 → D par tiers + total CIRIL D
 *   ctrl5 → I sur 342
 *   ctrl6 → G par OPS→code (OPS2CODE)
 *   ctrl7 → H sur 24574
 *   ctrl8 → E sur 24574 + total CIRIL E (prélèvement) + drapeau titre (centimes < 0,5)
 *   ctrl9 → F sur 24574
 * PAIE = I[342] ; CHARGES = total CIRIL C − PAIE (dérivés à l'affichage si besoin).
 */
export async function aggregate(files: File[]): Promise<AggregateResult> {
  const found = new Map<string, CtrlData>(); // clé `${entite}|${ctrl}`
  const log: AggregateResult['log'] = [];
  const errors: string[] = [];

  for (const file of files) {
    if (file.name.startsWith('~') || ext(file.name) === '.csv') continue;
    try {
      const { entite, ctrl, data } = await classify(file);
      log.push({ name: file.name, entite, controle: ctrl });
      if (ctrl && entite !== '?') found.set(`${entite}|${ctrl}`, data);
      else if (ctrl && entite === '?')
        errors.push(`${file.name} : contrôle ${ctrl} reconnu mais entité indéterminée.`);
      else errors.push(`${file.name} : contenu non reconnu (aucune signature).`);
    } catch (err) {
      log.push({ name: file.name, entite: '?', controle: 0 });
      errors.push(`${file.name} : ${(err as Error).message?.slice(0, 80) ?? 'erreur de lecture'}`);
    }
  }

  const data: Record<EntiteKey, EntiteData> = { VILLE: emptyEntite(), CCAS: emptyEntite() };

  for (const ent of ['VILLE', 'CCAS'] as EntiteKey[]) {
    const ed = data[ent];
    const byCode = new Map<string, { code: string; libelle: string; valeurs: Partial<Record<ColKey, number>> }>();
    const put = (code: string | null | undefined, col: ColKey, val: number | null | undefined) => {
      if (!code || val == null) return;
      let t = byCode.get(code);
      if (!t) {
        t = { code, libelle: NAMES[code] ?? '', valeurs: {} };
        byCode.set(code, t);
        ed.tiers.push(t);
      }
      t.valeurs[col] = val;
    };

    const g = (ctrl: Ctrl) => found.get(`${ent}|${ctrl}`) as Record<string, unknown> | undefined;
    const d1 = g(1), d2 = g(2), d5 = g(5), d6 = g(6), d7 = g(7), d8 = g(8), d9 = g(9);

    if (d1) {
      const tiers = d1.tiers as Record<string, number>;
      for (const [c, v] of Object.entries(tiers)) put(c, 'C', v);
      if (d1.total != null) ed.totaux.C = d1.total as number;
    }
    if (d2) {
      const tiers = d2.tiers as Record<string, number>;
      for (const [c, v] of Object.entries(tiers)) put(c, 'D', v);
      if (d2.total != null) ed.totaux.D = d2.total as number;
    }
    if (d5) put(TRESO, 'I', d5.total as number | null);
    if (d6) {
      const ops = d6.ops as Record<string, number>;
      for (const [opsName, v] of Object.entries(ops)) put(OPS2CODE[ent][opsName], 'G', v);
    }
    if (d7) put(PAS_TIERS, 'H', d7.total as number);
    if (d8) {
      put(PAS_TIERS, 'E', d8.somme as number | null);
      if (d8.prelev != null) ed.totaux.E = d8.prelev as number;
      if (d8.somme != null && d8.prelev != null) {
        const prelev = d8.prelev as number;
        const cts = round2(prelev - Math.trunc(prelev));
        ed.titrePasFlag = cts < 0.5; // titre d'arrondi si centimes < 0,50
      }
    }
    if (d9) put(PAS_TIERS, 'F', d9.total as number);
  }

  return { data, log, errors };
}
