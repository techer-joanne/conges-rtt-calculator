import { Table2, Info } from 'lucide-react';
import type { SocleKey } from '../lib/calc';
import { SOCLES, QUOTITES, rttBareme, CA_BASE_ANNUEL, fmtJours } from '../lib/calc';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { cn } from '../lib/utils';

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-5">
        <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-secondary-foreground">{title}</h3>
        <div className="space-y-1.5 text-sm leading-relaxed text-muted-foreground">{children}</div>
      </CardContent>
    </Card>
  );
}

export default function Bareme({
  currentSocle,
  currentQuotite,
}: {
  currentSocle: SocleKey;
  currentQuotite: number;
}) {
  return (
    <div className="animate-fade-up space-y-6">
      <Card className="overflow-hidden">
        <CardHeader className="flex flex-row items-center gap-2 space-y-0 border-b">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Table2 className="h-4 w-4" />
          </span>
          <CardTitle className="text-base font-bold uppercase tracking-wide text-secondary-foreground">
            Barème RTT / ARTT — socle × quotité
          </CardTitle>
        </CardHeader>

        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/60 hover:bg-muted/60">
                <TableHead className="text-left">Socle horaire</TableHead>
                {QUOTITES.map((q) => (
                  <TableHead key={q} className={cn('text-right', q === currentQuotite && 'bg-accent text-accent-foreground')}>
                    {q} %
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {SOCLES.map((s) => {
                const isRow = s.key === currentSocle;
                return (
                  <TableRow key={s.key} className={cn(isRow ? 'bg-accent/60 font-bold text-foreground' : 'text-secondary-foreground')}>
                    <TableCell className="font-semibold">
                      {s.label}
                      {isRow && (
                        <Badge className="ml-2 px-2 py-0.5 text-[10px] uppercase">actuel</Badge>
                      )}
                    </TableCell>
                    {QUOTITES.map((q) => {
                      const cell = rttBareme(s.key, q);
                      const isCell = isRow && q === currentQuotite;
                      return (
                        <TableCell
                          key={q}
                          className={cn(
                            'text-right tabular-nums',
                            isCell
                              ? 'bg-primary font-bold text-primary-foreground'
                              : q === currentQuotite
                                ? 'bg-accent/60'
                                : '',
                          )}
                        >
                          {fmtJours(cell)}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          <p className="flex items-start gap-2 border-t bg-muted/40 px-5 py-3 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            RTT / ARTT annuels (base année pleine) selon le socle horaire et la quotité. Les socles 35 h et
            « Annualisation » n'ouvrent pas de RTT. Ces valeurs sont ensuite proratisées sur la période.
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <InfoCard title="Congés annuels (CA)">
          <p>
            Base de <strong>{CA_BASE_ANNUEL} jours</strong> par an pour un agent à temps plein sur une année
            complète.
          </p>
          <p>
            CA = 25 × quotité × prorata, arrondi à l'<strong>entier le plus proche</strong> (règle du 0,5 : à
            partir de 0,5, arrondi au jour supérieur).
          </p>
        </InfoCard>

        <InfoCard title="Prorata de la période">
          <p>Pour une prise de fonction ou un départ en cours d'année, les droits sont calculés au prorata.</p>
          <p>Prorata = nombre de jours calendaires de la période ÷ 365.</p>
        </InfoCard>

        <InfoCard title="RTT réelles (maladie)">
          <p>
            Pendant un congé de maladie, le temps de travail est ramené à 35 h (0 RTT). Les RTT sont réduites au
            prorata des jours ouvrés d'absence maladie.
          </p>
          <p>RTT réelles = RTT × (jours ouvrés − maladie) ÷ jours ouvrés.</p>
        </InfoCard>

        <InfoCard title="Journée de solidarité">
          <p>
            <strong>1 jour</strong> à effectuer, indiqué à titre d'information : il n'est{' '}
            <strong>pas déduit</strong> du total des droits.
          </p>
        </InfoCard>
      </div>
    </div>
  );
}
