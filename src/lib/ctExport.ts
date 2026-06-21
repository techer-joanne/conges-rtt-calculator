/**
 * Export Excel (.xlsx) « prêt à l'emploi » du Contrôle Tiers — AVEC mise en page
 * et couleurs (via xlsx-js-style).
 *
 * Reproduit le classeur : Synthèse · Détail Ville · Détail CCAS · VILLE · CCAS
 * (les deux feuilles de données brutes), SANS la page « TACHES ». Données et
 * contrôles déjà calculés — plus besoin de la passe CSV → macro.
 *
 * 100 % navigateur : xlsx-js-style importé à la demande (jamais en SSR). Aucun
 * envoi serveur ; aucun classeur modèle embarqué (dépôt public).
 */
import { PARAM, TOLERANCE, type ColKey, type EcartKey, type EntiteKey, type EntiteResultat } from './controleTiers';

const round2 = (n: number) => Math.round(n * 100) / 100;
const EUR = '#,##0.00" €"';

/* ----------------------------- Palette & styles ----------------------------- */
const NAVY = '16294D';
const AZUR = '4A86C5';
const WHITE = 'FFFFFF';
const GREEN_T = '15803D';
const GREEN_F = 'DCFCE7';
const AMBER_T = 'B45309';
const AMBER_F = 'FEF3C7';
const RED_T = 'B91C1C';
const RED_F = 'FEE2E2';
const GREY = 'D1D5DB';
const SECTION_F = 'E2E8F0';

type Style = Record<string, unknown>;
const thin = { style: 'thin', color: { rgb: GREY } };
const BORDER = { top: thin, bottom: thin, left: thin, right: thin };

const ST: Record<string, Style> = {
  title: { font: { bold: true, sz: 14, color: { rgb: WHITE } }, fill: { fgColor: { rgb: NAVY } }, alignment: { vertical: 'center' } },
  subtitle: { font: { italic: true, sz: 10, color: { rgb: 'DCE6F5' } }, fill: { fgColor: { rgb: NAVY } } },
  header: { font: { bold: true, sz: 10, color: { rgb: WHITE } }, fill: { fgColor: { rgb: AZUR } }, alignment: { horizontal: 'center', vertical: 'center', wrapText: true }, border: BORDER },
  section: { font: { bold: true, sz: 11, color: { rgb: NAVY } }, fill: { fgColor: { rgb: SECTION_F } }, border: BORDER },
  label: { font: { sz: 10 }, alignment: { horizontal: 'left' }, border: BORDER },
  num: { font: { sz: 10 }, alignment: { horizontal: 'right' }, border: BORDER },
  note: { font: { italic: true, sz: 9, color: { rgb: '64748B' } } },
};

const fill = (s: Style, rgb: string): Style => ({ ...s, fill: { fgColor: { rgb } } });
const redText = (s: Style): Style => ({ ...s, font: { ...(s.font as object), bold: true, color: { rgb: RED_T } } });

/* ----------------------------- Modèle de cellule ----------------------------- */
type Cell = { v: string | number; t: 's' | 'n'; z?: string; s?: Style } | null;
const txt = (v: string | number, s?: Style): Cell => ({ v, t: 's', s });
const num = (v: number | undefined, s: Style = ST.num): Cell => (v === undefined ? txt('', s) : { v, t: 'n', z: EUR, s });

/* ----------------------------- Feuilles ----------------------------- */

