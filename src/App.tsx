import { useEffect, useMemo, useState } from 'react';
import { TooltipProvider } from './components/ui/tooltip';
import Header from './components/Header';
import Sidebar, { type TabId } from './components/Sidebar';
import Dashboard from './components/Dashboard';
import InputForm from './components/InputForm';
import ResultsPanel from './components/Results';
import TotalCard from './components/TotalCard';
import Depart from './components/Depart';
import Annualisation from './components/Annualisation';
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
      <div className="min-h-screen">
        <Header />

        <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-6 sm:px-5 lg:flex-row lg:gap-6 lg:py-8">
          <Sidebar active={tab} onChange={setTab} />

          <main className="min-w-0 flex-1">
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
            {tab === 'bareme' && <Bareme currentSocle={inputs.socle} currentQuotite={inputs.quotite} />}
            {tab === 'notice' && <Notice />}
          </main>
        </div>

        <footer className="no-print border-t border-border py-6 text-center text-xs text-muted-foreground">
          Ville de Trappes — Direction des Ressources Humaines · Outil d'estimation des congés &amp; RTT
        </footer>
      </div>
    </TooltipProvider>
  );
}
