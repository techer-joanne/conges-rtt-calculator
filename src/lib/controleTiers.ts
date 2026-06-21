/**
 * Contrôle Tiers (rapprochement de paie) — Ville (001) & CCAS (004).
 *
 * MOTEUR de réconciliation. Les valeurs proviennent désormais de la LECTURE des
 * fichiers bruts CIRIL dans le navigateur (cf. ctExtract.ts : pdf.js + SheetJS),
 * sans Python. Un import CSV (format compagnon) reste un chemin secondaire.
 *
 * Rapprochement par Code Tiers (jamais par libellé / position). Les lignes de
 * tiers sont FIXES par entité (BRIEF §5) : un tiers absent du mois reste vide.
 *
 * Colonnes (BRIEF §6) — par contrôle :
 *   C = génération budgétaire (1) · D = état des charges (2) · E = décompte PAS (8)
 *   F = journal PAS (9) · G = bloc 81 (6) · H = bloc 50 (7) · I = trésorerie/paies (5)
 * Écarts par tiers (doivent valoir 0) :
 *   J = C − D · K = G − C (URSSAF : G − (C_urssaf + C_csg)) · L = G − D (idem URSSAF)
 *   M = D + H − F (PAS ; D absent ⇒ H − F) · N = I − C · O = I − D (Trésorerie 342)
 *
 * Format CSV d'échange (BRIEF §9, optionnel) : ENTITE, CODE_TIERS, LIBELLE,
 * COLONNE, VALEUR, CONTROLE ; lignes spéciales `_TOTAL_CIRIL` (COLONNE = C/D/E) et
 * `_TITRE_PAS` (VALEUR = OUI/NON).
 *
 * Jeu de validation : juin 2026 (BRIEF §10).
 */

export type EntiteKey = 'VILLE' | 'CCAS';
export type ColKey = 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I';
export type EcartKey = 'J' | 'K' | 'L' | 'M' | 'N' | 'O';
export type Statut = 'ok' | 'ko' | 'na';

export const COLONNES: { key: ColKey; n: number; court: string; label: string }[] = [
  { key: 'C', n: 1, court: 'Génération budgétaire', label: '1ᵉʳ contrôle — Génération budgétaire' },
  { key: 'D', n: 2, court: 'État des charges', label: '2ᵉ contrôle — État des charges' },
  { key: 'E', n: 8, court: 'Décompte PAS', label: '8ᵉ contrôle — Décompte du PAS arrondi (tiers 24574)' },
  { key: 'F', n: 9, court: 'Prélèvement source', label: '9ᵉ contrôle — Prélèvement à la source / RUB 1697 (tiers 24587)' },
  { key: 'G', n: 6, court: 'DSN bloc 81', label: '6ᵉ contrôle — DSN bloc 81' },
  { key: 'H', n: 7, court: 'DSN bloc 50', label: '7ᵉ contrôle — DSN bloc 50 (avant régul. bloc 56)' },
  { key: 'I', n: 5, court: 'Paies numéraires', label: '5ᵉ contrôle — Paies numéraires' },
];
const COL_KEYS = COLONNES.map((c) => c.key);

/** Paramétrage par entité (codes Tiers — cf. OPS2CODE du compagnon). */
export const PARAM: Record<EntiteKey, { pas: string; treso: string; urssaf: string; csg: string; ops: string[] }> = {
  VILLE: { pas: '24574', treso: '342', urssaf: '11788', csg: '11789', ops: ['10937', '10938', '11788', '11837', '11838'] },
  CCAS: { pas: '24574', treso: '342', urssaf: '1467', csg: '1468', ops: ['1348', '1467', '1479', '329'] },
};

/**
 * Lignes de tiers FIXES par entité (BRIEF §5), dans l'ordre d'affichage.
 * Un tiers absent du mois reste vide (valeurs {}). Le détail rend TOUTES ces lignes.
 */
