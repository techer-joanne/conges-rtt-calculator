import { LayoutDashboard, Calculator, DoorOpen, CalendarRange, Table2, BookOpen } from 'lucide-react';
import type { ComponentType } from 'react';
import { cn } from '../lib/utils';

export type TabId =
  | 'dashboard'
  | 'calculateur'
  | 'depart'
  | 'annualisation'
  | 'bareme'
  | 'notice';

const NAV: { id: TabId; label: string; hint: string; icon: ComponentType<{ className?: string }> }[] = [
  { id: 'dashboard', label: 'Tableau de bord', hint: 'Synthèse & graphiques', icon: LayoutDashboard },
  { id: 'calculateur', label: 'Calculateur', hint: 'Congés annuels & RTT', icon: Calculator },
  { id: 'depart', label: "Départ de l'agent", hint: 'Solde & indemnisation', icon: DoorOpen },
  { id: 'annualisation', label: 'Annualisation', hint: 'Équivalent & quotité de paie', icon: CalendarRange },
  { id: 'bareme', label: 'Barème', hint: 'RTT par socle horaire', icon: Table2 },
  { id: 'notice', label: 'Notice', hint: "Mode d'emploi & calcul", icon: BookOpen },
];

export default function Sidebar({
  active,
  onChange,
}: {
  active: TabId;
  onChange: (t: TabId) => void;
}) {
  return (
    <aside className="no-print lg:w-64 lg:shrink-0">
      <nav
        role="tablist"
        aria-label="Sections"
        className="flex gap-1.5 overflow-x-auto rounded-lg border bg-card p-2 shadow-card lg:sticky lg:top-4 lg:flex-col lg:gap-1 lg:overflow-visible"
      >
        {NAV.map(({ id, label, hint, icon: Icon }) => {
          const isActive = active === id;
          return (
            <button
              key={id}
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(id)}
              className={cn(
                'group flex shrink-0 items-center gap-3 rounded-md px-3.5 py-2.5 text-left text-sm font-semibold transition-colors lg:w-full',
                isActive
                  ? 'bg-primary text-primary-foreground shadow'
                  : 'text-secondary-foreground hover:bg-accent hover:text-accent-foreground',
              )}
            >
              <span
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors',
                  isActive ? 'bg-white/15 text-primary-foreground' : 'bg-muted text-primary group-hover:bg-background',
                )}
              >
                <Icon className="h-4 w-4" />
              </span>
              <span className="hidden flex-col leading-tight sm:flex">
                <span>{label}</span>
                <span
                  className={cn(
                    'text-[11px] font-medium',
                    isActive ? 'text-primary-foreground/80' : 'text-muted-foreground',
                  )}
                >
                  {hint}
                </span>
              </span>
              <span className="sm:hidden">{label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
