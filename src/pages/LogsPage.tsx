import { useState, useMemo, useEffect } from "react";
import { useActivityLogs } from "@/hooks/useActivityLog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Download, Search, Filter } from "lucide-react";
import { formatBRL } from "@/lib/format";
import { SlideUpModal } from "@/components/SlideUpModal";
import { supabase } from "@/integrations/supabase/client";

interface LogsPageProps {
  onBack: () => void;
}

const ACTION_OPTIONS = [
  "Venda Finalizada",
  "Pedido Criado",
  "Pedido Editado",
  "Pedido Atendido",
  "Pedido Excluído",
  "Compra Registrada",
  "Estoque Baixado",
  "Processamento Realizado",
  "Estoque Ajustado",
  "Dívida Quitada",
  "Pagamento Recebido",
];

export function LogsPage({ onBack }: LogsPageProps) {
  const { logs, loading, fetch } = useActivityLogs();
  const [search, setSearch] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterAction, setFilterAction] = useState("");
  const [filterStart, setFilterStart] = useState("");
  const [filterEnd, setFilterEnd] = useState("");
  const [resolver, setResolver] = useState<(entity: string, entityId: string) => string>(() => () => "-");

  useEffect(() => {
    (async () => {
      const [c, f, d, v, p] = await Promise.all([
        supabase.from("clientes").select("id, nome"),
        supabase.from("fornecedores").select("id, nome"),
        supabase.from("dividas_compra").select("id, fornecedor_id, descricao"),
        supabase.from("vendas").select("id, cliente_id"),
        supabase.from("pedidos").select("id, cliente_id"),
      ]);
      const clientePrefix = new Map<string, string>();
      for (const x of c.data ?? []) clientePrefix.set(x.id.slice(0, 8), x.nome);
      const fornecedorPrefix = new Map<string, string>();
      for (const x of f.data ?? []) fornecedorPrefix.set(x.id.slice(0, 8), x.nome);
      const dividaMap = new Map<string, string>();
      for (const x of d.data ?? []) {
        const fname = x.fornecedor_id ? fornecedorPrefix.get(x.fornecedor_id.slice(0, 8)) : null;
        dividaMap.set(x.id.slice(0, 8), fname ?? (x.descricao ? "Despesa" : "-"));
      }
      const vendaMap = new Map<string, string>();
      for (const x of v.data ?? []) {
        const cname = x.cliente_id ? clientePrefix.get(x.cliente_id.slice(0, 8)) : null;
        vendaMap.set(x.id.slice(0, 8), cname ?? "Consumidor");
      }
      const pedidoMap = new Map<string, string>();
      for (const x of p.data ?? []) {
        const cname = x.cliente_id ? clientePrefix.get(x.cliente_id.slice(0, 8)) : null;
        pedidoMap.set(x.id.slice(0, 8), cname ?? "-");
      }
      setResolver(() => (entity: string, entityId: string) => {
        const e = (entity || "").toLowerCase();
        if (e === "cliente") return clientePrefix.get(entityId) ?? "-";
        if (e === "fornecedor") return fornecedorPrefix.get(entityId) ?? "-";
        if (e === "dívida" || e === "divida" || e === "compra") return dividaMap.get(entityId) ?? "-";
        if (e === "venda") return vendaMap.get(entityId) ?? "-";
        if (e === "pedido") return pedidoMap.get(entityId) ?? "-";
        return "-";
      });
    })();
  }, []);
    if (!search) return logs;
    const q = search.toLowerCase();
    return logs.filter(l =>
      l.user_name.toLowerCase().includes(q) ||
      l.action.toLowerCase().includes(q) ||
      l.entity.toLowerCase().includes(q) ||
      l.entity_id.toLowerCase().includes(q) ||
      l.description.toLowerCase().includes(q)
    );
  }, [logs, search]);

  const applyFilters = () => {
    fetch({
      startDate: filterStart ? new Date(filterStart + "T00:00:00").toISOString() : undefined,
      endDate: filterEnd ? new Date(filterEnd + "T23:59:59").toISOString() : undefined,
      action: filterAction || undefined,
    });
    setFilterOpen(false);
  };

  const clearFilters = () => {
    setFilterAction("");
    setFilterStart("");
    setFilterEnd("");
    fetch();
    setFilterOpen(false);
  };

  const exportExcel = async () => {
    const XLSX = await import("xlsx");
    const data = filtered.map(l => ({
      "Data/Hora": new Date(l.created_at).toLocaleString("pt-BR"),
      "Usuário": l.user_name,
      "Ação": l.action,
      "Entidade/ID": l.entity_id ? `${l.entity} - ${l.entity_id}` : l.entity,
      "Valor": l.amount != null ? l.amount : "",
      "Descrição": l.description,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    ws["!cols"] = [
      { wch: 20 }, { wch: 20 }, { wch: 22 },
      { wch: 20 }, { wch: 15 }, { wch: 50 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Logs");
    XLSX.writeFile(wb, `logs_atividade_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString("pt-BR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
  };

  return (
    <div className="pb-24 space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <button onClick={onBack} className="p-2 rounded-full hover:bg-muted transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold flex-1">Logs de Atividade</h1>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar logs..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="icon" onClick={() => setFilterOpen(true)}>
          <Filter className="w-4 h-4" />
        </Button>
        <Button variant="outline" size="icon" onClick={exportExcel}>
          <Download className="w-4 h-4" />
        </Button>
      </div>

      {loading ? (
        <p className="text-center text-muted-foreground py-8">Carregando...</p>
      ) : filtered.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">Nenhum log encontrado.</p>
      ) : (
        <>
          {/* Mobile: cards */}
          <div className="space-y-2 md:hidden">
            {filtered.map(log => (
              <div key={log.id} className="bg-card rounded-xl p-3 border border-border space-y-1">
                <div className="flex justify-between items-start">
                  <span className="text-xs text-muted-foreground">{formatDate(log.created_at)}</span>
                  {log.amount != null && (
                    <span className="text-sm font-semibold text-primary">{formatBRL(log.amount)}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                    {log.action}
                  </span>
                </div>
                <p className="text-sm font-medium">{log.user_name}</p>
                {log.entity_id && (
                  <p className="text-xs text-muted-foreground">{log.entity}: {log.entity_id}</p>
                )}
                <p className="text-xs text-muted-foreground">{log.description}</p>
              </div>
            ))}
          </div>

          {/* Desktop: table */}
          <div className="hidden md:block overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted">
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Data/Hora</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Usuário</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Ação</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Entidade/ID</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Valor</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Descrição</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(log => (
                  <tr key={log.id} className="border-t border-border hover:bg-muted/50">
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{formatDate(log.created_at)}</td>
                    <td className="px-4 py-3 font-medium">{log.user_name}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{log.entity_id ? `${log.entity}: ${log.entity_id}` : "—"}</td>
                    <td className="px-4 py-3 text-right font-semibold text-primary">{log.amount != null ? formatBRL(log.amount) : "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">{log.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <SlideUpModal open={filterOpen} onOpenChange={setFilterOpen} title="Filtrar Logs">
        <div className="space-y-4">
          <div>
            <Label>Tipo de Ação</Label>
            <select
              className="w-full mt-1 h-10 rounded-xl border border-input bg-background px-3 text-sm"
              value={filterAction}
              onChange={e => setFilterAction(e.target.value)}
            >
              <option value="">Todas</option>
              {ACTION_OPTIONS.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <Label>Data Início</Label>
            <Input type="date" value={filterStart} onChange={e => setFilterStart(e.target.value)} />
          </div>
          <div>
            <Label>Data Fim</Label>
            <Input type="date" value={filterEnd} onChange={e => setFilterEnd(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={clearFilters}>Limpar</Button>
            <Button className="flex-1" onClick={applyFilters}>Aplicar</Button>
          </div>
        </div>
      </SlideUpModal>
    </div>
  );
}
