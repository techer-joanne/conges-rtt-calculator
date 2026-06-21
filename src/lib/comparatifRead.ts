/**
 * Lecture des fichiers du Comparatif NET dans le navigateur (lazy SheetJS).
 * Aucun envoi serveur.
 *
 * SÉCURITÉ : la LECTURE de fichiers (potentiellement non maîtrisés) passe par
 * `xlsx` 0.20.3 (corrige la pollution de prototype CVE-2023-30533 et le ReDoS
 * CVE-2024-22363). xlsx-js-style (fork figé sur 0.18.5) est réservé à l'ÉCRITURE
 * (export), qui ne parse aucune entrée hostile.
 */

export interface ReadWb {
  names: string[];
  rows: (name?: string) => string[][];
}

/** Lit un classeur et expose ses noms de feuilles + un accès aux lignes (string[][]). */
export async function readWorkbook(file: File): Promise<ReadWb> {
  const XLSX = await import('xlsx');
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
