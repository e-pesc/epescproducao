import { useState, useMemo } from "react";
import { useProdutos } from "@/hooks/useProdutos";
import { useClientes } from "@/hooks/useClientes";
import { useVendas, ItemVenda } from "@/hooks/useVendas";
import { useBilling } from "@/hooks/useBilling";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/SearchableSelect";
import { ShoppingCart, Check, Plus, Trash2, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/format";

interface CartItem {
  produto_id: string;
  kg: number;
  preco_kg: number;
  nome: string;
  sku: string;
  subtotal: number;
}

export function POSPage() {
  const { produtos, refetch: refetchProdutos } = useProdutos();
  const { clientes } = useClientes();
  const { addVenda } = useVendas();
  const { addPagamentoEntrada, refetch: refetchBilling } = useBilling();
  const { toast } = useToast();

  // Client & payment state
  const [selectedClientId, setSelectedClientId] = useState("");
  const [payment, setPayment] = useState<"avista" | "prazo">("avista");
  const [entrada, setEntrada] = useState("");

  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);

  // Item form state
  const [selectedProductId, setSelectedProductId] = useState("");
  const [kg, setKg] = useState("");
  const [priceKg, setPriceKg] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const activeProducts = produtos.filter((p) => p.ativo && p.estoque_kg > 0);
  const activeClients = clientes.filter((c) => c.ativo);
  const selectedProduct = produtos.find((p) => p.id === selectedProductId);

  const itemSubtotal = useMemo(() => {
    return (parseFloat(kg) || 0) * (parseFloat(priceKg) || 0);
  }, [kg, priceKg]);

  const totalVenda = useMemo(() => {
    return cart.reduce((s, item) => s + item.subtotal, 0);
  }, [cart]);

  const resetItemForm = () => {
    setSelectedProductId("");
    setKg("");
    setPriceKg("");
    setEditingIndex(null);
  };

  const handleAddItem = () => {
    const kgNum = parseFloat(kg);
    const priceNum = parseFloat(priceKg);
    if (!selectedProductId || !kgNum || !priceNum || kgNum <= 0 || priceNum <= 0) return;

    if (selectedProduct && kgNum > selectedProduct.estoque_kg) {
      toast({ title: "Estoque insuficiente", variant: "destructive" });
      return;
    }

    const newItem: CartItem = {
      produto_id: selectedProductId,
      kg: kgNum,
      preco_kg: priceNum,
      nome: selectedProduct?.nome ?? "",
      sku: selectedProduct?.sku ?? "",
      subtotal: +(kgNum * priceNum).toFixed(2),
    };

    if (editingIndex !== null) {
      setCart((prev) => prev.map((item, i) => (i === editingIndex ? newItem : item)));
    } else {
      setCart((prev) => [...prev, newItem]);
    }
    resetItemForm();
  };

  const handleEditItem = (index: number) => {
    const item = cart[index];
    setSelectedProductId(item.produto_id);
    setKg(String(item.kg));
    setPriceKg(String(item.preco_kg));
    setEditingIndex(index);
  };

  const handleRemoveItem = (index: number) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
    if (editingIndex === index) resetItemForm();
  };

  const [submitting, setSubmitting] = useState(false);

  const handleSale = async () => {
    if (cart.length === 0) return;
    setSubmitting(true);

    try {
      const vendaId = await addVenda({
        cliente_id: selectedClientId || null,
        itens: cart.map(({ produto_id, kg, preco_kg }) => ({ produto_id, kg, preco_kg })),
        valor_total: +totalVenda.toFixed(2),
        forma_pagamento: payment,
        entrada: payment === "prazo" ? (parseFloat(entrada) || null) : null,
      });

      const totalKg = cart.reduce((s, i) => s + i.kg, 0);
      const entradaNum = parseFloat(entrada) || 0;

      if (payment === "avista") {
        await addPagamentoEntrada({
          cliente_id: selectedClientId || null,
          origem: "venda",
          venda_id: vendaId,
          produto_id: cart[0].produto_id,
          kg: totalKg,
          valor: +totalVenda.toFixed(2),
          tipo: "total",
        });
      } else {
        // Register the full sale as a receivable entry
        await addPagamentoEntrada({
          cliente_id: selectedClientId || null,
          origem: "venda",
          venda_id: vendaId,
          produto_id: cart[0].produto_id,
          kg: totalKg,
          valor: +totalVenda.toFixed(2),
          tipo: entradaNum > 0 ? "parcial" : "total",
        });
        if (entradaNum > 0) {
          // Register the down payment as a separate incoming payment
          await addPagamentoEntrada({
            cliente_id: selectedClientId || null,
            origem: "recebimento",
            venda_id: vendaId,
            valor: entradaNum,
            tipo: "parcial",
          });
        }
        if (selectedClientId) {
          const { data: cliente } = await supabase.from("clientes").select("debito").eq("id", selectedClientId).single();
          if (cliente) {
            const debtAmount = totalVenda - entradaNum;
            const { error: debtError } = await supabase.from("clientes").update({ debito: +(Number(cliente.debito) + debtAmount).toFixed(2) }).eq("id", selectedClientId);
            if (debtError) throw debtError;
          }
        }
        // Invalidate billing cache after direct debt update
        await refetchBilling();
      }

      toast({ title: "Venda registrada!", description: `${cart.length} item(ns) — ${formatBRL(totalVenda)}` });
      await refetchProdutos();
      setCart([]);
      setSelectedClientId("");
      setPayment("avista");
      setEntrada("");
      resetItemForm();
    } catch (e: any) {
      toast({ title: "Erro na venda", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <ShoppingCart className="w-6 h-6 text-secondary" />
        <h1 className="text-xl font-bold text-foreground">Frente de Caixa</h1>
      </div>

      <div className="md:grid md:grid-cols-2 md:gap-6 space-y-5 md:space-y-0">
        {/* Left column: Client + Item form */}
        <div className="space-y-5 max-w-xl">
          {/* Client selection */}
          <div className="rounded-3xl bg-card p-5 shadow-sm space-y-4">
            <div>
              <Label>Cliente</Label>
              <SearchableSelect
                value={selectedClientId}
                onValueChange={setSelectedClientId}
                placeholder="Selecione o cliente"
                options={activeClients.map((c) => ({ value: c.id, label: `${c.nome} — ${c.cidade}` }))}
              />
            </div>
          </div>

          {/* Add item form */}
          <div className="rounded-3xl bg-card p-5 shadow-sm space-y-4">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              {editingIndex !== null ? "Editar Item" : "Adicionar Item"}
            </h2>
            <div>
              <Label>Produto</Label>
              <SearchableSelect
                value={selectedProductId}
                onValueChange={setSelectedProductId}
                placeholder="Selecione o peixe"
                options={activeProducts.map((p) => ({ value: p.id, label: `${p.nome} (${p.sku}) — ${Number(p.estoque_kg).toFixed(1)}kg` }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Peso (KG)</Label>
                <Input type="number" step="0.1" min="0" value={kg} onChange={(e) => setKg(e.target.value)} placeholder="Ex: 5.0" className="rounded-2xl h-12 text-lg" />
              </div>
              <div>
                <Label>Valor/KG (R$)</Label>
                <Input type="number" step="0.01" min="0" value={priceKg} onChange={(e) => setPriceKg(e.target.value)} placeholder="Ex: 25.00" className="rounded-2xl h-12 text-lg" />
              </div>
            </div>
            {itemSubtotal > 0 && (
              <p className="text-sm text-muted-foreground text-center">Subtotal: <span className="font-semibold text-foreground">{formatBRL(itemSubtotal)}</span></p>
            )}
            <div className="flex gap-2">
              <Button className="flex-1" onClick={handleAddItem}>
                {editingIndex !== null ? <><Pencil className="w-4 h-4" /> Salvar Alteração</> : <><Plus className="w-4 h-4" /> Adicionar ao Carrinho</>}
              </Button>
              {editingIndex !== null && (
                <Button variant="outline" onClick={resetItemForm}>Cancelar</Button>
              )}
            </div>
          </div>
        </div>

        {/* Right column: Cart + Payment */}
        <div className="space-y-5 max-w-xl">
          {cart.length > 0 && (
            <div className="rounded-3xl bg-card p-5 shadow-sm space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Carrinho ({cart.length} {cart.length === 1 ? "item" : "itens"})
              </h2>
              <div className="space-y-2">
                {cart.map((item, index) => (
                  <div key={index} className="flex items-center justify-between rounded-2xl bg-muted p-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{item.nome} ({item.sku})</p>
                      <p className="text-xs text-muted-foreground">{item.kg}kg × {formatBRL(item.preco_kg)}/kg</p>
                    </div>
                    <div className="flex items-center gap-2 ml-2 shrink-0">
                      <span className="text-sm font-bold text-foreground">{formatBRL(item.subtotal)}</span>
                      <button onClick={() => handleEditItem(index)} className="p-1.5 rounded-xl hover:bg-background transition-colors">
                        <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                      <button onClick={() => handleRemoveItem(index)} className="p-1.5 rounded-xl hover:bg-destructive/10 transition-colors">
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {cart.length > 0 && (
            <div className="rounded-3xl bg-card p-5 shadow-sm space-y-4">
              <div className="rounded-2xl bg-muted p-4 text-center">
                <p className="text-xs text-muted-foreground uppercase">Valor Total da Venda</p>
                <p className="text-3xl font-bold text-foreground">{formatBRL(totalVenda)}</p>
              </div>
              <div>
                <Label>Forma de Pagamento</Label>
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
                  {entrada && totalVenda > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">Restante: {formatBRL(totalVenda - (parseFloat(entrada) || 0))}</p>
                  )}
                </div>
              )}
              <Button size="lg" className="w-full" onClick={handleSale} disabled={submitting}>
                {submitting ? "Processando..." : <><Check className="w-5 h-5" /> Finalizar Venda</>}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
