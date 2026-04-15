import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface Cliente {
  id: string;
  nome: string;
  cpf_cnpj: string;
  whatsapp: string;
  endereco: string;
  cidade: string;
  ativo: boolean;
  debito: number;
  created_at: string;
  peixaria_id: string | null;
}

export function useClientes() {
  const queryClient = useQueryClient();
  const { peixariaId } = useAuth();

  const { data: clientes = [], isLoading: loading } = useQuery({
    queryKey: ["clientes"],
    queryFn: async () => {
      const { data } = await supabase.from("clientes").select("*").order("nome");
      return (data ?? []) as Cliente[];
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["clientes"] });

  const addCliente = async (c: Omit<Cliente, "id" | "ativo" | "debito" | "created_at" | "peixaria_id">) => {
    const { error } = await supabase.from("clientes").insert({ ...c, peixaria_id: peixariaId });
    if (error) throw error;
    await invalidate();
  };

  const updateCliente = async (id: string, c: Partial<Cliente>) => {
    const { error } = await supabase.from("clientes").update(c).eq("id", id);
    if (error) throw error;
    await invalidate();
  };

  const deleteCliente = async (id: string) => {
    const { error } = await supabase.from("clientes").delete().eq("id", id);
    if (error) throw error;
    await invalidate();
  };

  const toggleCliente = async (id: string, currentActive: boolean) => {
    await updateCliente(id, { ativo: !currentActive });
  };

  return { clientes, loading, addCliente, updateCliente, deleteCliente, toggleCliente, refetch: invalidate };
}
