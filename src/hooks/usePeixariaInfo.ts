import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/** Returns the current tenant's display name (razao_social). */
export function usePeixariaInfo() {
  const { peixariaId } = useAuth();
  const [nome, setNome] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!peixariaId) {
      setNome(null);
      return;
    }
    supabase
      .from("peixarias")
      .select("razao_social")
      .eq("id", peixariaId)
      .maybeSingle()
      .then(({ data }) => {
        if (active) setNome(data?.razao_social ?? null);
      });
    return () => {
      active = false;
    };
  }, [peixariaId]);

  return { nome };
}