/** Détail d'une entité (cf. « Détail Ville/CCAS »). */
function detailRows(res: EntiteResultat, titre: string): { rows: Cell[][]; cols: number[]; merges: [number, number, number][] } {
  const P = PARAM[res.entite];
  const v = (code: string, col: ColKey) => res.lignes.find((l) => l.code === code)?.valeurs[col];
  const rows: Cell[][] = [];
  const merges: [number, number, number][] = []; // [row, c0, c1]

  rows.push([txt(titre, ST.title)]);
  merges.push([0, 0, 5]);
  rows.push([txt('Montants par contrôle', ST.subtitle)]);
  merges.push([1, 0, 5]);
  rows.push([]);
  rows.push([
    txt('Tiers', ST.header),
    txt('1 · Génér. budgétaire', ST.header),
    txt('2 · État des charges', ST.header),
    txt('6 · DSN bloc 81', ST.header),
    txt('Écart 1−2', ST.header),
    txt('✓', ST.header),
  ]);

  for (const l of res.lignes) {
    if (l.code === P.pas) continue;
    const c = v(l.code, 'C') ?? 0;
    const d = v(l.code, 'D') ?? 0;
    const g = v(l.code, 'G');
    const ecart = round2(c - d);
    const ok = Math.abs(ecart) <= TOLERANCE;
    const lab = ok ? ST.label : fill(redText(ST.label), RED_F);
    const n = ok ? ST.num : fill(ST.num, RED_F);
    rows.push([
      txt(l.libelle || l.code, lab),
      num(c, n),
      num(d, n),
      g === undefined ? txt('—', { ...n, alignment: { horizontal: 'right' } }) : num(g, n),
      num(ecart, ok ? ST.num : fill(redText(ST.num), RED_F)),
      txt(ok ? '✓' : '!', ok ? fill({ ...ST.num, alignment: { horizontal: 'center' }, font: { bold: true, color: { rgb: GREEN_T } } }, GREEN_F) : fill({ ...ST.num, alignment: { horizontal: 'center' }, font: { bold: true, color: { rgb: RED_T } } }, RED_F)),
    ]);
  }

  rows.push([]);
  rows.push([txt('Bloc 81 URSSAF = URSSAF + URSSAF CSG regroupés. « — » = pas de bloc 81 pour ce tiers.', ST.note)]);
  rows.push([]);

  rows.push([txt('PRÉLÈVEMENT À LA SOURCE (PAS) — contrôles 1 · 7 · 8 · 9', ST.section)]);
  merges.push([rows.length - 1, 0, 5]);
  const pasRow = (label: string, val?: number, accent?: 'amber') => {
    const ls = accent ? fill({ font: { bold: true, color: { rgb: AMBER_T } }, border: BORDER }, AMBER_F) : ST.label;
    const ns = accent ? fill({ font: { bold: true, color: { rgb: AMBER_T } }, alignment: { horizontal: 'right' }, border: BORDER }, AMBER_F) : ST.num;
    rows.push([txt(label, ls), num(val, ns)]);
  };
  pasRow('Génération budgétaire (sans cts)', v(P.pas, 'C'));
  pasRow('Décompte — somme mise en paiement', v(P.pas, 'E'));
  pasRow('Bloc 50 — montant PAS (contrôle 7)', v(P.pas, 'H'));
  pasRow('Journal 1691/1694/1697 (contrôle 9)', v(P.pas, 'F'));
  pasRow('Prélèvement effectué (avec cts)', res.totalPrelevement);
  pasRow('Arrondi du PAS → titre à émettre', res.pasEcartArrondi, 'amber');
  rows.push([]);

  rows.push([txt('VÉRIFICATIONS GLOBALES — contrôles 3 · 5 + bouclage', ST.section)]);
  merges.push([rows.length - 1, 0, 5]);
  const verif = (label: string, val: number | undefined, id: string) => {
    const r = res.reconciliations.find((x) => x.id === id);
    const ok = r?.statut === 'ok';
    const na = r?.statut === 'na' || r === undefined;
    rows.push([
      txt(label, ST.label),
      num(val, ST.num),
      txt(na ? '—' : ok ? '✓ OK' : 'écart', na ? ST.label : ok ? fill({ font: { bold: true, color: { rgb: GREEN_T } }, alignment: { horizontal: 'center' }, border: BORDER }, GREEN_F) : fill({ font: { bold: true, color: { rgb: RED_T } }, alignment: { horizontal: 'center' }, border: BORDER }, RED_F)),
    ]);
  };
  verif('URSSAF détaillé (contrôle 3) = budgétaire + CSG', res.urssaf, 'urssaf');
  verif('Paies numéraires (contrôle 5) = budgétaire', res.totalPaie, 'paies');
  verif('PAIE + CHARGES = total fichier CIRIL', res.totalCiril, 'paie-charges');

  return { rows, cols: [42, 18, 18, 16, 14, 6], merges };
}

