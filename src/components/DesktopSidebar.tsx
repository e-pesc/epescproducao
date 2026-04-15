import { LayoutDashboard, Package, ShoppingCart, ContactRound, FileText, Wallet, Store, LogOut, ClipboardList, Users, FileBarChart } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import type { Tab } from "@/components/BottomNav";

interface DesktopSidebarProps {
  active: Tab;
  onChange: (tab: Tab) => void;
  disabledTabs?: Tab[];
  visibleTabs?: Tab[];
  onOpenReports?: () => void;
}

const navItems: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "peixarias", label: "Peixarias", icon: Store },
  { id: "dashboard", label: "Início", icon: LayoutDashboard },
  { id: "inventory", label: "Estoque", icon: Package },
  { id: "pos", label: "Frente de Caixa", icon: ShoppingCart },
  { id: "pedidos", label: "Pedidos", icon: FileText },
  { id: "faturamento", label: "Faturamento", icon: Wallet },
  { id: "cadastros", label: "Cadastros", icon: ContactRound },
];

const adminItems: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "usuarios", label: "Usuários", icon: Users },
  { id: "logs", label: "Logs de Atividade", icon: ClipboardList },
];

export function DesktopSidebar({ active, onChange, disabledTabs = [], visibleTabs, onOpenReports }: DesktopSidebarProps) {
  const { signOut, role } = useAuth();
  const isAdmin = role === "administrador";

  const tabs = visibleTabs
    ? navItems.filter(t => visibleTabs.includes(t.id))
    : navItems.filter(t => t.id !== "peixarias");

  return (
    <aside className="hidden md:flex flex-col w-60 bg-card border-r border-border h-screen sticky top-0 shrink-0">
      <div className="p-5 border-b border-border">
        <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
          🐟 E-Pesc
        </h1>
        <p className="text-xs text-muted-foreground">Gestão de Peixaria</p>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-2">Menu</p>
        {tabs.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.id;
          const isDisabled = disabledTabs.includes(item.id);
          return (
            <button
              key={item.id}
              onClick={() => !isDisabled && onChange(item.id)}
              disabled={isDisabled}
              className={cn(
                "flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
                isDisabled
                  ? "text-muted-foreground/40 cursor-not-allowed"
                  : isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground hover:bg-muted"
              )}
            >
              <Icon className="w-5 h-5 shrink-0" />
              {item.label}
            </button>
          );
        })}

        {isAdmin && (
          <>
            <div className="pt-4 pb-1">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-3">Administração</p>
            </div>
            {adminItems.map((item) => {
              const Icon = item.icon;
              const isActive = active === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onChange(item.id)}
                  className={cn(
                    "flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground hover:bg-muted"
                  )}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  {item.label}
                </button>
              );
            })}
            {onOpenReports && (
              <button
                onClick={onOpenReports}
                className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                <FileBarChart className="w-5 h-5 shrink-0" />
                Relatórios
              </button>
            )}
          </>
        )}
      </nav>

      <div className="p-3 border-t border-border">
        <button
          onClick={signOut}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
        >
          <LogOut className="w-5 h-5 shrink-0" />
          Sair
        </button>
      </div>
    </aside>
  );
}
