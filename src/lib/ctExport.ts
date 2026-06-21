/**
 * Export Excel (.xlsx) « prêt à l'emploi » du Contrôle Tiers — mise en forme
 * COULEUR COMPLÈTE (via xlsx-js-style), sans cellule blanche.
 *
 * Feuilles : Synthèse · Détail Ville · Détail CCAS · VILLE · CCAS (données
 * brutes), SANS « TACHES ». Données et contrôles déjà calculés.
 *
 * 100 % navigateur : xlsx-js-style importé à la demande. Aucun envoi serveur ;
 * aucun classeur modèle embarqué (dépôt public).
 */
import { PARAM, TOLERANCE, type ColKey, type EcartKey, type EntiteKey, type EntiteResultat } from './controleTiers';

const round2 = (n: number) => Math.round(n * 100) / 100;
const EUR = '#,##0.00" €"';

/* ----------------------------- Palette ----------------------------- */
const NAVY = '16294D';
const AZUR = '4A86C5';
const WHITE = 'FFFFFF';
const ZEBRA1 = 'EAF1FA'; // bleu très clair
const ZEBRA2 = 'DCE7F4'; // bleu clair (alternance)
const SECTION_F = 'C7D7EC'; // bleu moyen clair (sections / totaux)
const PAGE = 'E3ECF7'; // fond des séparateurs / notes
const GREEN_T = '15803D';
const GREEN_F = 'C6F0CE';
const AMBER_T = '92400E';
const AMBER_F = 'FCE9B6';
const RED_T = 'B91C1C';
const RED_F = 'F8C9CC';

type Style = Record<string, unknown>;
const thin = { style: 'thin', color: { rgb: 'B8C6DD' } };
const BORDER = { top: thin, bottom: thin, left: thin, right: thin };

const ST: Record<string, Style> = {
  title: { font: { bold: true, sz: 14, color: { rgb: WHITE } }, fill: { fgColor: { rgb: NAVY } }, alignment: { vertical: 'center' } },
  subtitle: { font: { italic: true, sz: 10, color: { rgb: 'CFE0F4' } }, fill: { fgColor: { rgb: NAVY } } },
  header: { font: { bold: true, sz: 10, color: { rgb: WHITE } }, fill: { fgColor: { rgb: AZUR } }, alignment: { horizontal: 'center', vertical: 'center', wrapText: true } },
  section: { font: { bold: true, sz: 11, color: { rgb: NAVY } }, fill: { fgColor: { rgb: SECTION_F } } },
  label: { font: { sz: 10, color: { rgb: '1E293B' } }, alignment: { horizontal: 'left' } },
  num: { font: { sz: 10, color: { rgb: '1E293B' } }, alignment: { horizontal: 'right' } },
  note: { font: { italic: true, sz: 9, color: { rgb: '475569' } } },
};
const status = (kind: 'ok' | 'ko' | 'amber' | 'na'): Style => {
  if (kind === 'ok') return { font: { bold: true, color: { rgb: GREEN_T } }, fill: { fgColor: { rgb: GREEN_F } }, alignment: { horizontal: 'center' } };
  if (kind === 'ko') return { font: { bold: true, color: { rgb: RED_T } }, fill: { fgColor: { rgb: RED_F } }, alignment: { horizontal: 'center' } };
  if (kind === 'amber') return { font: { bold: true, color: { rgb: AMBER_T } }, fill: { fgColor: { rgb: AMBER_F } }, alignment: { horizontal: 'center' } };
  return { ...ST.label, alignment: { horizontal: 'center' } };
};
const redInk = (s: Style): Style => ({ ...s, font: { ...(s.font as object), bold: true, color: { rgb: RED_T } } });
const amberInk = (s: Style): Style => ({ ...s, font: { ...(s.font as object), bold: true, color: { rgb: AMBER_T } } });

/* ----------------------------- Modèle ----------------------------- */
type Cell = { v: string | number; t: 's' | 'n'; z?: string; s?: Style } | null;
type Row = { cells: Cell[]; bg: string; border?: boolean };
type Built = { rows: Row[]; cols: number[]; merges: [number, number, number][] };

const txt = (v: string | number, s?: Style): Cell => ({ v, t: 's', s });
const num = (v: number | undefined, s: Style = ST.num): Cell => (v === undefined ? txt('', s) : { v, t: 'n', z: EUR, s });

