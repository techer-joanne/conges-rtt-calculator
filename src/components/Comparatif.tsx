import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  Upload,
  FileSpreadsheet,
  Trash2,
  Info,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  TrainFront,
  Maximize2,
  Minimize2,
  FileDown,
} from 'lucide-react';
import { fmtEuro } from '../lib/calc';
import {
  A_AFFECTER,
  TRAIN_ORDER,
  applyAffectations,
  buildComparatif,
  correspToCsv,
  memoriserNouveaux,
  parseCorrespCsv,
  parseCorrespRows,
  type Corresp,
  type ComparatifResult,
} from '../lib/comparatif';
import { cn } from '../lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';

const NUM = "font-['Space_Grotesk'] tabular-nums";
const CORRESP_KEY = 'conges-rtt-trappes:comparatif:corresp:v1';
const EXT_OK = /\.(xlsx|xlsm|xls|slk|csv)$/i;

function loadCorresp(): Corresp {
  try {
    const raw = sessionStorage.getItem(CORRESP_KEY);
    if (raw) return JSON.parse(raw) as Corresp;
  } catch {
    /* ignore */
  }
  return {};
}

function FullscreenPortal({ active, children }: { active: boolean; children: ReactNode }) {
  if (!active) return <>{children}</>;
  return createPortal(<div className="fixed inset-0 z-[70] flex flex-col bg-background">{children}</div>, document.body);
}

const ecartClass = (v: number) => (v < -0.005 ? 'text-destructive' : v > 0.005 ? 'text-success' : 'text-muted-foreground');

function Kpi({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card/60 px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn('mt-0.5 text-lg font-bold', NUM, tone ?? 'text-foreground')}>{value}</p>
    </div>
  );
}

