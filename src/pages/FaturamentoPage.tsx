import { useState, useMemo } from "react";
import { useClientes } from "@/hooks/useClientes";
import { useFornecedores } from "@/hooks/useFornecedores";
import { useProdutos } from "@/hooks/useProdutos";
import { useBilling, type DividaCompra } from "@/hooks/useBilling";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { SlideUpModal } from "@/components/SlideUpModal";
import { Wallet, Calendar, ArrowDownCircle, FileText, ChevronLeft, ChevronRight, Plus, Receipt } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { formatBRL } from "@/lib/format";

// ─── Card Skeleton ───
function CardSkeleton() {
  return (
    <div className="rounded-3xl bg-card p-3 shadow-sm border-l-4 border-l-muted">
      <Skeleton className="h-3 w-16 mb-2" />
      <Skeleton className="h-6 w-24" />
    </div>
  );
}

// ─── List Item Skeleton ───
function ListSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-3xl bg-card p-4 shadow-sm">
          <div className="flex items-start justify-between mb-2">
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-5 w-20" />
          </div>
          <Skeleton className="h-8 w-full rounded-2xl mt-2" />
        </div>
      ))}
    </div>
  );
}

// ─── Pay Debt Modal ───
function PayDebtModal({ open, onOpenChange, debt }: {
  open: boolean; onOpenChange: (o: boolean) => void; debt: DividaCompra;
}) {
  const { payDivida } = useBilling();
  const { fornecedores } = useFornecedores();
  const { toast } = useToast();
  const [mode, setMode] = useState<"avista" | "adiantamento">("avista");
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const remaining = +(Number(debt.valor_total) - Number(debt.valor_pago)).toFixed(2);
  const supplier = fornecedores.find((s) => s.id === debt.fornecedor_id);

  const handlePay = async () => {
    try {
      setSubmitting(true);
      if (mode === "avista") {
        await payDivida(debt.id, remaining, "total");
        toast({ title: "Dívida quitada!", description: `${formatBRL(remaining)} pago a ${supplier?.nome}` });
      } else {
        const val = parseFloat(amount) || 0;
        if (val <= 0 || val > remaining) { setSubmitting(false); return; }
        await payDivida(debt.id, val, "adiantamento");
        toast({ title: "Adiantamento registrado!", description: `${formatBRL(val)} — Restante: ${formatBRL(remaining - val)}` });
      }
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SlideUpModal open={open} onOpenChange={onOpenChange} title="Quitar Dívida">
      <div className="space-y-4 mt-2">
        <div className="rounded-2xl bg-muted p-4 text-center">
          <p className="text-xs text-muted-foreground uppercase">Saldo Devedor</p>
          <p className="text-3xl font-bold text-foreground">{formatBRL(remaining)}</p>
          <p className="text-xs text-muted-foreground mt-1">{supplier?.nome}</p>
        </div>
        <div><Label>Forma de Pagamento</Label>
          <div className="grid grid-cols-2 gap-2 mt-1">
            {(["avista", "adiantamento"] as const).map((t) => (
              <button key={t} onClick={() => setMode(t)}
                className={cn("rounded-2xl py-3 text-sm font-semibold transition-colors border",
                  mode === t ? "bg-primary text-primary-foreground border-primary" : "bg-card text-foreground border-border"
                )}>{t === "avista" ? "À Vista" : "Adiantamento"}</button>
            ))}
          </div>
        </div>
        {mode === "adiantamento" && (
          <div>
            <Label>Valor do Adiantamento (R$)</Label>
            <Input type="number" step="0.01" min="0" max={remaining} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Ex: 100.00" className="rounded-2xl h-12 text-lg" />
            {amount && <p className="text-xs text-muted-foreground mt-1">Restante após pagamento: {formatBRL(remaining - (parseFloat(amount) || 0))}</p>}
          </div>
        )}
        <Button size="lg" className="w-full" onClick={handlePay} disabled={submitting}>
          {submitting ? "Processando..." : "Confirmar Pagamento"}
        </Button>
      </div>
    </SlideUpModal>
  );
}

// ─── Receive from Client Modal ───
function ReceiveModal({ open, onOpenChange, clientId, clientName, debt }: {
  open: boolean; onOpenChange: (o: boolean) => void; clientId: string; clientName: string; debt: number;
}) {
  const { receiveFromClient } = useBilling();
  const { toast } = useToast();
  const [mode, setMode] = useState<"total" | "parcial">("total");
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleReceive = async () => {
    try {
      setSubmitting(true);
      if (mode === "total") {
        await receiveFromClient(clientId, debt, "total");
        toast({ title: "Débito quitado!", description: `${formatBRL(debt)} recebido de ${clientName}` });
      } else {
        const val = parseFloat(amount) || 0;
        if (val <= 0 || val > debt) { setSubmitting(false); return; }
        await receiveFromClient(clientId, val, "parcial");
        toast({ title: "Recebimento parcial!", description: `${formatBRL(val)} — Restante: ${formatBRL(debt - val)}` });
      }
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SlideUpModal open={open} onOpenChange={onOpenChange} title="Receber Pagamento">
      <div className="space-y-4 mt-2">
        <div className="rounded-2xl bg-muted p-4 text-center">
          <p className="text-xs text-muted-foreground uppercase">Débito do Cliente</p>
          <p className="text-3xl font-bold text-destructive">{formatBRL(debt)}</p>
          <p className="text-xs text-muted-foreground mt-1">{clientName}</p>
        </div>
        <div><Label>Tipo de Recebimento</Label>
          <div className="grid grid-cols-2 gap-2 mt-1">
            {(["total", "parcial"] as const).map((t) => (
              <button key={t} onClick={() => setMode(t)}
                className={cn("rounded-2xl py-3 text-sm font-semibold transition-colors border",
                  mode === t ? "bg-primary text-primary-foreground border-primary" : "bg-card text-foreground border-border"
                )}>{t === "total" ? "À Vista (Total)" : "Parcial"}</button>
            ))}
          </div>
        </div>
        {mode === "parcial" && (
          <div>
            <Label>Valor Recebido (R$)</Label>
            <Input type="number" step="0.01" min="0" max={debt} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Ex: 50.00" className="rounded-2xl h-12 text-lg" />
            {amount && <p className="text-xs text-muted-foreground mt-1">Restante: {formatBRL(debt - (parseFloat(amount) || 0))}</p>}
          </div>
        )}
        <Button size="lg" className="w-full" onClick={handleReceive} disabled={submitting}>
          {submitting ? "Processando..." : "Confirmar Recebimento"}
        </Button>
      </div>
    </SlideUpModal>
  );
}

// ─── Month Navigator ───
const MONTH_NAMES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

function MonthNav({ month, year, onPrev, onNext }: { month: number; year: number; onPrev: () => void; onNext: () => void }) {
  return (
    <div className="flex items-center justify-center rounded-2xl bg-muted px-2 py-1">
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onPrev}><ChevronLeft className="w-4 h-4" /></Button>
      <span className="text-xs font-semibold text-foreground whitespace-nowrap px-1">{MONTH_NAMES[month].slice(0, 3)} {year}</span>
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onNext}><ChevronRight className="w-4 h-4" /></Button>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="text-center py-12 text-muted-foreground"><FileText className="w-12 h-12 mx-auto mb-3 opacity-30" /><p className="text-sm">{text}</p></div>;
}

// ─── Tab: A Pagar ───
function TabAPagar({ filterMonth, filterYear }: { filterMonth: number; filterYear: number }) {
  const { dividasCompra, loading } = useBilling();
  const { fornecedores } = useFornecedores();
  const { produtos } = useProdutos();
  const [payingDebt, setPayingDebt] = useState<DividaCompra | undefined>();

  const openDebts = dividasCompra.filter((d) => {
    if (d.quitado) return false;
    const dt = new Date(d.created_at);
    return dt.getMonth() === filterMonth && dt.getFullYear() === filterYear;
  });

  if (loading) return <ListSkeleton />;

  return (
    <>
      {openDebts.length === 0 ? <EmptyState text="Nenhuma dívida pendente com fornecedores" /> : (
        <div className="space-y-3">
          {openDebts.map((debt) => {
            const supplier = debt.fornecedor_id ? fornecedores.find((s) => s.id === debt.fornecedor_id) : null;
            const product = debt.produto_id ? produtos.find((p) => p.id === debt.produto_id) : null;
            const remaining = +(Number(debt.valor_total) - Number(debt.valor_pago)).toFixed(2);
            const isDespesa = !debt.fornecedor_id && !!debt.descricao;
            return (
              <div key={debt.id} className="rounded-3xl bg-card p-4 shadow-sm border-l-4 border-l-destructive">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-bold text-foreground text-base">
                      {isDespesa ? debt.descricao : (supplier?.nome || "—")}
                    </h3>
                    {isDespesa ? (
                      <p className="text-xs text-muted-foreground">
                        Despesa{debt.recorrente ? " • Recorrente" : ""}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">{product?.nome} ({product?.sku})</p>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-bold text-destructive">{formatBRL(remaining)}</span>
                    {Number(debt.valor_pago) > 0 && <p className="text-[10px] text-muted-foreground">Pago: {formatBRL(Number(debt.valor_pago))}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                  {!isDespesa && <><span>{Number(debt.kg)} kg</span><span>{formatBRL(Number(debt.preco_kg))}/kg</span></>}
                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(debt.created_at).toLocaleDateString("pt-BR")}</span>
                </div>
                <Button size="sm" className="w-full rounded-2xl" onClick={() => setPayingDebt(debt)}><Wallet className="w-4 h-4" /> Quitar</Button>
              </div>
            );
          })}
        </div>
      )}
      {payingDebt && <PayDebtModal open={!!payingDebt} onOpenChange={(o) => !o && setPayingDebt(undefined)} debt={payingDebt} />}
    </>
  );
}

// ─── Income Modal ───
function IncomeModal({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { addReceita } = useBilling();
  const { toast } = useToast();
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [avista, setAvista] = useState(true);
  const [recorrente, setRecorrente] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const reset = () => { setDescricao(""); setValor(""); setAvista(true); setRecorrente(false); };

  const handleSave = async () => {
    const v = parseFloat(valor) || 0;
    if (!descricao.trim()) { toast({ title: "Informe a descrição", variant: "destructive" }); return; }
    if (v <= 0) { toast({ title: "Informe um valor válido", variant: "destructive" }); return; }
    try {
      setSubmitting(true);
      await addReceita({ descricao: descricao.trim(), valor: v, avista, recorrente: !avista && recorrente });
      toast({
        title: "Receita lançada!",
        description: avista
          ? `${formatBRL(v)} em Entradas`
          : `${formatBRL(v)} em A Receber${recorrente ? " (12 meses)" : ""}`,
      });
      reset();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SlideUpModal open={open} onOpenChange={onOpenChange} title="Lançar Receita">
      <div className="space-y-4 mt-2">
        <div>
          <Label>Descrição</Label>
          <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex: Aluguel recebido" className="rounded-2xl h-12" />
        </div>
        <div>
          <Label>Valor (R$)</Label>
          <Input type="number" step="0.01" min="0" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0.00" className="rounded-2xl h-12 text-lg" />
        </div>
        <div className="flex items-center justify-between rounded-2xl bg-muted px-4 py-3">
          <div>
            <Label className="text-sm">À Vista</Label>
            <p className="text-[11px] text-muted-foreground">Lança direto em Entradas</p>
          </div>
          <Switch checked={avista} onCheckedChange={(v) => { setAvista(v); if (v) setRecorrente(false); }} />
        </div>
        {!avista && (
          <div className="flex items-center justify-between rounded-2xl bg-muted px-4 py-3">
            <div>
              <Label className="text-sm">Recorrente (12 meses)</Label>
              <p className="text-[11px] text-muted-foreground">Replica em todos os meses futuros</p>
            </div>
            <Switch checked={recorrente} onCheckedChange={setRecorrente} />
          </div>
        )}
        {!avista && (
          <p className="text-xs text-muted-foreground text-center">Será lançado em <strong>A Receber</strong></p>
        )}
        <Button
          size="lg"
          className="w-full rounded-2xl bg-fish-treated text-primary-foreground hover:bg-fish-treated/90"
          onClick={handleSave}
          disabled={submitting}
        >
          {submitting ? "Salvando..." : "Lançar Receita"}
        </Button>
      </div>
    </SlideUpModal>
  );
}

// ─── Tab: A Receber ───
function TabAReceber({ filterMonth, filterYear }: { filterMonth: number; filterYear: number }) {
  const { clientes, loading } = useClientes();
  const { pagamentosEntrada, loading: loadingBilling, quitarReceita } = useBilling();
  const { toast } = useToast();
  const [receiving, setReceiving] = useState<{ id: string; nome: string; debito: number } | undefined>();
  const [incomeOpen, setIncomeOpen] = useState(false);
  const [quitandoId, setQuitandoId] = useState<string | null>(null);

  const debtors = clientes.filter((c) => Number(c.debito) > 0);

  const receitasPendentes = pagamentosEntrada.filter((p) => {
    if (p.cancelado) return false;
    if (p.tipo !== "pendente") return false;
    if (!p.origem?.startsWith("receita_pendente:")) return false;
    const d = new Date(p.created_at);
    return d.getMonth() === filterMonth && d.getFullYear() === filterYear;
  });

  const handleQuitarReceita = async (id: string) => {
    try {
      setQuitandoId(id);
      await quitarReceita(id);
      toast({ title: "Receita recebida!", description: "Lançada em Entradas" });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setQuitandoId(null);
    }
  };

  if (loading || loadingBilling) return <ListSkeleton />;

  return (
    <div className="space-y-3">
      <Button
        onClick={() => setIncomeOpen(true)}
        className="w-full rounded-2xl gap-2 bg-fish-treated text-primary-foreground hover:bg-fish-treated/90"
      >
        <Receipt className="w-4 h-4" /> Lançar Receita
      </Button>
      {debtors.length === 0 && receitasPendentes.length === 0 ? (
        <EmptyState text="Nenhum débito ou receita pendente" />
      ) : (
        <div className="space-y-3">
          {debtors.map((client) => (
            <div key={client.id} className="rounded-3xl bg-card p-4 shadow-sm border-l-4 border-l-amber-400">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-bold text-foreground text-base">{client.nome}</h3>
                  <p className="text-xs text-muted-foreground">{client.cidade}</p>
                </div>
                <span className="text-lg font-bold text-destructive">{formatBRL(Number(client.debito))}</span>
              </div>
              <Button size="sm" className="w-full rounded-2xl" onClick={() => setReceiving({ id: client.id, nome: client.nome, debito: Number(client.debito) })}>
                <ArrowDownCircle className="w-4 h-4" /> Receber / Quitar
              </Button>
            </div>
          ))}
          {receitasPendentes.map((r) => {
            const desc = (r.origem || "").slice("receita_pendente:".length);
            return (
              <div key={r.id} className="rounded-3xl bg-card p-4 shadow-sm border-l-4 border-l-fish-treated">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-bold text-foreground text-base">{desc}</h3>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> {new Date(r.created_at).toLocaleDateString("pt-BR")} • Receita
                    </p>
                  </div>
                  <span className="text-lg font-bold text-fish-treated">{formatBRL(Number(r.valor))}</span>
                </div>
                <Button
                  size="sm"
                  className="w-full rounded-2xl bg-fish-treated text-primary-foreground hover:bg-fish-treated/90"
                  onClick={() => handleQuitarReceita(r.id)}
                  disabled={quitandoId === r.id}
                >
                  <Wallet className="w-4 h-4" /> {quitandoId === r.id ? "Processando..." : "Quitar"}
                </Button>
              </div>
            );
          })}
        </div>
      )}
      {receiving && <ReceiveModal open={!!receiving} onOpenChange={(o) => !o && setReceiving(undefined)} clientId={receiving.id} clientName={receiving.nome} debt={receiving.debito} />}
      <IncomeModal open={incomeOpen} onOpenChange={setIncomeOpen} />
    </div>
  );
}

// ─── Expense Modal ───
function ExpenseModal({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { addDespesa } = useBilling();
  const { toast } = useToast();
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [avista, setAvista] = useState(true);
  const [recorrente, setRecorrente] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const reset = () => { setDescricao(""); setValor(""); setAvista(true); setRecorrente(false); };

  const handleSave = async () => {
    const v = parseFloat(valor) || 0;
    if (!descricao.trim()) { toast({ title: "Informe a descrição", variant: "destructive" }); return; }
    if (v <= 0) { toast({ title: "Informe um valor válido", variant: "destructive" }); return; }
    try {
      setSubmitting(true);
      await addDespesa({ descricao: descricao.trim(), valor: v, avista, recorrente: !avista && recorrente });
      toast({
        title: "Despesa lançada!",
        description: avista
          ? `${formatBRL(v)} em Saídas`
          : `${formatBRL(v)} em A Pagar${recorrente ? " (12 meses)" : ""}`,
      });
      reset();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SlideUpModal open={open} onOpenChange={onOpenChange} title="Lançar Despesa">
      <div className="space-y-4 mt-2">
        <div>
          <Label>Descrição</Label>
          <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex: Conta de luz" className="rounded-2xl h-12" />
        </div>
        <div>
          <Label>Valor (R$)</Label>
          <Input type="number" step="0.01" min="0" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0.00" className="rounded-2xl h-12 text-lg" />
        </div>
        <div className="flex items-center justify-between rounded-2xl bg-muted px-4 py-3">
          <div>
            <Label className="text-sm">À Vista</Label>
            <p className="text-[11px] text-muted-foreground">Lança direto em Saídas</p>
          </div>
          <Switch checked={avista} onCheckedChange={(v) => { setAvista(v); if (v) setRecorrente(false); }} />
        </div>
        {!avista && (
          <div className="flex items-center justify-between rounded-2xl bg-muted px-4 py-3">
            <div>
              <Label className="text-sm">Recorrente (12 meses)</Label>
              <p className="text-[11px] text-muted-foreground">Replica em todos os meses futuros</p>
            </div>
            <Switch checked={recorrente} onCheckedChange={setRecorrente} />
          </div>
        )}
        {!avista && (
          <p className="text-xs text-muted-foreground text-center">Será lançado em <strong>A Pagar</strong></p>
        )}
        <Button size="lg" className="w-full rounded-2xl" onClick={handleSave} disabled={submitting}>
          {submitting ? "Salvando..." : "Lançar Despesa"}
        </Button>
      </div>
    </SlideUpModal>
  );
}

// ─── Tab: Saídas ───
function TabSaidas({ filterMonth, filterYear }: { filterMonth: number; filterYear: number }) {
  const { pagamentosSaida, loading } = useBilling();
  const { fornecedores } = useFornecedores();
  const [expenseOpen, setExpenseOpen] = useState(false);

  const sorted = useMemo(() => pagamentosSaida
    .filter((p) => { const d = new Date(p.created_at); return d.getMonth() === filterMonth && d.getFullYear() === filterYear; })
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()), [pagamentosSaida, filterMonth, filterYear]);

  return (
    <div className="space-y-3">
      <Button onClick={() => setExpenseOpen(true)} className="w-full rounded-2xl gap-2" variant="outline">
        <Receipt className="w-4 h-4" /> Lançar Despesa
      </Button>
      {loading ? <ListSkeleton /> : sorted.length === 0 ? <EmptyState text="Nenhum pagamento registrado" /> : (
        <div className="space-y-3">
          {sorted.map((p) => {
            const supplier = p.fornecedor_id ? fornecedores.find((s) => s.id === p.fornecedor_id) : null;
            const label = supplier?.nome || p.descricao || "Despesa";
            return (
              <div key={p.id} className="rounded-3xl bg-card p-4 shadow-sm border-l-4 border-l-destructive/50">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-foreground text-sm">{label}</h3>
                    {!supplier && p.descricao && <p className="text-[10px] text-muted-foreground">Despesa avulsa</p>}
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5"><Calendar className="w-3 h-3" /><span>{new Date(p.created_at).toLocaleDateString("pt-BR")}</span></div>
                  </div>
                  <div className="text-right">
                    <span className="text-base font-bold text-destructive">- {formatBRL(Number(p.valor))}</span>
                    <Badge className={cn("ml-2 text-[10px]", p.tipo === "total" ? "bg-primary" : "bg-amber-500")}>{p.tipo === "total" ? "TOTAL" : "PARCIAL"}</Badge>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <ExpenseModal open={expenseOpen} onOpenChange={setExpenseOpen} />
    </div>
  );
}

// ─── Tab: Entradas ───
function TabEntradas({ filterMonth, filterYear }: { filterMonth: number; filterYear: number }) {
  const { pagamentosEntrada, loading } = useBilling();
  const { clientes } = useClientes();
  const { produtos } = useProdutos();

  const sorted = useMemo(() => pagamentosEntrada
    .filter((p) => { const d = new Date(p.created_at); return d.getMonth() === filterMonth && d.getFullYear() === filterYear; })
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()), [pagamentosEntrada, filterMonth, filterYear]);

  const originLabel = (origin: string) => {
    switch (origin) { case "venda": return "Venda Direta"; case "pedido": return "Pedido Atendido"; case "recebimento": return "Recebimento de Dívida"; default: return origin; }
  };

  if (loading) return <ListSkeleton />;

  return sorted.length === 0 ? <EmptyState text="Nenhuma entrada registrada" /> : (
    <div className="space-y-3">
      {sorted.map((p) => {
        const client = clientes.find((c) => c.id === p.cliente_id);
        const product = produtos.find((pr) => pr.id === p.produto_id);
        const isCancelled = !!p.cancelado;
        return (
          <div key={p.id} className={cn(
            "rounded-3xl bg-card p-4 shadow-sm border-l-4",
            isCancelled ? "border-l-destructive opacity-70" : "border-l-fish-treated/50"
          )}>
            <div className="flex items-start justify-between">
              <div>
                <h3 className={cn("font-semibold text-foreground text-sm", isCancelled && "line-through")}>{client?.nome || "Venda Balcão"}</h3>
                <p className="text-[10px] text-muted-foreground">{originLabel(p.origem)}</p>
                {product && <p className="text-[10px] text-muted-foreground">{product.nome} ({product.sku}){p.kg ? ` — ${Number(p.kg)}kg` : ""}</p>}
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5"><Calendar className="w-3 h-3" /><span>{new Date(p.created_at).toLocaleDateString("pt-BR")}</span></div>
              </div>
              <div className="text-right">
                <span className={cn("text-base font-bold", isCancelled ? "text-muted-foreground line-through" : "text-fish-treated")}>+ {formatBRL(Number(p.valor))}</span>
                {isCancelled ? (
                  <Badge className="ml-2 text-[10px] bg-destructive hover:bg-destructive text-destructive-foreground">CANCELADO</Badge>
                ) : (
                  <Badge className={cn("ml-2 text-[10px]", p.tipo === "total" ? "bg-primary" : "bg-amber-500")}>{p.tipo === "total" ? "TOTAL" : "PARCIAL"}</Badge>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Page ───
export function FaturamentoPage() {
  const now = new Date();
  const [filterMonth, setFilterMonth] = useState(now.getMonth());
  const [filterYear, setFilterYear] = useState(now.getFullYear());
  const { dividasCompra, pagamentosSaida, pagamentosEntrada, loading } = useBilling();
  const { clientes, loading: loadingClientes } = useClientes();

  const prevMonth = () => { if (filterMonth === 0) { setFilterMonth(11); setFilterYear((y) => y - 1); } else setFilterMonth((m) => m - 1); };
  const nextMonth = () => { if (filterMonth === 11) { setFilterMonth(0); setFilterYear((y) => y + 1); } else setFilterMonth((m) => m + 1); };

  const inMonth = (dateStr: string) => { const d = new Date(dateStr); return d.getMonth() === filterMonth && d.getFullYear() === filterYear; };

  const totalAPagar = useMemo(() => dividasCompra
    .filter((d) => !d.quitado && inMonth(d.created_at))
    .reduce((sum, d) => sum + (Number(d.valor_total) - Number(d.valor_pago)), 0), [dividasCompra, filterMonth, filterYear]);

  const totalAReceber = useMemo(() => clientes
    .reduce((sum, c) => sum + Number(c.debito), 0), [clientes]);

  const totalSaidas = useMemo(() => pagamentosSaida
    .filter((p) => inMonth(p.created_at))
    .reduce((sum, p) => sum + Number(p.valor), 0), [pagamentosSaida, filterMonth, filterYear]);

  const totalEntradas = useMemo(() => pagamentosEntrada
    .filter((p) => inMonth(p.created_at) && !p.cancelado)
    .reduce((sum, p) => sum + Number(p.valor), 0), [pagamentosEntrada, filterMonth, filterYear]);

  const cardsLoading = loading || loadingClientes;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wallet className="w-5 h-5 text-secondary" />
          <h1 className="text-lg font-bold text-foreground">Faturamento</h1>
        </div>
        <MonthNav month={filterMonth} year={filterYear} onPrev={prevMonth} onNext={nextMonth} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cardsLoading ? (
          <>
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </>
        ) : (
          <>
            <div className="rounded-3xl bg-card p-3 shadow-sm border-l-4 border-l-destructive">
              <p className="text-[10px] text-muted-foreground font-medium uppercase">A Pagar</p>
              <p className="text-lg font-bold text-destructive mt-0.5">{formatBRL(totalAPagar)}</p>
            </div>
            <div className="rounded-3xl bg-card p-3 shadow-sm border-l-4 border-l-amber-400">
              <p className="text-[10px] text-muted-foreground font-medium uppercase">A Receber</p>
              <p className="text-lg font-bold text-amber-500 mt-0.5">{formatBRL(totalAReceber)}</p>
            </div>
            <div className="rounded-3xl bg-card p-3 shadow-sm border-l-4 border-l-destructive/50">
              <p className="text-[10px] text-muted-foreground font-medium uppercase">Saídas</p>
              <p className="text-lg font-bold text-destructive mt-0.5">{formatBRL(totalSaidas)}</p>
            </div>
            <div className="rounded-3xl bg-card p-3 shadow-sm border-l-4 border-l-fish-treated">
              <p className="text-[10px] text-muted-foreground font-medium uppercase">Entradas</p>
              <p className="text-lg font-bold text-fish-treated mt-0.5">{formatBRL(totalEntradas)}</p>
            </div>
          </>
        )}
      </div>

      <Tabs defaultValue="apagar" className="w-full">
        <TabsList className="w-full rounded-2xl grid grid-cols-4">
          <TabsTrigger value="apagar" className="rounded-xl text-[11px] px-1">A Pagar</TabsTrigger>
          <TabsTrigger value="areceber" className="rounded-xl text-[11px] px-1">A Receber</TabsTrigger>
          <TabsTrigger value="saidas" className="rounded-xl text-[11px] px-1">Saídas</TabsTrigger>
          <TabsTrigger value="entradas" className="rounded-xl text-[11px] px-1">Entradas</TabsTrigger>
        </TabsList>
        <TabsContent value="apagar"><TabAPagar filterMonth={filterMonth} filterYear={filterYear} /></TabsContent>
        <TabsContent value="areceber"><TabAReceber /></TabsContent>
        <TabsContent value="saidas"><TabSaidas filterMonth={filterMonth} filterYear={filterYear} /></TabsContent>
        <TabsContent value="entradas"><TabEntradas filterMonth={filterMonth} filterYear={filterYear} /></TabsContent>
      </Tabs>
    </div>
  );
}