/* ----------------------------- Détail entité ----------------------------- */
function detailRows(res: EntiteResultat, titre: string): Built {
  const P = PARAM[res.entite];
  const v = (code: string, col: ColKey) => res.lignes.find((l) => l.code === code)?.valeurs[col];
  const rows: Row[] = [];
  const merges: [number, number, number][] = [];

  rows.push({ cells: [txt(titre, ST.title)], bg: NAVY, border: false });
  merges.push([0, 0, 5]);
  rows.push({ cells: [txt('Montants par contrôle', ST.subtitle)], bg: NAVY, border: false });
  merges.push([1, 0, 5]);
  rows.push({ cells: [], bg: PAGE, border: false });
  rows.push({
    cells: [txt('Tiers', ST.header), txt('1 · Génér. budgétaire', ST.header), txt('2 · État des charges', ST.header), txt('6 · DSN bloc 81', ST.header), txt('Écart 1−2', ST.header), txt('✓', ST.header)],
    bg: AZUR,
  });

  let z = 0;
  for (const l of res.lignes) {
    if (l.code === P.pas) continue;
    const c = v(l.code, 'C') ?? 0;
    const d = v(l.code, 'D') ?? 0;
    const g = v(l.code, 'G');
    const ecart = round2(c - d);
    const ok = Math.abs(ecart) <= TOLERANCE;
    const bg = ok ? (z++ % 2 ? ZEBRA2 : ZEBRA1) : RED_F;
    rows.push({
      bg,
      cells: [
        txt(l.libelle || l.code, ok ? ST.label : redInk(ST.label)),
        num(c, ok ? ST.num : redInk(ST.num)),
        num(d, ok ? ST.num : redInk(ST.num)),
        g === undefined ? txt('—', { ...ST.num }) : num(g, ok ? ST.num : redInk(ST.num)),
        num(ecart, ok ? ST.num : redInk(ST.num)),
        txt(ok ? '✓' : '!', status(ok ? 'ok' : 'ko')),
      ],
    });
  }

  rows.push({ cells: [txt('Bloc 81 URSSAF = URSSAF + URSSAF CSG regroupés. « — » = pas de bloc 81 pour ce tiers.', ST.note)], bg: PAGE, border: false });
  rows.push({ cells: [], bg: PAGE, border: false });

  rows.push({ cells: [txt('PRÉLÈVEMENT À LA SOURCE (PAS) — contrôles 1 · 7 · 8 · 9', ST.section)], bg: SECTION_F });
  merges.push([rows.length - 1, 0, 5]);
  let zp = 0;
  const pasRow = (label: string, val?: number, amber?: boolean) => {
    const bg = amber ? AMBER_F : zp++ % 2 ? ZEBRA2 : ZEBRA1;
    rows.push({ bg, cells: [txt(label, amber ? amberInk(ST.label) : ST.label), num(val, amber ? amberInk(ST.num) : ST.num)] });
  };
  pasRow('Génération budgétaire (sans cts)', v(P.pas, 'C'));
  pasRow('Décompte — somme mise en paiement', v(P.pas, 'E'));
  pasRow('Bloc 50 — montant PAS (contrôle 7)', v(P.pas, 'H'));
  pasRow('Journal 1691/1694/1697 (contrôle 9)', v(P.pas, 'F'));
  pasRow('Prélèvement effectué (avec cts)', res.totalPrelevement);
  pasRow('Arrondi du PAS → titre à émettre', res.pasEcartArrondi, true);
  rows.push({ cells: [], bg: PAGE, border: false });

  rows.push({ cells: [txt('VÉRIFICATIONS GLOBALES — contrôles 3 · 5 + bouclage', ST.section)], bg: SECTION_F });
  merges.push([rows.length - 1, 0, 5]);
  let zv = 0;
  const verif = (label: string, val: number | undefined, id: string) => {
    const r = res.reconciliations.find((x) => x.id === id);
    const k = !r || r.statut === 'na' ? 'na' : r.statut === 'ok' ? 'ok' : 'ko';
    rows.push({ bg: zv++ % 2 ? ZEBRA2 : ZEBRA1, cells: [txt(label, ST.label), num(val, ST.num), txt(k === 'na' ? '—' : k === 'ok' ? '✓ OK' : 'écart', status(k))] });
  };
  verif('URSSAF détaillé (contrôle 3) = budgétaire + CSG', res.urssaf, 'urssaf');
  verif('Paies numéraires (contrôle 5) = budgétaire', res.totalPaie, 'paies');
  verif('PAIE + CHARGES = total fichier CIRIL', res.totalCiril, 'paie-charges');

  return { rows, cols: [42, 18, 18, 16, 14, 6], merges };
}

