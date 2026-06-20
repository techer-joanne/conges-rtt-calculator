// Vérification runtime du moteur de calcul contre le classeur Excel de la DRH.
// Transpile src/lib/calc.ts via esbuild puis contrôle les valeurs attendues.
import { build } from 'esbuild';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const out = join(tmpdir(), `calc-${Date.now()}.mjs`);
await build({
  entryPoints: ['src/lib/calc.ts'],
  outfile: out,
  format: 'esm',
  bundle: true,
  logLevel: 'silent',
});

const { computeResults, rttBareme, computeAnnualisation } = await import(pathToFileURL(out).href);

// Moteur « Contrôle Tiers » (rapprochement de paie).
const outCt = join(tmpdir(), `ct-${Date.now()}.mjs`);
await build({
  entryPoints: ['src/lib/controleTiers.ts'],
  outfile: outCt,
  format: 'esm',
  bundle: true,
  logLevel: 'silent',
});
const { computeEntite, parseCsv, parseMontant, DEMO_JUIN } = await import(pathToFileURL(outCt).href);
const ctVille = computeEntite('VILLE', DEMO_JUIN.VILLE);
const ctCcas = computeEntite('CCAS', DEMO_JUIN.CCAS);
// Pire écart absolu J..O sur l'ensemble des tiers (doit valoir 0 sur juin 2026).
const pireEcart = (res) =>
  res.lignes.reduce((m, l) => {
    const e = Object.values(l.ecarts ?? {}).reduce((mm, x) => Math.max(mm, Math.abs(x)), 0);
    return Math.max(m, e);
  }, 0);
const ctCsv = parseCsv(
  'ENTITE,CODE_TIERS,LIBELLE,COLONNE,VALEUR,CONTROLE\n' +
    'VILLE,11788,URSSAF,C,925561.32,1\n' +
    'VILLE,11788,URSSAF,G,925561.32,6\n' +
    'VILLE,24574,PAS/SIE,C,56260.00,1\n' +
    'VILLE,24574,PAS/SIE,F,56260.29,9\n' +
    'VILLE,_TOTAL_CIRIL,,C,3406242.95,1\n' +
    'VILLE,_TITRE_PAS,,,OUI,8\n' +
    'CCAS,1467,URSSAF,C,8015.37,1\n',
);
const ctTierUrssaf = ctCsv.data.VILLE.tiers.find((t) => t.code === '11788');

const round2 = (x) => Math.round(x * 100) / 100;
const base = {
  nom: '', socle: '38', quotite: 100, dateDebut: '2026-01-01', dateFin: '2026-12-31',
  joursMaladie: 0, congesDejaPris: 0, remunerationBrute: 0,
};

// 1) Exemple du classeur : année pleine, 38 h, 100 % -> CA 25 · RTT 18 · total 43
const full = computeResults(base);
// 2) Période partielle (01/01 -> 06/10) : prorata 76,4 % -> CA 19 · RTT 14 · total 33
const part = computeResults({ ...base, dateFin: '2026-10-06' });
// 3) Temps partiel 80 % année pleine : CA 20 · barème 14,5 -> RTT 15 · total 35
const tp80 = computeResults({ ...base, quotite: 80 });
// 4) Cas table 39 h / 90 % : CA round(22,5)=23 · barème 20 · total 43
const q90 = computeResults({ ...base, socle: '39', quotite: 90 });
// 5) Maladie 13 j (année pleine 38 h) : RTT 18 -> 17 ; total 42
const mal = computeResults({ ...base, joursMaladie: 13 });
// 6) Départ : 2 400 € brut -> indemnité 115,20 €/j · 20 j · montant 2 304 € (= Excel)
const dep = computeResults({ ...base, remunerationBrute: 2400 });
// 7) Départ temps partiel 80 %, 5 j déjà pris : solde 15, plafond 16 -> 15 j · 1 728 €
const dep80 = computeResults({ ...base, quotite: 80, congesDejaPris: 5, remunerationBrute: 2400 });

