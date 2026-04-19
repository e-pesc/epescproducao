import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get("authorization")!;
    const callerClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { authorization: authHeader } },
    });

    const [{ data: roleData }, { data: callerPeixariaId }] = await Promise.all([
      callerClient.rpc("get_my_role"),
      callerClient.rpc("get_my_peixaria_id"),
    ]);

    if (roleData !== "root" && roleData !== "administrador") {
      return new Response(JSON.stringify({ error: "Sem permissão" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { app_user_id, peixaria_id } = await req.json();

    let authUserId: string | null = null;

    if (app_user_id) {
      const { data: appUser, error } = await adminClient
        .from("app_users")
        .select("auth_user_id, peixaria_id")
        .eq("id", app_user_id)
        .single();

      if (error || !appUser?.auth_user_id) {
        return new Response(JSON.stringify({ error: "Usuário não encontrado" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Admins só podem ver usuários da própria peixaria
      if (roleData === "administrador" && appUser.peixaria_id !== callerPeixariaId) {
        return new Response(JSON.stringify({ error: "Sem permissão" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      authUserId = appUser.auth_user_id;
    } else if (peixaria_id) {
      // Root busca o admin principal da peixaria
      if (roleData !== "root") {
        return new Response(JSON.stringify({ error: "Sem permissão" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: admin } = await adminClient
        .from("app_users")
        .select("id, auth_user_id")
        .eq("peixaria_id", peixaria_id)
        .eq("role", "administrador")
        .eq("active", true)
        .order("created_at", { ascending: true })
        .limit(1)
        .single();
      if (!admin?.auth_user_id) {
        return new Response(JSON.stringify({ email: null, app_user_id: null }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      authUserId = admin.auth_user_id;
      const { data: u } = await adminClient.auth.admin.getUserById(authUserId);
      return new Response(JSON.stringify({ email: u.user?.email ?? null, app_user_id: admin.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else {
      return new Response(JSON.stringify({ error: "app_user_id ou peixaria_id obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: u, error: uErr } = await adminClient.auth.admin.getUserById(authUserId);
    if (uErr || !u.user) {
      return new Response(JSON.stringify({ error: "Email não encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ email: u.user.email ?? null }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
