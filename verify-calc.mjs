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

const { computeResults, rttBareme } = await import(pathToFileURL(out).href);

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
];

let ok = true;
for (const [name, got, exp] of checks) {
  const pass = got === exp;
  if (!pass) ok = false;
  console.log(`${pass ? '✅' : '❌'} ${name}: ${got}${pass ? '' : ` (attendu ${exp})`}`);
}

process.exit(ok ? 0 : 1);