export const TIERS_FIXES: Record<EntiteKey, { code: string; libelle: string }[]> = {
  VILLE: [
    { code: '10937', libelle: 'RAFP' },
    { code: '10938', libelle: 'PENSION CIVILE / SRE' },
    { code: '11788', libelle: 'URSSAF' },
    { code: '11789', libelle: 'URSSAF CSG' },
    { code: '11837', libelle: 'IRCANTEC' },
    { code: '11838', libelle: 'CNRACL' },
    { code: '25224', libelle: 'CNRACL RÉTRO' },
    { code: '13983', libelle: 'CAREL' },
    { code: '1403', libelle: 'CIG' },
    { code: '16780', libelle: 'ATIACL' },
    { code: '19425', libelle: 'HARMONIE' },
    { code: '24574', libelle: 'PAS / SIE' },
    { code: '342', libelle: 'TRÉSORERIE' },
    { code: '375', libelle: 'MNFCT' },
    { code: '391', libelle: 'MNT' },
    { code: '392', libelle: 'PRÉFON' },
    { code: '23440', libelle: 'DIF ÉLUS' },
    { code: '9988', libelle: 'FONPEL' },
  ],
  CCAS: [
    { code: '1348', libelle: 'RAFP' },
    { code: '1467', libelle: 'URSSAF' },
    { code: '1468', libelle: 'URSSAF CSG' },
    { code: '1479', libelle: 'IRCANTEC' },
    { code: '19425', libelle: 'HARMONIE' },
    { code: '2301', libelle: 'ATIACL' },
    { code: '24574', libelle: 'PAS / SIE' },
    { code: '3000', libelle: 'CIG' },
    { code: '329', libelle: 'CNRACL' },
    { code: '391', libelle: 'MNT' },
    { code: '342', libelle: 'TRÉSORERIE' },
  ],
};

export interface TierLigne {
  code: string;
  libelle: string;
  valeurs: Partial<Record<ColKey, number>>;
}

export interface EntiteData {
  tiers: TierLigne[];
  totaux: Partial<Record<ColKey, number>>;
  titrePasFlag?: boolean; // _TITRE_PAS = OUI / NON
  charges?: number; // CHARGES (= total CIRIL C − PAIE), dérivé si absent
  paie?: number; // PAIE (= I[342]), dérivé si absent
  regulPas?: number; // régularisation bloc 56 du PAS (positive), si fournie par le décompte
}

export interface LigneResultat extends TierLigne {
  ecarts: Partial<Record<EcartKey, number>>; // écarts J..O définis pour ce tiers
  ecart?: number; // pire écart absolu (pilote le statut)
  statut: Statut;
  arrondi: boolean; // ligne PAS avec écart de centimes attendu (→ titre, pas une anomalie)
}

export interface Reconciliation {
  id: string;
  label: string;
  detail: string;
  ecart?: number;
  statut: Statut;
}

export interface EntiteResultat {
  entite: EntiteKey;
  lignes: LigneResultat[];
  reconciliations: Reconciliation[];
  totaux: Partial<Record<ColKey, number>>;
  totalCiril?: number; // budgétaire (total CIRIL C)
  totalEtatCharges?: number; // état des charges (total D)
  totalPrelevement?: number; // prélèvement PAS effectué (total E)
  totalPaie?: number; // PAIE = I[342]
  totalCharges?: number; // CHARGES = total CIRIL C − PAIE
  urssaf?: number; // cotisation URSSAF bloc 81 (G urssaf)
  pas?: number; // prélèvement PAS (F / H)
  regulPas?: number; // régularisation bloc 56 (bloc 50 − régul = journal = décompte)
  bouclage?: number; // écart |PAIE + CHARGES − total CIRIL|
  pasEcartArrondi?: number; // centimes prélèvement − somme arrondie
  titreArrondi: boolean;
  nbAnomalies: number;
  statut: Statut;
  renseigne: boolean;
}

export const TOLERANCE = 0.01; // €
export const TOLERANCE_ARRONDI = 0.5; // € — écart de centimes PAS toléré (→ titre)

const isNum = (v: unknown): v is number => typeof v === 'number';
const round2 = (n: number) => Math.round(n * 100) / 100;

function reco(id: string, label: string, detail: string, diffs: number[], tol = TOLERANCE): Reconciliation {
  if (diffs.length === 0) return { id, label, detail, statut: 'na' };
  const ecart = round2(Math.max(...diffs));
  return { id, label, detail, ecart, statut: ecart <= tol ? 'ok' : 'ko' };
}

