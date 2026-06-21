import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Upload,
  FileDown,
  RotateCcw,
  CheckCircle2,
  XCircle,
  MinusCircle,
  AlertTriangle,
  Building2,
  Landmark,
  ShieldCheck,
  Info,
  FileText,
  FileSpreadsheet,
  Loader2,
  Trash2,
  FileSearch,
} from 'lucide-react';
import { fmtEuro } from '../lib/calc';
import {
  computeEntite,
  mergeEntiteData,
  parseCsv,
  toCsvModele,
  DEMO_JUIN,
  PARAM,
  TOLERANCE,
  type EntiteKey,
  type EntiteData,
  type EntiteResultat,
  type Statut,
} from '../lib/controleTiers';
import { cn } from '../lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

const STORAGE_KEY = 'conges-rtt-trappes:ct:v4';
const NUM = "font-['Space_Grotesk'] tabular-nums";
const ENTITES: EntiteKey[] = ['VILLE', 'CCAS'];
const ENTITE_META: Record<EntiteKey, { label: string; code: string; icon: typeof Building2 }> = {
  VILLE: { label: 'Ville', code: '001', icon: Building2 },
  CCAS: { label: 'CCAS', code: '004', icon: Landmark },
};
const round2 = (n: number) => Math.round(n * 100) / 100;

// Noms des 9 contrôles — utilisés par le journal de détection (après dépôt).
const CTRL_NOMS: Record<number, string> = {
  1: 'Génération budgétaire',
  2: 'État des charges',
  3: 'État charges URSSAF',
  4: 'DSN bordereau 22/23',
  5: 'Paies numéraires',
  6: 'DSN bloc 81',
  7: 'DSN bloc 50',
  8: 'Décompte du PAS',
  9: 'Journal RUB 1691/94/97',
};

function StatutIcon({ statut, className }: { statut: Statut; className?: string }) {
  if (statut === 'ok') return <CheckCircle2 className={cn('text-success', className)} />;
  if (statut === 'ko') return <XCircle className={cn('text-destructive', className)} />;
  return <MinusCircle className={cn('text-muted-foreground', className)} />;
}

function StatutBadge({ statut }: { statut: Statut }) {
  if (statut === 'ok') return <Badge variant="success">✓ Équilibrée</Badge>;
  if (statut === 'ko') return <Badge variant="destructive">Anomalie</Badge>;
  return <Badge variant="secondary">À compléter</Badge>;
}

function emptyData(): Record<EntiteKey, EntiteData> {
  return { VILLE: { tiers: [], totaux: {} }, CCAS: { tiers: [], totaux: {} } };
}

/** Une entité a-t-elle reçu des données (tiers / totaux / titre) ? */
const aDesDonnees = (ed?: EntiteData) =>
  !!ed && (ed.tiers.length > 0 || Object.keys(ed.totaux).length > 0 || ed.titrePasFlag !== undefined);

function loadData(): Record<EntiteKey, EntiteData> {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<Record<EntiteKey, EntiteData>>;
      if (Array.isArray(p.VILLE?.tiers) && Array.isArray(p.CCAS?.tiers)) {
        return { VILLE: p.VILLE, CCAS: p.CCAS };
      }
    }
  } catch {
    /* ignore */
  }
  return DEMO_JUIN;
}

type LogLine = { name: string; entite: EntiteKey | '?'; controle: number };

/* --------------------------- Synthèse --------------------------- */

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn('mt-0.5 text-sm font-bold text-foreground', NUM)}>{value}</p>
    </div>
  );
}