// --- Annualisation (cahier des charges DRH / méthode CDG) ---
const annuBase = {
  nom: '', heuresHebdo: 20, nbSemaines: 36, dateDebut: '', dateFin: '', joursFeries: 0, joursMaladie: 0,
};
// A) Exemple ATSEM CDG27 : 20 h × 36 sem -> X 720 h · équiv. 15,68 h · quotité 44,8 % · CA 11 j
const annu = computeAnnualisation(annuBase);
// B) Année scolaire complète (01/09 -> 31/08) : prorata 100 %
const annuFull = computeAnnualisation({ ...annuBase, dateDebut: '2026-09-01', dateFin: '2027-08-31' });
// C) Déduction de 2 jours fériés travaillés (4 h/jour) -> 720 − 8 = 712 h réelles
const annuFer = computeAnnualisation({ ...annuBase, joursFeries: 2 });

const checks = [
  // Année pleine (exemple Excel)
  ['plein · valid', full.valid, true],
  ['plein · joursCalendaires', full.joursCalendaires, 365],
  ['plein · joursOuvres (NETWORKDAYS)', full.joursOuvres, 261],
  ['plein · prorata %', Math.round(full.prorata * 1000) / 10, 100],
  ['plein · CA', full.congesAnnuels, 25],
  ['plein · RTT proratisés', full.rttProratises, 18],
  ['plein · RTT réelles', full.rttReelles, 18],
  ['plein · solidarité (info)', full.journeeSolidarite, 1],
  ['plein · TOTAL congés+RTT', full.total, 43],
  // Période partielle -> arrondi à l'entier
  ['partiel · prorata %', Math.round(part.prorata * 1000) / 10, 76.4],
  ['partiel · CA (round 19,1→19)', part.congesAnnuels, 19],
  ['partiel · RTT (round 13,76→14)', part.rttReelles, 14],
  ['partiel · TOTAL', part.total, 33],
  // Temps partiel via table
  ['80% · CA', tp80.congesAnnuels, 20],
  ['80% · barème RTT', tp80.rttBareme, 14.5],
  ['80% · RTT proratisés (round 14,5→15)', tp80.rttProratises, 15],
  ['80% · TOTAL', tp80.total, 35],
  // Cellule 39h/90%
  ['39h/90% · CA (round 22,5→23)', q90.congesAnnuels, 23],
  ['39h/90% · barème RTT', q90.rttBareme, 20],
  ['39h/90% · TOTAL', q90.total, 43],
  // Maladie au prorata
  ['maladie · RTT réelles (18→17)', mal.rttReelles, 17],
  ['maladie · TOTAL', mal.total, 42],
  // Départ / indemnisation (= Excel)
  ['départ · CA acquis', dep.caAcquis, 25],
  ['départ · solde', dep.soldeConges, 25],
  ['départ · jours indemnisables', dep.joursIndemnisables, 20],
  ['départ · indemnité/jour', round2(dep.indemniteParJour), 115.2],
  ['départ · montant brut', round2(dep.montantIndemnisation), 2304],
  ['départ80 · CA acquis', dep80.caAcquis, 20],
  ['départ80 · solde (20−5)', dep80.soldeConges, 15],
  ['départ80 · jours indemnisables min(15,16)', dep80.joursIndemnisables, 15],
  ['départ80 · montant brut', round2(dep80.montantIndemnisation), 1728],
  // Table RTT (recopie feuille Barèmes)
  ['table 38h/100%', rttBareme('38', 100), 18],
  ['table 37h/70%', rttBareme('37', 70), 8.5],
  ['table 39h/50%', rttBareme('39', 50), 11.5],
  ['table 35h/100% (=0)', rttBareme('35', 100), 0],
  ['table Annualisation (=0)', rttBareme('annu', 100), 0],
  // Annualisation — exemple ATSEM CDG27
  ['annu · valid', annu.valid, true],
  ['annu · heures annuelles (X)', annu.heuresAnnuelles, 720],
  ['annu · équivalent hebdo (15,68 h)', round2(annu.equivalentHebdo), 15.68],
  ['annu · quotité de paie %', Math.round(annu.quotitePaie * 1000) / 10, 44.8],
  ['annu · prorata % (sans dates = 100)', Math.round(annu.prorata * 1000) / 10, 100],
  ['annu · congés annuels (round 11,2→11)', annu.congesAnnuels, 11],
  ['annu · heures réelles (sans déduction)', annu.heuresReelles, 720],
  ['annu · écart cohérence (720−1607)', round2(annu.ecartCoherence), -887],
  // Année scolaire complète -> prorata 100 %
  ['annuFull · prorata %', Math.round(annuFull.prorata * 1000) / 10, 100],
  ['annuFull · congés (= sans dates)', annuFull.congesAnnuels, 11],
  // Déduction fériés (2 j × 4 h)
  ['annuFer · heures déduites (2×4)', round2(annuFer.heuresDeduites), 8],
  ['annuFer · heures réelles (712)', round2(annuFer.heuresReelles), 712],
  ['annuFer · quotité inchangée %', Math.round(annuFer.quotitePaie * 1000) / 10, 44.8],
  // Contrôle Tiers — exemple juin 2026 (matrice par Code Tiers, écarts J..O = 0)
  ['CT Ville · statut', ctVille.statut, 'ok'],
  ['CT Ville · 0 anomalie', ctVille.nbAnomalies, 0],
  ['CT Ville · tous écarts J..O = 0', round2(pireEcart(ctVille)), 0],
  ['CT Ville · titre arrondi PAS', ctVille.titreArrondi, true],
  ['CT Ville · écart arrondi PAS', round2(ctVille.pasEcartArrondi), 0.29],
  ['CT Ville · total CIRIL (C)', round2(ctVille.totalCiril), 3406242.95],
  ['CT Ville · total état charges (D)', round2(ctVille.totalEtatCharges), 3349982.95],
  ['CT Ville · prélèvement PAS (E)', round2(ctVille.totalPrelevement), 56260.29],
  ['CT Ville · PAIE', round2(ctVille.totalPaie), 1906259.23],
  ['CT Ville · CHARGES', round2(ctVille.totalCharges), 1499983.72],
  ['CT Ville · bouclage = 0', round2(ctVille.bouclage), 0],
  ['CT Ville · URSSAF bloc 81', round2(ctVille.urssaf), 925561.32],
  ['CT Ville · réco paie+charges', ctVille.reconciliations.find((r) => r.id === 'paie-charges').statut, 'ok'],
  ['CT Ville · réco budgétaire=charges+PAS', ctVille.reconciliations.find((r) => r.id === 'budget-charges').statut, 'ok'],
  ['CT Ville · réco URSSAF', ctVille.reconciliations.find((r) => r.id === 'urssaf').statut, 'ok'],
  ['CT Ville · réco paies', ctVille.reconciliations.find((r) => r.id === 'paies').statut, 'ok'],
  ['CT Ville · réco PAS', ctVille.reconciliations.find((r) => r.id === 'pas').statut, 'ok'],
  ['CT CCAS · statut équilibrée', ctCcas.statut, 'ok'],
  ['CT CCAS · 0 anomalie', ctCcas.nbAnomalies, 0],
  ['CT CCAS · tous écarts J..O = 0', round2(pireEcart(ctCcas)), 0],
  ['CT CCAS · total CIRIL (C)', round2(ctCcas.totalCiril), 31218.03],
  ['CT CCAS · total état charges (D)', round2(ctCcas.totalEtatCharges), 30451.03],
  ['CT CCAS · PAIE', round2(ctCcas.totalPaie), 16446.91],
  ['CT CCAS · CHARGES', round2(ctCcas.totalCharges), 14771.12],
  ['CT CCAS · URSSAF bloc 81', round2(ctCcas.urssaf), 8015.37],
  ['CT CCAS · titre arrondi (0,08)', ctCcas.titreArrondi, true],
  ['CT CCAS · réco URSSAF', ctCcas.reconciliations.find((r) => r.id === 'urssaf').statut, 'ok'],
  // Import CSV (format compagnon)
  ['CT parseMontant « 925 561,32 »', parseMontant('925 561,32'), 925561.32],
  ['CT parseCsv · tier URSSAF colonne C', ctTierUrssaf.valeurs.C, 925561.32],
  ['CT parseCsv · total CIRIL', ctCsv.data.VILLE.totaux.C, 3406242.95],
  ['CT parseCsv · titre PAS (OUI)', ctCsv.data.VILLE.titrePasFlag, true],
  ['CT parseCsv · lignes reconnues', ctCsv.lignesReconnues, 7],
];

let ok = true;
for (const [name, got, exp] of checks) {
  const pass = got === exp;
  if (!pass) ok = false;
  console.log(`${pass ? '✅' : '❌'} ${name}: ${got}${pass ? '' : ` (attendu ${exp})`}`);
}

process.exit(ok ? 0 : 1);
