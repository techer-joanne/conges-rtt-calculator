import { useEffect, useMemo, useState } from 'react';
import { TooltipProvider } from './components/ui/tooltip';
import { Separator } from './components/ui/separator';
import { SidebarInset, SidebarProvider, SidebarTrigger } from './components/ui/sidebar';
import AppSidebar from './components/AppSidebar';
import { type TabId } from './components/Sidebar';
import Dashboard from './components/Dashboard';
import InputForm from './components/InputForm';
import ResultsPanel from './components/Results';
import TotalCard from './components/TotalCard';
import Depart from './components/Depart';
import Annualisation from './components/Annualisation';
import ControleTiers from './components/ControleTiers';
import Bareme from './components/Bareme';
import Notice from './components/Notice';
import {
  computeResults,
  computeAnnualisation,
  type Inputs,
  type AnnualisationInputs,
} from './lib/calc';

const STORAGE_KEY = 'conges-rtt-trappes:v1';
const STORAGE_KEY_ANNU = 'conges-rtt-trappes:annu:v1';

// Titre de section affiché dans la barre supérieure, dérivé de l'onglet actif.
const SECTION_TITLES: Record<TabId, string> = {
  dashboard: 'Tableau de bord',
  calculateur: 'Calculateur',
  depart: "Départ de l'agent",
  annualisation: 'Annualisation',
  'controle-tiers': 'Contrôle Tiers',
  bareme: 'Barème',
  notice: 'Notice',
};

// Exemple par défaut = celui du classeur Excel (année pleine → 43 j).
const DEFAULT_INPUTS: Inputs = {
  nom: '',
  socle: '38',
  quotite: 100,
  dateDebut: '2026-01-01',
  dateFin: '2026-12-31',
  joursMaladie: 0,
  congesDejaPris: 0,
  remunerationBrute: 0,
};

// Exemple par défaut = cas ATSEM CDG27 (20 h × 36 semaines → quotité 44,8 %).
const DEFAULT_ANNU: AnnualisationInputs = {
  nom: '',
  heuresHebdo: 20,
  nbSemaines: 36,
  dateDebut: '',
  dateFin: '',
  joursFeries: 0,
  joursMaladie: 0,
};

function loadInputs(): Inputs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_INPUTS, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return DEFAULT_INPUTS;
}

function loadAnnu(): AnnualisationInputs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ANNU);
    if (raw) return { ...DEFAULT_ANNU, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return DEFAULT_ANNU;
}

export default function App() {
  const [tab, setTab] = useState<TabId>('dashboard');
  const [inputs, setInputs] = useState<Inputs>(loadInputs);
  const [annuInputs, setAnnuInputs] = useState<AnnualisationInputs>(loadAnnu);

  const results = useMemo(() => computeResults(inputs), [inputs]);
  const annuResults = useMemo(() => computeAnnualisation(annuInputs), [annuInputs]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(inputs));
    } catch {
      /* ignore */
    }
  }, [inputs]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_ANNU, JSON.stringify(annuInputs));
    } catch {
      /* ignore */
    }
  }, [annuInputs]);

  const update = (patch: Partial<Inputs>) => setInputs((prev) => ({ ...prev, ...patch }));
  const updateAnnu = (patch: Partial<AnnualisationInputs>) =>
    setAnnuInputs((prev) => ({ ...prev, ...patch }));
  const reset = () => setInputs(DEFAULT_INPUTS);

  return (
    <TooltipProvider delayDuration={150}>
      <SidebarProvider>
        <AppSidebar active={tab} onChange={setTab} />

        <SidebarInset className="bg-transparent">
          {/* Barre supérieure collante : déclencheur + titre de section. */}
          <header className="no-print sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <SidebarTrigger />
            <Separator orientation="vertical" className="h-6" />
            <h1 className="truncate text-base font-bold tracking-tight text-foreground">
              {SECTION_TITLES[tab]}
            </h1>
            <span className="ml-auto hidden truncate text-xs font-medium text-muted-foreground sm:block">
              Ville de Trappes — DRH
            </span>
            {/* Marque complète, conservée pour le SSR / l'accessibilité. */}
            <span className="sr-only">
              Calculateur de congés annuels &amp; RTT — Ville de Trappes, Direction des Ressources
              Humaines
            </span>
          </header>

          <main className="mx-auto w-full min-w-0 max-w-6xl flex-1 px-4 py-6 sm:px-5 lg:py-8">
            {tab === 'dashboard' && (
              <Dashboard inputs={inputs} results={results} annuResults={annuResults} onNavigate={setTab} />
            )}

            {tab === 'calculateur' && (
              <div className="animate-fade-up space-y-6">
                <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                  <InputForm inputs={inputs} onChange={update} onReset={reset} results={results} />
                  <ResultsPanel results={results} />
                </div>
                <TotalCard inputs={inputs} results={results} />
              </div>
            )}

            {tab === 'depart' && <Depart inputs={inputs} onChange={update} results={results} />}
            {tab === 'annualisation' && (
              <Annualisation inputs={annuInputs} onChange={updateAnnu} results={annuResults} />
            )}
            {tab === 'controle-tiers' && <ControleTiers />}
            {tab === 'bareme' && <Bareme currentSocle={inputs.socle} currentQuotite={inputs.quotite} />}
            {tab === 'notice' && <Notice />}
          </main>

          <footer className="no-print border-t border-border py-6 text-center text-xs text-muted-foreground">
            Ville de Trappes — Direction des Ressources Humaines · Outil d'estimation des congés &amp; RTT
          </footer>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
