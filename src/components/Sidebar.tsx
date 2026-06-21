// Définitions de navigation partagées (TabId + NAV) — consommées par AppSidebar,
// App et Dashboard. La barre latérale elle-même est rendue par AppSidebar.tsx.
import { LayoutDashboard, Calculator, DoorOpen, CalendarRange, Table2, BookOpen, Scale, ScanSearch, TrainFront } from 'lucide-react';
import type { ComponentType } from 'react';

export type TabId =
  | 'dashboard'
  | 'calculateur'
  | 'depart'
  | 'annualisation'
  | 'controle-tiers'
  | 'controle-approfondi'
  | 'comparatif'
  | 'bareme'
  | 'notice';

export const NAV: { id: TabId; label: string; hint: string; icon: ComponentType<{ className?: string }> }[] = [
  { id: 'dashboard', label: 'Tableau de bord', hint: 'Synthèse & graphiques', icon: LayoutDashboard },
  { id: 'calculateur', label: 'Calculateur', hint: 'Congés annuels & RTT', icon: Calculator },
  { id: 'depart', label: "Départ de l'agent", hint: 'Solde & indemnisation', icon: DoorOpen },
  { id: 'annualisation', label: 'Annualisation', hint: 'Équivalent & quotité de paie', icon: CalendarRange },
  { id: 'controle-tiers', label: 'Contrôle Tiers', hint: 'Rapprochement de paie', icon: Scale },
  { id: 'controle-approfondi', label: 'Contrôle approfondi', hint: 'Écarts détaillés & bouclages', icon: ScanSearch },
  { id: 'comparatif', label: 'Comparatif NET', hint: 'Écart de NET par train', icon: TrainFront },
  { id: 'bareme', label: 'Barème', hint: 'RTT par socle horaire', icon: Table2 },
  { id: 'notice', label: 'Notice', hint: "Mode d'emploi & calcul", icon: BookOpen },
];