function SyntheseCard({ res }: { res: EntiteResultat }) {
  const meta = ENTITE_META[res.entite];
  const Icon = meta.icon;
  return (
    <Card className="print-clean overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 border-b">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-primary">
            <Icon className="h-4 w-4" />
          </span>
          <div>
            <CardTitle className="text-sm font-bold uppercase tracking-wide text-secondary-foreground">{meta.label}</CardTitle>
            <p className="text-[11px] font-medium text-muted-foreground">Établissement {meta.code}</p>
          </div>
        </div>
        <StatutBadge statut={res.statut} />
      </CardHeader>
      <CardContent className="space-y-3 p-4">
        {/* 5 réconciliations clés (BRIEF §8) */}
        <div className="space-y-1">
          {!res.renseigne && (
            <p className="text-xs italic text-muted-foreground">Déposez les fichiers CIRIL pour voir les réconciliations.</p>
          )}
          {res.reconciliations.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 odd:bg-muted/30">
              <div className="flex min-w-0 items-center gap-2">
                <StatutIcon statut={r.statut} className="h-4 w-4 shrink-0" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{r.label}</p>
                  <p className="truncate text-[11px] italic text-muted-foreground">{r.detail}</p>
                </div>
              </div>
              <span
                className={cn(
                  'shrink-0 text-xs font-bold',
                  NUM,
                  r.statut === 'ko' ? 'text-destructive' : r.statut === 'na' ? 'text-muted-foreground' : 'text-success',
                )}
              >
                {r.ecart === undefined ? '—' : `± ${fmtEuro(r.ecart)}`}
              </span>
            </div>
          ))}
        </div>

        {/* Chiffres clés */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Kpi label="Total CIRIL" value={res.totalCiril === undefined ? '—' : fmtEuro(res.totalCiril, 0)} />
          <Kpi label="Paie" value={res.totalPaie === undefined ? '—' : fmtEuro(res.totalPaie, 0)} />
          <Kpi label="Charges" value={res.totalCharges === undefined ? '—' : fmtEuro(res.totalCharges, 0)} />
          <Kpi label="URSSAF" value={res.urssaf === undefined ? '—' : fmtEuro(res.urssaf, 0)} />
          <Kpi label="PAS" value={res.pas === undefined ? '—' : fmtEuro(res.pas)} />
          <Kpi label="Anomalies" value={String(res.nbAnomalies)} />
        </div>

        {res.titreArrondi && (
          <div className="flex items-start gap-2 rounded-md border border-amber-300/30 bg-amber-400/10 px-3 py-2 text-xs font-medium text-amber-300">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Titre d'arrondi PAS à émettre ({fmtEuro(res.pasEcartArrondi ?? 0)}) — n° de bordereau à saisir.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* --------------------------- Détail par contrôle (aperçu type Excel) --------------------------- */

// La matrice détaillée (valeurs C→I + écarts J→O) vit désormais dans l'onglet
// « Contrôle approfondi » (ControleApprofondi.tsx) pour garder cet onglet épuré.

const EXT_OK = /\.(pdf|xlsx|xlsm|slk|csv)$/i;

/** Lit récursivement un FileSystemEntry (fichier ou dossier déposé). */
async function readEntry(entry: any): Promise<File[]> {
  if (!entry) return [];
  if (entry.isFile) {
    return new Promise((res) => entry.file((f: File) => res([f]), () => res([])));
  }
  if (entry.isDirectory) {
    const reader = entry.createReader();
    const readBatch = (): Promise<any[]> =>
      new Promise((res) => reader.readEntries((es: any[]) => res(es), () => res([])));
    const out: File[] = [];
    let batch = await readBatch();
    while (batch.length) {
      for (const e of batch) out.push(...(await readEntry(e)));
      batch = await readBatch();
    }
    return out;
  }
  return [];
}

/**
 * Récupère les fichiers d'un dépôt, en gérant les DOSSIERS déposés
 * (Extraction VILLE / CCAS). Les entries sont capturées de façon synchrone.
 */
async function filesFromDataTransfer(dt: DataTransfer): Promise<File[]> {
  const entries: any[] = [];
  if (dt.items && dt.items.length) {
    for (let i = 0; i < dt.items.length; i++) {
      const e = (dt.items[i] as any).webkitGetAsEntry?.();
      if (e) entries.push(e);
    }
  }
  if (entries.length === 0) return Array.from(dt.files).filter((f) => EXT_OK.test(f.name));
  const out: File[] = [];
  for (const e of entries) out.push(...(await readEntry(e)));
  const filtered = out.filter((f) => EXT_OK.test(f.name));
  return filtered.length ? filtered : Array.from(dt.files).filter((f) => EXT_OK.test(f.name));
}

/* --------------------- Détail par contrôle (aperçu type Excel « Détail Ville/CCAS ») --------------------- */

/** Ligne d'un bloc clé/valeur (PAS, vérifications globales). */
function KV({ label, value, accent }: { label: string; value?: number; accent?: 'amber' }) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 px-3 py-1.5 text-xs',
        accent === 'amber' && 'bg-amber-400/10',
      )}
    >
      <span className={cn(accent === 'amber' ? 'font-semibold text-amber-300' : 'text-muted-foreground')}>{label}</span>
      <span className={cn('font-bold', NUM, accent === 'amber' ? 'text-amber-300' : 'text-foreground')}>
        {value === undefined ? '—' : fmtEuro(value)}
      </span>
    </div>
  );
}

