import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { logActivity } from "@/lib/logActivity";

export interface ItemPedido {
  id?: string;
  pedido_id?: string;
  produto_id: string;
  kg: number;
  preco_kg: number;
}

export interface Pedido {
  id: string;
  numero: number;
  cliente_id: string;
  status: "pendente" | "atendido";
  pagamento: "avista" | "prazo" | null;
  entrada: number | null;
  prepaid: boolean;
  prepaid_method: "pix" | "cartao" | "dinheiro" | null;
  valor_total: number;
  created_at: string;
  fulfilled_at: string | null;
  itens?: ItemPedido[];
  peixaria_id: string | null;
  cancelado?: boolean;
  cancelado_motivo?: string | null;
  cancelado_at?: string | null;
}

export function usePedidos() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const { peixariaId } = useAuth();

  const fetch = useCallback(async () => {
    const { data: pedidosData } = await supabase.from("pedidos").select("*").order("created_at", { ascending: false });
    if (!pedidosData) { setPedidos([]); setLoading(false); return; }

    const pedidoIds = pedidosData.map(p => p.id);
    const { data: itensData } = await supabase.from("itens_pedido").select("*").in("pedido_id", pedidoIds);

    const pedidosWithItens = pedidosData.map(p => ({
      ...p,
      itens: (itensData ?? []).filter(i => i.pedido_id === p.id),
    }));

    setPedidos(pedidosWithItens);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const addPedido = async (p: {
    cliente_id: string;
    itens: { produto_id: string; kg: number; preco_kg: number }[];
    prepaid?: boolean;
    prepaid_method?: "pix" | "cartao" | "dinheiro";
  }) => {
    const valor_total = p.itens.reduce((acc, i) => acc + i.kg * i.preco_kg, 0);
    const { data, error } = await supabase.from("pedidos").insert({
      cliente_id: p.cliente_id,
      valor_total: +valor_total.toFixed(2),
      prepaid: p.prepaid ?? false,
      prepaid_method: p.prepaid_method ?? null,
      peixaria_id: peixariaId,
    }).select("id").single();
    if (error || !data) throw error;

    const itens = p.itens.map(i => ({ pedido_id: data.id, produto_id: i.produto_id, kg: i.kg, preco_kg: i.preco_kg, peixaria_id: peixariaId }));
    const { error: itensError } = await supabase.from("itens_pedido").insert(itens);
    if (itensError) throw itensError;

    logActivity({
      action: "Pedido Criado",
      entity: "Pedido",
      entity_id: `#${data.id.slice(0, 8)}`,
      amount: +valor_total.toFixed(2),
      description: `Pedido criado com ${p.itens.length} item(ns)${p.prepaid ? " - Pago antecipadamente" : ""}`,
      peixaria_id: peixariaId,
    });

    await fetch();
  };

  const updatePedido = async (id: string, p: {
    cliente_id?: string;
    itens?: { produto_id: string; kg: number; preco_kg: number }[];
  }) => {
    if (p.itens) {
      const valor_total = p.itens.reduce((acc, i) => acc + i.kg * i.preco_kg, 0);
      await supabase.from("pedidos").update({
        cliente_id: p.cliente_id,
        valor_total: +valor_total.toFixed(2),
      }).eq("id", id);

      await supabase.from("itens_pedido").delete().eq("pedido_id", id);
      const itens = p.itens.map(i => ({ pedido_id: id, produto_id: i.produto_id, kg: i.kg, preco_kg: i.preco_kg, peixaria_id: peixariaId }));
      await supabase.from("itens_pedido").insert(itens);

      logActivity({
        action: "Pedido Editado",
        entity: "Pedido",
        entity_id: id.slice(0, 8),
        amount: +valor_total.toFixed(2),
        description: `Pedido editado com ${p.itens.length} item(ns)`,
        peixaria_id: peixariaId,
      });
    } else if (p.cliente_id) {
      await supabase.from("pedidos").update({ cliente_id: p.cliente_id }).eq("id", id);
    }
    await fetch();
  };

  const fulfillPedido = async (id: string, pagamento: "avista" | "prazo", entrada?: number) => {
    const { error } = await supabase.from("pedidos").update({
      status: "atendido" as const,
      pagamento,
      entrada: entrada ?? null,
      fulfilled_at: new Date().toISOString(),
    }).eq("id", id);
    if (error) throw error;

    logActivity({
      action: "Pedido Atendido",
      entity: "Pedido",
      entity_id: id.slice(0, 8),
      amount: undefined,
      description: `Pedido atendido - ${pagamento === "avista" ? "À Vista" : "A Prazo"}${entrada ? ` com entrada de R$${entrada.toFixed(2)}` : ""}`,
      peixaria_id: peixariaId,
    });

    await fetch();
  };

  const deletePedido = async (id: string) => {
    await supabase.from("itens_pedido").delete().eq("pedido_id", id);
    const { error } = await supabase.from("pedidos").delete().eq("id", id);
    if (error) throw error;

    logActivity({
      action: "Pedido Excluído",
      entity: "Pedido",
      entity_id: id.slice(0, 8),
      description: "Pedido excluído",
      peixaria_id: peixariaId,
    });

    await fetch();
  };

  const cancelPedido = async (id: string, motivo: string) => {
    if (!motivo?.trim()) throw new Error("Motivo do cancelamento é obrigatório");

    const pedido = pedidos.find((p) => p.id === id);
    if (!pedido) throw new Error("Pedido não encontrado");
    if (pedido.cancelado) throw new Error("Pedido já cancelado");
    if (pedido.status !== "atendido") throw new Error("Apenas pedidos atendidos podem ser cancelados aqui");

    // 1) Restituir estoque
    for (const item of (pedido.itens ?? [])) {
      const { data: prod } = await supabase.from("produtos").select("estoque_kg").eq("id", item.produto_id).single();
      if (prod) {
        await supabase.from("produtos").update({
          estoque_kg: +(Number(prod.estoque_kg) + Number(item.kg)).toFixed(3),
        }).eq("id", item.produto_id);
        await supabase.from("movimentacoes_estoque").insert({
          produto_id: item.produto_id,
          tipo: "outros" as const,
          kg: -Number(item.kg),
          observacao: `Estorno pedido cancelado - ${motivo}`,
          peixaria_id: peixariaId,
        });
      }
    }

    // 2) Marcar entradas como canceladas
    await supabase
      .from("pagamentos_entrada")
      .update({ cancelado: true, cancelado_at: new Date().toISOString() })
      .eq("pedido_id", id);

    // 3) Subtrair débito do cliente (se prazo, não pré-pago)
    if (!pedido.prepaid && pedido.pagamento === "prazo" && pedido.cliente_id) {
      const entradaPaga = Number(pedido.entrada ?? 0);
      const debtoGerado = Number(pedido.valor_total) - entradaPaga;
      const { data: cliente } = await supabase.from("clientes").select("debito").eq("id", pedido.cliente_id).single();
      if (cliente) {
        const novoDebito = Math.max(0, +(Number(cliente.debito) - debtoGerado).toFixed(2));
        await supabase.from("clientes").update({ debito: novoDebito }).eq("id", pedido.cliente_id);
      }
    }

    // 4) Marcar pedido como cancelado
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("pedidos").update({
      cancelado: true,
      cancelado_motivo: motivo.trim(),
      cancelado_at: new Date().toISOString(),
      cancelado_por: user?.id ?? null,
    }).eq("id", id);
    if (error) throw error;

    logActivity({
      action: "Pedido Cancelado",
      entity: "Pedido",
      entity_id: id.slice(0, 8),
      amount: Number(pedido.valor_total),
      description: `Pedido #${pedido.numero} cancelado - Motivo: ${motivo.trim()}`,
      peixaria_id: peixariaId,
    });

    await fetch();
  };

  return { pedidos, loading, addPedido, updatePedido, fulfillPedido, deletePedido, cancelPedido, refetch: fetch };
}
