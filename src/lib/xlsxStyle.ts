/**
 * Briques partagées pour l'export Excel stylé (xlsx-js-style) : palette « charte »,
 * styles réutilisables, modèle de cellules/lignes et conversion en feuille.
 * Utilisé par ctExport (Contrôle Tiers) et comparatifExport (Comparatif NET).
 */

export const EUR = '#,##0.00" €"';

/* Palette */
export const NAVY = '16294D';
export const AZUR = '4A86C5';
export const WHITE = 'FFFFFF';
export const ZEBRA1 = 'EAF1FA';
export const ZEBRA2 = 'DCE7F4';
export const SECTION_F = 'C7D7EC';
export const PAGE = 'E3ECF7';
export const GREEN_T = '15803D';
export const GREEN_F = 'C6F0CE';
export const AMBER_T = '92400E';
export const AMBER_F = 'FCE9B6';
export const RED_T = 'B91C1C';
export const RED_F = 'F8C9CC';
export const YELLOW_F = 'FFF2CC'; // ECART / COMMENTAIRE (cf. macro)

export type Style = Record<string, unknown>;
const thin = { style: 'thin', color: { rgb: 'B8C6DD' } };
export const BORDER = { top: thin, bottom: thin, left: thin, right: thin };

export const ST: Record<string, Style> = {
  title: { font: { bold: true, sz: 14, color: { rgb: WHITE } }, fill: { fgColor: { rgb: NAVY } }, alignment: { vertical: 'center' } },
  subtitle: { font: { italic: true, sz: 10, color: { rgb: 'CFE0F4' } }, fill: { fgColor: { rgb: NAVY } } },
  header: { font: { bold: true, sz: 10, color: { rgb: WHITE } }, fill: { fgColor: { rgb: AZUR } }, alignment: { horizontal: 'center', vertical: 'center', wrapText: true } },
  headerYellow: { font: { bold: true, sz: 10, color: { rgb: '7A5B00' } }, fill: { fgColor: { rgb: YELLOW_F } }, alignment: { horizontal: 'center', vertical: 'center', wrapText: true } },
  section: { font: { bold: true, sz: 11, color: { rgb: NAVY } }, fill: { fgColor: { rgb: SECTION_F } } },
  label: { font: { sz: 10, color: { rgb: '1E293B' } }, alignment: { horizontal: 'left' } },
  num: { font: { sz: 10, color: { rgb: '1E293B' } }, alignment: { horizontal: 'right' } },
  note: { font: { italic: true, sz: 9, color: { rgb: '475569' } } },
};

export const status = (kind: 'ok' | 'ko' | 'amber' | 'na'): Style => {
  if (kind === 'ok') return { font: { bold: true, color: { rgb: GREEN_T } }, fill: { fgColor: { rgb: GREEN_F } }, alignment: { horizontal: 'center' } };
  if (kind === 'ko') return { font: { bold: true, color: { rgb: RED_T } }, fill: { fgColor: { rgb: RED_F } }, alignment: { horizontal: 'center' } };
  if (kind === 'amber') return { font: { bold: true, color: { rgb: AMBER_T } }, fill: { fgColor: { rgb: AMBER_F } }, alignment: { horizontal: 'center' } };
  return { ...ST.label, alignment: { horizontal: 'center' } };
};
export const redInk = (s: Style): Style => ({ ...s, font: { ...(s.font as object), bold: true, color: { rgb: RED_T } } });
export const amberInk = (s: Style): Style => ({ ...s, font: { ...(s.font as object), bold: true, color: { rgb: AMBER_T } } });

export type Cell = { v: string | number; t: 's' | 'n'; z?: string; s?: Style } | null;
export type Row = { cells: Cell[]; bg: string; border?: boolean };
export type Built = { rows: Row[]; cols: number[]; merges: [number, number, number][] };

export const txt = (v: string | number, s?: Style): Cell => ({ v, t: 's', s });
export const num = (v: number | undefined, s: Style = ST.num): Cell =>
  v === undefined ? txt('', s) : { v, t: 'n', z: EUR, s };

/** Convertit un « Built » en feuille xlsx-js-style : toute la plage est remplie
 *  (fond de ligne par défaut → aucune cellule blanche). */
export function sheetFromBuilt(
  XLSX: typeof import('xlsx-js-style'),
  { rows, cols, merges }: Built,
): import('xlsx-js-style').WorkSheet {
  const ncols = cols.length;
  const ws: Record<string, unknown> = {};
  rows.forEach((row, r) => {
    for (let c = 0; c < ncols; c++) {
      const cell = row.cells[c] ?? null;
      const base: Style = cell?.s ? { ...cell.s } : {};
      if (!base.fill) base.fill = { fgColor: { rgb: row.bg } };
      if (row.border !== false) base.border = BORDER;
      ws[XLSX.utils.encode_cell({ r, c })] = cell
        ? { v: cell.v, t: cell.t, ...(cell.z ? { z: cell.z } : {}), s: base }
        : { v: '', t: 's', s: base };
    }
  });
  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(rows.length - 1, 0), c: Math.max(ncols - 1, 0) } });
  ws['!cols'] = cols.map((wch) => ({ wch }));
  if (merges.length) ws['!merges'] = merges.map(([r, c0, c1]) => ({ s: { r, c: c0 }, e: { r, c: c1 } }));
  return ws as import('xlsx-js-style').WorkSheet;
}

/** Import paresseux + interop CJS/ESM de xlsx-js-style. */
export async function loadXLSX(): Promise<typeof import('xlsx-js-style')> {
  const mod = await import('xlsx-js-style');
  return (mod as { default?: typeof import('xlsx-js-style') }).default ?? mod;
}

/** Télécharge des octets .xlsx (navigateur). */
export function downloadXlsx(bytes: Uint8Array, filename: string): void {
  const blob = new Blob([bytes as unknown as BlobPart], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
