/**
 * Export Excel (.xlsx) « prêt à l'emploi » du Contrôle Tiers.
 *
 * Reproduit les feuilles utiles du classeur (Synthèse · Détail Ville · Détail
 * CCAS) avec les données chargées et les contrôles DÉJÀ calculés — sans macro,
 * sans import CSV, et SANS la page « TACHES ». Plus besoin de la passe
 * « Exporter le CSV → ImporterControleTiers ».
 *
 * 100 % navigateur : `xlsx` est importé à la demande (jamais en SSR). Aucune
 * donnée n'est envoyée à un serveur ; aucun fichier modèle n'est embarqué
 * (le dépôt est public, on ne committe donc aucune donnée de paie).
 */
import { PARAM, TOLERANCE, type ColKey, type EntiteKey, type EntiteResultat } from './controleTiers';

const round2 = (n: number) => Math.round(n * 100) / 100;
const EUR = '#,##0.00" €"';

type Cell = string | number | undefined;

/** Feuille « Détail » d'une entité (cf. classeur « Détail Ville/CCAS »). */
function detailAoa(res: EntiteResultat, titre: string): Cell[][] {
  const P = PARAM[res.entite];
  const v = (code: string, col: ColKey) => res.lignes.find((l) => l.code === code)?.valeurs[col];
  const rows: Cell[][] = [];

  rows.push([titre]);
  rows.push(['Montants par contrôle']);
  rows.push([]);
  rows.push(['Tiers', '1 · Génér. budgétaire', '2 · État des charges', '6 · DSN bloc 81', 'Écart 1−2', '✓']);

  for (const l of res.lignes) {
    if (l.code === P.pas) continue; // le PAS a son propre bloc
    const c = v(l.code, 'C') ?? 0;
    const d = v(l.code, 'D') ?? 0;
    const g = v(l.code, 'G');
    const ecart = round2(c - d);
    const ok = Math.abs(ecart) <= TOLERANCE;
    rows.push([l.libelle || l.code, c, d, g === undefined ? '—' : g, ecart, ok ? '✓' : '!']);
  }

  rows.push([]);
  rows.push(['Bloc 81 URSSAF = URSSAF + URSSAF CSG regroupés. « — » = pas de bloc 81 pour ce tiers.']);
  rows.push([]);

  rows.push(['PRÉLÈVEMENT À LA SOURCE (PAS) — contrôles 1 · 7 · 8 · 9']);
  rows.push(['Génération budgétaire (sans cts)', v(P.pas, 'C')]);
  rows.push(['Décompte — somme mise en paiement', v(P.pas, 'E')]);
  rows.push(['Bloc 50 — montant PAS (contrôle 7)', v(P.pas, 'H')]);
  rows.push(['Journal 1691/1694/1697 (contrôle 9)', v(P.pas, 'F')]);
  rows.push(['Prélèvement effectué (avec cts)', res.totalPrelevement]);
  rows.push(['Arrondi du PAS → titre à émettre', res.pasEcartArrondi]);
  rows.push([]);

  const st = (id: string) => {
    const r = res.reconciliations.find((x) => x.id === id);
    return r?.statut === 'ok' ? '✓ OK' : r?.statut === 'ko' ? 'écart' : '—';
  };
  rows.push(['VÉRIFICATIONS GLOBALES — contrôles 3 · 5 + bouclage']);
  rows.push(['URSSAF détaillé (contrôle 3) = budgétaire + CSG', res.urssaf, st('urssaf')]);
  rows.push(['Paies numéraires (contrôle 5) = budgétaire', res.totalPaie, st('paies')]);
  rows.push(['PAIE + CHARGES = total fichier CIRIL', res.totalCiril, st('paie-charges')]);

  return rows;
}