export default function Comparatif() {
  const [corresp, setCorresp] = useState<Corresp>(loadCorresp);
  const [result, setResult] = useState<ComparatifResult | null>(null);
  const [affect, setAffect] = useState<Record<string, string>>({});
  const [info, setInfo] = useState<{ kind: 'ok' | 'warn'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      sessionStorage.setItem(CORRESP_KEY, JSON.stringify(corresp));
    } catch {
      /* ignore */
    }
  }, [corresp]);

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setFullscreen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fullscreen]);

  const correspCount = Object.keys(corresp).length;
  const view = useMemo(() => (result ? applyAffectations(result, affect) : null), [result, affect]);

  const trainOptions = useMemo(() => {
    const set = new Set<string>(TRAIN_ORDER);
    view?.trains.forEach((t) => t.lib !== A_AFFECTER && set.add(t.lib));
    return [...set];
  }, [view]);

  async function handleFiles(files: FileList | File[] | null) {
    const arr = (files ? Array.from(files) : []).filter((f) => EXT_OK.test(f.name));
    if (arr.length === 0) return;
    setBusy(true);
    setInfo(null);
    try {
      const { readWorkbook } = await import('../lib/comparatifRead');
      let nextCorresp = { ...corresp };
      let correspAdded = 0;
      let built: ComparatifResult | null = null;
      let builtName = '';

      for (const f of arr) {
        if (f.name.toLowerCase().endsWith('.csv')) {
          const c = parseCorrespCsv(await f.text());
          nextCorresp = { ...nextCorresp, ...c };
          correspAdded += Object.keys(c).length;
          continue;
        }
        const wb = await readWorkbook(f);
        if (wb.names.some((n) => n.trim().toUpperCase() === 'CORRESP')) {
          const c = parseCorrespRows(wb.rows('CORRESP'));
          nextCorresp = { ...nextCorresp, ...c };
          correspAdded += Object.keys(c).length;
        } else {
          built = buildComparatif(wb.rows(), nextCorresp);
          builtName = f.name;
        }
      }

      setCorresp(nextCorresp);
      if (built) {
        if (built.erreur) setInfo({ kind: 'warn', text: built.erreur });
        else {
          setResult(built);
          setAffect({});
          setInfo({
            kind: 'ok',
            text: `${builtName} : ${built.agents.length} agents · ${built.trains.length} train(s) · ${built.nbAffecter} à affecter${
              built.hasTrainCol ? ' · train lu dans l’extraction' : ' · train via CORRESP'
            }.`,
          });
        }
      } else if (correspAdded > 0) {
        setInfo({ kind: 'ok', text: `CORRESP mis à jour (${Object.keys(nextCorresp).length} matricules en mémoire).` });
      } else {
        setInfo({ kind: 'warn', text: 'Fichier non reconnu (extraction .xlsx/.slk ou CORRESP .xlsm/.csv attendu).' });
      }
    } catch (e) {
      setInfo({ kind: 'warn', text: `Lecture impossible : ${(e as Error).message?.slice(0, 120) ?? 'erreur'}` });
    } finally {
      setBusy(false);
    }
  }

  function memoriser() {
    if (!view) return;
    const next = { ...corresp };
    const n = memoriserNouveaux(next, view.agents);
    if (n === 0) {
      setInfo({ kind: 'warn', text: 'Aucun nouveau matricule à mémoriser (affectez d’abord les agents « À affecter »).' });
      return;
    }
    setCorresp(next);
    setInfo({ kind: 'ok', text: `${n} matricule(s) ajouté(s) à CORRESP (mémorisés pour le mois prochain).` });
  }

  async function exporter() {
    if (!view) return;
    try {
      const { exportComparatifXlsx } = await import('../lib/comparatifExport');
      await exportComparatifXlsx(view);
      setInfo({ kind: 'ok', text: 'Classeur Excel généré (comparatif_net_par_train.xlsx).' });
    } catch (e) {
      setInfo({ kind: 'warn', text: `Export impossible : ${(e as Error).message?.slice(0, 100) ?? 'erreur'}` });
    }
  }

  function exporterCorresp() {
    const blob = new Blob([correspToCsv(corresp)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'corresp_trains.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  function vider() {
    setResult(null);
    setAffect({});
    setInfo(null);
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  return (
    <div className="animate-fade-up space-y-5">
      {/* En-tête */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className={cn('flex items-center gap-2 text-xl font-bold tracking-tight text-foreground', NUM)}>
            <TrainFront className="h-5 w-5 text-primary" /> Comparatif NET par train
          </h2>
          <p className="text-sm text-muted-foreground">
            Écart du NET à payer entre deux mois, regroupé par train ·{' '}
            <span className="font-semibold text-foreground">
              {view ? `${view.mois.m1} → ${view.mois.m2}` : 'déposez l’extraction du mois'}
            </span>
          </p>
        </div>
        <div className="no-print flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            <Upload className="h-4 w-4" /> Charger un fichier
          </Button>
          <Button variant="outline" onClick={exporter} disabled={!view}>
            <FileSpreadsheet className="h-4 w-4" /> Exporter Excel
          </Button>
          <Button variant="ghost" onClick={vider} className="text-destructive hover:text-destructive">
            <Trash2 className="h-4 w-4" /> Vider
          </Button>
          <input
            ref={fileRef}
            type="file"
            multiple
            accept=".xlsx,.xlsm,.xls,.slk,.csv"
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>
      </div>

      {/* Zone de dépôt */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          'no-print flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed px-6 py-7 text-center transition-colors',
          dragging ? 'border-primary bg-primary/10' : 'border-border bg-card/40',
        )}
      >
        {busy ? <Loader2 className="h-6 w-6 animate-spin text-primary" /> : <Upload className="h-6 w-6 text-primary" />}
        <p className="text-sm font-semibold text-foreground">
          {busy ? 'Lecture en cours…' : 'Glissez l’extraction mensuelle (.xlsx / .slk) — et une fois Outil_Comparatif_NET.xlsm (CORRESP)'}
        </p>
        <p className="text-xs text-muted-foreground">
          Le train est lu dans l’extraction ; CORRESP (mémorisée) sert de secours. Lecture 100 % locale, aucun envoi serveur.
        </p>
        {info && (
          <p className={cn('mt-1 text-xs font-medium', info.kind === 'ok' ? 'text-success' : 'text-amber-300')}>{info.text}</p>
        )}
      </div>

      {/* CORRESP en mémoire */}
      <div className="no-print flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant={correspCount > 0 ? 'outline' : 'secondary'}>CORRESP : {correspCount} matricule(s) en mémoire</Badge>
        {correspCount > 0 && (
          <>
            <button onClick={exporterCorresp} className="inline-flex items-center gap-1 text-primary hover:underline">
              <FileDown className="h-3 w-3" /> exporter la table
            </button>
            <button
              onClick={() => {
                setCorresp({});
                setInfo({ kind: 'ok', text: 'CORRESP oubliée.' });
              }}
              className="text-destructive hover:underline"
            >
              oublier
            </button>
          </>
        )}
        <span className="text-muted-foreground/70">(mémorisée le temps de la session uniquement)</span>
      </div>

      {!view ? null : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi label="Agents" value={String(view.agents.length)} />
            <Kpi label="Trains" value={String(view.trains.filter((t) => t.lib !== A_AFFECTER).length)} />
            <Kpi label={`Écart total ${view.mois.m1}→${view.mois.m2}`} value={fmtEuro(view.totalEcart)} tone={ecartClass(view.totalEcart)} />
            <Kpi label="À affecter" value={String(view.nbAffecter)} tone={view.nbAffecter ? 'text-amber-300' : 'text-success'} />
          </div>

          {/* À AFFECTER */}
          {view.nbAffecter > 0 && (
            <Card className="border-amber-300/30">
              <CardHeader className="flex flex-row items-center gap-2 space-y-0 border-b">
                <AlertTriangle className="h-4 w-4 text-amber-300" />
                <CardTitle className="text-sm font-bold text-amber-300">
                  À affecter — {view.nbAffecter} agent(s) sans train
                </CardTitle>
                <Button size="sm" variant="outline" className="ml-auto h-7 text-xs" onClick={memoriser}>
                  <CheckCircle2 className="h-3.5 w-3.5" /> Mémoriser dans CORRESP
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50 hover:bg-muted/50">
                        <TableHead>Matricule</TableHead>
                        <TableHead>Identité</TableHead>
                        <TableHead className="text-right">{view.mois.m1}</TableHead>
                        <TableHead className="text-right">{view.mois.m2}</TableHead>
                        <TableHead className="text-right">Écart</TableHead>
                        <TableHead>Affecter au train</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {view.agents
                        .filter((a) => a.trainLib === A_AFFECTER)
                        .map((a) => (
                          <TableRow key={a.matricule}>
                            <TableCell className={cn('font-semibold text-foreground', NUM)}>{a.matricule}</TableCell>
                            <TableCell className="text-foreground">{a.identite}</TableCell>
                            <TableCell className={cn('text-right', NUM)}>{a.m1 === undefined ? '—' : fmtEuro(a.m1)}</TableCell>
                            <TableCell className={cn('text-right', NUM)}>{a.m2 === undefined ? '—' : fmtEuro(a.m2)}</TableCell>
                            <TableCell className={cn('text-right font-semibold', NUM, ecartClass(a.ecart))}>{fmtEuro(a.ecart)}</TableCell>
                            <TableCell>
                              <select
                                value={affect[a.matricule] ?? ''}
                                onChange={(e) => setAffect((p) => ({ ...p, [a.matricule]: e.target.value }))}
                                className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
                              >
                                <option value="">—</option>
                                {trainOptions.map((t) => (
                                  <option key={t} value={t}>
                                    {t}
                                  </option>
                                ))}
                              </select>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Récap par train */}
          <Card className="print-clean overflow-hidden">
            <CardHeader className="border-b">
              <CardTitle className="text-sm font-bold uppercase tracking-wide text-secondary-foreground">Par train</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead>Train</TableHead>
                      <TableHead className="text-right">Agents</TableHead>
                      <TableHead className="text-right">{view.mois.m1}</TableHead>
                      <TableHead className="text-right">{view.mois.m2}</TableHead>
                      <TableHead className="text-right">Écart</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {view.trains.map((t) => (
                      <TableRow key={t.lib} className={t.lib === A_AFFECTER ? 'bg-amber-400/10' : undefined}>
                        <TableCell className="font-semibold text-foreground">
                          {t.lib} {t.no !== '' && <span className="text-[10px] text-muted-foreground">n°{t.no}</span>}
                        </TableCell>
                        <TableCell className={cn('text-right', NUM)}>{t.agents.length}</TableCell>
                        <TableCell className={cn('text-right', NUM)}>{fmtEuro(t.total1)}</TableCell>
                        <TableCell className={cn('text-right', NUM)}>{fmtEuro(t.total2)}</TableCell>
                        <TableCell className={cn('text-right font-bold', NUM, ecartClass(t.totalEcart))}>{fmtEuro(t.totalEcart)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="border-t-2 border-border bg-muted/40 font-bold hover:bg-muted/40">
                      <TableCell className="text-foreground">TOTAL</TableCell>
                      <TableCell className={cn('text-right', NUM)}>{view.agents.length}</TableCell>
                      <TableCell className={cn('text-right', NUM)}>{fmtEuro(view.total1)}</TableCell>
                      <TableCell className={cn('text-right', NUM)}>{fmtEuro(view.total2)}</TableCell>
                      <TableCell className={cn('text-right', NUM, ecartClass(view.totalEcart))}>{fmtEuro(view.totalEcart)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Détail global */}
          <FullscreenPortal active={fullscreen}>
            <Card className={cn('print-clean overflow-hidden', fullscreen && 'flex h-full w-full flex-col rounded-none border-0')}>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 border-b">
                <CardTitle className="text-sm font-bold uppercase tracking-wide text-secondary-foreground">
                  Détail global — {view.agents.length} agents
                </CardTitle>
                <Button
                  variant="outline"
                  size="icon"
                  className="no-print h-7 w-7"
                  onClick={() => setFullscreen((v) => !v)}
                  title={fullscreen ? 'Quitter le plein écran (Échap)' : 'Vue plein écran'}
                >
                  {fullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                </Button>
              </CardHeader>
              <CardContent className={cn('p-0', fullscreen && 'flex-1 overflow-auto')}>
                <div className="w-full overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50 hover:bg-muted/50">
                        <TableHead>Train</TableHead>
                        <TableHead>Matricule</TableHead>
                        <TableHead>Identité</TableHead>
                        <TableHead>Étab.</TableHead>
                        <TableHead className="text-right">{view.mois.m1}</TableHead>
                        <TableHead className="text-right">{view.mois.m2}</TableHead>
                        <TableHead className="text-right">Écart</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {view.agents.map((a, i) => (
                        <TableRow key={`${a.matricule}-${i}`} className={a.trainLib === A_AFFECTER ? 'bg-amber-400/10' : undefined}>
                          <TableCell className="whitespace-nowrap text-foreground">{a.trainLib}</TableCell>
                          <TableCell className={cn('text-foreground', NUM)}>{a.matricule}</TableCell>
                          <TableCell className="whitespace-nowrap text-foreground">{a.identite}</TableCell>
                          <TableCell className="text-muted-foreground">{a.libEtab || a.etab}</TableCell>
                          <TableCell className={cn('text-right text-xs', NUM)}>{a.m1 === undefined ? '—' : fmtEuro(a.m1)}</TableCell>
                          <TableCell className={cn('text-right text-xs', NUM)}>{a.m2 === undefined ? '—' : fmtEuro(a.m2)}</TableCell>
                          <TableCell className={cn('text-right text-xs font-semibold', NUM, ecartClass(a.ecart))}>{fmtEuro(a.ecart)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </FullscreenPortal>
        </>
      )}

      {/* Note */}
      <div className="flex items-start gap-2 rounded-lg border border-border bg-card/50 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
        <span>
          Le <strong className="text-foreground">train</strong> est lu directement dans l’extraction (colonnes « Train » /
          « Lib. Train »), repérées par leur intitulé. À défaut, la table <strong>CORRESP</strong> (matricule → train,
          chargée depuis <code className="rounded bg-muted px-1">Outil_Comparatif_NET.xlsm</code>) prend le relais ; sinon
          l’agent va dans « À affecter ». L’export Excel reproduit GLOBAL + un onglet par train. Traitement 100 % local.
        </span>
      </div>
    </div>
  );
}
