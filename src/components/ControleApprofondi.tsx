import { useMemo, useState } from 'react';
import {
  ScanSearch,
  Building2,
  Landmark,
  Printer,
  CheckCircle2,
  XCircle,
  MinusCircle,
  AlertTriangle,
} from 'lucide-react';
import { fmtEuro } from '../lib/calc';
import {
  computeEntite,
  DEMO_JUIN,
  COLONNES,
  PARAM,
  TOLERANCE,
  type EntiteKey,
  type EntiteData,
  type EntiteResultat,
  type Statut,
  type EcartKey,
} from '../lib/controleTiers';
import { cn } from '../lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';

const STORAGE_KEY = 'conges-rtt-trappes:ct:v3';
const NUM = "font-['Space_Grotesk'] tabular-nums";
const ENTITES: EntiteKey[] = ['VILLE', 'CCAS'];
const META: Record<EntiteKey, { label: string; code: string; icon: typeof Building2 }> = {
  VILLE: { label: 'Ville', code: '001', icon: Building2 },
  CCAS: { label: 'CCAS', code: '004', icon: Landmark },
};
const ECARTS: { key: EcartKey; label: string }[] = [
  { key: 'J', label: 'J = C − D' },
  { key: 'K', label: 'K = G − C (URSSAF : G − (C+CSG))' },
  { key: 'L', label: 'L = G − D' },
  { key: 'M', label: 'M = D + H − F (PAS)' },
  { key: 'N', label: 'N = I − C' },
  { key: 'O', label: 'O = I − D' },
];

const fmtNum = (v?: number) =>
  v === undefined ? '·' : v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function loadData(): Record<EntiteKey, EntiteData> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<Record<EntiteKey, EntiteData>>;
      if (Array.isArray(p.VILLE?.tiers) && Array.isArray(p.CCAS?.tiers)) return { VILLE: p.VILLE, CCAS: p.CCAS };
    }
  } catch {
    /* ignore */
  }
  return DEMO_JUIN;
}

function StatutIcon({ statut, className }: { statut: Statut; className?: string }) {
  if (statut === 'ok') return <CheckCircle2 className={cn('text-success', className)} />;
  if (statut === 'ko') return <XCircle className={cn('text-destructive', className)} />;
  return <MinusCircle className={cn('text-muted-foreground', className)} />;
}

