/**
 * Export Excel stylé du Comparatif NET (cf. macro Comparatif_NET_par_train.bas) :
 * feuille GLOBAL + un onglet par train + « A AFFECTER ». Colonnes ÉCART &
 * COMMENTAIRE sur fond jaune, ÉCART en € (rouge si négatif, vert si positif).
 * 100 % navigateur.
 */
import { A_AFFECTER, type AgentRow, type ComparatifResult } from './comparatif';
import {
  AZUR,
  type Built,
  type Cell,
  GREEN_T,
  NAVY,
  PAGE,
  RED_T,
  SECTION_F,
  ST,
  type Style,
  YELLOW_F,
  ZEBRA1,
  ZEBRA2,
  downloadXlsx,
  loadXLSX,
  num,
  sheetFromBuilt,
  txt,
} from './xlsxStyle';

const COLS = [10, 22, 16, 28, 8, 18, 12, 30, 14, 14, 14, 26];
const ecartStyle = (v: number): Style => ({
  font: { sz: 10, bold: true, color: { rgb: v < -0.005 ? RED_T : v > 0.005 ? GREEN_T : '1E293B' } },
  alignment: { horizontal: 'right' },
  fill: { fgColor: { rgb: YELLOW_F } },
});
const yellowCell = (): Style => ({ fill: { fgColor: { rgb: YELLOW_F } } });

function sheetBuilt(title: string, agents: AgentRow[], mois: { m1: string; m2: string }): Built {
  const rows: Built['rows'] = [];
  const merges: [number, number, number][] = [];

  rows.push({ cells: [txt(title, ST.title)], bg: NAVY, border: false });
  merges.push([0, 0, 11]);
  rows.push({ cells: [txt(`Comparatif NET à payer · ${mois.m1} → ${mois.m2}`, ST.subtitle)], bg: NAVY, border: false });
  merges.push([1, 0, 11]);
  rows.push({ cells: [], bg: PAGE, border: false });

  rows.push({
    bg: AZUR,
    cells: [
      txt('Étab.', ST.header),
      txt('Lib. Établissement', ST.header),
      txt('Position', ST.header),
      txt('Lib. position', ST.header),
      txt('Train', ST.header),
      txt('Lib. Train', ST.header),
      txt('Matricule', ST.header),
      txt('Identité', ST.header),
      txt(mois.m1, ST.header),
      txt(mois.m2, ST.header),
      txt('ÉCART', ST.headerYellow),
      txt('COMMENTAIRE', ST.headerYellow),
    ],
  });

  let z = 0;
  for (const a of agents) {
    rows.push({
      bg: z++ % 2 ? ZEBRA2 : ZEBRA1,
      cells: [
        txt(a.etab, ST.label),
        txt(a.libEtab, ST.label),
        txt(a.pos, { ...ST.label, alignment: { horizontal: 'center' } }),
        txt(a.libPos, ST.label),
        txt(a.trainNo === '' ? '' : a.trainNo, { ...ST.label, alignment: { horizontal: 'center' } }),
        txt(a.trainLib, ST.label),
        txt(a.matricule, { ...ST.label, alignment: { horizontal: 'center' } }),
        txt(a.identite, ST.label),
        num(a.m1, ST.num),
        num(a.m2, ST.num),
        num(a.ecart, ecartStyle(a.ecart)),
        txt('', yellowCell()),
      ],
    });
  }

  // Total de la feuille.
  const t1 = agents.reduce((s, a) => s + (a.m1 ?? 0), 0);
  const t2 = agents.reduce((s, a) => s + (a.m2 ?? 0), 0);
  const te = Math.round((t2 - t1) * 100) / 100;
  const totCells: Cell[] = [
    txt('TOTAL', ST.section),
    ...Array(7).fill(null).map(() => txt('', ST.section)),
    num(Math.round(t1 * 100) / 100, { ...ST.section, alignment: { horizontal: 'right' } }),
    num(Math.round(t2 * 100) / 100, { ...ST.section, alignment: { horizontal: 'right' } }),
    num(te, { ...ST.section, alignment: { horizontal: 'right' } }),
    txt('', ST.section),
  ];
  rows.push({ bg: SECTION_F, cells: totCells });

  return { rows, cols: COLS, merges };
}

/** Nom d'onglet court & valide (cf. NomOnglet de la macro). */
function nomOnglet(lib: string, used: Set<string>): string {
  let s = lib === A_AFFECTER ? 'A AFFECTER' : lib.replace(/Train/gi, '').replace(/Ville/gi, '').replace(/\s+/g, ' ').trim().toUpperCase();
  s = s.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || 'TRAIN';
  let name = s;
  let i = 2;
  while (used.has(name)) name = `${s.slice(0, 28)} ${i++}`;
  used.add(name);
  return name;
}

export async function buildComparatifXlsxBytes(res: ComparatifResult): Promise<Uint8Array> {
  const XLSX = await loadXLSX();
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheetFromBuilt(XLSX, sheetBuilt('GLOBAL', res.agents, res.mois)), 'GLOBAL');
  const used = new Set<string>(['GLOBAL']);
  for (const g of res.trains) {
    XLSX.utils.book_append_sheet(wb, sheetFromBuilt(XLSX, sheetBuilt(g.lib, g.agents, res.mois)), nomOnglet(g.lib, used));
  }
  return XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as Uint8Array;
}

export async function exportComparatifXlsx(res: ComparatifResult): Promise<void> {
  downloadXlsx(await buildComparatifXlsxBytes(res), 'comparatif_net_par_train.xlsx');
}
