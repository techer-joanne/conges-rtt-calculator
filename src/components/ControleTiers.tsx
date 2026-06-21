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
  Loader2,
} from 'lucide-react';
import { fmtEuro } from '../lib/calc';
import {
  computeEntite,
  parseCsv,
  toCsvModele,
  DEMO_JUIN,
  COLONNES,
  type EntiteKey,
  type EntiteData,
  type EntiteResultat,
  type Statut,
} from '../lib/controleTiers';
import { cn } from '../lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';

const STORAGE_KEY = 'conges-rtt-trappes:ct:v3';
const NUM = "font-['Space_Grotesk'] tabular-nums";
const ENTITES: EntiteKey[] = ['VILLE', 'CCAS'];
const ENTITE_META: Record<EntiteKey, { label: string; code: string; icon: typeof Building2 }> = {
  VILLE: { label: 'Ville', code: '001', icon: Building2 },
  CCAS: { label: 'CCAS', code: '004', icon: Landmark },
};
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

const fmtNum = (v?: number) =>
  v === undefined ? '·' : v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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

function loadData(): Record<EntiteKey, EntiteData> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
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

/* --------------------------- Détail (matrice) --------------------------- */

const ECARTS_META: { key: 'J' | 'K' | 'L' | 'M' | 'N' | 'O'; label: string }[] = [
  { key: 'J', label: 'J = C − D (budgétaire vs état des charges)' },
  { key: 'K', label: 'K = G − C (bloc 81 vs budgétaire)' },
  { key: 'L', label: 'L = G − D (bloc 81 vs état des charges)' },
  { key: 'M', label: 'M = D + H − F (PAS)' },
  { key: 'N', label: 'N = I − C (trésorerie vs budgétaire)' },
  { key: 'O', label: 'O = I − D (trésorerie vs état des charges)' },
];

function EcartCell({ res }: { res: EntiteResultat['lignes'][number] }) {
  const keys = ECARTS_META.filter((m) => res.ecarts[m.key] !== undefined);
  if (keys.length === 0) {
    return <span className="text-muted-foreground/40">·</span>;
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            'cursor-help',
            res.statut === 'ko' ? 'text-destructive' : res.arrondi ? 'text-amber-300' : 'text-muted-foreground',
          )}
        >
          {res.ecart === undefined ? '·' : fmtNum(res.ecart)}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <div className="space-y-0.5">
          {keys.map((m) => (
            <div key={m.key} className="flex justify-between gap-3">
              <span>{m.label}</span>
              <span className={cn(NUM, Math.abs(res.ecarts[m.key]!) > 0.01 ? 'text-amber-300' : '')}>
                {fmtNum(res.ecarts[m.key])}
              </span>
            </div>
          ))}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