/** Synthèse (cf. classeur). */
function syntheseRows(byEnt: Record<EntiteKey, EntiteResultat>): { rows: Cell[][]; cols: number[]; merges: [number, number, number][] } {
  const V = byEnt.VILLE;
  const C = byEnt.CCAS;
  const merges: [number, number, number][] = [];
  const statut = (r: EntiteResultat) => (r.statut === 'ok' ? '✓ ÉQUILIBRÉE' : r.statut === 'ko' ? '✕ ANOMALIE' : '— à compléter');
  const symCell = (r: EntiteResultat, id: string): Cell => {
    const x = r.reconciliations.find((z) => z.id === id);
    const ok = x?.statut === 'ok';
    const na = !x || x.statut === 'na';
    return txt(ok ? '✓' : na ? '—' : '✕', na ? ST.label : ok ? fill({ font: { bold: true, color: { rgb: GREEN_T } }, alignment: { horizontal: 'center' }, border: BORDER }, GREEN_F) : fill({ font: { bold: true, color: { rgb: RED_T } }, alignment: { horizontal: 'center' }, border: BORDER }, RED_F));
  };
  const tiersNulsCell = (r: EntiteResultat): Cell => {
    const ko = r.lignes.some((l) => l.statut === 'ko');
    return txt(ko ? '⚠' : '✓', ko ? fill({ font: { bold: true, color: { rgb: AMBER_T } }, alignment: { horizontal: 'center' }, border: BORDER }, AMBER_F) : fill({ font: { bold: true, color: { rgb: GREEN_T } }, alignment: { horizontal: 'center' }, border: BORDER }, GREEN_F));
  };
  const statutCell = (r: EntiteResultat): Cell => {
    const ok = r.statut === 'ok';
    const na = r.statut === 'na';
    return txt(statut(r), na ? ST.label : ok ? fill({ font: { bold: true, color: { rgb: GREEN_T } }, alignment: { horizontal: 'center' }, border: BORDER }, GREEN_F) : fill({ font: { bold: true, color: { rgb: RED_T } }, alignment: { horizontal: 'center' }, border: BORDER }, RED_F));
  };
  const titreCell = (r: EntiteResultat): Cell =>
    r.titreArrondi
      ? txt(`OUI — ${(r.pasEcartArrondi ?? 0).toFixed(2)} €`, fill({ font: { bold: true, color: { rgb: AMBER_T } }, alignment: { horizontal: 'center' }, border: BORDER }, AMBER_F))
      : txt('non', { ...ST.label, alignment: { horizontal: 'center' } });

  const rows: Cell[][] = [];
  rows.push([txt('CONTRÔLE TIERS — SYNTHÈSE', ST.title)]);
  merges.push([0, 0, 2]);
  rows.push([txt('Mise à jour depuis les fichiers chargés (Ville & CCAS)', ST.subtitle)]);
  merges.push([1, 0, 2]);
  rows.push([]);
  rows.push([txt('', ST.header), txt('VILLE', ST.header), txt('CCAS', ST.header)]);
  rows.push([txt('Statut de la paie', ST.section), statutCell(V), statutCell(C)]);
  rows.push([]);
  rows.push([txt('RÉCONCILIATIONS (doivent toutes être ✓)', ST.section)]);
  merges.push([rows.length - 1, 0, 2]);
  const reco = (label: string, id: string) => rows.push([txt(label, ST.label), symCell(V, id), symCell(C, id)]);
  reco('PAIE + CHARGES = Génération budgétaire', 'paie-charges');
  reco('Totaux budgétaire & état des charges cohérents', 'budget-charges');
  reco('URSSAF concordant', 'urssaf');
  reco('Paies numéraires = budgétaire', 'paies');
  reco('PAS : bloc 50 − régul = journal = décompte', 'pas');
  rows.push([txt('Écarts par tiers nuls (hors arrondi PAS)', ST.label), tiersNulsCell(V), tiersNulsCell(C)]);
  rows.push([]);
  rows.push([txt('CHIFFRES CLÉS', ST.section)]);
  merges.push([rows.length - 1, 0, 2]);
  const chiffre = (label: string, a?: number, b?: number) => rows.push([txt(label, ST.label), num(a, ST.num), num(b, ST.num)]);
  chiffre('Total du fichier généré CIRIL', V.totalCiril, C.totalCiril);
  chiffre('dont PAIE — traitements', V.totalPaie, C.totalPaie);
  chiffre('dont CHARGES', V.totalCharges, C.totalCharges);
  rows.push([]);
  rows.push([txt("POINT D'ATTENTION", ST.section)]);
  merges.push([rows.length - 1, 0, 2]);
  rows.push([txt("Titre d'arrondi du PAS à émettre ?", ST.label), titreCell(V), titreCell(C)]);

  return { rows, cols: [46, 18, 18], merges };
}