/**
 * Fusionne les données analysées sur les lignes FIXES de l'entité (BRIEF §5).
 * Tout tiers parsé hors liste fixe est ajouté à la fin (sécurité).
 */
export function mergeFixedTiers(entite: EntiteKey, data: EntiteData): TierLigne[] {
  const byCode = new Map(data.tiers.map((t) => [t.code, t]));
  const out: TierLigne[] = TIERS_FIXES[entite].map((f) => {
    const parsed = byCode.get(f.code);
    return { code: f.code, libelle: f.libelle, valeurs: parsed ? { ...parsed.valeurs } : {} };
  });
  const fixedCodes = new Set(TIERS_FIXES[entite].map((f) => f.code));
  for (const t of data.tiers) {
    if (!fixedCodes.has(t.code)) out.push({ ...t, valeurs: { ...t.valeurs } });
  }
  return out;
}

/**
 * Fusionne deux jeux de données d'une MÊME entité (cumul des dépôts fichier par
 * fichier) : on combine les valeurs par Code Tiers × colonne, les totaux par
 * colonne et les drapeaux. Les valeurs du dépôt entrant priment, mais les
 * colonnes déjà présentes (déposées avant) sont CONSERVÉES — déposer le
 * budgétaire puis le bloc 50 garde les deux contrôles.
 */
export function mergeEntiteData(base: EntiteData, incoming: EntiteData): EntiteData {
  const byCode = new Map<string, TierLigne>();
  for (const t of base.tiers) {
    byCode.set(t.code, { code: t.code, libelle: t.libelle, valeurs: { ...t.valeurs } });
  }
  for (const t of incoming.tiers) {
    const ex = byCode.get(t.code);
    if (ex) {
      ex.valeurs = { ...ex.valeurs, ...t.valeurs };
      if (t.libelle && !ex.libelle) ex.libelle = t.libelle;
    } else {
      byCode.set(t.code, { code: t.code, libelle: t.libelle, valeurs: { ...t.valeurs } });
    }
  }
  return {
    tiers: [...byCode.values()],
    totaux: { ...base.totaux, ...incoming.totaux },
    titrePasFlag: incoming.titrePasFlag ?? base.titrePasFlag,
    charges: incoming.charges ?? base.charges,
    paie: incoming.paie ?? base.paie,
    regulPas: incoming.regulPas ?? base.regulPas,
  };
}

