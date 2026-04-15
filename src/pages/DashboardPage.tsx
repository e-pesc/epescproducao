import { useState, useEffect, useCallback } from "react";
import { useVendas } from "@/hooks/useVendas";
import { usePedidos } from "@/hooks/usePedidos";
import { useProdutos } from "@/hooks/useProdutos";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ShoppingCart, TrendingUp, Fish, TrendingDown, Percent } from "lucide-react";
import { formatBRL } from "@/lib/format";
import { SettingsMenu } from "@/components/SettingsMenu";
import { ReportsModal } from "@/components/ReportsModal";

interface DashboardPageProps {
  onNavigateUsers?: () => void;
  onNavigateLogs?: () => void;
}

type Periodo = "dia" | "mes";

interface MargemData {
  receita: number;
  custo: number;
  lucro: number;
  margem: number;
}

export function DashboardPage({ onNavigateUsers, onNavigateLogs }: DashboardPageProps) {
  const { vendas } = useVendas();
  const { pedidos } = usePedidos();
  const { produtos } = useProdutos();
  const { role } = useAuth();
  const [reportsOpen, setReportsOpen] = useState(false);
  const [periodo, setPeriodo] = useState<Periodo>("dia");
  const [margemInteiro, setMargemInteiro] = useState<MargemData>({ receita: 0, custo: 0, lucro: 0, margem: 0 });
  const [margemTratado, setMargemTratado] = useState<MargemData>({ receita: 0, custo: 0, lucro: 0, margem: 0 });

  const isAdmin = role === "administrador" || role === "root";

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const monthPrefix = now.toISOString().slice(0, 7);

  const filteredSales = vendas.filter((s) =>
    periodo === "dia"
      ? s.created_at.slice(0, 10) === today
      : s.created_at.slice(0, 7) === monthPrefix
  );
  const totalVendas = filteredSales.reduce((acc, s) => acc + Number(s.valor_total), 0);

  const fetchMargens = useCallback(async () => {
    if (!isAdmin) return;

    const startDate = periodo === "dia" ? today : `${monthPrefix}-01`;
    const endDate = periodo === "dia"
      ? `${today}T23:59:59.999`
      : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

    const { data: itens } = await supabase
      .from("itens_venda")
      .select("kg, preco_kg, produto_id, venda_id");

    if (!itens) return;

    // Get venda ids in the period
    const vendaIdsInPeriod = new Set(
      filteredSales.map((v) => v.id)
    );

    const itensInPeriod = itens.filter((i) => vendaIdsInPeriod.has(i.venda_id));

    // Get unique product ids
    const produtoIds = [...new Set(itensInPeriod.map((i) => i.produto_id))];
    if (produtoIds.length === 0) {
      setMargemInteiro({ receita: 0, custo: 0, lucro: 0, margem: 0 });
      setMargemTratado({ receita: 0, custo: 0, lucro: 0, margem: 0 });
      return;
    }

    const { data: produtos } = await supabase
      .from("produtos")
      .select("id, tipo, preco_compra")
      .in("id", produtoIds);

    if (!produtos) return;

    const produtoMap = new Map(produtos.map((p) => [p.id, p]));

    let inteiroReceita = 0, inteiroCusto = 0;
    let tratadoReceita = 0, tratadoCusto = 0;

    for (const item of itensInPeriod) {
      const prod = produtoMap.get(item.produto_id);
      if (!prod) continue;
      const receita = Number(item.kg) * Number(item.preco_kg);
      const custo = Number(item.kg) * Number(prod.preco_compra);

      if (prod.tipo === "inteiro") {
        inteiroReceita += receita;
        inteiroCusto += custo;
      } else {
        tratadoReceita += receita;
        tratadoCusto += custo;
      }
    }

    const lucroI = inteiroReceita - inteiroCusto;
    const lucroT = tratadoReceita - tratadoCusto;

    setMargemInteiro({
      receita: inteiroReceita,
      custo: inteiroCusto,
      lucro: lucroI,
      margem: inteiroReceita > 0 ? (lucroI / inteiroReceita) * 100 : 0,
    });
    setMargemTratado({
      receita: tratadoReceita,
      custo: tratadoCusto,
      lucro: lucroT,
      margem: tratadoReceita > 0 ? (lucroT / tratadoReceita) * 100 : 0,
    });
  }, [isAdmin, periodo, filteredSales.length, vendas]);

  useEffect(() => {
    fetchMargens();
  }, [fetchMargens]);

  const cards = [
    ...(isAdmin ? [{ label: periodo === "dia" ? "Vendas Hoje" : "Vendas no Mês", value: formatBRL(totalVendas), icon: TrendingUp, color: "text-fish-treated", bg: "bg-fish-treated-light" }] : []),
    { label: periodo === "dia" ? "Nº Vendas Hoje" : "Nº Vendas no Mês", value: filteredSales.length.toString(), icon: ShoppingCart, color: "text-fish-whole", bg: "bg-fish-whole-light" },
  ];

  // Build product map for SKU lookup
  const produtoMap = new Map(produtos.map((p) => [p.id, p]));

  // Combine vendas + pedidos atendidos for "Últimas Vendas"
  const fulfilledOrders = pedidos
    .filter((p) => p.status === "atendido")
    .filter((p) => {
      const d = p.fulfilled_at || p.created_at;
      return periodo === "dia" ? d.slice(0, 10) === today : d.slice(0, 7) === monthPrefix;
    })
    .flatMap((p) =>
      (p.itens ?? []).map((item) => ({
        id: `${p.id}-${item.produto_id}`,
        produto_id: item.produto_id,
        kg: item.kg,
        valor_total: item.kg * item.preco_kg,
        created_at: p.fulfilled_at || p.created_at,
      }))
    );

  const salesEntries = filteredSales.flatMap((s) => {
    // Use itens_venda if available via the venda's produto_id
    return [{
      id: s.id,
      produto_id: s.produto_id,
      kg: Number(s.kg),
      valor_total: Number(s.valor_total),
      created_at: s.created_at,
    }];
  });

  const allEntries = [...salesEntries, ...fulfilledOrders]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Fish className="w-6 h-6 text-primary" /> E-Pesc
          </h1>
          <p className="text-sm text-muted-foreground">Gestão de Peixaria</p>
        </div>
        <SettingsMenu onOpenReports={() => setReportsOpen(true)} onOpenUsers={() => onNavigateUsers?.()} onOpenLogs={() => onNavigateLogs?.()} />
      </div>

      {/* Period filter */}
      <div className="flex gap-2">
        <button
          onClick={() => setPeriodo("dia")}
          className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${
            periodo === "dia"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground"
          }`}
        >
          Hoje
        </button>
        <button
          onClick={() => setPeriodo("mes")}
          className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${
            periodo === "mes"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground"
          }`}
        >
          Este Mês
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="rounded-3xl bg-card p-4 shadow-sm">
              <div className={`w-10 h-10 ${c.bg} rounded-2xl flex items-center justify-center mb-3`}>
                <Icon className={`w-5 h-5 ${c.color}`} />
              </div>
              <p className="text-[11px] text-muted-foreground font-medium">{c.label}</p>
              <p className="text-lg font-bold text-foreground mt-0.5">{c.value}</p>
            </div>
          );
        })}
      </div>

      {/* Margin cards - admin only */}
      {isAdmin && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MargemCard
            label="Margem Inteiro"
            data={margemInteiro}
            color="text-fish-whole"
            bg="bg-fish-whole-light"
          />
          <MargemCard
            label="Margem Tratado"
            data={margemTratado}
            color="text-fish-treated"
            bg="bg-fish-treated-light"
          />
        </div>
      )}

      {allEntries.length > 0 && (
        <div className="rounded-3xl bg-card p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-foreground mb-3">
            {periodo === "dia" ? "Últimas Vendas" : "Vendas do Mês"}
          </h2>
          <div className="space-y-2">
            {allEntries.slice(0, 5).map((entry) => {
              const prod = produtoMap.get(entry.produto_id);
              return (
                <div key={entry.id} className="flex items-center justify-between text-sm py-2 border-b border-border last:border-0">
                  <span className="font-medium text-foreground truncate max-w-[45%]">{prod?.sku ?? "—"} - {prod?.nome ?? ""}</span>
                  <span className="text-muted-foreground">{entry.kg}kg</span>
                  <span className="font-semibold text-foreground">{formatBRL(entry.valor_total)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <ReportsModal open={reportsOpen} onOpenChange={setReportsOpen} />
    </div>
  );
}

function MargemCard({ label, data, color, bg }: { label: string; data: MargemData; color: string; bg: string }) {
  const isPositive = data.lucro >= 0;
  return (
    <div className="rounded-3xl bg-card p-4 shadow-sm">
      <div className={`w-10 h-10 ${bg} rounded-2xl flex items-center justify-center mb-3`}>
        <Percent className={`w-5 h-5 ${color}`} />
      </div>
      <p className="text-[11px] text-muted-foreground font-medium">{label}</p>
      <p className={`text-lg font-bold mt-0.5 ${isPositive ? "text-fish-treated" : "text-destructive"}`}>
        {formatBRL(data.lucro)}
      </p>
      <p className={`text-xs font-semibold ${isPositive ? "text-fish-treated" : "text-destructive"}`}>
        {data.margem.toFixed(1)}%
      </p>
    </div>
  );
}
