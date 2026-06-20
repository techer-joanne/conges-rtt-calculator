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
} from 'lucide-react';
import { fmtEuro } from '../lib/calc';
import {
  computeEntite,
  parseCsv,
  toCsvModele,
  DEMO_JUIN,
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

const STORAGE_KEY = 'conges-rtt-trappes:ct:v1';
const NUM = "font-['Space_Grotesk'] tabular-nums";
const ENTITES: EntiteKey[] = ['VILLE', 'CCAS'];
const ENTITE_META: Record<EntiteKey, { label: string; code: string; icon: typeof Building2 }> = {
  VILLE: { label: 'Ville', code: '001', icon: Building2 },
  CCAS: { label: 'CCAS', code: '004', icon: Landmark },
};

const fmtE = (v?: number) => (v === undefined ? '—' : fmtEuro(v));

function StatutIcon({ statut, className }: { statut: Statut; className?: string }) {
  if (statut === 'ok') return <CheckCircle2 className={cn('text-success', className)} />;
  if (statut === 'ko') return <XCircle className={cn('text-destructive', className)} />;
  return <MinusCircle className={cn('text-muted-foreground', className)} />;
}

function StatutBadge({ statut }: { statut: Statut }) {
  if (statut === 'ok') return <Badge variant="success">✓ Équilibrée</Badge>;
  if (statut === 'ko') return <Badge variant="destructive">Anomalie</Badge>;
  return <Badge variant="secondary">Incomplet</Badge>;
}

function loadData(): Record<EntiteKey, EntiteData> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<Record<EntiteKey, EntiteData>>;
      return { VILLE: p.VILLE ?? {}, CCAS: p.CCAS ?? {} };
    }
  } catch {
    /* ignore */
  }
  return DEMO_JUIN;
}

/* --------------------------- Sous-composants --------------------------- */

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
            <CardTitle className="text-sm font-bold uppercase tracking-wide text-secondary-foreground">
              {meta.label}
            </CardTitle>
            <p className="text-[11px] font-medium text-muted-foreground">Établissement {meta.code}</p>
          </div>
        </div>
        <StatutBadge statut={res.statut} />
      </CardHeader>
      <CardContent className="space-y-1 p-0">
        {res.reconciliations.map((r) => (
          <div key={r.id} className="flex items-center justify-between gap-3 px-4 py-2.5 odd:bg-muted/40">
            <div className="flex min-w-0 items-center gap-2">
              <StatutIcon statut={r.statut} className="h-4 w-4 shrink-0" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{r.label}</p>
                <p className="truncate text-[11px] italic text-muted-foreground">{r.detail}</p>
              </div>
            </div>
            <span
              className={cn(
                'shrink-0 text-right text-xs font-bold',
                NUM,
                r.statut === 'ko' ? 'text-destructive' : r.statut === 'ok' ? 'text-success' : 'text-muted-foreground',
              )}
            >
              {r.ecart === undefined ? '—' : `écart ${fmtEuro(r.ecart)}`}
            </span>
          </div>
        ))}

        {res.titreArrondi && (
          <div className="flex items-start gap-2 border-t border-amber-300/30 bg-amber-400/10 px-4 py-2.5 text-xs font-medium text-amber-300">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Titre d'arrondi PAS à émettre ({fmtEuro(res.pasEcartArrondi ?? 0)}) — n° de bordereau à saisir.
          </div>
        )}
      </CardContent>
    </Card>
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
          Détail {meta.label} — 9 contrôles
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="w-8 text-center">#</TableHead>
              <TableHead>Contrôle</TableHead>
              <TableHead className="w-16">Source</TableHead>
              <TableHead className="text-right">Montant</TableHead>
              <TableHead className="w-12 text-center">État</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {res.controles.map((c) => (
              <TableRow key={c.n}>
                <TableCell className="text-center text-xs font-bold text-muted-foreground">{c.n}</TableCell>
                <TableCell className="font-semibold text-foreground">{c.label}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{c.source}</TableCell>
                <TableCell className={cn('text-right font-bold text-foreground', NUM)}>{fmtE(c.value)}</TableCell>
                <TableCell className="text-center">
                  <StatutIcon statut={c.statut} className="mx-auto h-4 w-4" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
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
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      /* ignore */
    }
  }, [data]);

  const results = useMemo(
    () => ENTITES.map((e) => computeEntite(e, data[e] ?? {})),
    [data],
  );

  async function handleFiles(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    try {
      const text = await f.text();
      const { data: parsed, lignesReconnues, lignesIgnorees, erreur } = parseCsv(text);
      if (erreur) return setInfo({ kind: 'warn', text: erreur });
      if (Object.keys(parsed).length === 0) {
        return setInfo({
          kind: 'warn',
          text: `Aucune valeur reconnue (${lignesIgnorees} ligne(s) ignorée(s)). Dépose ton « Exemple import controle tiers.csv » et j'aligne le format.`,
        });
      }
      setData((prev) => ({ ...prev, ...parsed }));
      setSource(f.name);
      setInfo({ kind: 'ok', text: `${lignesReconnues} valeur(s) importée(s) · ${lignesIgnorees} ignorée(s).` });
    } catch {
      setInfo({ kind: 'warn', text: 'Lecture du fichier impossible.' });
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
    setInfo(null);
  }

  return (
    <div className="animate-fade-up space-y-5">
      {/* En-tête */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className={cn('text-xl font-bold tracking-tight text-foreground', NUM)}>Contrôle Tiers</h2>
          <p className="text-sm text-muted-foreground">
            Rapprochement de paie — 9 contrôles · Ville &amp; CCAS · <span className="font-semibold text-foreground">{source}</span>
          </p>
        </div>
        <div className="no-print flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => inputRef.current?.click()}>
            <Upload className="h-4 w-4" /> Importer un CSV
          </Button>
          <Button variant="ghost" onClick={downloadModele}>
            <FileDown className="h-4 w-4" /> Modèle CSV
          </Button>
          <Button variant="ghost" onClick={resetDemo}>
            <RotateCcw className="h-4 w-4" /> Exemple
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
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
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={cn(
          'no-print flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors',
          dragging ? 'border-primary bg-primary/10' : 'border-border bg-card/40 hover:border-primary/50',
        )}
      >
        <Upload className="h-5 w-5 text-primary" />
        <p className="text-sm font-semibold text-foreground">Glissez-déposez le CSV de l'outil compagnon</p>
        <p className="text-xs text-muted-foreground">
          (sortie « import_controle_tiers.csv ») — ou cliquez pour parcourir
        </p>
        {info && (
          <p className={cn('mt-1 text-xs font-medium', info.kind === 'ok' ? 'text-success' : 'text-amber-300')}>
            {info.text}
          </p>
        )}
      </div>

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

      {/* Détail */}
      <div>
        <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-secondary-foreground">Détail des contrôles</h3>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {results.map((r) => (
            <DetailCard key={r.entite} res={r} />
          ))}
        </div>
      </div>

      {/* Note */}
      <div className="flex items-start gap-2 rounded-lg border border-border bg-card/50 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
        <span>
          Vue de synthèse (couche d'affichage). La lecture des PDF/CIRIL et la production du CSV restent assurées par
          l'outil compagnon. Montants d'exemple : juin 2026 — dépose ton CSV réel pour les remplacer. Régul. bloc 56 et
          n° de bordereau du titre d'arrondi : saisie manuelle dans CIRIL.
        </span>
      </div>
    </div>
  );
}
