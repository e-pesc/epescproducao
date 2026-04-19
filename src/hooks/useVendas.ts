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

  return { vendas, loading, addVenda, refetch: fetch };
}