function DetailCard({ res }: { res: EntiteResultat }) {
  const meta = ENTITE_META[res.entite];
  return (
    <Card className="print-clean overflow-hidden">
      <CardHeader className="flex flex-row items-center gap-2 space-y-0 border-b">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <ShieldCheck className="h-4 w-4" />
        </span>
        <CardTitle className="text-sm font-bold uppercase tracking-wide text-secondary-foreground">
          Détail {meta.label} — rapprochement par Code Tiers
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="w-full overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="text-left">Tiers</TableHead>
                {COLONNES.map((c) => (
                  <TableHead key={c.key} className="text-right" title={`${c.key} — ${c.label} (contrôle ${c.n})`}>
                    {c.court}
                  </TableHead>
                ))}
                <TableHead className="text-right" title="Écart J..O — survolez pour le détail">
                  Écart
                </TableHead>
                <TableHead className="w-10 text-center">État</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {res.lignes.map((l) => {
                const vide = COLONNES.every((c) => l.valeurs[c.key] === undefined);
                return (
                  <TableRow key={l.code} className={cn(vide && 'opacity-50')}>
                    <TableCell className="whitespace-nowrap">
                      <span className="font-semibold text-foreground">{l.libelle || l.code}</span>
                      <span className="ml-1.5 text-[10px] text-muted-foreground">{l.code}</span>
                    </TableCell>
                    {COLONNES.map((c) => (
                      <TableCell
                        key={c.key}
                        className={cn(
                          'text-right text-xs',
                          NUM,
                          l.valeurs[c.key] === undefined ? 'text-muted-foreground/40' : 'text-foreground',
                        )}
                      >
                        {fmtNum(l.valeurs[c.key])}
                      </TableCell>
                    ))}
                    <TableCell className={cn('text-right text-xs font-bold', NUM)}>
                      <EcartCell res={l} />
                    </TableCell>
                    <TableCell className="text-center">
                      {l.arrondi ? (
                        <AlertTriangle className="mx-auto h-4 w-4 text-amber-300" />
                      ) : (
                        <StatutIcon statut={l.statut} className="mx-auto h-4 w-4" />
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}

              {/* TOTAL FICHIER CIRIL */}
              {Object.keys(res.totaux).length > 0 && (
                <TableRow className="border-t-2 border-border bg-muted/40 font-bold hover:bg-muted/40">
                  <TableCell className="whitespace-nowrap text-foreground">Total fichier CIRIL</TableCell>
                  {COLONNES.map((c) => (
                    <TableCell key={c.key} className={cn('text-right text-xs text-foreground', NUM)}>
                      {fmtNum(res.totaux[c.key])}
                    </TableCell>
                  ))}
                  <TableCell />
                  <TableCell />
                </TableRow>
              )}

              {/* Bouclage PAIE + CHARGES = budgétaire */}
              {res.totalPaie !== undefined && res.totalCharges !== undefined && (
                <TableRow className="bg-muted/20 hover:bg-muted/20">
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground" colSpan={COLONNES.length + 1}>
                    Bouclage : Paie ({fmtNum(res.totalPaie)}) + Charges ({fmtNum(res.totalCharges)}) ={' '}
                    <span className={cn('font-semibold', NUM)}>{fmtNum(res.totalCiril)}</span> = budgétaire
                    {res.bouclage !== undefined && (
                      <span className="ml-1 text-muted-foreground">· écart {fmtNum(res.bouclage)}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <StatutIcon statut={res.bouclage === undefined ? 'na' : res.bouclage <= 0.01 ? 'ok' : 'ko'} className="mx-auto h-4 w-4" />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

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

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
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
      setLog(logLines);
      setErrors(errs);
      const nbVal = (Object.values(parsed) as EntiteData[]).reduce((n, ed) => n + ed.tiers.length, 0);
      if (nbVal === 0) {
        setInfo({
          kind: 'warn',
          text: 'Aucune valeur extraite — vérifiez que les fichiers sont bien les éditions CIRIL attendues.',
        });
      } else {
        setData(parsed);
        setSource(`${arr.length} fichier(s) CIRIL`);
        setInfo({ kind: 'ok', text: `${nbVal} ligne(s) de tiers extraite(s) de ${arr.length} fichier(s).` });
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
      setData((prev) => ({ ...emptyData(), ...prev, ...parsed }));
      setLog([]);
      setErrors([]);
      setSource(f.name);
      setInfo({ kind: 'ok', text: `${lignesReconnues} valeur(s) importée(s) du CSV · ${lignesIgnorees} ignorée(s).` });
    } catch {
      setInfo({ kind: 'warn', text: 'Lecture du CSV impossible.' });
    }
  }

  function downloadModele() {
    const blob = new Blob([toCsvModele(DEMO_JUIN)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'modele_controle_tiers.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  function resetDemo() {
    setData(DEMO_JUIN);
    setSource('Exemple — juin 2026');
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
          <Button variant="ghost" onClick={() => csvRef.current?.click()}>
            <FileText className="h-4 w-4" /> Importer un CSV
          </Button>
          <Button variant="ghost" onClick={downloadModele}>
            <FileDown className="h-4 w-4" /> Modèle CSV
          </Button>
          <Button variant="ghost" onClick={resetDemo}>
            <RotateCcw className="h-4 w-4" /> Exemple
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

      {/* Détail (matrice par Code Tiers) */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-wide text-secondary-foreground">Détail des 9 contrôles</h3>
        {results.map((r) => (
          <DetailCard key={r.entite} res={r} />
        ))}
        <p className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          {COLONNES.map((c) => (
            <span key={c.key}>
              <span className="font-semibold text-foreground">{c.court}</span> = {c.label} (contrôle {c.n})
            </span>
          ))}
        </p>
      </div>

      {/* Note */}
      <div className="flex items-start gap-2 rounded-lg border border-border bg-card/50 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
        <span>
          Lecture 100 % locale des éditions CIRIL (PDF via pdf.js · tableurs via SheetJS). Chaque fichier est identifié{' '}
          <strong>par son contenu</strong>, jamais par son nom. Rapprochement par <strong>Code Tiers</strong> (un tiers =
          une ligne, colonnes C→I, écarts J→O). L'écart de centimes sur le PAS est attendu (→ titre d'arrondi, jamais une
          anomalie). Régul. bloc 56 et n° de bordereau : saisie manuelle dans CIRIL.
        </span>
      </div>
    </div>
  );
}