/** Calcule écarts J..O par tiers, réconciliations clés (§8), totaux et statut global. */
export function computeEntite(entite: EntiteKey, data: EntiteData): EntiteResultat {
  const P = PARAM[entite];
  const lignesFixes = mergeFixedTiers(entite, data);
  const byCode = new Map(lignesFixes.map((t) => [t.code, t]));
  const val = (code: string, col: ColKey): number | undefined => byCode.get(code)?.valeurs[col];

  // --- Régularisation bloc 56 du PAS (CORRECTIF) ---
  // Le bloc 50 (H) est AVANT régul ; le journal (F) et le décompte (E) sont APRÈS.
  // Donc : bloc 50 + ajustement = journal = prélèvement. La régul apparaît soit en
  // colonne D du PAS (déjà signée, ex. −59,02), soit sur le décompte (data.regulPas,
  // positive → ajustement = −régul). `regulAdj` = ajustement signé à appliquer à H.
  const pasDval = val(P.pas, 'D');
  const regulDecompte = isNum(data.regulPas) ? data.regulPas : undefined;
  const regulAdj: number | undefined =
    isNum(pasDval) && Math.abs(pasDval) > TOLERANCE
      ? pasDval
      : regulDecompte !== undefined
        ? -regulDecompte
        : undefined;

  // ---- Écarts J..O + statut par tiers (BRIEF §6) ----
  const lignes: LigneResultat[] = lignesFixes.map((t) => {
    const v = t.valeurs;
    const ecarts: Partial<Record<EcartKey, number>> = {};
    const isPas = t.code === P.pas;
    const isUrssaf = t.code === P.urssaf;
    const isTreso = t.code === P.treso;

    // Base bloc 81 : URSSAF agrège URSSAF + CSG (BRIEF §6).
    const baseC = isUrssaf ? (val(P.urssaf, 'C') ?? 0) + (val(P.csg, 'C') ?? 0) : v.C;
    const baseD = isUrssaf ? (val(P.urssaf, 'D') ?? 0) + (val(P.csg, 'D') ?? 0) : v.D;

    // J = C − D. PAS : on n'utilise PAS J (centimes du PAS sans cts en C → arrondi, pas anomalie).
    if (!isPas && isNum(v.C) && isNum(v.D)) ecarts.J = round2(v.C - v.D);
    // K = G − C ; L = G − D (URSSAF : base agrégée).
    if (isNum(v.G) && isNum(baseC)) ecarts.K = round2(v.G - baseC);
    if (isNum(v.G) && isNum(baseD)) ecarts.L = round2(v.G - baseD);
    // M sur le PAS : bloc 50 (H) + régul bloc 56 = journal (F). La régul est portée
    // par la colonne D (signée) ou, à défaut, par le décompte (regulDecompte).
    if (isPas && (isNum(v.H) || isNum(v.F))) {
      const dPart = isNum(v.D) ? v.D : 0;
      const extra = isNum(v.D) ? 0 : regulDecompte !== undefined ? -regulDecompte : 0;
      ecarts.M = round2(dPart + (v.H ?? 0) + extra - (v.F ?? 0));
    }
    // N = I − C ; O = I − D sur la Trésorerie (342).
    if (isTreso && isNum(v.I) && isNum(v.C)) ecarts.N = round2(v.I - v.C);
    if (isTreso && isNum(v.I) && isNum(v.D)) ecarts.O = round2(v.I - v.D);

    const defined = Object.values(ecarts).filter(isNum);
    if (defined.length === 0) {
      const any = COL_KEYS.some((k) => v[k] !== undefined);
      return { ...t, ecarts, statut: any ? 'ok' : 'na', arrondi: false };
    }
    const ecart = Math.max(...defined.map((e) => Math.abs(e)));

    // PAS : drapeau arrondi (centimes attendus). Jamais une anomalie : les écarts
    // J..O du PAS sont neutralisés (J non utilisé, M = H − F = 0).
    if (isPas) {
      const cents = pasCentimes(v.C, val(P.pas, 'F') ?? val(P.pas, 'H'), data);
      const titre = cents !== undefined && cents < TOLERANCE_ARRONDI && cents > TOLERANCE;
      return { ...t, ecarts, ecart, statut: 'ok', arrondi: titre };
    }

    return { ...t, ecarts, ecart, statut: ecart <= TOLERANCE ? 'ok' : 'ko', arrondi: false };
  });

  // ---- Réconciliations (BRIEF §8 : exactement 5) ----
  // Valeurs clés.
  const paie = val(P.treso, 'I') ?? data.paie ?? data.totaux.I;
  const totalCiril = data.totaux.C; // budgétaire
  const totalEtatCharges = data.totaux.D; // état des charges
  const totalPrelevement = data.totaux.E; // prélèvement PAS effectué
  const charges = data.charges ?? (isNum(totalCiril) && isNum(paie) ? round2(totalCiril - paie) : undefined);
  const pasE = val(P.pas, 'E');
  const pasF = val(P.pas, 'F');
  const pasH = val(P.pas, 'H');
  const pasC = val(P.pas, 'C');
  const urssafG = val(P.urssaf, 'G');

  // (1) PAIE + CHARGES = budgétaire = total CIRIL.
  const r1: number[] = [];
  if (isNum(paie) && isNum(charges) && isNum(totalCiril)) r1.push(Math.abs(paie + charges - totalCiril));

  // (2) budgétaire = état des charges + PAS (prélèvement). Budgétaire C inclut le PAS (E sans cts) ;
  //     état charges D exclut le PAS ⇒ total CIRIL C = total D + PAS (E sans cts).
  const r2: number[] = [];
  if (isNum(totalCiril) && isNum(totalEtatCharges) && isNum(pasC))
    r2.push(Math.abs(totalCiril - (totalEtatCharges + pasC)));

  // (3) URSSAF concordant : (C_urssaf + C_csg) = (D_urssaf + D_csg) = bloc 81 G.
  const r3: number[] = [];
  {
    const cTot = (val(P.urssaf, 'C') ?? 0) + (val(P.csg, 'C') ?? 0);
    const dTot = (val(P.urssaf, 'D') ?? 0) + (val(P.csg, 'D') ?? 0);
    if (isNum(urssafG)) {
      if (cTot !== 0) r3.push(Math.abs(cTot - urssafG));
      if (dTot !== 0) r3.push(Math.abs(dTot - urssafG));
      if (cTot !== 0 && dTot !== 0) r3.push(Math.abs(cTot - dTot));
    }
  }

  // (4) paies numéraires = budgétaire : I[342] = C[342].
  const r4: number[] = [];
  const tresoC = val(P.treso, 'C');
  if (isNum(paie) && isNum(tresoC)) r4.push(Math.abs(paie - tresoC));

  // (5) PAS : bloc 50 (H) + régul bloc 56 = journal (F) = décompte (E/prélèvement).
  // Le bloc 50 est AVANT régul ; journal et décompte sont APRÈS. On n'exige donc
  // JAMAIS « bloc 50 = journal » à l'identique (CORRECTIF) :
  //   • régul connue (D ou décompte) ⇒ contrôle strict bloc 50 + régul = journal ;
  //   • régul inconnue ⇒ l'écart bloc 50 ↔ journal est une régularisation (normal),
  //     on ne contrôle que journal = prélèvement.
  const r5: number[] = [];
  const regulConnue = regulAdj !== undefined;
  if (regulConnue) {
    if (isNum(pasH) && isNum(pasF)) r5.push(Math.abs(pasH + (regulAdj as number) - pasF));
    if (isNum(pasF) && isNum(totalPrelevement)) r5.push(Math.abs(pasF - totalPrelevement));
    else if (isNum(pasH) && isNum(totalPrelevement))
      r5.push(Math.abs(pasH + (regulAdj as number) - totalPrelevement));
  } else {
    if (isNum(pasF) && isNum(totalPrelevement)) r5.push(Math.abs(pasF - totalPrelevement));
  }

  const reconciliations: Reconciliation[] = [
    reco('paie-charges', 'Paie + charges = budgétaire', 'bouclage de la génération budgétaire', r1),
    reco('budget-charges', 'Budgétaire = état charges + PAS', 'le PAS complète l’état des charges', r2),
    reco('urssaf', 'URSSAF concordant', '(C+CSG) = (D+CSG) = bloc 81', r3),
    reco('paies', 'Paies numéraires = budgétaire', 'tout payé par virement (tiers 342)', r4),
    reco(
      'pas',
      'PAS : bloc 50 − régul 56 = journal = décompte',
      regulConnue
        ? 'prélèvement à la source cohérent (régul bloc 56 appliquée)'
        : 'écart bloc 50 ↔ journal = régularisation bloc 56 (normal)',
      r5,
    ),
  ];

  // Anomalies = écarts tiers KO (hors arrondi PAS) + réconciliations KO.
  const anomTiers = lignes.filter((l) => l.statut === 'ko').length;
  const anomReco = reconciliations.filter((r) => r.statut === 'ko').length;
  const nbAnomalies = anomTiers + anomReco;

  const renseigne = data.tiers.length > 0 || Object.keys(data.totaux).length > 0;
  const statut: Statut = !renseigne ? 'na' : nbAnomalies > 0 ? 'ko' : 'ok';

  // ---- Titre d'arrondi PAS (BRIEF §7) ----
  const prelevReel = isNum(totalPrelevement) ? totalPrelevement : (pasF ?? pasH);
  const pasEcartArrondi =
    isNum(prelevReel) && isNum(pasE) ? round2(Math.abs(prelevReel - pasE)) : undefined;
  const titreArrondi =
    data.titrePasFlag ??
    (isNum(prelevReel)
      ? round2(prelevReel - Math.trunc(prelevReel)) < TOLERANCE_ARRONDI && round2(prelevReel - Math.trunc(prelevReel)) > 0
      : false);

  const bouclage = r1.length ? round2(Math.max(...r1)) : undefined;

  return {
    entite,
    lignes,
    reconciliations,
    totaux: data.totaux,
    totalCiril,
    totalEtatCharges,
    totalPrelevement,
    totalPaie: paie,
    totalCharges: charges,
    urssaf: urssafG,
    pas: isNum(pasF) ? pasF : pasH,
    regulPas:
      isNum(pasDval) && Math.abs(pasDval) > TOLERANCE
        ? round2(-pasDval)
        : regulDecompte,
    bouclage,
    pasEcartArrondi,
    titreArrondi,
    nbAnomalies,
    statut,
    renseigne,
  };
}

