import { useEffect, useMemo, useState } from 'react';
import Header from './components/Header';
import Sidebar, { type TabId } from './components/Sidebar';
import InputForm from './components/InputForm';
import ResultsPanel from './components/Results';
import TotalCard from './components/TotalCard';
import Depart from './components/Depart';
import Bareme from './components/Bareme';
import Notice from './components/Notice';
import { computeResults, type Inputs } from './lib/calc';

const STORAGE_KEY = 'conges-rtt-trappes:v1';

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

function loadInputs(): Inputs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_INPUTS, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return DEFAULT_INPUTS;
}

export default function App() {
  const [tab, setTab] = useState<TabId>('calculateur');
  const [inputs, setInputs] = useState<Inputs>(loadInputs);

  const results = useMemo(() => computeResults(inputs), [inputs]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(inputs));
    } catch {
      /* ignore */
    }
  }, [inputs]);

  const update = (patch: Partial<Inputs>) => setInputs((prev) => ({ ...prev, ...patch }));
  const reset = () => setInputs(DEFAULT_INPUTS);

  return (
    <div className="min-h-screen">
      <Header />

      <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-6 sm:px-5 lg:flex-row lg:gap-6 lg:py-8">
        <Sidebar active={tab} onChange={setTab} />

        <main className="min-w-0 flex-1">
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
          {tab === 'bareme' && <Bareme currentSocle={inputs.socle} currentQuotite={inputs.quotite} />}
          {tab === 'notice' && <Notice />}
        </main>
      </div>

      <footer className="no-print border-t border-trappes-100 py-6 text-center text-xs text-trappes-400">
        Ville de Trappes — Direction des Ressources Humaines · Outil d'estimation des congés &amp; RTT
      </footer>
    </div>
  );
}
