import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { logActivity } from "@/lib/logActivity";

export interface DividaCompra {
  id: string;
  fornecedor_id: string | null;
  produto_id: string | null;
  kg: number | null;
  preco_kg: number | null;
  valor_total: number;
  valor_pago: number;
  quitado: boolean;
  created_at: string;
  cancelado?: boolean;
  cancelado_motivo?: string | null;
  cancelado_at?: string | null;
  cancelado_por?: string | null;
  descricao?: string | null;
  recorrente?: boolean;
  mes_referencia?: string | null;
  vencimento?: string | null;
}

export interface PagamentoSaida {
  id: string;
  divida_id: string | null;
  fornecedor_id: string | null;
  valor: number;
  tipo: string;
  created_at: string;
  cancelado?: boolean;
  cancelado_at?: string | null;
  descricao?: string | null;
}

export interface PagamentoEntrada {
  id: string;
  cliente_id: string | null;
  origem: string;
  pedido_id: string | null;
  venda_id: string | null;
  produto_id: string | null;
  kg: number | null;
  valor: number;
  tipo: string;
  created_at: string;
  cancelado?: boolean;
  cancelado_at?: string | null;
}

const BILLING_KEYS = {
  dividas: ["dividas_compra"] as const,
  saidas: ["pagamentos_saida"] as const,
  entradas: ["pagamentos_entrada"] as const,
  clientes: ["clientes"] as const,
};