/** Centimes d'arrondi du PAS : prélèvement réel (avec cts) − montant en C (sans cts). */
function pasCentimes(pasC: number | undefined, prelev: number | undefined, data: EntiteData): number | undefined {
  const reel = isNum(data.totaux.E) ? data.totaux.E : prelev;
  if (!isNum(reel)) return undefined;
  if (isNum(pasC)) return round2(Math.abs(reel - pasC));
  return round2(reel - Math.trunc(reel));
}

/* ----------------------------- Exemple juin 2026 (BRIEF §10) ----------------------------- */

const tier = (code: string, libelle: string, valeurs: Partial<Record<ColKey, number>>): TierLigne => ({
  code,
  libelle,
  valeurs,
});

export const DEMO_JUIN: Record<EntiteKey, EntiteData> = {
  VILLE: {
    tiers: [
      // C = D par tiers (BRIEF §10).
      tier('10937', 'RAFP', { C: 15894.94, D: 15894.94, G: 15894.94 }),
      tier('10938', 'PENSION CIVILE / SRE', { C: 4384.47, D: 4384.47, G: 4384.47 }),
      tier('11788', 'URSSAF', { C: 696163.81, D: 696163.81, G: 925561.32 }),
      tier('11789', 'URSSAF CSG', { C: 229397.51, D: 229397.51 }),
      tier('11837', 'IRCANTEC', { C: 90001.6, D: 90001.6, G: 90001.6 }),
      tier('11838', 'CNRACL', { C: 380018.77, D: 380018.77, G: 380018.77 }),
      tier('13983', 'CAREL', { C: 1212.18, D: 1212.18 }),
      tier('1403', 'CIG', { C: 1801.53, D: 1801.53 }),
      tier('16780', 'ATIACL', { C: 3165.18, D: 3165.18 }),
      tier('19425', 'HARMONIE', { C: 16675.38, D: 16675.38 }),
      tier('391', 'MNT', { C: 4857.85, D: 4857.85 }),
      tier('392', 'PRÉFON', { C: 150.5, D: 150.5 }),
      tier('342', 'TRÉSORERIE', { C: 1906259.23, D: 1906259.23, I: 1906259.23 }),
      tier('24574', 'PAS / SIE', { C: 56260.0, E: 56260.0, F: 56260.29, H: 56260.29 }),
    ],
    totaux: { C: 3406242.95, D: 3349982.95, E: 56260.29 },
    titrePasFlag: true, // 0,29 < 0,50
    paie: 1906259.23,
    charges: 1499983.72,
  },
  CCAS: {
    tiers: [
      tier('1348', 'RAFP', { C: 188.8, D: 188.8 }),
      tier('1467', 'URSSAF', { C: 5964.55, D: 5964.55, G: 8015.37 }),
      tier('1468', 'URSSAF CSG', { C: 2050.82, D: 2050.82 }),
      tier('1479', 'IRCANTEC', { C: 638.49, D: 638.49 }),
      tier('2301', 'ATIACL', { C: 39.88, D: 39.88 }),
      tier('3000', 'CIG', { C: 17.5, D: 17.5 }),
      tier('329', 'CNRACL', { C: 4991.68, D: 4991.68 }),
      tier('391', 'MNT', { C: 112.4, D: 112.4 }),
      tier('342', 'TRÉSORERIE', { C: 16446.91, D: 16446.91, I: 16446.91 }),
      tier('24574', 'PAS / SIE', { C: 767.0, E: 767.0, F: 767.08, H: 767.08 }),
    ],
    totaux: { C: 31218.03, D: 30451.03, E: 767.08 },
    titrePasFlag: true, // 0,08 < 0,50
    paie: 16446.91,
    charges: 14771.12,
  },
};

