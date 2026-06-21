/**
 * Lecture des fichiers du Comparatif NET dans le navigateur (lazy SheetJS).
 * Aucun envoi serveur. xlsx-js-style sait lire xlsx/xlsm/xls/slk.
 */
import { loadXLSX } from './xlsxStyle';

export interface ReadWb {
  names: string[];
  rows: (name?: string) => string[][];
}

/** Lit un classeur et expose ses noms de feuilles + un accès aux lignes (string[][]). */
export async function readWorkbook(file: File): Promise<ReadWb> {
  const XLSX = await loadXLSX();
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(new Uint8Array(buf), { type: 'array' });
  return {
    names: wb.SheetNames,
    rows: (name) => {
      const nm = name && wb.SheetNames.includes(name) ? name : wb.SheetNames[0];
      const ws = wb.Sheets[nm];
      if (!ws) return [];
      return XLSX.utils
        .sheet_to_json<unknown[]>(ws, { header: 1, raw: false, defval: '' })
        .map((r) => (r ?? []).map((c) => (c == null ? '' : String(c))));
    },
  };
}
