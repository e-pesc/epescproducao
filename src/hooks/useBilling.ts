import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { logActivity } from "@/lib/logActivity";

export interface DividaCompra {
  id: string;
  fornecedor_id: string;
  produto_id: string;
  kg: number;
  preco_kg: number;
  valor_total: number;
  valor_pago: number;
  quitado: boolean;
  created_at: string;
}

export interface PagamentoSaida {
  id: string;
  divida_id: string | null;
  fornecedor_id: string;
  valor: number;
  tipo: string;
  created_at: string;
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

  return {
    dividasCompra, pagamentosSaida, pagamentosEntrada, loading,
    addDividaCompra, payDivida, addPagamentoEntrada, addPagamentoSaida, receiveFromClient,
    refetch: invalidateAll,
  };
}