/* ----------------------------- Synthèse ----------------------------- */
function syntheseRows(byEnt: Record<EntiteKey, EntiteResultat>): Built {
  const V = byEnt.VILLE;
  const C = byEnt.CCAS;
  const merges: [number, number, number][] = [];
  const rows: Row[] = [];
  const statutCell = (r: EntiteResultat): Cell => txt(r.statut === 'ok' ? '✓ ÉQUILIBRÉE' : r.statut === 'ko' ? '✕ ANOMALIE' : '— à compléter', status(r.statut === 'ok' ? 'ok' : r.statut === 'ko' ? 'ko' : 'na'));
  const symCell = (r: EntiteResultat, id: string): Cell => {
    const x = r.reconciliations.find((z) => z.id === id);
    const k = !x || x.statut === 'na' ? 'na' : x.statut === 'ok' ? 'ok' : 'ko';
    return txt(k === 'na' ? '—' : k === 'ok' ? '✓' : '✕', status(k));
  };
  const tiersNulsCell = (r: EntiteResultat): Cell => (r.lignes.some((l) => l.statut === 'ko') ? txt('⚠', status('amber')) : txt('✓', status('ok')));
  const titreCell = (r: EntiteResultat): Cell => (r.titreArrondi ? txt(`OUI — ${(r.pasEcartArrondi ?? 0).toFixed(2)} €`, status('amber')) : txt('non', status('na')));

  rows.push({ cells: [txt('CONTRÔLE TIERS — SYNTHÈSE', ST.title)], bg: NAVY, border: false });
  merges.push([0, 0, 2]);
  rows.push({ cells: [txt('Mise à jour depuis les fichiers chargés (Ville & CCAS)', ST.subtitle)], bg: NAVY, border: false });
  merges.push([1, 0, 2]);
  rows.push({ cells: [], bg: PAGE, border: false });
  rows.push({ cells: [txt('', ST.header), txt('VILLE', ST.header), txt('CCAS', ST.header)], bg: AZUR });
  rows.push({ cells: [txt('Statut de la paie', ST.section), statutCell(V), statutCell(C)], bg: SECTION_F });
  rows.push({ cells: [], bg: PAGE, border: false });
  rows.push({ cells: [txt('RÉCONCILIATIONS (doivent toutes être ✓)', ST.section)], bg: SECTION_F });
  merges.push([rows.length - 1, 0, 2]);
  let z = 0;
  const reco = (label: string, id: string) => rows.push({ bg: z++ % 2 ? ZEBRA2 : ZEBRA1, cells: [txt(label, ST.label), symCell(V, id), symCell(C, id)] });
  reco('PAIE + CHARGES = Génération budgétaire', 'paie-charges');
  reco('Totaux budgétaire & état des charges cohérents', 'budget-charges');
  reco('URSSAF concordant', 'urssaf');
  reco('Paies numéraires = budgétaire', 'paies');
  reco('PAS : bloc 50 − régul = journal = décompte', 'pas');
  rows.push({ bg: z++ % 2 ? ZEBRA2 : ZEBRA1, cells: [txt('Écarts par tiers nuls (hors arrondi PAS)', ST.label), tiersNulsCell(V), tiersNulsCell(C)] });
  rows.push({ cells: [], bg: PAGE, border: false });
  rows.push({ cells: [txt('CHIFFRES CLÉS', ST.section)], bg: SECTION_F });
  merges.push([rows.length - 1, 0, 2]);
  let z2 = 0;
  const chiffre = (label: string, a?: number, b?: number) => rows.push({ bg: z2++ % 2 ? ZEBRA2 : ZEBRA1, cells: [txt(label, ST.label), num(a, ST.num), num(b, ST.num)] });
  chiffre('Total du fichier généré CIRIL', V.totalCiril, C.totalCiril);
  chiffre('dont PAIE — traitements', V.totalPaie, C.totalPaie);
  chiffre('dont CHARGES', V.totalCharges, C.totalCharges);
  rows.push({ cells: [], bg: PAGE, border: false });
  rows.push({ cells: [txt("POINT D'ATTENTION", ST.section)], bg: SECTION_F });
  merges.push([rows.length - 1, 0, 2]);
  rows.push({ bg: ZEBRA1, cells: [txt("Titre d'arrondi du PAS à émettre ?", ST.label), titreCell(V), titreCell(C)] });

  return { rows, cols: [46, 18, 18], merges };
}

