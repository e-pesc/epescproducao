import { LayoutDashboard, Package, ShoppingCart, ContactRound, FileText, Wallet, Store } from "lucide-react";
import { cn } from "@/lib/utils";

export type Tab = "dashboard" | "inventory" | "pos" | "cadastros" | "pedidos" | "faturamento" | "usuarios" | "peixarias" | "logs";

interface BottomNavProps {
  active: Tab;
  onChange: (tab: Tab) => void;
  disabledTabs?: Tab[];
  visibleTabs?: Tab[];
}

const allTabs: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "peixarias", label: "Peixarias", icon: Store },
  { id: "dashboard", label: "Início", icon: LayoutDashboard },
  { id: "inventory", label: "Estoque", icon: Package },
  { id: "pos", label: "Venda", icon: ShoppingCart },
  { id: "pedidos", label: "Pedidos", icon: FileText },
  { id: "faturamento", label: "Faturam.", icon: Wallet },
  { id: "cadastros", label: "Cadastros", icon: ContactRound },
];

export function BottomNav({ active, onChange, disabledTabs = [], visibleTabs }: BottomNavProps) {
  const tabs = visibleTabs ? allTabs.filter(t => visibleTabs.includes(t.id)) : allTabs.filter(t => t.id !== "peixarias");

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border md:hidden">
      <div className="flex items-center justify-around h-[var(--nav-height)] max-w-lg mx-auto px-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = active === tab.id;
          const isDisabled = disabledTabs.includes(tab.id);
          return (
            <button
              key={tab.id}
              onClick={() => !isDisabled && onChange(tab.id)}
              disabled={isDisabled}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 flex-1 py-1 rounded-2xl transition-colors",
                isDisabled
                  ? "text-muted-foreground/40 cursor-not-allowed"
                  : isActive
                    ? "text-secondary"
                    : "text-muted-foreground"
              )}
            >
              <Icon className={cn("w-6 h-6", isActive && !isDisabled && "drop-shadow-sm")} />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
