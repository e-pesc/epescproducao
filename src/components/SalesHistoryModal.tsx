import { useState, useMemo, useEffect } from "react";
import { useVendas, type Venda } from "@/hooks/useVendas";
import { useClientes } from "@/hooks/useClientes";
import { useProdutos } from "@/hooks/useProdutos";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useBilling } from "@/hooks/useBilling";
import { SlideUpModal } from "@/components/SlideUpModal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { CancelReasonModal } from "@/components/CancelReasonModal";
import { ChevronLeft, ChevronRight, Calendar, History, Search, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatBRL } from "@/lib/format";


const MONTH_NAMES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export function SalesHistoryModal({ open, onOpenChange }: Props) {
  const { vendas, cancelVenda, refetch } = useVendas();
  const { clientes } = useClientes();
  const { produtos, refetch: refetchProdutos } = useProdutos();
  const { refetch: refetchBilling } = useBilling();
  const { role } = useAuth();
  const { toast } = useToast();

  const isAdmin = role === "administrador" || role === "root";
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const [search, setSearch] = useState("");
  const [cancelTarget, setCancelTarget] = useState<Venda | null>(null);

  useEffect(() => {
    if (open) refetch();
  }, [open, refetch]);

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear((y) => y - 1); } else setMonth((m) => m - 1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear((y) => y + 1); } else setMonth((m) => m + 1); };

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return vendas.filter((v) => {
      const d = new Date(v.created_at);
      if (d.getMonth() !== month || d.getFullYear() !== year) return false;
      if (!term) return true;
      const cli = clientes.find((c) => c.id === v.cliente_id);
      return (cli?.nome ?? "").toLowerCase().includes(term);
    });
  }, [vendas, month, year, search, clientes]);

  const handleCancel = async (motivo: string) => {
    if (!cancelTarget) return;
    await cancelVenda(cancelTarget.id, motivo);
    await Promise.all([refetch(), refetchProdutos(), refetchBilling()]);
    toast({ title: "Venda cancelada", description: "Estoque, entradas e débitos foram estornados." });
    setCancelTarget(null);
  };

  return (
    <>
      <SlideUpModal open={open} onOpenChange={onOpenChange} title="Histórico de Vendas">
        <div className="space-y-3 mt-2">
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-2xl bg-muted px-2 py-1 shrink-0">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={prevMonth}><ChevronLeft className="w-4 h-4" /></Button>
              <span className="text-xs font-semibold text-foreground whitespace-nowrap px-1">{MONTH_NAMES[month].slice(0, 3)} {year}</span>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={nextMonth}><ChevronRight className="w-4 h-4" /></Button>
            </div>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input type="text" placeholder="Cliente..." value={search} onChange={(e) => setSearch(e.target.value)} className="rounded-2xl h-9 pl-9 text-sm" />
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <History className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Nenhuma venda neste período</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((v) => {
                const cli = clientes.find((c) => c.id === v.cliente_id);
                const isCancelled = !!v.cancelado;
                return (
                  <div
                    key={v.id}
                    className={cn(
                      "rounded-3xl bg-card p-4 shadow-sm border-l-4",
                      isCancelled ? "border-l-destructive opacity-70" : "border-l-fish-treated"
                    )}
                  >
                    <div className="flex items-start justify-between mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <h3 className={cn("font-bold text-foreground text-sm truncate", isCancelled && "line-through")}>
                          {cli?.nome ?? "Venda Balcão"}
                        </h3>
                        {isCancelled ? (
                          <Badge className="bg-destructive hover:bg-destructive text-destructive-foreground text-[10px] px-2 py-0.5 font-bold">CANCELADA</Badge>
                        ) : (
                          <Badge className={cn(
                            "text-[10px] px-2 py-0.5 font-bold",
                            v.forma_pagamento === "avista" ? "bg-fish-treated hover:bg-fish-treated text-white" : "bg-amber-500 hover:bg-amber-500 text-white"
                          )}>
                            {v.forma_pagamento === "avista" ? "À VISTA" : "A PRAZO"}
                          </Badge>
                        )}
                      </div>
                      <span className={cn("text-base font-bold text-foreground shrink-0 ml-2", isCancelled && "line-through")}>
                        {formatBRL(Number(v.valor_total))}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                      <Calendar className="w-3 h-3" />
                      <span>{new Date(v.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</span>
                    </div>
                    <div className="space-y-0.5 mb-2">
                      {(v.itens ?? []).map((it, i) => {
                        const p = produtos.find((pr) => pr.id === it.produto_id);
                        return (
                          <div key={i} className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground truncate">{p?.nome ?? "—"} ({p?.sku ?? "—"})</span>
                            <span className="text-foreground font-medium shrink-0 ml-2">{Number(it.kg)}kg × {formatBRL(Number(it.preco_kg))}</span>
                          </div>
                        );
                      })}
                    </div>
                    {isCancelled && v.cancelado_motivo && (
                      <div className="rounded-2xl bg-destructive/10 border border-destructive/20 p-2 text-xs text-foreground">
                        <span className="font-semibold">Motivo: </span>{v.cancelado_motivo}
                        {v.cancelado_at && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            em {new Date(v.cancelado_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                          </p>
                        )}
                      </div>
                    )}
                    {!isCancelled && isAdmin && (
                      <Button variant="outline" size="sm" className="w-full rounded-2xl mt-2 text-destructive border-destructive/40 hover:bg-destructive/10" onClick={() => setCancelTarget(v)}>
                        <XCircle className="w-4 h-4" /> Cancelar Venda
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </SlideUpModal>

      {cancelTarget && (
        <CancelReasonModal
          open={!!cancelTarget}
          onOpenChange={(o) => !o && setCancelTarget(null)}
          title={`Cancelar venda — ${formatBRL(Number(cancelTarget.valor_total))}`}
          onConfirm={handleCancel}
        />
      )}
    </>
  );
}
