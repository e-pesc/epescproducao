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

  const addDividaCompra = async (d: { fornecedor_id: string; produto_id: string; kg: number; preco_kg: number; quitado?: boolean; valor_pago?: number; created_at?: string }) => {
    const valor_total = +(d.kg * d.preco_kg).toFixed(2);
    await supabase.from("dividas_compra").insert({ fornecedor_id: d.fornecedor_id, produto_id: d.produto_id, kg: d.kg, preco_kg: d.preco_kg, valor_total, quitado: d.quitado ?? false, valor_pago: d.valor_pago ?? 0, peixaria_id: peixariaId, ...(d.created_at ? { created_at: d.created_at } : {}) });

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
      descricao: divida.descricao ?? null,
      peixaria_id: peixariaId,
    });

    logActivity({
      action: "Dívida Quitada",
      entity: "Dívida",
      entity_id: dividaId.slice(0, 8),
      amount: amount,
      description: `Pagamento ${tipo === "total" ? "total" : "parcial"} ${divida.descricao ? `(${divida.descricao}) ` : ""}- R$${amount.toFixed(2)}`,
      peixaria_id: peixariaId,
    });

    await invalidateAll();
  };

  // ─── Despesa avulsa (sem fornecedor) ───
  const addDespesa = async (d: { descricao: string; valor: number; avista: boolean; recorrente: boolean }) => {
    const valor = +d.valor.toFixed(2);
    const now = new Date();
    const baseMonth = now.getMonth();
    const baseYear = now.getFullYear();
    const refOf = (offset: number) => {
      const m = baseMonth + offset;
      const y = baseYear + Math.floor(m / 12);
      const mm = ((m % 12) + 12) % 12;
      return `${y}-${String(mm + 1).padStart(2, "0")}`;
    };

    if (d.avista) {
      // Lança direto em saídas
      await supabase.from("pagamentos_saida").insert({
        fornecedor_id: null,
        valor,
        tipo: "total",
        descricao: d.descricao,
        peixaria_id: peixariaId,
      });
      logActivity({
        action: "Despesa Lançada",
        entity: "Despesa",
        entity_id: d.descricao.slice(0, 8),
        amount: valor,
        description: `Despesa à vista — ${d.descricao}`,
        peixaria_id: peixariaId,
      });
    } else {
      // Lança em A Pagar (mês atual). Se recorrente, cria 12 meses.
      const months = d.recorrente ? 12 : 1;
      const rows = [];
      for (let i = 0; i < months; i++) {
        rows.push({
          fornecedor_id: null,
          produto_id: null,
          kg: null,
          preco_kg: null,
          valor_total: valor,
          valor_pago: 0,
          quitado: false,
          descricao: d.descricao,
          recorrente: d.recorrente,
          mes_referencia: refOf(i),
          peixaria_id: peixariaId,
          // Force created_at no mês de referência (dia 1) para que filtros mensais funcionem
          created_at: new Date(baseYear, baseMonth + i, Math.min(now.getDate(), 28)).toISOString(),
        });
      }
      await supabase.from("dividas_compra").insert(rows);
      logActivity({
        action: "Despesa Lançada",
        entity: "Despesa",
        entity_id: d.descricao.slice(0, 8),
        amount: valor,
        description: `Despesa a prazo${d.recorrente ? " (recorrente 12 meses)" : ""} — ${d.descricao}`,
        peixaria_id: peixariaId,
      });
    }

    await invalidateAll();
  };

  // ─── Receita avulsa (entrada genérica, sem cliente/venda) ───
  const addReceita = async (d: { descricao: string; valor: number; avista: boolean; recorrente: boolean }) => {
    const valor = +d.valor.toFixed(2);
    const now = new Date();
    const baseMonth = now.getMonth();
    const baseYear = now.getFullYear();

    if (d.avista) {
      // Lança direto em Entradas
      await supabase.from("pagamentos_entrada").insert({
        cliente_id: null,
        origem: `receita:${d.descricao}`,
        valor,
        tipo: "total",
        peixaria_id: peixariaId,
      });
      logActivity({
        action: "Receita Lançada",
        entity: "Receita",
        entity_id: d.descricao.slice(0, 8),
        amount: valor,
        description: `Receita à vista — ${d.descricao}`,
        peixaria_id: peixariaId,
      });
    } else {
      // Lança em A Receber (genérico). Se recorrente, cria 12 meses.
      const months = d.recorrente ? 12 : 1;
      const rows = [];
      for (let i = 0; i < months; i++) {
        rows.push({
          cliente_id: null,
          origem: `receita_pendente:${d.descricao}`,
          valor,
          tipo: "pendente",
          peixaria_id: peixariaId,
          created_at: new Date(baseYear, baseMonth + i, Math.min(now.getDate(), 28)).toISOString(),
        });
      }
      await supabase.from("pagamentos_entrada").insert(rows);
      logActivity({
        action: "Receita Lançada",
        entity: "Receita",
        entity_id: d.descricao.slice(0, 8),
        amount: valor,
        description: `Receita a prazo${d.recorrente ? " (recorrente 12 meses)" : ""} — ${d.descricao}`,
        peixaria_id: peixariaId,
      });
    }

    await invalidateAll();
  };

  const quitarReceita = async (receitaId: string) => {
    const { data: rec } = await supabase.from("pagamentos_entrada").select("*").eq("id", receitaId).single();
    if (!rec) throw new Error("Receita não encontrada");
    const desc = (rec.origem || "").startsWith("receita_pendente:") ? rec.origem.slice("receita_pendente:".length) : "Receita";

    // Marca a pendência como cancelada (consumida) e cria entrada efetiva
    await supabase.from("pagamentos_entrada").update({ cancelado: true, cancelado_at: new Date().toISOString() }).eq("id", receitaId);
    await supabase.from("pagamentos_entrada").insert({
      cliente_id: null,
      origem: `receita:${desc}`,
      valor: rec.valor,
      tipo: "total",
      peixaria_id: peixariaId,
    });

    logActivity({
      action: "Receita Recebida",
      entity: "Receita",
      entity_id: desc.slice(0, 8),
      amount: Number(rec.valor),
      description: `Recebimento de receita — ${desc}`,
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

  const receiveFromClient = async (
    clienteId: string,
    amount: number,
    tipo: "total" | "parcial",
    refs?: { venda_id?: string | null; pedido_id?: string | null }
  ) => {
    const { data: cliente } = await supabase.from("clientes").select("debito").eq("id", clienteId).single();
    if (!cliente) return;

    const newDebt = tipo === "total" ? 0 : Math.max(0, +(cliente.debito - amount).toFixed(2));
    await supabase.from("clientes").update({ debito: newDebt }).eq("id", clienteId);

    await supabase.from("pagamentos_entrada").insert({
      cliente_id: clienteId,
      origem: "recebimento",
      valor: amount,
      tipo,
      venda_id: refs?.venda_id ?? null,
      pedido_id: refs?.pedido_id ?? null,
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

    // 1) Restituir estoque apenas se for compra de produto (não despesa avulsa)
    let produto: { estoque_kg: number; nome: string } | null = null;
    if (divida.produto_id && divida.kg) {
      const { data } = await supabase.from("produtos").select("estoque_kg, nome").eq("id", divida.produto_id).single();
      produto = data as any;
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

  // ─── Cancelar despesa avulsa (saída sem fornecedor) ───
  const cancelDespesa = async (pagamentoId: string, motivo: string) => {
    const { data: pag } = await supabase.from("pagamentos_saida").select("*").eq("id", pagamentoId).single();
    if (!pag) throw new Error("Despesa não encontrada");
    if (pag.cancelado) throw new Error("Despesa já está cancelada");
    if (pag.fornecedor_id) throw new Error("Use o cancelamento de compra para fornecedores");

    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("pagamentos_saida").update({
      cancelado: true,
      cancelado_at: new Date().toISOString(),
      cancelado_motivo: motivo,
      cancelado_por: user?.id ?? null,
    }).eq("id", pagamentoId);

    logActivity({
      action: "Despesa Cancelada",
      entity: "Despesa",
      entity_id: pagamentoId.slice(0, 8),
      amount: Number(pag.valor),
      description: `Cancelamento de despesa "${pag.descricao ?? "—"}" — Motivo: ${motivo}`,
      peixaria_id: peixariaId,
    });

    await invalidateAll();
  };

  // ─── Cancelar receita avulsa (entrada origem receita:* ou receita_pendente:*) ───
  const cancelReceita = async (pagamentoId: string, motivo: string) => {
    const { data: pag } = await supabase.from("pagamentos_entrada").select("*").eq("id", pagamentoId).single();
    if (!pag) throw new Error("Receita não encontrada");
    if (pag.cancelado) throw new Error("Receita já está cancelada");
    const isReceitaAvulsa = (pag.origem || "").startsWith("receita:") || (pag.origem || "").startsWith("receita_pendente:");
    if (!isReceitaAvulsa) throw new Error("Apenas receitas avulsas podem ser canceladas por aqui");

    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("pagamentos_entrada").update({
      cancelado: true,
      cancelado_at: new Date().toISOString(),
      cancelado_motivo: motivo,
      cancelado_por: user?.id ?? null,
    }).eq("id", pagamentoId);

    const desc = (pag.origem || "").replace(/^receita(_pendente)?:/, "");
    logActivity({
      action: "Receita Cancelada",
      entity: "Receita",
      entity_id: pagamentoId.slice(0, 8),
      amount: Number(pag.valor),
      description: `Cancelamento de receita "${desc}" — Motivo: ${motivo}`,
      peixaria_id: peixariaId,
    });

    await invalidateAll();
  };

  return {
    dividasCompra, pagamentosSaida, pagamentosEntrada, loading,
    addDividaCompra, payDivida, addPagamentoEntrada, addPagamentoSaida, receiveFromClient, cancelDivida,
    addDespesa, addReceita, quitarReceita, cancelDespesa, cancelReceita,
    refetch: invalidateAll,
  };
}
