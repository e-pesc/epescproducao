import { createClient } from "npm:@supabase/supabase-js@2";
import { count } from "npm:drizzle-orm@0.45.3";
import { conexaoTeste, getNeonDb } from "../_shared/neon.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET" && req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Método não permitido" }), { status: 405, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    const url = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!authHeader?.startsWith("Bearer ") || !url || !anonKey) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: corsHeaders });
    }

    const caller = createClient(url, anonKey, {
      global: { headers: { authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: userData, error: userError } = await caller.auth.getUser();
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: corsHeaders });
    }
    const { data: role, error: roleError } = await caller.rpc("get_my_role");
    if (roleError || role !== "root") {
      return new Response(JSON.stringify({ error: "Sem permissão" }), { status: 403, headers: corsHeaders });
    }

    const db = getNeonDb();
    const rows = await db.select({ total: count() }).from(conexaoTeste);
    return new Response(JSON.stringify({ connected: true, table: "conexao_teste", rows: rows[0]?.total ?? 0 }), { headers: corsHeaders });
  } catch (error) {
    console.error("Neon connection test failed", error instanceof Error ? error.name : "UnknownError");
    return new Response(JSON.stringify({ error: "Falha na conexão com o Neon" }), { status: 500, headers: corsHeaders });
  }
});