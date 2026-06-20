// Définitions de navigation partagées (TabId + NAV) — consommées par AppSidebar,
// App et Dashboard. La barre latérale elle-même est rendue par AppSidebar.tsx.
import { LayoutDashboard, Calculator, DoorOpen, CalendarRange, Table2, BookOpen } from 'lucide-react';
import type { ComponentType } from 'react';

export type TabId =
  | 'dashboard'
  | 'calculateur'
  | 'depart'
  | 'annualisation'
  | 'bareme'
  | 'notice';

export const NAV: { id: TabId; label: string; hint: string; icon: ComponentType<{ className?: string }> }[] = [
  { id: 'dashboard', label: 'Tableau de bord', hint: 'Synthèse & graphiques', icon: LayoutDashboard },
  { id: 'calculateur', label: 'Calculateur', hint: 'Congés annuels & RTT', icon: Calculator },
  { id: 'depart', label: "Départ de l'agent", hint: 'Solde & indemnisation', icon: DoorOpen },
  { id: 'annualisation', label: 'Annualisation', hint: 'Équivalent & quotité de paie', icon: CalendarRange },
  { id: 'bareme', label: 'Barème', hint: 'RTT par socle horaire', icon: Table2 },
  { id: 'notice', label: 'Notice', hint: "Mode d'emploi & calcul", icon: BookOpen },
];
