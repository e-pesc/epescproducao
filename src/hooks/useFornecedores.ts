import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface Fornecedor {
  id: string;
  nome: string;
  cpf_cnpj: string;
  whatsapp: string;
  endereco: string;
  cidade: string;
  ativo: boolean;
  created_at: string;
  peixaria_id: string | null;
}

export function useFornecedores() {
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [loading, setLoading] = useState(true);
  const { peixariaId } = useAuth();

  const fetchFornecedores = useCallback(async () => {
    const { data } = await supabase.from("fornecedores").select("*").order("nome");
    setFornecedores(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchFornecedores();
  }, [fetchFornecedores]);

  const addFornecedor = async (f: Omit<Fornecedor, "id" | "ativo" | "created_at" | "peixaria_id">) => {
    const { error } = await supabase.from("fornecedores").insert({ ...f, peixaria_id: peixariaId });
    if (error) throw error;
    await fetchFornecedores();
  };

  const updateFornecedor = async (id: string, f: Partial<Fornecedor>) => {
    const { error } = await supabase.from("fornecedores").update(f).eq("id", id);
    if (error) throw error;
    await fetchFornecedores();
  };

  const deleteFornecedor = async (id: string) => {
    const { error } = await supabase.from("fornecedores").delete().eq("id", id);
    if (error) throw error;
    await fetchFornecedores();
  };

  const toggleFornecedor = async (id: string, currentActive: boolean) => {
    await updateFornecedor(id, { ativo: !currentActive });
  };

  return { fornecedores, loading, addFornecedor, updateFornecedor, deleteFornecedor, toggleFornecedor, refetch: fetchFornecedores };
}
