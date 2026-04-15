import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface ActivityLog {
  id: string;
  user_id: string;
  user_name: string;
  action: string;
  entity: string;
  entity_id: string;
  amount: number | null;
  description: string;
  peixaria_id: string | null;
  created_at: string;
}

export function useActivityLog() {
  const { peixariaId, user } = useAuth();

  const log = useCallback(async (entry: {
    action: string;
    entity: string;
    entity_id: string;
    amount?: number | null;
    description: string;
  }) => {
    if (!user) return;

    // Get user name from app_users
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
      peixaria_id: peixariaId,
    });
  }, [user, peixariaId]);

  return { log };
}

export function useActivityLogs() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async (filters?: {
    startDate?: string;
    endDate?: string;
    userId?: string;
    action?: string;
  }) => {
    setLoading(true);

    // Default to today only
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    let query = supabase
      .from("activity_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);

    query = query.gte("created_at", filters?.startDate ?? todayStart.toISOString());
    query = query.lte("created_at", filters?.endDate ?? todayEnd.toISOString());

    if (filters?.userId) {
      query = query.eq("user_id", filters.userId);
    }
    if (filters?.action) {
      query = query.eq("action", filters.action);
    }

    const { data } = await query;
    setLogs((data as ActivityLog[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { logs, loading, fetch };
}
