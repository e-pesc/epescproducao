import { useState, useMemo } from "react";
import { useProdutos, type Produto } from "@/hooks/useProdutos";
import { useFornecedores } from "@/hooks/useFornecedores";
import { useBilling } from "@/hooks/useBilling";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { SlideUpModal } from "@/components/SlideUpModal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/SearchableSelect";
import { ArrowRightLeft, TrendingDown, Package, ShoppingCart, DollarSign, Search, History } from "lucide-react";
import { PurchaseHistoryModal } from "@/components/PurchaseHistoryModal";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { formatBRL } from "@/lib/format";
import { logActivity } from "@/lib/logActivity";

function ProductCard({ product, allProducts, onMutate }: { product: Produto; allProducts: Produto[]; onMutate: () => Promise<void> }) {
  const { processarProduto, updateEstoque, addMovimento } = useProdutos();
  const { toast } = useToast();
  const [processOpen, setProcessOpen] = useState(false);
  const [baixaOpen, setBaixaOpen] = useState(false);
  const [processKg, setProcessKg] = useState("");
  const [baixaKg, setBaixaKg] = useState("");
  const [baixaType, setBaixaType] = useState<"perda" | "quebra" | "outros">("perda");
  const [baixaObs, setBaixaObs] = useState("");

  const isInteiro = product.tipo === "inteiro";
  const totalValue = Number(product.estoque_kg) * Number(product.preco_compra);
  const linkedTratado = isInteiro ? allProducts.find((p) => p.tipo === "tratado" && p.linked_sku === product.sku) : null;

  const handleProcess = async () => {
    const kg = parseFloat(processKg);
    if (!kg || kg <= 0 || kg > Number(product.estoque_kg) || !linkedTratado) return;
    try {
      await processarProduto(product.id, linkedTratado.id, kg);
      await onMutate();
      toast({ title: "Processado!", description: `${kg}kg transferido para ${linkedTratado.nome}` });
      setProcessKg(""); setProcessOpen(false);
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const handleBaixa = async () => {
    const kg = parseFloat(baixaKg);
    if (!kg || kg <= 0 || kg > Number(product.estoque_kg)) return;
    try {
      await updateEstoque(product.id, -kg);
      await addMovimento({ produto_id: product.id, tipo: baixaType, kg, observacao: baixaObs || undefined });
      await onMutate();
      toast({ title: "Baixa registada", description: `${kg}kg - ${baixaType}` });
      setBaixaKg(""); setBaixaObs(""); setBaixaOpen(false);
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  return (
    <>
      <div className={cn("rounded-3xl p-4 border-l-4 bg-card shadow-sm", isInteiro ? "border-l-fish-whole" : "border-l-fish-treated")}>
        <div className="flex items-start justify-between mb-3">
          <div>
            <span className={cn("text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full", isInteiro ? "bg-fish-whole-light text-fish-whole" : "bg-fish-treated-light text-fish-treated")}>
              {isInteiro ? "Inteiro" : "Tratado"}
            </span>
            <h3 className="text-base font-bold mt-1 text-foreground">{product.nome}</h3>
            <p className="text-xs text-muted-foreground">Código: {product.sku}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-foreground">{Number(product.estoque_kg).toFixed(1)}</p>
            <p className="text-[10px] text-muted-foreground uppercase">KG</p>
          </div>
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
          <span>Compra: {formatBRL(Number(product.preco_compra))}/kg</span>
          <span className="font-semibold text-foreground">Total: {formatBRL(totalValue)}</span>
        </div>
        <div className="flex gap-2">
          {isInteiro && linkedTratado && (
            <Button variant="whole" size="sm" className="flex-1" onClick={() => setProcessOpen(true)}>
              <ArrowRightLeft className="w-4 h-4" /> Processar
            </Button>
          )}
          <Button variant="outline" size="sm" className="flex-1" onClick={() => setBaixaOpen(true)}>
            <TrendingDown className="w-4 h-4" /> Baixa
          </Button>
        </div>
      </div>

      <SlideUpModal open={processOpen} onOpenChange={setProcessOpen} title="Processar Produto">
        <div className="space-y-4 mt-2">
          <p className="text-sm text-muted-foreground">Transferir de <strong>{product.nome}</strong> para <strong>{linkedTratado?.nome}</strong></p>
          <p className="text-xs text-muted-foreground">Saldo disponível: {Number(product.estoque_kg).toFixed(1)} kg</p>
          <div><Label>Peso (KG)</Label><Input type="number" step="0.1" min="0" max={product.estoque_kg} value={processKg} onChange={(e) => setProcessKg(e.target.value)} placeholder="Ex: 5.0" className="rounded-2xl h-12 text-lg" /></div>
          <Button variant="whole" size="lg" className="w-full" onClick={handleProcess}>Confirmar Processamento</Button>
        </div>
      </SlideUpModal>

      <SlideUpModal open={baixaOpen} onOpenChange={setBaixaOpen} title="Registar Baixa">
        <div className="space-y-4 mt-2">
          <p className="text-sm text-muted-foreground">Baixa em <strong>{product.nome}</strong> — Saldo: {Number(product.estoque_kg).toFixed(1)} kg</p>
          <div className="grid grid-cols-3 gap-2">
            {(["perda", "quebra", "outros"] as const).map((t) => (
              <button key={t} onClick={() => setBaixaType(t)}
                className={cn("rounded-2xl py-3 text-sm font-semibold capitalize transition-colors border",
                  baixaType === t ? "bg-primary text-primary-foreground border-primary" : "bg-card text-foreground border-border"
                )}>{t}</button>
            ))}
          </div>
          <div><Label>Peso (KG)</Label><Input type="number" step="0.1" min="0" max={product.estoque_kg} value={baixaKg} onChange={(e) => setBaixaKg(e.target.value)} placeholder="Ex: 2.0" className="rounded-2xl h-12 text-lg" /></div>
          {baixaType === "outros" && (
            <div><Label>Observação</Label><Input value={baixaObs} onChange={(e) => setBaixaObs(e.target.value)} placeholder="Motivo da baixa..." className="rounded-2xl h-12" /></div>
          )}
          <Button variant="destructive" size="lg" className="w-full" onClick={handleBaixa}>Confirmar Baixa</Button>
        </div>
      </SlideUpModal>
    </>
  );
}

export function InventoryPage() {
  const { produtos, updateEstoque, updateProduto, refetch } = useProdutos();
  const { fornecedores } = useFornecedores();
  const { addDividaCompra, addPagamentoSaida } = useBilling();
  const { peixariaId } = useAuth();
  const { toast } = useToast();
  const [buyOpen, setBuyOpen] = useState(false);
  const [buyProductId, setBuyProductId] = useState("");
  const [buySupplierId, setBuySupplierId] = useState("");
  const [buyKg, setBuyKg] = useState("");
  const [buyPriceKg, setBuyPriceKg] = useState("");
  const [buyPayment, setBuyPayment] = useState<"avista" | "prazo">("avista");
  const [buyEntrada, setBuyEntrada] = useState("");
  const [search, setSearch] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const activeProducts = produtos.filter((p) => p.ativo);
  const activeSuppliers = fornecedores.filter((s) => s.ativo);
  const q = search.toLowerCase();
  const inteiros = activeProducts.filter((p) => p.tipo === "inteiro" && (!q || p.nome.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)));
  const tratados = activeProducts.filter((p) => p.tipo === "tratado" && (!q || p.nome.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)));
  const totalInvested = activeProducts.reduce((acc, p) => acc + Number(p.estoque_kg) * Number(p.preco_compra), 0);
  const totalKgInStock = activeProducts.reduce((acc, p) => acc + Number(p.estoque_kg), 0);

  const buyTotal = useMemo(() => {
    const kg = parseFloat(buyKg) || 0;
    const price = parseFloat(buyPriceKg) || 0;
    return kg * price;
  }, [buyKg, buyPriceKg]);

  const handleBuy = async () => {
    if (submitting) return;
    const kg = parseFloat(buyKg);
    const priceKg = parseFloat(buyPriceKg);
    if (!buyProductId || !buySupplierId || !kg || kg <= 0 || !priceKg || priceKg <= 0) return;

    setSubmitting(true);
    try {
      await updateEstoque(buyProductId, kg);
      await updateProduto(buyProductId, { preco_compra: priceKg });

      const entradaNum = parseFloat(buyEntrada) || 0;

      // Always register the purchase in dividas_compra so it appears in reports
      if (buyPayment === "avista") {
        await addPagamentoSaida({ fornecedor_id: buySupplierId, valor: +buyTotal.toFixed(2), tipo: "total" });
        // Register as already paid debt for report tracking
        await addDividaCompra({ fornecedor_id: buySupplierId, produto_id: buyProductId, kg, preco_kg: priceKg, quitado: true, valor_pago: +buyTotal.toFixed(2) });
      } else {
        if (entradaNum > 0) {
          await addPagamentoSaida({ fornecedor_id: buySupplierId, valor: entradaNum, tipo: "adiantamento" });
        }
        await addDividaCompra({ fornecedor_id: buySupplierId, produto_id: buyProductId, kg, preco_kg: priceKg });
      }

      const produto = produtos.find(p => p.id === buyProductId);
      const fornecedor = fornecedores.find(f => f.id === buySupplierId);

      logActivity({
        action: "Compra Registrada",
        entity: "Estoque",
        entity_id: buyProductId.slice(0, 8),
        amount: +buyTotal.toFixed(2),
        description: `Compra de ${kg}kg de ${produto?.nome ?? "—"} (${produto?.sku ?? "—"}) do fornecedor ${fornecedor?.nome ?? "—"} — ${formatBRL(buyTotal)}`,
        peixaria_id: peixariaId,
      });

      toast({ title: "Compra registada!", description: `${kg}kg adicionado ao estoque — ${formatBRL(buyTotal)}` });
      setBuyProductId(""); setBuySupplierId(""); setBuyKg(""); setBuyPriceKg(""); setBuyPayment("avista"); setBuyEntrada(""); setBuyOpen(false);
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="w-6 h-6 text-secondary" />
          <h1 className="text-xl font-bold text-foreground">Estoque</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="rounded-2xl" onClick={() => setHistoryOpen(true)}>
            <History className="w-4 h-4" /> Histórico
          </Button>
          <Button variant="default" size="sm" className="rounded-2xl" onClick={() => setBuyOpen(true)}>
            <ShoppingCart className="w-4 h-4" /> Comprar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-3xl bg-card p-4 shadow-sm">
          <div className="w-10 h-10 bg-secondary/10 rounded-2xl flex items-center justify-center mb-2">
            <DollarSign className="w-5 h-5 text-secondary" />
          </div>
          <p className="text-[11px] text-muted-foreground font-medium">Investido em Estoque</p>
          <p className="text-lg font-bold text-foreground mt-0.5">{formatBRL(totalInvested)}</p>
        </div>
        <div className="rounded-3xl bg-card p-4 shadow-sm">
          <div className="w-10 h-10 bg-muted rounded-2xl flex items-center justify-center mb-2">
            <Package className="w-5 h-5 text-muted-foreground" />
          </div>
          <p className="text-[11px] text-muted-foreground font-medium">Total KG em Estoque</p>
          <p className="text-lg font-bold text-foreground mt-0.5">{totalKgInStock.toFixed(1)} kg</p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input type="text" placeholder="Buscar por nome ou código..." value={search} onChange={(e) => setSearch(e.target.value)} className="rounded-2xl h-10 pl-9 text-sm" />
      </div>

      <h2 className="text-sm font-semibold text-fish-whole flex items-center gap-1">🐟 Inteiro ({inteiros.length})</h2>
      <div className="space-y-3 md:grid md:grid-cols-2 md:gap-3 md:space-y-0">{inteiros.map((p) => <ProductCard key={p.id} product={p} allProducts={produtos} onMutate={refetch} />)}</div>

      <h2 className="text-sm font-semibold text-fish-treated flex items-center gap-1 pt-2">🔪 Tratado ({tratados.length})</h2>
      <div className="space-y-3 md:grid md:grid-cols-2 md:gap-3 md:space-y-0">{tratados.map((p) => <ProductCard key={p.id} product={p} allProducts={produtos} onMutate={refetch} />)}</div>

      <SlideUpModal open={buyOpen} onOpenChange={setBuyOpen} title="Comprar Peixe">
        <div className="space-y-4 mt-2">
          <div><Label>Fornecedor</Label><SearchableSelect value={buySupplierId} onValueChange={setBuySupplierId} placeholder="Selecione o fornecedor" options={activeSuppliers.map((s) => ({ value: s.id, label: `${s.nome} — ${s.cidade}` }))} /></div>
          <div><Label>Produto</Label><SearchableSelect value={buyProductId} onValueChange={setBuyProductId} placeholder="Selecione o peixe" options={activeProducts.map((p) => ({ value: p.id, label: `${p.nome} (${p.sku}) — ${p.tipo === "inteiro" ? "Inteiro" : "Tratado"}` }))} /></div>
          <div><Label>Peso (KG)</Label><Input type="number" step="0.1" min="0" value={buyKg} onChange={(e) => setBuyKg(e.target.value)} placeholder="Ex: 10.0" className="rounded-2xl h-12 text-lg" /></div>
          <div><Label>Valor do KG (R$)</Label><Input type="number" step="0.01" min="0" value={buyPriceKg} onChange={(e) => setBuyPriceKg(e.target.value)} placeholder="Ex: 12.50" className="rounded-2xl h-12 text-lg" /></div>
          <div className="rounded-2xl bg-muted p-4 text-center">
            <p className="text-xs text-muted-foreground uppercase">Montante Total</p>
            <p className="text-3xl font-bold text-foreground">{formatBRL(buyTotal)}</p>
          </div>
          <div>
            <Label>Forma de Pagamento</Label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {(["avista", "prazo"] as const).map((t) => (
                <button key={t} onClick={() => setBuyPayment(t)}
                  className={cn("rounded-2xl py-3 text-sm font-semibold transition-colors border",
                    buyPayment === t ? "bg-primary text-primary-foreground border-primary" : "bg-card text-foreground border-border"
                  )}>{t === "avista" ? "À Vista" : "A Prazo"}</button>
              ))}
            </div>
          </div>
          {buyPayment === "prazo" && (
            <div>
              <Label>Valor de Entrada (R$)</Label>
              <Input type="number" step="0.01" min="0" value={buyEntrada} onChange={(e) => setBuyEntrada(e.target.value)} placeholder="Ex: 50.00" className="rounded-2xl h-12 text-lg" />
              {buyEntrada && buyTotal > 0 && <p className="text-xs text-muted-foreground mt-1">Restante: {formatBRL(buyTotal - (parseFloat(buyEntrada) || 0))}</p>}
            </div>
          )}
          <Button variant="default" size="lg" className="w-full" onClick={handleBuy}><ShoppingCart className="w-4 h-4" /> Confirmar Compra</Button>
        </div>
      </SlideUpModal>
    </div>
  );
}
