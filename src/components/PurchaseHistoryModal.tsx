import { useState, useMemo, useEffect } from "react";
import { useBilling, type DividaCompra } from "@/hooks/useBilling";
import { useFornecedores } from "@/hooks/useFornecedores";
import { useProdutos } from "@/hooks/useProdutos";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { SlideUpModal } from "@/components/SlideUpModal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { CancelReasonModal } from "@/components/CancelReasonModal";
import { ChevronLeft, ChevronRight, Calendar, History, Search, XCircle, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatBRL } from "@/lib/format";
import { openWhatsappReceipt } from "@/lib/whatsappReceipt";

const MONTH_NAMES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export function PurchaseHistoryModal({ open, onOpenChange }: Props) {
  const { dividasCompra, cancelDivida, refetch } = useBilling();
  const { fornecedores } = useFornecedores();
  const { produtos, refetch: refetchProdutos } = useProdutos();
  const { role } = useAuth();
  const { toast } = useToast();

  const isAdmin = role === "administrador" || role === "root";
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const [search, setSearch] = useState("");
  const [cancelTarget, setCancelTarget] = useState<DividaCompra[] | null>(null);

  useEffect(() => {
    if (open) refetch();
  }, [open, refetch]);

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear((y) => y - 1); } else setMonth((m) => m - 1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear((y) => y + 1); } else setMonth((m) => m + 1); };

  // Agrupa itens da mesma compra: mesmo fornecedor + mesmo created_at (truncado em segundos)
  const grouped = useMemo(() => {
    const map = new Map<string, DividaCompra[]>();
    for (const d of dividasCompra) {
      const dt = new Date(d.created_at);
      if (dt.getMonth() !== month || dt.getFullYear() !== year) continue;
      const sec = Math.floor(dt.getTime() / 1000);
      const key = `${d.fornecedor_id ?? "_"}|${sec}`;
      const arr = map.get(key) ?? [];
      arr.push(d);
      map.set(key, arr);
    }
    return Array.from(map.values()).sort(
      (a, b) => new Date(b[0].created_at).getTime() - new Date(a[0].created_at).getTime()
    );
  }, [dividasCompra, month, year]);

  const filteredGroups = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return grouped;
    return grouped.filter((group) => {
      const f = fornecedores.find((x) => x.id === group[0].fornecedor_id);
      if ((f?.nome ?? "").toLowerCase().includes(term)) return true;
      return group.some((d) => {
        const p = produtos.find((x) => x.id === d.produto_id);
        return (p?.nome ?? "").toLowerCase().includes(term);
      });
    });
  }, [grouped, search, fornecedores, produtos]);

  const handleCancel = async (motivo: string) => {
    if (!cancelTarget || cancelTarget.length === 0) return;
    try {
      // Cancela todos os itens do grupo (mesma compra)
      for (const d of cancelTarget) {
        if (!d.cancelado) await cancelDivida(d.id, motivo);
      }
      await Promise.all([refetch(), refetchProdutos()]);
      toast({ title: "Compra cancelada", description: "Estoque e pagamentos foram estornados." });
      setCancelTarget(null);
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  return (
    <>
      <SlideUpModal open={open} onOpenChange={onOpenChange} title="Histórico de Compras">
        <div className="space-y-3 mt-2">
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-2xl bg-muted px-2 py-1 shrink-0">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={prevMonth}><ChevronLeft className="w-4 h-4" /></Button>
              <span className="text-xs font-semibold text-foreground whitespace-nowrap px-1">{MONTH_NAMES[month].slice(0, 3)} {year}</span>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={nextMonth}><ChevronRight className="w-4 h-4" /></Button>
            </div>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input type="text" placeholder="Fornecedor ou produto..." value={search} onChange={(e) => setSearch(e.target.value)} className="rounded-2xl h-9 pl-9 text-sm" />
            </div>
          </div>

          {filteredGroups.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <History className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Nenhuma compra neste período</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredGroups.map((group) => {
                const first = group[0];
                const f = fornecedores.find((x) => x.id === first.fornecedor_id);
                const allCancelled = group.every((d) => d.cancelado);
                const totalCompra = group.reduce((acc, d) => acc + Number(d.valor_total), 0);
                const totalPago = group.reduce((acc, d) => acc + Number(d.valor_pago ?? 0), 0);
                const allQuitado = group.every((d) => d.quitado || d.cancelado);
                const motivo = group.find((d) => d.cancelado_motivo)?.cancelado_motivo;
                const canceladoAt = group.find((d) => d.cancelado_at)?.cancelado_at;
                return (
                  <div
                    key={`${first.fornecedor_id}-${first.created_at}`}
                    className={cn(
                      "rounded-3xl bg-card p-4 shadow-sm border-l-4",
                      allCancelled ? "border-l-destructive opacity-70" : "border-l-fish-whole"
                    )}
                  >
                    <div className="flex items-start justify-between mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <h3 className={cn("font-bold text-foreground text-sm truncate", allCancelled && "line-through")}>
                          {f?.nome ?? "Fornecedor"}
                        </h3>
                        {allCancelled ? (
                          <Badge className="bg-destructive hover:bg-destructive text-destructive-foreground text-[10px] px-2 py-0.5 font-bold">CANCELADA</Badge>
                        ) : (
                          <Badge className={cn(
                            "text-[10px] px-2 py-0.5 font-bold",
                            allQuitado ? "bg-fish-treated hover:bg-fish-treated text-white" : "bg-amber-500 hover:bg-amber-500 text-white"
                          )}>
                            {allQuitado ? "QUITADA" : "EM ABERTO"}
                          </Badge>
                        )}
                        {group.length > 1 && (
                          <Badge variant="outline" className="text-[10px] px-2 py-0.5">{group.length} itens</Badge>
                        )}
                      </div>
                      <span className={cn("text-base font-bold text-foreground shrink-0 ml-2", allCancelled && "line-through")}>
                        {formatBRL(totalCompra)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                      <Calendar className="w-3 h-3" />
                      <span>{new Date(first.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</span>
                    </div>
                    <div className="space-y-1 mb-1">
                      {group.map((d) => {
                        const p = produtos.find((x) => x.id === d.produto_id);
                        return (
                          <div key={d.id} className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground truncate">• {p?.nome ?? "—"} ({p?.sku ?? "—"})</span>
                            <span className="text-foreground font-medium shrink-0 ml-2">
                              {Number(d.kg)}kg × {formatBRL(Number(d.preco_kg))} = {formatBRL(Number(d.valor_total))}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    {!allCancelled && totalPago > 0 && (
                      <p className="text-[11px] text-muted-foreground">Pago: {formatBRL(totalPago)}</p>
                    )}
                    {allCancelled && motivo && (
                      <div className="rounded-2xl bg-destructive/10 border border-destructive/20 p-2 text-xs text-foreground mt-2">
                        <span className="font-semibold">Motivo: </span>{motivo}
                        {canceladoAt && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            em {new Date(canceladoAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                          </p>
                        )}
                      </div>
                    )}
                    <div className="flex gap-2 mt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={allCancelled}
                        className={cn(
                          "flex-1 rounded-2xl gap-1.5",
                          allCancelled
                            ? "opacity-50"
                            : "border-[hsl(142,70%,45%)]/40 text-[hsl(142,70%,38%)] hover:bg-[hsl(142,70%,45%)]/10"
                        )}
                        onClick={() => {
                          if (!f?.whatsapp) {
                            toast({ title: "WhatsApp não cadastrado", description: "Este fornecedor não possui WhatsApp cadastrado.", variant: "destructive" });
                            return;
                          }
                          openWhatsappReceipt(f?.whatsapp, {
                            tipo: "Compra",
                            data: first.created_at,
                            contraparte: f?.nome ?? "Fornecedor",
                            itens: group.map((d) => {
                              const p = produtos.find((x) => x.id === d.produto_id);
                              return {
                                nome: p?.nome ?? "Produto",
                                sku: p?.sku,
                                kg: Number(d.kg),
                                preco_kg: Number(d.preco_kg),
                              };
                            }),
                            valor_total: totalCompra,
                            valor_pago: totalPago,
                          });
                        }}
                      >
                        <MessageCircle className="w-4 h-4" /> WhatsApp
                      </Button>
                      {!allCancelled && isAdmin && (
                        <Button variant="outline" size="sm" className="flex-1 rounded-2xl text-destructive border-destructive/40 hover:bg-destructive/10" onClick={() => setCancelTarget(group)}>
                          <XCircle className="w-4 h-4" /> Cancelar
                        </Button>
                      )}
                    </div>
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
          title={`Cancelar compra — ${formatBRL(cancelTarget.reduce((acc, d) => acc + Number(d.valor_total), 0))}`}
          onConfirm={handleCancel}
        />
      )}
    </>
  );
}
