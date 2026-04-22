import { useState, useMemo } from "react";
import { usePedidos, type Pedido, type ItemPedido } from "@/hooks/usePedidos";
import { useProdutos } from "@/hooks/useProdutos";
import { useClientes } from "@/hooks/useClientes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/SearchableSelect";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { SlideUpModal } from "@/components/SlideUpModal";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { CancelReasonModal } from "@/components/CancelReasonModal";
import { QuitacaoModal } from "@/components/QuitacaoModal";
import { useAuth } from "@/hooks/useAuth";
import { useBilling } from "@/hooks/useBilling";
import { FileText, Plus, Pencil, CheckCircle2, Trash2, MapPin, Calendar, MessageCircle, ChevronLeft, ChevronRight, Search, XCircle, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/format";
import { openWhatsappReceipt } from "@/lib/whatsappReceipt";
import { usePeixariaInfo } from "@/hooks/usePeixariaInfo";

const PREPAID_METHODS = [
  { value: "pix", label: "Pix" },
  { value: "cartao", label: "Cartão" },
  { value: "dinheiro", label: "Dinheiro" },
] as const;

// ─── Order Form Modal ───
function OrderFormModal({ open, onOpenChange, editOrder, onSuccess }: {
  open: boolean; onOpenChange: (o: boolean) => void; editOrder?: Pedido; onSuccess?: () => void;
}) {
  const { produtos } = useProdutos();
  const { clientes } = useClientes();
  const { addPedido, updatePedido } = usePedidos();
  const { toast } = useToast();
  const activeProducts = produtos.filter((p) => p.ativo);
  const activeClients = clientes.filter((c) => c.ativo);

  const [clientId, setClientId] = useState(editOrder?.cliente_id ?? "");
  const [items, setItems] = useState<{ produto_id: string; kg: number; preco_kg: number }[]>(
    editOrder?.itens?.map(i => ({ produto_id: i.produto_id, kg: Number(i.kg), preco_kg: Number(i.preco_kg) })) ?? [{ produto_id: "", kg: 0, preco_kg: 0 }]
  );
  const [prepaid, setPrepaid] = useState(editOrder?.prepaid ?? false);
  const [prepaidMethod, setPrepaidMethod] = useState<"pix" | "cartao" | "dinheiro">(editOrder?.prepaid_method ?? "pix");

  const updateItem = (idx: number, field: string, value: string) => {
    setItems((prev) => prev.map((item, i) => {
      if (i !== idx) return item;
      if (field === "produto_id") return { ...item, produto_id: value };
      return { ...item, [field]: parseFloat(value) || 0 };
    }));
  };

  const addItem = () => setItems((prev) => [...prev, { produto_id: "", kg: 0, preco_kg: 0 }]);
  const removeItem = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx));
  const total = useMemo(() => items.reduce((acc, item) => acc + item.kg * item.preco_kg, 0), [items]);

  const handleSave = async () => {
    if (!clientId) return;
    const validItems = items.filter((i) => i.produto_id && i.kg > 0 && i.preco_kg > 0);
    if (validItems.length === 0) return;
    try {
      if (editOrder) {
        await updatePedido(editOrder.id, { cliente_id: clientId, itens: validItems });
        toast({ title: "Pedido atualizado!" });
      } else {
        await addPedido({ cliente_id: clientId, itens: validItems, prepaid, prepaid_method: prepaid ? prepaidMethod : undefined });
        toast({ title: prepaid ? "Pedido criado (pago antecipado)!" : "Pedido criado!" });
      }
      onOpenChange(false);
      onSuccess?.();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  return (
    <SlideUpModal open={open} onOpenChange={onOpenChange} title={editOrder ? "Editar Pedido" : "Criar Pedido"}>
      <div className="space-y-4 mt-2">
        <div><Label>Cliente</Label><SearchableSelect value={clientId} onValueChange={setClientId} placeholder="Selecione o cliente" options={activeClients.map((c) => ({ value: c.id, label: `${c.nome} — ${c.cidade}` }))} /></div>
        {items.map((item, idx) => {
          const product = produtos.find((p) => p.id === item.produto_id);
          return (
            <div key={idx} className="rounded-2xl border border-border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">Item {idx + 1}</span>
                {items.length > 1 && <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeItem(idx)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>}
              </div>
              <SearchableSelect value={item.produto_id} onValueChange={(v) => updateItem(idx, "produto_id", v)} placeholder="Selecione o produto" options={activeProducts.map((p) => ({ value: p.id, label: `${p.nome} (${p.sku}) — ${Number(p.estoque_kg).toFixed(1)}kg` }))} />
              {product && <p className={cn("text-xs font-medium", Number(product.estoque_kg) < 0 ? "text-destructive" : "text-fish-treated")}>Saldo: {Number(product.estoque_kg).toFixed(1)} kg</p>}
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">Peso (KG)</Label><Input type="number" step="0.1" min="0" value={item.kg || ""} onChange={(e) => updateItem(idx, "kg", e.target.value)} placeholder="5.0" className="rounded-2xl h-10" /></div>
                <div><Label className="text-xs">Valor/KG (R$)</Label><Input type="number" step="0.01" min="0" value={item.preco_kg || ""} onChange={(e) => updateItem(idx, "preco_kg", e.target.value)} placeholder="25.00" className="rounded-2xl h-10" /></div>
              </div>
              <p className="text-xs text-muted-foreground text-right">Subtotal: {formatBRL(item.kg * item.preco_kg)}</p>
            </div>
          );
        })}
        <Button variant="outline" className="w-full rounded-2xl" onClick={addItem}><Plus className="w-4 h-4" /> Adicionar + Item</Button>
        <div className="rounded-2xl border border-border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="prepaid-toggle" className="text-sm font-semibold cursor-pointer">Pedido Pago Antecipado?</Label>
            <Switch id="prepaid-toggle" checked={prepaid} onCheckedChange={setPrepaid} />
          </div>
          {prepaid && (
            <div><Label className="text-xs">Forma de Pagamento</Label>
              <div className="grid grid-cols-3 gap-2 mt-1">
                {PREPAID_METHODS.map((m) => (
                  <button key={m.value} onClick={() => setPrepaidMethod(m.value)}
                    className={cn("rounded-2xl py-2.5 text-sm font-semibold transition-colors border",
                      prepaidMethod === m.value ? "bg-primary text-primary-foreground border-primary" : "bg-card text-foreground border-border"
                    )}>{m.label}</button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="rounded-2xl bg-muted p-4 text-center">
          <p className="text-xs text-muted-foreground uppercase">Total do Pedido</p>
          <p className="text-3xl font-bold text-foreground">{formatBRL(total)}</p>
          {prepaid && <p className="text-xs text-fish-treated font-semibold mt-1">✓ Pago antecipado via {PREPAID_METHODS.find(m => m.value === prepaidMethod)?.label}</p>}
        </div>
        <Button size="lg" className="w-full" onClick={handleSave}>{editOrder ? "Salvar Alterações" : "Criar Pedido"}</Button>
      </div>
    </SlideUpModal>
  );
}

// ─── Fulfill Modal ───
function FulfillModal({ open, onOpenChange, order, onSuccess }: {
  open: boolean; onOpenChange: (o: boolean) => void; order: Pedido; onSuccess?: () => void;
}) {
  const { fulfillPedido } = usePedidos();
  const { addPagamentoEntrada, refetch: refetchBilling } = useBilling();
  const { toast } = useToast();
  const [payment, setPayment] = useState<"avista" | "prazo">("avista");
  const [entrada, setEntrada] = useState("");

  const [submitting, setSubmitting] = useState(false);

  const handleFulfill = async () => {
    try {
      setSubmitting(true);
      if (order.prepaid) {
        await fulfillPedido(order.id, "avista");
        await addPagamentoEntrada({ cliente_id: order.cliente_id, origem: "pedido", pedido_id: order.id, valor: Number(order.valor_total), tipo: "total" });
        toast({ title: "Pedido atendido!", description: `Pago antecipado — ${formatBRL(Number(order.valor_total))}` });
      } else {
        const entradaNum = parseFloat(entrada) || 0;
        await fulfillPedido(order.id, payment, payment === "prazo" ? entradaNum : undefined);
        if (payment === "avista") {
          await addPagamentoEntrada({ cliente_id: order.cliente_id, origem: "pedido", pedido_id: order.id, valor: Number(order.valor_total), tipo: "total" });
        } else {
          if (entradaNum > 0) {
            await addPagamentoEntrada({ cliente_id: order.cliente_id, origem: "pedido", pedido_id: order.id, valor: entradaNum, tipo: "parcial" });
          }
          // Update client debt
          const { data: cliente } = await supabase.from("clientes").select("debito").eq("id", order.cliente_id).single();
          if (cliente) {
            const debtAmount = Number(order.valor_total) - entradaNum;
            const { error: debtError } = await supabase.from("clientes").update({ debito: +(Number(cliente.debito) + debtAmount).toFixed(2) }).eq("id", order.cliente_id);
            if (debtError) throw debtError;
          }
          // Invalidate billing cache after direct debt update
          await refetchBilling();
        }
        toast({ title: "Pedido atendido!", description: formatBRL(Number(order.valor_total)) });
      }
      onOpenChange(false);
      onSuccess?.();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (order.prepaid) {
    return (
      <SlideUpModal open={open} onOpenChange={onOpenChange} title="Atender Pedido">
        <div className="space-y-4 mt-2">
          <div className="rounded-2xl bg-muted p-4 text-center">
            <p className="text-xs text-muted-foreground uppercase">Total</p>
            <p className="text-3xl font-bold text-foreground">{formatBRL(Number(order.valor_total))}</p>
          </div>
          <div className="rounded-2xl bg-fish-treated/10 border border-fish-treated/30 p-4 text-center">
            <Badge className="bg-fish-treated text-white text-sm px-4 py-1 mb-2">PAGO</Badge>
            <p className="text-sm text-foreground font-medium">Pagamento já recebido via {PREPAID_METHODS.find(m => m.value === order.prepaid_method)?.label || "—"}</p>
            <p className="text-xs text-muted-foreground mt-1">Apenas a baixa do estoque será realizada.</p>
          </div>
          <Button size="lg" className="w-full" onClick={handleFulfill} disabled={submitting}><CheckCircle2 className="w-5 h-5" /> {submitting ? "Processando..." : "Confirmar Atendimento"}</Button>
        </div>
      </SlideUpModal>
    );
  }

  return (
    <SlideUpModal open={open} onOpenChange={onOpenChange} title="Atender Pedido">
      <div className="space-y-4 mt-2">
        <div className="rounded-2xl bg-muted p-4 text-center">
          <p className="text-xs text-muted-foreground uppercase">Total</p>
          <p className="text-3xl font-bold text-foreground">{formatBRL(Number(order.valor_total))}</p>
        </div>
        <div><Label>Forma de Pagamento</Label>
          <div className="grid grid-cols-2 gap-2 mt-1">
            {(["avista", "prazo"] as const).map((t) => (
              <button key={t} onClick={() => setPayment(t)}
                className={cn("rounded-2xl py-3 text-sm font-semibold transition-colors border",
                  payment === t ? "bg-primary text-primary-foreground border-primary" : "bg-card text-foreground border-border"
                )}>{t === "avista" ? "À Vista" : "A Prazo"}</button>
            ))}
          </div>
        </div>
        {payment === "prazo" && (
          <div>
            <Label>Valor de Entrada (R$)</Label>
            <Input type="number" step="0.01" min="0" value={entrada} onChange={(e) => setEntrada(e.target.value)} placeholder="Ex: 50.00" className="rounded-2xl h-12 text-lg" />
            {entrada && <p className="text-xs text-muted-foreground mt-1">Restante (débito): {formatBRL(Number(order.valor_total) - (parseFloat(entrada) || 0))}</p>}
          </div>
        )}
        <Button size="lg" className="w-full" onClick={handleFulfill} disabled={submitting}><CheckCircle2 className="w-5 h-5" /> {submitting ? "Processando..." : "Confirmar Atendimento"}</Button>
      </div>
    </SlideUpModal>
  );
}

// ─── Month Navigator ───
const MONTH_NAMES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

function MonthNavigator({ month, year, onPrev, onNext, searchValue, onSearchChange }: {
  month: number; year: number; onPrev: () => void; onNext: () => void; searchValue: string; onSearchChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center rounded-2xl bg-muted px-2 py-1 shrink-0">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onPrev}><ChevronLeft className="w-4 h-4" /></Button>
        <span className="text-xs font-semibold text-foreground whitespace-nowrap px-1">{MONTH_NAMES[month].slice(0, 3)} {year}</span>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onNext}><ChevronRight className="w-4 h-4" /></Button>
      </div>
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input type="text" placeholder="Nº pedido..." value={searchValue} onChange={(e) => onSearchChange(e.target.value)} className="rounded-2xl h-9 pl-9 text-sm" />
      </div>
    </div>
  );
}

// ─── Order Card ───
function OrderCard({ order, isPendente, pagoExtra, onEdit, onFulfill, onDelete, onCancel, onQuitar }: {
  order: Pedido; isPendente: boolean; pagoExtra?: number; onEdit?: (o: Pedido) => void; onFulfill?: (o: Pedido) => void; onDelete?: (o: Pedido) => void; onCancel?: (o: Pedido) => void; onQuitar?: (o: Pedido) => void;
}) {
  const { clientes } = useClientes();
  const { produtos } = useProdutos();
  const { nome: peixariaNome } = usePeixariaInfo();
  const client = clientes.find((c) => c.id === order.cliente_id);
  const isCancelled = !!order.cancelado;

  const canFulfill = (order.itens ?? []).every((item) => {
    const product = produtos.find((p) => p.id === item.produto_id);
    return product && Number(product.estoque_kg) >= Number(item.kg);
  });

  return (
    <div className={cn(
      "rounded-3xl bg-card p-4 shadow-sm border-l-4",
      isCancelled ? "border-l-destructive opacity-70" : isPendente ? "border-l-amber-400" : "border-l-fish-treated opacity-80"
    )}>
      <div className="flex items-start justify-between mb-1">
        <div className="flex items-center gap-2">
          <h3 className={cn("font-bold text-foreground text-base", isCancelled && "line-through")}>{client?.nome || "—"}</h3>
          {isCancelled ? (
            <Badge className="bg-destructive hover:bg-destructive text-destructive-foreground text-[10px] px-2 py-0.5 font-bold tracking-wide">CANCELADO</Badge>
          ) : order.status === "atendido" ? (
            <Badge className="bg-primary hover:bg-primary text-primary-foreground text-[10px] px-2 py-0.5 font-bold tracking-wide">ATENDIDO</Badge>
          ) : order.prepaid ? (
            <Badge className="bg-fish-treated hover:bg-fish-treated text-white text-[10px] px-2 py-0.5 font-bold tracking-wide">PAGO</Badge>
          ) : (
            <Badge className="bg-amber-500 hover:bg-amber-500 text-white text-[10px] px-2 py-0.5 font-bold tracking-wide">A RECEBER</Badge>
          )}
        </div>
        <span className="text-sm font-bold text-muted-foreground">#{String(order.numero || 0).padStart(3, "0")}</span>
        <div className="text-right">
          <span className={cn("text-lg font-bold text-foreground", isCancelled && "line-through")}>{formatBRL(Number(order.valor_total))}</span>
          {!isPendente && <p className="text-[10px] text-muted-foreground">{order.pagamento === "prazo" ? "A Prazo" : "À Vista"}</p>}
          {isPendente && order.prepaid && order.prepaid_method && (
            <p className="text-[10px] text-fish-treated font-medium">via {PREPAID_METHODS.find(m => m.value === order.prepaid_method)?.label}</p>
          )}
        </div>
      </div>
      <div className="space-y-1 mb-3">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Calendar className="w-3.5 h-3.5 shrink-0" /><span>{new Date(order.created_at).toLocaleDateString("pt-BR")}</span>
        </div>
        {client?.endereco && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="w-3.5 h-3.5 shrink-0" /><span>{client.endereco}{client.cidade ? `, ${client.cidade}` : ""}</span>
          </div>
        )}
        {client?.whatsapp && (
          <div className="flex items-center gap-1.5 text-xs">
            <MessageCircle className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
            <span className="text-muted-foreground">{client.whatsapp}</span>
            <button type="button" onClick={(e) => { e.stopPropagation(); window.open(`https://wa.me/55${client.whatsapp.replace(/\D/g, "")}`, '_blank'); }}
              className="ml-1 inline-flex items-center justify-center w-8 h-8 rounded-full bg-[hsl(142,70%,45%)] hover:bg-[hsl(142,70%,38%)] transition-colors">
              <MessageCircle className="w-4 h-4 text-white" />
            </button>
          </div>
        )}
      </div>
      <div className="space-y-1 mb-3">
        {(order.itens ?? []).map((item, idx) => {
          const product = produtos.find((p) => p.id === item.produto_id);
          return (
            <div key={idx} className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{product?.nome || "—"} ({product?.sku})</span>
              <span className="text-foreground font-medium">{Number(item.kg)}kg × {formatBRL(Number(item.preco_kg))}</span>
            </div>
          );
        })}
      </div>
      {isCancelled && order.cancelado_motivo && (
        <div className="rounded-2xl bg-destructive/10 border border-destructive/20 p-2 text-xs text-foreground mb-2">
          <span className="font-semibold">Motivo: </span>{order.cancelado_motivo}
          {order.cancelado_at && (
            <p className="text-[10px] text-muted-foreground mt-0.5">
              em {new Date(order.cancelado_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
            </p>
          )}
        </div>
      )}
      {isPendente && !isCancelled && (
        <div className="flex gap-2">
          {onFulfill && (
            <Button size="sm" className={cn("flex-1 rounded-2xl", !canFulfill && "opacity-50")} disabled={!canFulfill} onClick={() => onFulfill(order)}>
              <CheckCircle2 className="w-4 h-4" /> Atender
            </Button>
          )}
          {onEdit && <Button variant="outline" size="sm" className="rounded-2xl" onClick={() => onEdit(order)}><Pencil className="w-4 h-4" /></Button>}
          {onDelete && (
            <AlertDialog>
              <Button variant="outline" size="sm" className="rounded-2xl" onClick={() => onDelete(order)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
            </AlertDialog>
          )}
        </div>
      )}
      {!isPendente && (
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={isCancelled || !client?.whatsapp}
            className={cn(
              "flex-1 rounded-2xl gap-1.5",
              isCancelled || !client?.whatsapp
                ? "opacity-50"
                : "border-[hsl(142,70%,45%)]/40 text-[hsl(142,70%,38%)] hover:bg-[hsl(142,70%,45%)]/10"
            )}
            onClick={() => {
              const valorTotal = Number(order.valor_total);
              const valorPago = order.prepaid || order.pagamento === "avista"
                ? valorTotal
                : Number(order.entrada ?? 0);
              openWhatsappReceipt(client?.whatsapp, {
                tipo: "Pedido",
                peixaria: peixariaNome ?? undefined,
                numero: `#${String(order.numero || 0).padStart(3, "0")}`,
                data: order.created_at,
                contraparte: client?.nome ?? "Cliente",
                itens: (order.itens ?? []).map((it) => {
                  const p = produtos.find((pr) => pr.id === it.produto_id);
                  return { nome: p?.nome ?? "Item", sku: p?.sku, kg: Number(it.kg), preco_kg: Number(it.preco_kg) };
                }),
                valor_total: valorTotal,
                valor_pago: valorPago,
              });
            }}
          >
            <MessageCircle className="w-4 h-4" /> WhatsApp
          </Button>
          {!isCancelled && onQuitar && order.pagamento === "prazo" && (Number(order.entrada ?? 0) + (pagoExtra ?? 0)) < Number(order.valor_total) && (
            <Button
              variant="outline"
              size="sm"
              className="flex-1 rounded-2xl gap-1.5 border-amber-500/50 text-amber-600 hover:bg-amber-500/10"
              onClick={() => onQuitar(order)}
            >
              <DollarSign className="w-4 h-4" /> Quitar
            </Button>
          )}
          {!isCancelled && onCancel && (
            <Button variant="outline" size="sm" className="flex-1 rounded-2xl text-destructive border-destructive/40 hover:bg-destructive/10" onClick={() => onCancel(order)}>
              <XCircle className="w-4 h-4" /> Cancelar
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export function OrdersPage() {
  const { pedidos, deletePedido, cancelPedido, refetch: refetchPedidos } = usePedidos();
  const { refetch: refetchProdutos } = useProdutos();
  const { refetch: refetchBilling, receiveFromClient, pagamentosEntrada } = useBilling();
  const { role } = useAuth();
  const isAdmin = role === "administrador" || role === "root";
  const { toast } = useToast();
  const now = new Date();
  const [filterMonth, setFilterMonth] = useState(now.getMonth());
  const [filterYear, setFilterYear] = useState(now.getFullYear());
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editOrder, setEditOrder] = useState<Pedido | undefined>();
  const [fulfillOrder, setFulfillOrder] = useState<Pedido | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<Pedido | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Pedido | null>(null);
  const [quitarTarget, setQuitarTarget] = useState<Pedido | null>(null);

  // Pagamentos extra (recebimentos posteriores ao atendimento) por pedido
  const pagoExtraByPedido = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of pagamentosEntrada) {
      if (p.cancelado || !p.pedido_id) continue;
      // entradas iniciais já foram registradas como tipo "parcial"/"total" no fulfill;
      // recebimentos posteriores são tipo "parcial"/"total" com origem "recebimento"
      if (p.origem === "recebimento") {
        map.set(p.pedido_id, +(((map.get(p.pedido_id) ?? 0) + Number(p.valor))).toFixed(2));
      }
    }
    return map;
  }, [pagamentosEntrada]);

  const prevMonth = () => { if (filterMonth === 0) { setFilterMonth(11); setFilterYear((y) => y - 1); } else setFilterMonth((m) => m - 1); };
  const nextMonth = () => { if (filterMonth === 11) { setFilterMonth(0); setFilterYear((y) => y + 1); } else setFilterMonth((m) => m + 1); };

  const filtered = useMemo(() => {
    return pedidos.filter((o) => {
      const d = new Date(o.created_at);
      if (d.getMonth() !== filterMonth || d.getFullYear() !== filterYear) return false;
      if (search && !String(o.numero).includes(search)) return false;
      return true;
    });
  }, [pedidos, filterMonth, filterYear, search]);

  const pendentes = filtered.filter((o) => o.status === "pendente" && !o.cancelado);
  const atendidos = filtered.filter((o) => o.status === "atendido");

  const handleDelete = async (order: Pedido) => {
    try {
      await deletePedido(order.id);
      toast({ title: "Pedido excluído" });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
    setDeleteTarget(null);
  };

  const handleCancel = async (motivo: string) => {
    if (!cancelTarget) return;
    await cancelPedido(cancelTarget.id, motivo);
    await Promise.all([refetchPedidos(), refetchProdutos(), refetchBilling()]);
    toast({ title: "Pedido cancelado", description: "Estoque, entradas e débitos foram estornados." });
    setCancelTarget(null);
  };

  const handleQuitar = async (amount: number, tipo: "total" | "parcial") => {
    if (!quitarTarget || !quitarTarget.cliente_id) return;
    try {
      const pago = Number(quitarTarget.entrada ?? 0) + (pagoExtraByPedido.get(quitarTarget.id) ?? 0);
      const saldo = +(Number(quitarTarget.valor_total) - pago).toFixed(2);
      const valor = tipo === "total" ? saldo : amount;
      // Usamos "parcial" no débito do cliente para não zerar dívidas de outros pedidos/vendas
      await receiveFromClient(quitarTarget.cliente_id, valor, "parcial", { pedido_id: quitarTarget.id });
      await Promise.all([refetchPedidos(), refetchBilling()]);
      toast({ title: tipo === "total" ? "Pedido quitado" : "Pagamento parcial registrado", description: formatBRL(valor) });
      setQuitarTarget(null);
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4 pb-24">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-6 h-6 text-secondary" />
          <h1 className="text-xl font-bold text-foreground">Pedidos</h1>
        </div>
        <Button size="sm" onClick={() => { setEditOrder(undefined); setFormOpen(true); }}>
          <Plus className="w-4 h-4" /> Novo
        </Button>
      </div>

      <MonthNavigator month={filterMonth} year={filterYear} onPrev={prevMonth} onNext={nextMonth} searchValue={search} onSearchChange={setSearch} />

      <Tabs defaultValue="pendentes" className="w-full">
        <TabsList className="w-full rounded-2xl grid grid-cols-2">
          <TabsTrigger value="pendentes" className="rounded-xl text-sm">Pendentes ({pendentes.length})</TabsTrigger>
          <TabsTrigger value="atendidos" className="rounded-xl text-sm">Atendidos ({atendidos.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="pendentes">
          {pendentes.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground"><FileText className="w-12 h-12 mx-auto mb-3 opacity-30" /><p className="text-sm">Nenhum pedido pendente</p></div>
          ) : (
            <div className="space-y-3">
              {pendentes.map((o) => (
                <OrderCard key={o.id} order={o} isPendente
                  onEdit={(o) => { setEditOrder(o); setFormOpen(true); }}
                  onFulfill={(o) => setFulfillOrder(o)}
                  onDelete={isAdmin ? (o) => setDeleteTarget(o) : undefined}
                />
              ))}
            </div>
          )}
        </TabsContent>
        <TabsContent value="atendidos">
          {atendidos.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground"><FileText className="w-12 h-12 mx-auto mb-3 opacity-30" /><p className="text-sm">Nenhum pedido atendido</p></div>
          ) : (
            <div className="space-y-3">
              {atendidos.map((o) => (
                <OrderCard
                  key={o.id}
                  order={o}
                  isPendente={false}
                  pagoExtra={pagoExtraByPedido.get(o.id) ?? 0}
                  onCancel={isAdmin && !o.cancelado ? (o) => setCancelTarget(o) : undefined}
                  onQuitar={!o.cancelado ? (o) => setQuitarTarget(o) : undefined}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {formOpen && <OrderFormModal open={formOpen} onOpenChange={setFormOpen} editOrder={editOrder} onSuccess={refetchPedidos} />}
      {fulfillOrder && <FulfillModal open={!!fulfillOrder} onOpenChange={(o) => !o && setFulfillOrder(undefined)} order={fulfillOrder} onSuccess={refetchPedidos} />}

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Pedido #{String(deleteTarget?.numero || 0).padStart(3, "0")}?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteTarget && handleDelete(deleteTarget)}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {cancelTarget && (
        <CancelReasonModal
          open={!!cancelTarget}
          onOpenChange={(o) => !o && setCancelTarget(null)}
          title={`Cancelar pedido #${String(cancelTarget.numero || 0).padStart(3, "0")}`}
          onConfirm={handleCancel}
        />
      )}

      {quitarTarget && (
        <QuitacaoModal
          open={!!quitarTarget}
          onOpenChange={(o) => !o && setQuitarTarget(null)}
          title={`Quitar pedido #${String(quitarTarget.numero || 0).padStart(3, "0")}`}
          totalDevido={Number(quitarTarget.valor_total)}
          jaPago={Number(quitarTarget.entrada ?? 0) + (pagoExtraByPedido.get(quitarTarget.id) ?? 0)}
          onConfirm={handleQuitar}
        />
      )}
    </div>
  );
}