function DetailEntite({ res }: { res: EntiteResultat }) {
  const meta = ENTITE_META[res.entite];
  const Icon = meta.icon;
  const P = PARAM[res.entite];
  const v = (code: string, col: 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I') =>
    res.lignes.find((l) => l.code === code)?.valeurs[col];
  const reco = (id: string): Statut => res.reconciliations.find((r) => r.id === id)?.statut ?? 'na';

  // Le PAS a son propre bloc → on l'exclut du tableau par tiers.
  const lignes = res.lignes.filter((l) => l.code !== P.pas);

  return (
    <Card className="print-clean overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 border-b">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-primary">
            <Icon className="h-4 w-4" />
          </span>
          <CardTitle className="text-sm font-bold uppercase tracking-wide text-secondary-foreground">
            Détail — {meta.label}
          </CardTitle>
        </div>
        <Badge variant={res.statut === 'ok' ? 'success' : res.statut === 'ko' ? 'destructive' : 'secondary'}>
          {res.nbAnomalies} anomalie(s)
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4 p-4">
        {!res.renseigne ? (
          <p className="text-sm italic text-muted-foreground">Aucune donnée pour {meta.label}.</p>
        ) : (
          <>
            {/* Montants par contrôle (1 · 2 · 6 + écart 1−2) */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="py-1.5 pr-2 text-left font-semibold">Tiers</th>
                    <th className="py-1.5 px-2 text-right font-semibold">1 · Génér. budgétaire</th>
                    <th className="py-1.5 px-2 text-right font-semibold">2 · État des charges</th>
                    <th className="py-1.5 px-2 text-right font-semibold">6 · DSN bloc 81</th>
                    <th className="py-1.5 px-2 text-right font-semibold">Écart 1−2</th>
                    <th className="py-1.5 pl-2 text-center font-semibold">✓</th>
                  </tr>
                </thead>
                <tbody>
                  {lignes.map((l) => {
                    const c = v(l.code, 'C');
                    const d = v(l.code, 'D');
                    const g = v(l.code, 'G');
                    const ecart = round2((c ?? 0) - (d ?? 0));
                    const ok = Math.abs(ecart) <= TOLERANCE;
                    return (
                      <tr key={l.code} className={cn('border-b border-border/40', !ok && 'bg-destructive/10')}>
                        <td className="py-1.5 pr-2">
                          <span className={cn('font-medium', ok ? 'text-foreground' : 'text-destructive')}>
                            {l.libelle || l.code}
                          </span>
                        </td>
                        <td className={cn('py-1.5 px-2 text-right text-foreground', NUM)}>{fmtEuro(c ?? 0)}</td>
                        <td className={cn('py-1.5 px-2 text-right text-foreground', NUM)}>{fmtEuro(d ?? 0)}</td>
                        <td className={cn('py-1.5 px-2 text-right', NUM, g === undefined ? 'text-muted-foreground/40' : 'text-foreground')}>
                          {g === undefined ? '—' : fmtEuro(g)}
                        </td>
                        <td className={cn('py-1.5 px-2 text-right', NUM, ok ? 'text-muted-foreground' : 'font-bold text-destructive')}>
                          {fmtEuro(ecart)}
                        </td>
                        <td className="py-1.5 pl-2 text-center">
                          {ok ? (
                            <CheckCircle2 className="mx-auto h-3.5 w-3.5 text-success" />
                          ) : (
                            <span className="font-bold text-destructive">!</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] italic text-muted-foreground">
              Bloc 81 URSSAF = URSSAF + URSSAF CSG regroupés. « — » = pas de bloc 81 pour ce tiers.
            </p>

            {/* Prélèvement à la source (PAS) — contrôles 1 · 7 · 8 · 9 */}
            <div className="overflow-hidden rounded-md border border-border">
              <p className="border-b border-border bg-muted/40 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-secondary-foreground">
                Prélèvement à la source (PAS) — contrôles 1 · 7 · 8 · 9
              </p>
              <div className="divide-y divide-border/40">
                <KV label="Génération budgétaire (sans cts)" value={v(P.pas, 'C')} />
                <KV label="Décompte — somme mise en paiement" value={v(P.pas, 'E')} />
                <KV label="Bloc 50 — montant PAS (contrôle 7)" value={v(P.pas, 'H')} />
                <KV label="Journal 1691/1694/1697 (contrôle 9)" value={v(P.pas, 'F')} />
                <KV label="Prélèvement effectué (avec cts)" value={res.totalPrelevement} />
                <KV label="Arrondi du PAS → titre à émettre" value={res.pasEcartArrondi} accent="amber" />
              </div>
            </div>

            {/* Vérifications globales — contrôles 3 · 5 + bouclage */}
            <div className="overflow-hidden rounded-md border border-border">
              <p className="border-b border-border bg-muted/40 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-secondary-foreground">
                Vérifications globales — contrôles 3 · 5 + bouclage
              </p>
              <div className="divide-y divide-border/40">
                {[
                  { label: 'URSSAF détaillé (contrôle 3) = budgétaire + CSG', value: res.urssaf, st: reco('urssaf') },
                  { label: 'Paies numéraires (contrôle 5) = budgétaire', value: res.totalPaie, st: reco('paies') },
                  { label: 'PAIE + CHARGES = total fichier CIRIL', value: res.totalCiril, st: reco('paie-charges') },
                ].map((r) => (
                  <div key={r.label} className="flex items-center justify-between gap-3 px-3 py-1.5 text-xs">
                    <span className="text-muted-foreground">{r.label}</span>
                    <span className="flex items-center gap-2">
                      <span className={cn('font-bold text-foreground', NUM)}>
                        {r.value === undefined ? '—' : fmtEuro(r.value)}
                      </span>
                      {r.st === 'ok' ? (
                        <Badge variant="success">✓ OK</Badge>
                      ) : r.st === 'ko' ? (
                        <Badge variant="destructive">écart</Badge>
                      ) : (
                        <Badge variant="secondary">—</Badge>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/* ------------------------------ Onglet ------------------------------ */

export default function ControleTiers() {
  const [data, setData] = useState<Record<EntiteKey, EntiteData>>(loadData);
  const [source, setSource] = useState('Exemple — juin 2026');
  const [info, setInfo] = useState<{ kind: 'ok' | 'warn'; text: string } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<LogLine[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const csvRef = useRef<HTMLInputElement>(null);
  const loadedRef = useRef(false); // false = exemple démo ; true = données chargées (cumul des dépôts)

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      /* ignore */
    }
  }, [data]);

  const results = useMemo(() => ENTITES.map((e) => computeEntite(e, data[e] ?? { tiers: [], totaux: {} })), [data]);

  /** Chemin PRINCIPAL : lecture des fichiers bruts CIRIL (PDF / xlsx / xlsm / slk). */
  async function handleRawFiles(files: FileList | File[] | null) {
    const arr = files ? Array.from(files) : [];
    if (arr.length === 0) return;
    // Un dépôt 100 % CSV ⇒ on bascule sur l'import CSV (chemin secondaire).
    if (arr.every((f) => f.name.toLowerCase().endsWith('.csv'))) {
      return handleCsvFile(arr[0]);
    }
    setBusy(true);
    setInfo(null);
    try {
      // Import paresseux : ctExtract charge pdf.js / xlsx à la demande (jamais en SSR).
      const { aggregate } = await import('../lib/ctExtract');
      const { data: parsed, log: logLines, errors: errs } = await aggregate(arr);
      const updated = ENTITES.filter((e) => aDesDonnees(parsed[e]));
      if (updated.length === 0) {
        setLog(logLines);
        setErrors(errs);
        setInfo({
          kind: 'warn',
          text: 'Aucune valeur extraite — vérifiez que les fichiers sont bien les éditions CIRIL attendues.',
        });
      } else {
        // CUMUL fichier par fichier : on AJOUTE les contrôles du dépôt aux données
        // déjà chargées (fusion par Code Tiers × colonne), pour Ville comme CCAS.
        // Déposer le budgétaire puis le bloc 50 conserve les deux ; l'autre entité
        // est préservée. Une même colonne re-déposée est mise à jour.
        const wasLoaded = loadedRef.current;
        const base = wasLoaded ? data : emptyData();
        const merged: Record<EntiteKey, EntiteData> = {
          VILLE: updated.includes('VILLE') ? mergeEntiteData(base.VILLE, parsed.VILLE!) : base.VILLE,
          CCAS: updated.includes('CCAS') ? mergeEntiteData(base.CCAS, parsed.CCAS!) : base.CCAS,
        };
        // Journal de traçabilité : on cumule les dépôts en dédupliquant
        // (même fichier + même entité + même contrôle).
        const prevLog = wasLoaded ? log : [];
        const seen = new Set<string>();
        const mergedLog = [...prevLog, ...logLines].filter((l) => {
          const k = `${l.name}|${l.entite}|${l.controle}`;
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        });
        loadedRef.current = true;
        setData(merged);
        setLog(mergedLog);
        setErrors(wasLoaded ? [...errors, ...errs] : errs);
        setSource(`Ville ${merged.VILLE.tiers.length} tiers · CCAS ${merged.CCAS.tiers.length} tiers`);
        setInfo({ kind: 'ok', text: `${updated.join(' + ')} cumulé(s) · ${arr.length} fichier(s) ajouté(s).` });
      }
    } catch (e) {
      setInfo({ kind: 'warn', text: `Lecture impossible : ${(e as Error).message?.slice(0, 120) ?? 'erreur'}` });
    } finally {
      setBusy(false);
    }
  }

  /** Chemin SECONDAIRE : import du CSV compagnon. */
  async function handleCsvFile(f?: File | null) {
    if (!f) return;
    try {
      const text = await f.text();
      const { data: parsed, lignesReconnues, lignesIgnorees, erreur } = parseCsv(text);
      if (erreur) return setInfo({ kind: 'warn', text: erreur });
      if (Object.keys(parsed).length === 0) {
        return setInfo({
          kind: 'warn',
          text: `Aucune donnée reconnue (${lignesIgnorees} ligne(s) ignorée(s)).`,
        });
      }
      loadedRef.current = true;
      setData((prev) => ({ ...emptyData(), ...prev, ...parsed }));
      setLog([]);
      setErrors([]);
      setSource(f.name);
      setInfo({ kind: 'ok', text: `${lignesReconnues} valeur(s) importée(s) du CSV · ${lignesIgnorees} ignorée(s).` });
    } catch {
      setInfo({ kind: 'warn', text: 'Lecture du CSV impossible.' });
    }
  }

  /** Export Excel direct : classeur .xlsx prêt à l'emploi (Synthèse + Détail
   *  Ville/CCAS), déjà rempli et contrôlé — sans macro ni import CSV. */
  async function exportXlsx() {
    try {
      const { exportControleXlsx } = await import('../lib/ctExport');
      await exportControleXlsx(results);
      setInfo({ kind: 'ok', text: 'Classeur Excel généré (controle_tiers.xlsx).' });
    } catch (e) {
      setInfo({ kind: 'warn', text: `Export Excel impossible : ${(e as Error).message?.slice(0, 100) ?? 'erreur'}` });
    }
  }

  /** Pont vers Excel : exporte les données courantes au format compagnon
   *  (import_controle_tiers.csv) ré-injectable dans le .xlsm via la macro. */
  function exportCsv() {
    const csv = '\uFEFF' + toCsvModele(data); // BOM UTF-8 pour Excel
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'import_controle_tiers.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  function resetDemo() {
    loadedRef.current = false;
    setData(DEMO_JUIN);
    setSource('Exemple — juin 2026');
    setLog([]);
    setErrors([]);
    setInfo(null);
  }

  /** Vide tout (Ville + CCAS) pour repartir d'une feuille blanche. */
  function clearAll() {
    loadedRef.current = true;
    setData(emptyData());
    setSource('Aucune donnée');
    setLog([]);
    setErrors([]);
    setInfo(null);
  }

  return (
    <div className="animate-fade-up space-y-5">
      {/* En-tête */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className={cn('text-xl font-bold tracking-tight text-foreground', NUM)}>Contrôle Tiers</h2>
          <p className="text-sm text-muted-foreground">
            Rapprochement de paie · Ville &amp; CCAS · <span className="font-semibold text-foreground">{source}</span>
          </p>
        </div>
        <div className="no-print flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            <Upload className="h-4 w-4" /> Lire des fichiers CIRIL
          </Button>
          <Button variant="outline" onClick={exportXlsx}>
            <FileSpreadsheet className="h-4 w-4" /> Exporter Excel
          </Button>
          <Button variant="ghost" onClick={() => csvRef.current?.click()}>
            <FileText className="h-4 w-4" /> Importer un CSV
          </Button>
          <Button variant="ghost" onClick={exportCsv}>
            <FileDown className="h-4 w-4" /> Exporter le CSV
          </Button>
          <Button variant="ghost" onClick={resetDemo}>
            <RotateCcw className="h-4 w-4" /> Exemple
          </Button>
          <Button variant="ghost" onClick={clearAll} className="text-destructive hover:text-destructive">
            <Trash2 className="h-4 w-4" /> Vider
          </Button>
          <input
            ref={fileRef}
            type="file"
            multiple
            accept=".pdf,.xlsx,.xlsm,.slk,.csv"
            className="hidden"
            onChange={(e) => handleRawFiles(e.target.files)}
          />
          <input ref={csvRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => handleCsvFile(e.target.files?.[0])} />
        </div>
      </div>

      {/* Zone de dépôt (fichiers bruts) */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          filesFromDataTransfer(e.dataTransfer).then((files) => handleRawFiles(files));
        }}
        onClick={() => !busy && fileRef.current?.click()}
        className={cn(
          'no-print flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors',
          dragging ? 'border-primary bg-primary/10' : 'border-border bg-card/40 hover:border-primary/50',
          busy && 'pointer-events-none opacity-70',
        )}
      >
        {busy ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : <Upload className="h-5 w-5 text-primary" />}
        <p className="text-sm font-semibold text-foreground">
          {busy
            ? 'Lecture en cours…'
            : 'Glissez les dossiers Extraction VILLE / CCAS (ou des fichiers PDF, xlsx, xlsm, slk)'}
        </p>
        <p className="text-xs text-muted-foreground">
          Dépôt de dossiers entiers accepté. Les 9 contrôles sont reconnus par leur contenu — lecture 100 % locale
          (aucun envoi serveur).
        </p>
        {info && (
          <p className={cn('mt-1 text-xs font-medium', info.kind === 'ok' ? 'text-success' : 'text-amber-300')}>{info.text}</p>
        )}
      </div>

      {/* Journal de détection + erreurs */}
      {(log.length > 0 || errors.length > 0) && (
        <div className="no-print rounded-lg border border-border bg-card/50 p-3 text-xs">
          {log.length > 0 && (
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {log.map((l, i) => (
                <span key={i} className="inline-flex items-center gap-1.5">
                  <Badge variant={l.entite === '?' ? 'secondary' : 'outline'} className="px-1.5 py-0 text-[10px]">
                    {l.entite}
                  </Badge>
                  <span className="text-muted-foreground">
                    {l.controle ? `contrôle ${l.controle} (${CTRL_NOMS[l.controle]})` : 'non reconnu'}
                  </span>
                  <span className="text-muted-foreground/60">←</span>
                  <span className="font-medium text-foreground">{l.name}</span>
                </span>
              ))}
            </div>
          )}
          {errors.length > 0 && (
            <ul className="mt-2 space-y-0.5 border-t border-border pt-2 text-amber-300">
              {errors.map((e, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {e}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Synthèse */}
      <div>
        <h3 className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-secondary-foreground">
          <ShieldCheck className="h-4 w-4 text-primary" /> Synthèse — la paie est-elle équilibrée ?
        </h3>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {results.map((r) => (
            <SyntheseCard key={r.entite} res={r} />
          ))}
        </div>
      </div>

      {/* Détail par contrôle (aperçu type tableur) */}
      <div>
        <h3 className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-secondary-foreground">
          <FileSearch className="h-4 w-4 text-primary" /> Détail par contrôle
        </h3>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {results.map((r) => (
            <DetailEntite key={r.entite} res={r} />
          ))}
        </div>
      </div>

      {/* Note */}
      <div className="flex items-start gap-2 rounded-lg border border-border bg-card/50 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
        <span>
          Lecture 100 % locale des éditions CIRIL (PDF via pdf.js · tableurs via SheetJS). Chaque fichier est identifié{' '}
          <strong>par son contenu</strong>, jamais par son nom. Rapprochement par <strong>Code Tiers</strong> (un tiers =
          une ligne, colonnes C→I, écarts J→O). L'écart de centimes sur le PAS est attendu (→ titre d'arrondi, jamais une
          anomalie). Régul. bloc 56 et n° de bordereau : saisie manuelle dans CIRIL.
          {' '}
          <strong className="text-foreground">Pont vers Excel</strong> : « Exporter le CSV » produit{' '}
          <code className="rounded bg-muted px-1">import_controle_tiers.csv</code>, ré-injectable dans le tableau{' '}
          <code className="rounded bg-muted px-1">.xlsm</code> via la macro <code className="rounded bg-muted px-1">ImporterControleTiers</code>.
        </span>
      </div>
    </div>
  );
}
