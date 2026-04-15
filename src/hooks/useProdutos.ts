import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { logActivity } from "@/lib/logActivity";

export interface Produto {
  id: string;
  sku: string;
  nome: string;
  tipo: "inteiro" | "tratado";
  linked_sku: string | null;
  estoque_kg: number;
  preco_compra: number;
  ativo: boolean;
  created_at: string;
  peixaria_id: string | null;
}

export function useProdutos() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const { peixariaId } = useAuth();

  const fetchProdutos = useCallback(async () => {
    const { data } = await supabase.from("produtos").select("*").order("nome");
    setProdutos(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchProdutos();
  }, [fetchProdutos]);

  const addProduto = async (p: { sku: string; nome: string; tipo: "inteiro" | "tratado"; linked_sku?: string; estoque_kg?: number; preco_compra?: number }) => {
    const { error } = await supabase.from("produtos").insert({ ...p, peixaria_id: peixariaId });
    if (error) throw error;
    await fetchProdutos();
  };

  const updateProduto = async (id: string, p: Partial<Produto>) => {
    const { error } = await supabase.from("produtos").update(p).eq("id", id);
    if (error) throw error;
    await fetchProdutos();
  };

  const deleteProduto = async (id: string) => {
    const { error } = await supabase.from("produtos").delete().eq("id", id);
    if (error) throw error;
    await fetchProdutos();
  };

  const toggleProduto = async (id: string, currentActive: boolean) => {
    await updateProduto(id, { ativo: !currentActive });
  };

  const updateEstoque = async (id: string, deltaKg: number) => {
    const { data: produto } = await supabase.from("produtos").select("estoque_kg").eq("id", id).single();
    if (!produto) throw new Error("Produto não encontrado");
    const novoEstoque = +(Number(produto.estoque_kg) + deltaKg);
    if (novoEstoque < 0) throw new Error("Estoque insuficiente");
    await updateProduto(id, { estoque_kg: novoEstoque });
  };

  const processarProduto = async (inteiroId: string, tratadoId: string, kg: number) => {
    const { data: inteiro } = await supabase.from("produtos").select("estoque_kg, preco_compra").eq("id", inteiroId).single();
    const { data: tratado } = await supabase.from("produtos").select("estoque_kg").eq("id", tratadoId).single();
    if (!inteiro || !tratado) throw new Error("Produto não encontrado");

    const estoqueAtual = Number(inteiro.estoque_kg);
    if (kg > estoqueAtual) {
      throw new Error(`Estoque insuficiente. Disponível: ${estoqueAtual.toFixed(1)}kg`);
    }

    const { error: e1 } = await supabase.from("produtos").update({ estoque_kg: +(estoqueAtual - kg) }).eq("id", inteiroId);
    if (e1) throw e1;
    const { error: e2 } = await supabase.from("produtos").update({
      estoque_kg: +(Number(tratado.estoque_kg) + kg),
      preco_compra: Number(inteiro.preco_compra),
    }).eq("id", tratadoId);
    if (e2) throw e2;

    await supabase.from("movimentacoes_estoque").insert([
      { produto_id: inteiroId, tipo: "processamento" as const, kg, peixaria_id: peixariaId },
      { produto_id: tratadoId, tipo: "processamento" as const, kg, peixaria_id: peixariaId },
    ]);

    logActivity({
      action: "Processamento Realizado",
      entity: "Estoque",
      entity_id: inteiroId.slice(0, 8),
      description: `Processamento de ${kg}kg (inteiro → tratado)`,
      peixaria_id: peixariaId,
    });

    await fetchProdutos();
  };

  const addMovimento = async (m: { produto_id: string; tipo: "perda" | "quebra" | "outros" | "processamento" | "venda"; kg: number; observacao?: string }) => {
    const { error } = await supabase.from("movimentacoes_estoque").insert({ ...m, peixaria_id: peixariaId });
    if (error) throw error;

    if (m.tipo !== "venda") {
      const tipoLabel = m.tipo === "perda" ? "Perda" : m.tipo === "quebra" ? "Quebra" : m.tipo === "processamento" ? "Processamento" : "Outros";
      logActivity({
        action: "Estoque Baixado",
        entity: "Estoque",
        entity_id: m.produto_id.slice(0, 8),
        description: `Baixa de ${m.kg}kg - Motivo: ${tipoLabel}${m.observacao ? ` (${m.observacao})` : ""}`,
        peixaria_id: peixariaId,
      });
    }
  };

  return { produtos, loading, addProduto, updateProduto, deleteProduto, toggleProduto, updateEstoque, processarProduto, addMovimento, refetch: fetchProdutos };
}