/* ----------------------------- Données brutes (VILLE / CCAS) ----------------------------- */
function rawRows(res: EntiteResultat): Built {
  const COLS: ColKey[] = ['C', 'D', 'E', 'F', 'G', 'H', 'I'];
  const ECARTS: EcartKey[] = ['J', 'K', 'L', 'M', 'N', 'O'];
  const headers = ['Tiers', 'Code Tiers', '1 · Génér. budgétaire', '2 · État des charges', '8 · Décompte PAS (24574)', '9 · Prélèvement / journal (24587)', '6 · DSN bloc 81', '7 · DSN bloc 50 (av. régul 56)', '5 · Paies numéraires', 'J · Écart C−D', 'K · Écart bloc 81 − C', 'L · Écart bloc 81 − D', 'M · Écart bloc 50 (D+H−F)', 'N · Écart I − C', 'O · Écart I − D'];
  const rows: Row[] = [];
  rows.push({ cells: headers.map((h) => txt(h, ST.header)), bg: AZUR });

  let z = 0;
  for (const l of res.lignes) {
    const ko = l.statut === 'ko';
    const bg = ko ? RED_F : z++ % 2 ? ZEBRA2 : ZEBRA1;
    const cells: Cell[] = [txt(l.libelle || l.code, ko ? redInk(ST.label) : ST.label), txt(l.code, { ...ST.label, alignment: { horizontal: 'center' } })];
    for (const k of COLS) cells.push(num(l.valeurs[k], ST.num));
    for (const k of ECARTS) {
      const e = l.ecarts[k];
      const bad = e !== undefined && Math.abs(e) > TOLERANCE && ko;
      cells.push(num(e, bad ? redInk(ST.num) : ST.num));
    }
    rows.push({ bg, cells });
  }
  const tot: Cell[] = [txt('TOTAL FICHIER CIRIL', ST.section), txt('', ST.section)];
  for (const k of COLS) tot.push(num(res.totaux[k], { ...ST.section, alignment: { horizontal: 'right' } }));
  for (let i = 0; i < ECARTS.length; i++) tot.push(txt('', ST.section));
  rows.push({ bg: SECTION_F, cells: tot });

  return { rows, cols: [40, 11, ...Array(13).fill(15)], merges: [] };
}

/* ----------------------------- Assemblage & téléchargement ----------------------------- */
export async function buildControleXlsxBytes(results: EntiteResultat[]): Promise<Uint8Array> {
  const mod = await import('xlsx-js-style');
  const XLSX: typeof import('xlsx-js-style') = (mod as { default?: typeof import('xlsx-js-style') }).default ?? mod;
  const byEnt = Object.fromEntries(results.map((r) => [r.entite, r])) as Record<EntiteKey, EntiteResultat>;

  const makeSheet = ({ rows, cols, merges }: Built) => {
    const ncols = cols.length;
    const ws: Record<string, unknown> = {};
    rows.forEach((row, r) => {
      for (let c = 0; c < ncols; c++) {
        const cell = row.cells[c] ?? null;
        const base: Style = cell?.s ? { ...cell.s } : {};
        if (!base.fill) base.fill = { fgColor: { rgb: row.bg } };
        if (row.border !== false) base.border = BORDER;
        const addr = XLSX.utils.encode_cell({ r, c });
        ws[addr] = cell
          ? { v: cell.v, t: cell.t, ...(cell.z ? { z: cell.z } : {}), s: base }
          : { v: '', t: 's', s: base };
      }
    });
    ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(rows.length - 1, 0), c: Math.max(ncols - 1, 0) } });
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
