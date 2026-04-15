import { supabase } from "@/integrations/supabase/client";

export async function logActivity(entry: {
  action: string;
  entity: string;
  entity_id: string;
  amount?: number | null;
  description: string;
  peixaria_id: string | null;
}) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: appUser } = await supabase
      .from("app_users")
      .select("name")
      .eq("auth_user_id", user.id)
      .single();

    await supabase.from("activity_logs").insert({
      user_id: user.id,
      user_name: appUser?.name ?? "Desconhecido",
      action: entry.action,
      entity: entry.entity,
      entity_id: entry.entity_id,
      amount: entry.amount ?? null,
      description: entry.description,
      peixaria_id: entry.peixaria_id,
    });
  } catch (e) {
    console.error("Erro ao registrar log:", e);
  }
}
