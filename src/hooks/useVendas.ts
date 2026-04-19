import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { logActivity } from "@/lib/logActivity";

export interface ItemVenda {
  produto_id: string;
  kg: number;
  preco_kg: number;
}

export interface Venda {
  id: string;
  cliente_id: string | null;
  vendedor_id: string | null;
  produto_id: string;
  kg: number;
  preco_kg: number;
  valor_total: number;
  forma_pagamento: "avista" | "prazo";
  entrada: number | null;
  created_at: string;
  peixaria_id: string | null;
  cancelado?: boolean;
  cancelado_motivo?: string | null;
  cancelado_at?: string | null;
  itens?: { id: string; produto_id: string; kg: number; preco_kg: number }[];
}

export function useVendas() {
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [loading, setLoading] = useState(true);
  const { peixariaId } = useAuth();

  const fetch = useCallback(async () => {
    const { data: vendasData } = await supabase.from("vendas").select("*").order("created_at", { ascending: false });
    if (!vendasData) { setVendas([]); setLoading(false); return; }
    const ids = vendasData.map((v) => v.id);
    const { data: itensData } = ids.length
      ? await supabase.from("itens_venda").select("*").in("venda_id", ids)
      : { data: [] as any[] };
    const merged = vendasData.map((v) => ({
      ...v,
      itens: (itensData ?? []).filter((i: any) => i.venda_id === v.id),
    }));
    setVendas(merged as Venda[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const addVenda = async (v: {
    cliente_id?: string | null;
    itens: ItemVenda[];
    valor_total: number;
    forma_pagamento: "avista" | "prazo";
    entrada?: number | null;
  }) => {
    const { data: { user } } = await supabase.auth.getUser();

    const firstItem = v.itens[0];
    const totalKg = v.itens.reduce((s, i) => s + i.kg, 0);
    const avgPrecoKg = v.valor_total / (totalKg || 1);

    const { data: venda, error } = await supabase.from("vendas").insert({
      cliente_id: v.cliente_id ?? null,
      produto_id: firstItem.produto_id,
      kg: totalKg,
      preco_kg: +avgPrecoKg.toFixed(2),
      valor_total: v.valor_total,
      forma_pagamento: v.forma_pagamento,
      entrada: v.forma_pagamento === "prazo" ? (v.entrada ?? null) : null,
      vendedor_id: user?.id ?? null,
      peixaria_id: peixariaId,
    }).select("id").single();

    if (error) throw error;

    const itensRows = v.itens.map((item) => ({
      venda_id: venda.id,
      produto_id: item.produto_id,
      kg: item.kg,
      preco_kg: item.preco_kg,
      peixaria_id: peixariaId,
    }));

    const { error: itensError } = await supabase.from("itens_venda").insert(itensRows);
    if (itensError) throw itensError;

    const descItems = v.itens.map(i => `${i.kg}kg`).join(", ");
    logActivity({
      action: "Venda Finalizada",
      entity: "Venda",
      entity_id: venda.id.slice(0, 8),
      amount: v.valor_total,
      description: `Venda de ${descItems} - ${v.forma_pagamento === "avista" ? "À Vista" : "A Prazo"}`,
      peixaria_id: peixariaId,
    });

    await fetch();
    return venda.id;
  };

  const cancelVenda = async (vendaId: string, motivo: string) => {
    if (!motivo?.trim()) throw new Error("Motivo do cancelamento é obrigatório");

    const { data: { user } } = await supabase.auth.getUser();
    const venda = vendas.find((v) => v.id === vendaId);
    if (!venda) throw new Error("Venda não encontrada");
    if (venda.cancelado) throw new Error("Venda já cancelada");

    // 1) Restituir estoque dos itens
    const itens = venda.itens ?? [];
    for (const item of itens) {
      const { data: prod } = await supabase.from("produtos").select("estoque_kg, nome").eq("id", item.produto_id).single();
      if (prod) {
        await supabase.from("produtos").update({
          estoque_kg: +(Number(prod.estoque_kg) + Number(item.kg)).toFixed(3),
        }).eq("id", item.produto_id);
        // Movimentação de estoque tipo "outros" com observação
        await supabase.from("movimentacoes_estoque").insert({
          produto_id: item.produto_id,
          tipo: "outros" as const,
          kg: -Number(item.kg), // negativo = entrada (estorno de saída)
          observacao: `Estorno venda cancelada - ${motivo}`,
          peixaria_id: peixariaId,
        });
      }
    }

    // 2) Marcar entradas como canceladas
    await supabase
      .from("pagamentos_entrada")
      .update({ cancelado: true, cancelado_at: new Date().toISOString() })
      .eq("venda_id", vendaId);

    // 3) Subtrair débito do cliente (se prazo)
    if (venda.forma_pagamento === "prazo" && venda.cliente_id) {
      const { data: cliente } = await supabase.from("clientes").select("debito").eq("id", venda.cliente_id).single();
      if (cliente) {
        const novoDebito = Math.max(0, +(Number(cliente.debito) - Number(venda.valor_total)).toFixed(2));
        await supabase.from("clientes").update({ debito: novoDebito }).eq("id", venda.cliente_id);
      }
    }

    // 4) Marcar venda como cancelada
    const { error } = await supabase.from("vendas").update({
      cancelado: true,
      cancelado_motivo: motivo.trim(),
      cancelado_at: new Date().toISOString(),
      cancelado_por: user?.id ?? null,
    }).eq("id", vendaId);
    if (error) throw error;

    logActivity({
      action: "Venda Cancelada",
      entity: "Venda",
      entity_id: vendaId.slice(0, 8),
      amount: Number(venda.valor_total),
      description: `Venda cancelada - Motivo: ${motivo.trim()}`,
      peixaria_id: peixariaId,
    });

    await fetch();
  };

  return { vendas, loading, addVenda, cancelVenda, refetch: fetch };
}