/** Feuille « Synthèse » (cf. classeur). */
function syntheseAoa(byEnt: Record<EntiteKey, EntiteResultat>): Cell[][] {
  const V = byEnt.VILLE;
  const C = byEnt.CCAS;
  const statut = (r: EntiteResultat) =>
    r.statut === 'ok' ? '✓ ÉQUILIBRÉE' : r.statut === 'ko' ? '✕ ANOMALIE' : '— à compléter';
  const sym = (r: EntiteResultat, id: string) => {
    const x = r.reconciliations.find((z) => z.id === id);
    return x?.statut === 'ok' ? '✓' : x?.statut === 'ko' ? '✕' : '—';
  };
  const tiersNuls = (r: EntiteResultat) => (r.lignes.some((l) => l.statut === 'ko') ? '⚠' : '✓');
  const titre = (r: EntiteResultat) => (r.titreArrondi ? `OUI — ${(r.pasEcartArrondi ?? 0).toFixed(2)} €` : 'non');

  return [
    ['CONTRÔLE TIERS — SYNTHÈSE'],
    ['Mise à jour depuis les fichiers chargés (Ville & CCAS)'],
    [],
    ['', 'VILLE', 'CCAS'],
    ['Statut de la paie', statut(V), statut(C)],
    [],
    ['RÉCONCILIATIONS (doivent toutes être ✓)'],
    ['PAIE + CHARGES = Génération budgétaire', sym(V, 'paie-charges'), sym(C, 'paie-charges')],
    ['Totaux budgétaire & état des charges cohérents', sym(V, 'budget-charges'), sym(C, 'budget-charges')],
    ['URSSAF concordant', sym(V, 'urssaf'), sym(C, 'urssaf')],
    ['Paies numéraires = budgétaire', sym(V, 'paies'), sym(C, 'paies')],
    ['PAS : bloc 50 − régul = journal = décompte', sym(V, 'pas'), sym(C, 'pas')],
    ['Écarts par tiers nuls (hors arrondi PAS)', tiersNuls(V), tiersNuls(C)],
    [],
    ['CHIFFRES CLÉS'],
    ['Total du fichier généré CIRIL', V.totalCiril, C.totalCiril],
    ['dont PAIE — traitements', V.totalPaie, C.totalPaie],
    ['dont CHARGES', V.totalCharges, C.totalCharges],
    [],
    ["POINT D'ATTENTION"],
    ["Titre d'arrondi du PAS à émettre ?", titre(V), titre(C)],
  ];
}

/** Construit le classeur et déclenche le téléchargement (côté navigateur). */
export async function exportControleXlsx(results: EntiteResultat[]): Promise<void> {
  const XLSX = await import('xlsx');
  const byEnt = Object.fromEntries(results.map((r) => [r.entite, r])) as Record<EntiteKey, EntiteResultat>;

  // Applique le format « € » à toutes les cellules numériques d'une feuille.
  const euro = (ws: import('xlsx').WorkSheet) => {
    if (!ws['!ref']) return;
    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let r = range.s.r; r <= range.e.r; r++) {
      for (let c = range.s.c; c <= range.e.c; c++) {
        const cell = ws[XLSX.utils.encode_cell({ r, c })] as import('xlsx').CellObject | undefined;
        if (cell && cell.t === 'n') cell.z = EUR;
      }
    }
  };

  const wb = XLSX.utils.book_new();

  const wsSynth = XLSX.utils.aoa_to_sheet(syntheseAoa(byEnt));
  wsSynth['!cols'] = [{ wch: 46 }, { wch: 18 }, { wch: 18 }];
  wsSynth['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 2 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 2 } },
  ];
  euro(wsSynth);
  XLSX.utils.book_append_sheet(wb, wsSynth, 'Synthèse');

  for (const [ent, titre] of [
    ['VILLE', 'DÉTAIL VILLE'],
    ['CCAS', 'DÉTAIL CCAS'],
  ] as [EntiteKey, string][]) {
    const res = byEnt[ent];
    if (!res) continue;
    const ws = XLSX.utils.aoa_to_sheet(detailAoa(res, titre));
    ws['!cols'] = [{ wch: 42 }, { wch: 18 }, { wch: 18 }, { wch: 16 }, { wch: 14 }, { wch: 6 }];
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } },
    ];
    euro(ws);
    XLSX.utils.book_append_sheet(wb, ws, ent === 'VILLE' ? 'Détail Ville' : 'Détail CCAS');
  }

  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  const blob = new Blob([out], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'controle_tiers.xlsx';
  a.click();
  URL.revokeObjectURL(url);
}
