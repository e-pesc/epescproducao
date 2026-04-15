import { useState, useEffect } from "react";
import { BottomNav, type Tab } from "@/components/BottomNav";
import { DesktopSidebar } from "@/components/DesktopSidebar";
import { ReportsModal } from "@/components/ReportsModal";
import { DashboardPage } from "@/pages/DashboardPage";
import { InventoryPage } from "@/pages/InventoryPage";
import { POSPage } from "@/pages/POSPage";
import { CadastrosPage } from "@/pages/CadastrosPage";
import { OrdersPage } from "@/pages/OrdersPage";
import { FaturamentoPage } from "@/pages/FaturamentoPage";
import { UsersPage } from "@/pages/UsersPage";
import { PeixariasPage } from "@/pages/PeixariasPage";
import { LogsPage } from "@/pages/LogsPage";
import { useAuth } from "@/hooks/useAuth";

const Index = () => {
  const { role } = useAuth();
  const isRoot = role === "root";
  const isVendedor = role === "vendedor";

  const defaultTab: Tab = isRoot ? "peixarias" : isVendedor ? "pos" : "dashboard";
  const [tab, setTab] = useState<Tab>(defaultTab);
  const [reportsOpen, setReportsOpen] = useState(false);

  // Force correct tab on role change
  useEffect(() => {
    if (isRoot && tab !== "peixarias") {
      setTab("peixarias");
    } else if (isVendedor && tab !== "pos" && tab !== "pedidos" && tab !== "dashboard") {
      setTab("pos");
    }
  }, [role]);

  const disabledTabs: Tab[] = isVendedor
    ? ["inventory", "faturamento", "cadastros"]
    : [];

  const visibleTabs: Tab[] | undefined = isRoot
    ? ["peixarias"]
    : undefined;

  const renderPage = () => {
    switch (tab) {
      case "peixarias": return <PeixariasPage />;
      case "dashboard": return <DashboardPage onNavigateUsers={() => setTab("usuarios")} onNavigateLogs={() => setTab("logs")} />;
      case "inventory": return <InventoryPage />;
      case "pos": return <POSPage />;
      case "cadastros": return <CadastrosPage />;
      case "pedidos": return <OrdersPage />;
      case "faturamento": return <FaturamentoPage />;
      case "usuarios": return <UsersPage onBack={() => setTab("dashboard")} />;
      case "logs": return <LogsPage onBack={() => setTab("dashboard")} />;
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      <DesktopSidebar active={tab} onChange={setTab} disabledTabs={disabledTabs} visibleTabs={visibleTabs} onOpenReports={() => setReportsOpen(true)} />
      <div className="flex-1 min-w-0">
        <div className="max-w-5xl mx-auto px-4 md:px-8 pt-6 safe-bottom md:pb-8">
          {renderPage()}
        </div>
      </div>
      <BottomNav active={tab} onChange={setTab} disabledTabs={disabledTabs} visibleTabs={visibleTabs} />
      <ReportsModal open={reportsOpen} onOpenChange={setReportsOpen} />
    </div>
  );
};

export default Index;
