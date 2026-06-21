import { CalendarCheck2 } from 'lucide-react';
import { NAV, type TabId } from './Sidebar';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from './ui/sidebar';

/** Regroupement des onglets en deux sections, pour une vraie ergonomie « app ». */
const GROUPS: { label: string; ids: TabId[] }[] = [
  { label: 'Pilotage', ids: ['dashboard', 'calculateur', 'depart', 'annualisation'] },
  { label: 'Paie', ids: ['controle-tiers', 'controle-approfondi'] },
  { label: 'Références', ids: ['bareme', 'notice'] },
];

const byId = new Map(NAV.map((item) => [item.id, item]));

export default function AppSidebar({
  active,
  onChange,
}: {
  active: TabId;
  onChange: (t: TabId) => void;
}) {
  return (
    <Sidebar collapsible="icon" className="no-print">
      <SidebarHeader>
        <div className="flex items-center gap-2.5 px-1 py-1.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-trappes-300 via-trappes-500 to-trappes-700 text-white shadow-md ring-1 ring-inset ring-white/25">
            <CalendarCheck2 className="h-5 w-5" strokeWidth={2.5} />
          </div>
          <div className="flex min-w-0 flex-col leading-tight group-data-[collapsible=icon]:hidden">
            <span className="truncate text-sm font-bold tracking-tight text-sidebar-foreground">
              Congés &amp; RTT
            </span>
            <span className="truncate text-[11px] font-medium uppercase tracking-wide text-sidebar-foreground/60">
              DRH
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {GROUPS.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.ids.map((id) => {
                  const item = byId.get(id);
                  if (!item) return null;
                  const Icon = item.icon;
                  return (
                    <SidebarMenuItem key={id}>
                      <SidebarMenuButton
                        isActive={active === id}
                        tooltip={item.label}
                        onClick={() => onChange(id)}
                      >
                        <Icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <div className="rounded-lg bg-sidebar-accent/60 px-3 py-2 group-data-[collapsible=icon]:hidden">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/60">
            Année de référence
          </p>
          <p className="text-base font-bold text-sidebar-foreground">{new Date().getFullYear()}</p>
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