/* ------------------------------- Import CSV (secondaire) --------------------------------- */

/** Convertit « 925 561,32 », « 925561.32 », « -0,29 » → nombre. */
export function parseMontant(raw: string): number | undefined {
  if (!raw) return undefined;
  let s = raw.trim().replace(/[€\s  ]/g, '');
  if (!s) return undefined;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

const detectEntite = (s: string): EntiteKey | undefined => {
  const n = s.toLowerCase();
  if (n.includes('ccas') || n.includes('004')) return 'CCAS';
  if (n.includes('ville') || n.includes('001') || n.includes('mairie')) return 'VILLE';
  return undefined;
};

function splitCsvLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (q && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else q = !q;
    } else if (c === delim && !q) {
      out.push(cur);
      cur = '';
    } else cur += c;
  }
  out.push(cur);
  return out.map((x) => x.trim());
}

export interface ParseResult {
  data: Partial<Record<EntiteKey, EntiteData>>;
  lignesReconnues: number;
  lignesIgnorees: number;
  erreur?: string;
}

/** Import du CSV compagnon. Tolérant : séparateur `,`/`;`, BOM, guillemets, en-tête. */
export function parseCsv(text: string): ParseResult {
  const data: Partial<Record<EntiteKey, EntiteData>> = {};
  let reconnues = 0;
  let ignorees = 0;

  const clean = text.replace(/^﻿/, '');
  const lines = clean.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { data, lignesReconnues: 0, lignesIgnorees: 0, erreur: 'Fichier vide.' };

  const delim = (lines[0].match(/;/g)?.length ?? 0) > (lines[0].match(/,/g)?.length ?? 0) ? ';' : ',';
  const start = /entite|établissement|etablissement/i.test(lines[0]) ? 1 : 0;

  const ensure = (ent: EntiteKey): EntiteData => (data[ent] ??= { tiers: [], totaux: {} });
  const findTier = (ed: EntiteData, code: string, libelle: string): TierLigne => {
    let t = ed.tiers.find((x) => x.code === code);
    if (!t) {
      t = { code, libelle, valeurs: {} };
      ed.tiers.push(t);
    } else if (libelle && !t.libelle) t.libelle = libelle;
    return t;
  };

  for (let i = start; i < lines.length; i++) {
    const p = splitCsvLine(lines[i], delim);
    if (p.length < 5) {
      ignorees++;
      continue;
    }
    const ent = detectEntite(p[0]);
    const code = p[1];
    const libelle = p[2];
    const col = p[3].toUpperCase() as ColKey;
    if (!ent || !code) {
      ignorees++;
      continue;
    }
    const ed = ensure(ent);

    if (code === '_TITRE_PAS') {
      ed.titrePasFlag = /^o/i.test((p[4] ?? '').trim()); // OUI / NON
      reconnues++;
      continue;
    }
    const v = parseMontant(p[4]);
    if (v === undefined || !COL_KEYS.includes(col)) {
      ignorees++;
      continue;
    }
    if (code === '_TOTAL_CIRIL') {
      ed.totaux[col] = v;
      reconnues++;
      continue;
    }
    findTier(ed, code, libelle).valeurs[col] = v;
    reconnues++;
  }

  return { data, lignesReconnues: reconnues, lignesIgnorees: ignorees };
}

/** Modèle CSV (format compagnon) à partir de données — pour aligner / documenter. */
export function toCsvModele(d: Record<EntiteKey, EntiteData>): string {
  const fmt = (n: number) => n.toFixed(2);
  const lignes: string[] = ['ENTITE,CODE_TIERS,LIBELLE,COLONNE,VALEUR,CONTROLE'];
  (Object.keys(d) as EntiteKey[]).forEach((ent) => {
    d[ent].tiers.forEach((t) => {
      COL_KEYS.forEach((k) => {
        const v = t.valeurs[k];
        if (isNum(v)) lignes.push(`${ent},${t.code},${t.libelle},${k},${fmt(v)},${COLONNES.find((c) => c.key === k)?.n ?? ''}`);
      });
    });
    Object.entries(d[ent].totaux).forEach(([k, v]) => {
      if (isNum(v)) lignes.push(`${ent},_TOTAL_CIRIL,,${k},${fmt(v)},`);
    });
    if (d[ent].titrePasFlag !== undefined) lignes.push(`${ent},_TITRE_PAS,,,${d[ent].titrePasFlag ? 'OUI' : 'NON'},8`);
  });
  return lignes.join('\n');
}
