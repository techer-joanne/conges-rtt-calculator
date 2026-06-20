import { RotateCcw, User, Clock, Percent, CalendarDays, HeartPulse, HelpCircle, CheckCircle2, AlertTriangle } from 'lucide-react';
import type { Inputs, Results, SocleKey } from '../lib/calc';
import { SOCLES, QUOTITES } from '../lib/calc';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';

function FieldTip({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className="text-muted-foreground hover:text-primary" aria-label={text}>
          <HelpCircle className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent>{text}</TooltipContent>
    </Tooltip>
  );
}

export default function InputForm({
  inputs,
  onChange,
  onReset,
  results,
}: {
  inputs: Inputs;
  onChange: (patch: Partial<Inputs>) => void;
  onReset: () => void;
  results: Results;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base font-bold uppercase tracking-wide text-secondary-foreground">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <User className="h-4 w-4" />
          </span>
          Saisie
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={onReset} className="text-muted-foreground">
          <RotateCcw className="h-3.5 w-3.5" /> Réinitialiser
        </Button>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Nom */}
          <div className="sm:col-span-2">
            <Label htmlFor="nom" className="mb-1.5">
              <User className="h-3.5 w-3.5 text-primary" /> Nom de l'agent
            </Label>
            <Input
              id="nom"
              value={inputs.nom}
              placeholder="Ex. : Dupont Marie"
              onChange={(e) => onChange({ nom: e.target.value })}
            />
          </div>

          {/* Socle horaire */}
          <div>
            <Label className="mb-1.5">
              <Clock className="h-3.5 w-3.5 text-primary" /> Socle horaire
              <FieldTip text="Temps de travail hebdomadaire de référence. Au-delà de 35 h, l'écart génère des jours RTT (voir l'onglet Barème). 35 h et Annualisation n'ouvrent pas de RTT." />
            </Label>
            <Select value={inputs.socle} onValueChange={(v) => onChange({ socle: v as SocleKey })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SOCLES.map((s) => (
                  <SelectItem key={s.key} value={s.key}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Quotité */}
          <div>
            <Label className="mb-1.5">
              <Percent className="h-3.5 w-3.5 text-primary" /> Quotité de travail
              <FieldTip text="Part du temps plein effectivement travaillée (temps partiel). Le barème RTT dépend du couple socle × quotité (feuille Barèmes)." />
            </Label>
            <Select value={String(inputs.quotite)} onValueChange={(v) => onChange({ quotite: Number(v) })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {QUOTITES.map((q) => (
                  <SelectItem key={q} value={String(q)}>
                    {q} %
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Dates */}
          <div>
            <Label htmlFor="debut" className="mb-1.5">
              <CalendarDays className="h-3.5 w-3.5 text-primary" /> Date de début
            </Label>
            <Input id="debut" type="date" value={inputs.dateDebut} onChange={(e) => onChange({ dateDebut: e.target.value })} />
          </div>

          <div>
            <Label htmlFor="fin" className="mb-1.5">
              <CalendarDays className="h-3.5 w-3.5 text-primary" /> Date de fin / de départ
            </Label>
            <Input id="fin" type="date" value={inputs.dateFin} onChange={(e) => onChange({ dateFin: e.target.value })} />
          </div>

          {/* Maladie */}
          <div className="sm:col-span-2">
            <Label htmlFor="maladie" className="mb-1.5">
              <HeartPulse className="h-3.5 w-3.5 text-primary" /> Absence maladie (jours ouvrés)
              <FieldTip text="Jours ouvrés d'arrêt maladie sur la période. Les RTT sont réduites au prorata des jours ouvrés d'absence maladie (la maternité, la paternité et l'adoption ne réduisent pas les RTT)." />
            </Label>
            <Input
              id="maladie"
              type="number"
              min={0}
              value={inputs.joursMaladie}
              onChange={(e) => onChange({ joursMaladie: Number(e.target.value) })}
            />
          </div>
        </div>

        {/* Bandeau de validation */}
        {results.valid ? (
          <Alert variant="success">
            <CheckCircle2 />
            <AlertDescription className="font-medium">Saisie valide — résultats calculés ci-contre.</AlertDescription>
          </Alert>
        ) : (
          <Alert variant="warning">
            <AlertTriangle />
            <AlertTitle>Saisie à corriger</AlertTitle>
            <AlertDescription>
              <ul className="mt-1 list-inside list-disc">
                {results.errors.map((err) => (
                  <li key={err}>{err}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