/** Feuille de données brute d'une entité (cf. « VILLE » / « CCAS ») : matrice C→I + écarts J→O. */
function rawRows(res: EntiteResultat): { rows: Cell[][]; cols: number[]; merges: [number, number, number][] } {
  const COLS: ColKey[] = ['C', 'D', 'E', 'F', 'G', 'H', 'I'];
  const ECARTS: EcartKey[] = ['J', 'K', 'L', 'M', 'N', 'O'];
  const headers = [
    'Tiers',
    'Code Tiers',
    '1 · Génér. budgétaire',
    '2 · État des charges',
    '8 · Décompte PAS (24574)',
    '9 · Prélèvement / journal (24587)',
    '6 · DSN bloc 81',
    '7 · DSN bloc 50 (av. régul 56)',
    '5 · Paies numéraires',
    'J · Écart C−D',
    'K · Écart bloc 81 − C',
    'L · Écart bloc 81 − D',
    'M · Écart bloc 50 (D+H−F)',
    'N · Écart I − C',
    'O · Écart I − D',
  ];
  const rows: Cell[][] = [];
  rows.push(headers.map((h) => txt(h, ST.header)));
  for (const l of res.lignes) {
    const cells: Cell[] = [txt(l.libelle || l.code, ST.label), txt(l.code, { ...ST.label, alignment: { horizontal: 'center' } })];
    for (const k of COLS) cells.push(num(l.valeurs[k], ST.num));
    for (const k of ECARTS) {
      const e = l.ecarts[k];
      const ko = e !== undefined && Math.abs(e) > TOLERANCE && l.statut === 'ko';
      cells.push(num(e, ko ? fill(redText(ST.num), RED_F) : ST.num));
    }
    rows.push(cells);
  }
  // Ligne total fichier CIRIL.
  const tot: Cell[] = [txt('TOTAL FICHIER CIRIL', ST.section), txt('', ST.section)];
  for (const k of COLS) tot.push(num(res.totaux[k], { ...ST.num, font: { bold: true } }));
  for (let i = 0; i < ECARTS.length; i++) tot.push(txt('', ST.section));
  rows.push(tot);

  return { rows, cols: [40, 11, ...Array(13).fill(15)], merges: [] };
}

/* ----------------------------- Assemblage & téléchargement ----------------------------- */

/** Construit le classeur stylé et renvoie ses octets (.xlsx). Testable hors navigateur. */
export async function buildControleXlsxBytes(results: EntiteResultat[]): Promise<Uint8Array> {
  // Interop CJS/ESM : selon le bundler, l'API est sur le namespace ou sur `.default`.
  const mod = await import('xlsx-js-style');
  const XLSX: typeof import('xlsx-js-style') =
    (mod as { default?: typeof import('xlsx-js-style') }).default ?? mod;
  const byEnt = Object.fromEntries(results.map((r) => [r.entite, r])) as Record<EntiteKey, EntiteResultat>;

  // Construit une feuille à partir de cellules typées (en gardant les styles).
  const makeSheet = (built: { rows: Cell[][]; cols: number[]; merges: [number, number, number][] }) => {
    const { rows, cols, merges } = built;
    const ws: Record<string, unknown> = {};
    let maxc = 0;
    rows.forEach((row, r) => {
      row.forEach((cell, c) => {
        if (!cell) return;
        ws[XLSX.utils.encode_cell({ r, c })] = { v: cell.v, t: cell.t, ...(cell.z ? { z: cell.z } : {}), ...(cell.s ? { s: cell.s } : {}) };
        if (c > maxc) maxc = c;
      });
    });
    ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(rows.length - 1, 0), c: maxc } });
    ws['!cols'] = cols.map((wch) => ({ wch }));
    if (merges.length) ws['!merges'] = merges.map(([r, c0, c1]) => ({ s: { r, c: c0 }, e: { r, c: c1 } }));
    return ws as import('xlsx-js-style').WorkSheet;
  };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, makeSheet(syntheseRows(byEnt)), 'Synthèse');
  if (byEnt.VILLE) XLSX.utils.book_append_sheet(wb, makeSheet(detailRows(byEnt.VILLE, 'DÉTAIL VILLE')), 'Détail Ville');
  if (byEnt.CCAS) XLSX.utils.book_append_sheet(wb, makeSheet(detailRows(byEnt.CCAS, 'DÉTAIL CCAS')), 'Détail CCAS');
  if (byEnt.VILLE) XLSX.utils.book_append_sheet(wb, makeSheet(rawRows(byEnt.VILLE)), 'VILLE');
  if (byEnt.CCAS) XLSX.utils.book_append_sheet(wb, makeSheet(rawRows(byEnt.CCAS)), 'CCAS');

  return XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as Uint8Array;
}

/** Génère le classeur et déclenche le téléchargement (navigateur). */
export async function exportControleXlsx(results: EntiteResultat[]): Promise<void> {
  const out = await buildControleXlsxBytes(results);
  const blob = new Blob([out as unknown as BlobPart], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'controle_tiers.xlsx';
  a.click();
  URL.revokeObjectURL(url);
}