/** Carte « bouclage » : quelques lignes chiffrées + un statut. */
function BouclageCard({
  title,
  hint,
  rows,
  ecart,
  statut,
}: {
  title: string;
  hint: string;
  rows: { label: string; value?: number }[];
  ecart?: number;
  statut: Statut;
}) {
  return (
    <Card className="print-clean">
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-2">
        <div>
          <CardTitle className="text-sm font-bold text-foreground">{title}</CardTitle>
          <p className="text-[11px] font-medium italic text-muted-foreground">{hint}</p>
        </div>
        <StatutIcon statut={statut} className="h-5 w-5 shrink-0" />
      </CardHeader>
      <CardContent className="space-y-1">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-3 text-xs">
            <span className="text-muted-foreground">{r.label}</span>
            <span className={cn('font-semibold text-foreground', NUM)}>{r.value === undefined ? '—' : fmtEuro(r.value)}</span>
          </div>
        ))}
        <div className="mt-1 flex items-center justify-between gap-3 border-t border-border pt-1.5 text-xs">
          <span className="font-semibold text-secondary-foreground">Écart</span>
          <span
            className={cn(
              'font-bold',
              NUM,
              statut === 'ko' ? 'text-destructive' : statut === 'na' ? 'text-muted-foreground' : 'text-success',
            )}
          >
            {ecart === undefined ? '—' : fmtEuro(ecart)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ControleApprofondi() {
  const [data] = useState<Record<EntiteKey, EntiteData>>(loadData);
  const [entite, setEntite] = useState<EntiteKey>('VILLE');

  const res: EntiteResultat = useMemo(() => computeEntite(entite, data[entite] ?? { tiers: [], totaux: {} }), [entite, data]);

  const P = PARAM[entite];
  const byCode = useMemo(() => new Map(res.lignes.map((l) => [l.code, l])), [res]);
  const gv = (code: string, col: 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I') => byCode.get(code)?.valeurs[col];

  const r = (id: string) => res.reconciliations.find((x) => x.id === id);
  const recoStatut = (id: string): Statut => r(id)?.statut ?? 'na';

  // URSSAF (3e contrôle) : (C+CSG) = (D+CSG) = bloc 81
  const urssafC = (gv(P.urssaf, 'C') ?? 0) + (gv(P.csg, 'C') ?? 0);
  const urssafD = (gv(P.urssaf, 'D') ?? 0) + (gv(P.csg, 'D') ?? 0);
  const urssafG = gv(P.urssaf, 'G');

  return (
    <div className="animate-fade-up space-y-5">
      {/* En-tête + sélecteur d'entité */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className={cn('text-xl font-bold tracking-tight text-foreground', NUM)}>Contrôle approfondi</h2>
          <p className="text-sm text-muted-foreground">
            Écarts détaillés J→O &amp; bouclages · données chargées depuis l'onglet <strong className="text-foreground">Contrôle Tiers</strong>
          </p>
        </div>
        <div className="no-print flex gap-2">
          <div className="flex rounded-md border border-border p-0.5">
            {ENTITES.map((e) => {
              const I = META[e].icon;
              return (
                <button
                  key={e}
                  onClick={() => setEntite(e)}
                  className={cn(
                    'flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-semibold transition-colors',
                    entite === e ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <I className="h-4 w-4" /> {META[e].label}
                </button>
              );
            })}
          </div>
          <Button variant="outline" className="no-print" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Imprimer / PDF
          </Button>
        </div>
      </div>

      {!res.renseigne ? (
        <Card className="print-clean">
          <CardContent className="flex items-center gap-2 p-5 text-sm text-muted-foreground">
            <ScanSearch className="h-4 w-4 text-primary" /> Aucune donnée pour {META[entite].label} — chargez les éditions
            CIRIL dans l'onglet « Contrôle Tiers ».
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Bouclages détaillés */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <BouclageCard
              title="Équilibre général"
              hint="Paie + Charges = budgétaire"
              rows={[
                { label: 'Paie (Trésorerie)', value: res.totalPaie },
                { label: 'Charges', value: res.totalCharges },
                { label: 'Budgétaire (CIRIL)', value: res.totalCiril },
              ]}
              ecart={res.bouclage}
              statut={res.bouclage === undefined ? 'na' : res.bouclage <= TOLERANCE ? 'ok' : 'ko'}
            />
            <BouclageCard
              title="URSSAF (3ᵉ contrôle)"
              hint="(C+CSG) = (D+CSG) = bloc 81"
              rows={[
                { label: 'Budgétaire + CSG', value: urssafC || undefined },
                { label: 'État charges + CSG', value: urssafD || undefined },
                { label: 'Bloc 81', value: urssafG },
              ]}
              ecart={r('urssaf')?.ecart}
              statut={recoStatut('urssaf')}
            />
            <BouclageCard
              title="PAS"
              hint="décompte = bloc 50 = journal"
              rows={[
                { label: 'Décompte (E)', value: gv(P.pas, 'E') },
                { label: 'Bloc 50 (H)', value: gv(P.pas, 'H') },
                { label: 'Journal (F)', value: gv(P.pas, 'F') },
                { label: 'Prélèvement (CIRIL)', value: res.totalPrelevement },
              ]}
              ecart={r('pas')?.ecart}
              statut={recoStatut('pas')}
            />
            <BouclageCard
              title="Trésorerie (342)"
              hint="paies numéraires = budgétaire"
              rows={[
                { label: 'Paies (I)', value: gv(P.treso, 'I') },
                { label: 'Budgétaire (C)', value: gv(P.treso, 'C') },
                { label: 'État charges (D)', value: gv(P.treso, 'D') },
              ]}
              ecart={r('paies')?.ecart}
              statut={recoStatut('paies')}
            />
          </div>

          {res.titreArrondi && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-300/30 bg-amber-400/10 px-4 py-2.5 text-xs font-medium text-amber-300">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Titre d'arrondi PAS à émettre ({fmtEuro(res.pasEcartArrondi ?? 0)}) — normal, pas une anomalie ; n° de
              bordereau à saisir dans CIRIL.
            </div>
          )}

          {/* Matrice approfondie : valeurs C→I + écarts J→O explicites */}
          <Card className="print-clean overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 border-b">
              <CardTitle className="text-sm font-bold uppercase tracking-wide text-secondary-foreground">
                Matrice — {META[entite].label} · valeurs &amp; écarts par tiers
              </CardTitle>
              <Badge variant={res.statut === 'ok' ? 'success' : res.statut === 'ko' ? 'destructive' : 'secondary'}>
                {res.nbAnomalies} anomalie(s)
              </Badge>
            </CardHeader>
            <CardContent className="p-0">
              <div className="w-full overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead className="text-left">Tiers</TableHead>
                      {COLONNES.map((c) => (
                        <TableHead key={c.key} className="text-right" title={`${c.label} (contrôle ${c.n})`}>
                          {c.key}
                        </TableHead>
                      ))}
                      {ECARTS.map((e) => (
                        <TableHead key={e.key} className="text-right text-amber-300/80" title={e.label}>
                          {e.key}
                        </TableHead>
                      ))}
                      <TableHead className="w-10 text-center">État</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {res.lignes.map((l) => {
                      const vide = COLONNES.every((c) => l.valeurs[c.key] === undefined);
                      return (
                        <TableRow key={l.code} className={cn(vide && 'opacity-40')}>
                          <TableCell className="whitespace-nowrap">
                            <span className="font-semibold text-foreground">{l.libelle || l.code}</span>
                            <span className="ml-1.5 text-[10px] text-muted-foreground">{l.code}</span>
                          </TableCell>
                          {COLONNES.map((c) => (
                            <TableCell
                              key={c.key}
                              className={cn('text-right text-xs', NUM, l.valeurs[c.key] === undefined ? 'text-muted-foreground/30' : 'text-foreground')}
                            >
                              {fmtNum(l.valeurs[c.key])}
                            </TableCell>
                          ))}
                          {ECARTS.map((e) => {
                            const v = l.ecarts[e.key];
                            const ko = v !== undefined && Math.abs(v) > TOLERANCE && !l.arrondi;
                            return (
                              <TableCell
                                key={e.key}
                                className={cn(
                                  'text-right text-xs',
                                  NUM,
                                  v === undefined ? 'text-muted-foreground/25' : ko ? 'font-bold text-destructive' : 'text-muted-foreground',
                                )}
                              >
                                {fmtNum(v)}
                              </TableCell>
                            );
                          })}
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
                    {Object.keys(res.totaux).length > 0 && (
                      <TableRow className="border-t-2 border-border bg-muted/40 font-bold hover:bg-muted/40">
                        <TableCell className="whitespace-nowrap text-foreground">Total fichier CIRIL</TableCell>
                        {COLONNES.map((c) => (
                          <TableCell key={c.key} className={cn('text-right text-xs text-foreground', NUM)}>
                            {fmtNum(res.totaux[c.key])}
                          </TableCell>
                        ))}
                        <TableCell colSpan={ECARTS.length + 1} />
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Légende écarts */}
          <p className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            {ECARTS.map((e) => (
              <span key={e.key}>
                <span className="font-semibold text-foreground">{e.key}</span> · {e.label}
              </span>
            ))}
            <span className="text-muted-foreground/70">Tous les écarts doivent valoir 0 (hors arrondi PAS).</span>
          </p>
        </>
      )}
    </div>
  );
}