export function useBilling() {
  const queryClient = useQueryClient();
  const { peixariaId } = useAuth();

  const { data: dividasCompra = [], isLoading: loadingDividas } = useQuery({
    queryKey: BILLING_KEYS.dividas,
    queryFn: async () => {
      const { data } = await supabase.from("dividas_compra").select("*").order("created_at", { ascending: false });
      return (data ?? []) as DividaCompra[];
    },
  });

  const { data: pagamentosSaida = [], isLoading: loadingSaidas } = useQuery({
    queryKey: BILLING_KEYS.saidas,
    queryFn: async () => {
      const { data } = await supabase.from("pagamentos_saida").select("*").order("created_at", { ascending: false });
      return (data ?? []) as PagamentoSaida[];
    },
  });

  const { data: pagamentosEntrada = [], isLoading: loadingEntradas } = useQuery({
    queryKey: BILLING_KEYS.entradas,
    queryFn: async () => {
      const { data } = await supabase.from("pagamentos_entrada").select("*").order("created_at", { ascending: false });
      return (data ?? []) as PagamentoEntrada[];
    },
  });

  const loading = loadingDividas || loadingSaidas || loadingEntradas;

  const invalidateAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: BILLING_KEYS.dividas }),
      queryClient.invalidateQueries({ queryKey: BILLING_KEYS.saidas }),
      queryClient.invalidateQueries({ queryKey: BILLING_KEYS.entradas }),
      queryClient.invalidateQueries({ queryKey: BILLING_KEYS.clientes }),
    ]);
  };

  const addDividaCompra = async (d: { fornecedor_id: string; produto_id: string; kg: number; preco_kg: number; quitado?: boolean; valor_pago?: number }) => {
    const valor_total = +(d.kg * d.preco_kg).toFixed(2);
    await supabase.from("dividas_compra").insert({ fornecedor_id: d.fornecedor_id, produto_id: d.produto_id, kg: d.kg, preco_kg: d.preco_kg, valor_total, quitado: d.quitado ?? false, valor_pago: d.valor_pago ?? 0, peixaria_id: peixariaId });

    logActivity({
      action: "Compra Registrada",
      entity: "Compra",
      entity_id: d.produto_id.slice(0, 8),
      amount: valor_total,
      description: `Compra de ${d.kg}kg a R$${d.preco_kg.toFixed(2)}/kg`,
      peixaria_id: peixariaId,
    });

    await invalidateAll();
  };

  const payDivida = async (dividaId: string, amount: number, tipo: "total" | "adiantamento") => {
    const divida = dividasCompra.find(d => d.id === dividaId);
    if (!divida) return;

    const newPaid = +(divida.valor_pago + amount).toFixed(2);
    const quitado = tipo === "total" || newPaid >= divida.valor_total;

    await supabase.from("dividas_compra").update({ valor_pago: newPaid, quitado }).eq("id", dividaId);
    await supabase.from("pagamentos_saida").insert({
      divida_id: dividaId,
      fornecedor_id: divida.fornecedor_id,
      valor: amount,
      tipo,
      peixaria_id: peixariaId,
    });

    logActivity({
      action: "Dívida Quitada",
      entity: "Dívida",
      entity_id: dividaId.slice(0, 8),
      amount: amount,
      description: `Pagamento ${tipo === "total" ? "total" : "parcial"} de dívida - R$${amount.toFixed(2)}`,
      peixaria_id: peixariaId,
    });

    await invalidateAll();
  };

  const addPagamentoEntrada = async (p: {
    cliente_id?: string | null;
    origem: string;
    pedido_id?: string | null;
    venda_id?: string | null;
    produto_id?: string | null;
    kg?: number | null;
    valor: number;
    tipo: string;
  }) => {
    await supabase.from("pagamentos_entrada").insert({ ...p, peixaria_id: peixariaId });
    await invalidateAll();
  };

  const addPagamentoSaida = async (p: {
    divida_id?: string | null;
    fornecedor_id: string;
    valor: number;
    tipo: string;
  }) => {
    await supabase.from("pagamentos_saida").insert({ ...p, peixaria_id: peixariaId });
    await invalidateAll();
  };

  const receiveFromClient = async (clienteId: string, amount: number, tipo: "total" | "parcial") => {
    const { data: cliente } = await supabase.from("clientes").select("debito").eq("id", clienteId).single();
    if (!cliente) return;

    const newDebt = tipo === "total" ? 0 : Math.max(0, +(cliente.debito - amount).toFixed(2));
    await supabase.from("clientes").update({ debito: newDebt }).eq("id", clienteId);

    await supabase.from("pagamentos_entrada").insert({
      cliente_id: clienteId,
      origem: "recebimento",
      valor: amount,
      tipo,
      peixaria_id: peixariaId,
    });

    logActivity({
      action: "Pagamento Recebido",
      entity: "Cliente",
      entity_id: clienteId.slice(0, 8),
      amount: amount,
      description: `Recebimento ${tipo === "total" ? "total" : "parcial"} de cliente - R$${amount.toFixed(2)}`,
      peixaria_id: peixariaId,
    });

    await invalidateAll();
  };

  const cancelDivida = async (dividaId: string, motivo: string) => {
    const { data: divida } = await supabase.from("dividas_compra").select("*").eq("id", dividaId).single();
    if (!divida) throw new Error("Compra não encontrada");
    if (divida.cancelado) throw new Error("Compra já está cancelada");

    const { data: { user } } = await supabase.auth.getUser();
    const now = new Date().toISOString();

    // 1) Restituir estoque (subtrair os kg que foram comprados) + log de movimentação
    const { data: produto } = await supabase.from("produtos").select("estoque_kg, nome").eq("id", divida.produto_id).single();
    if (produto) {
      const novoEstoque = +(Number(produto.estoque_kg) - Number(divida.kg)).toFixed(3);
      if (novoEstoque < 0) throw new Error(`Estoque insuficiente para estornar (disponível: ${produto.estoque_kg}kg)`);
      await supabase.from("produtos").update({ estoque_kg: novoEstoque }).eq("id", divida.produto_id);
      await supabase.from("movimentacoes_estoque").insert({
        produto_id: divida.produto_id,
        tipo: "outros",
        kg: Number(divida.kg),
        observacao: `Estorno por cancelamento de compra — ${motivo}`,
        peixaria_id: peixariaId,
      });
    }

    // 2) Marcar pagamentos de saída relacionados como cancelados
    await supabase.from("pagamentos_saida").update({ cancelado: true, cancelado_at: now }).eq("divida_id", dividaId);

    // 3) Marcar a dívida como cancelada
    await supabase.from("dividas_compra").update({
      cancelado: true,
      cancelado_motivo: motivo,
      cancelado_at: now,
      cancelado_por: user?.id ?? null,
    }).eq("id", dividaId);

    logActivity({
      action: "Compra Cancelada",
      entity: "Compra",
      entity_id: dividaId.slice(0, 8),
      amount: Number(divida.valor_total),
      description: `Cancelamento de compra de ${divida.kg}kg de ${produto?.nome ?? "—"} — Motivo: ${motivo}`,
      peixaria_id: peixariaId,
    });

    await invalidateAll();
    await queryClient.invalidateQueries({ queryKey: ["produtos"] });
  };

  return {
    dividasCompra, pagamentosSaida, pagamentosEntrada, loading,
    addDividaCompra, payDivida, addPagamentoEntrada, addPagamentoSaida, receiveFromClient, cancelDivida,
    refetch: invalidateAll,
  };
}
