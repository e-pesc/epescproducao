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

    const { app_user_id, new_password } = await req.json();

    if (!app_user_id || !new_password || new_password.length < 6) {
      return new Response(JSON.stringify({ error: "Senha deve ter no mínimo 6 caracteres" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get the app_user to find auth_user_id and verify peixaria ownership
    const { data: appUser, error: fetchError } = await adminClient
      .from("app_users")
      .select("auth_user_id, peixaria_id")
      .eq("id", app_user_id)
      .single();

    if (fetchError || !appUser?.auth_user_id) {
      return new Response(JSON.stringify({ error: "Usuário não encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Admins can only update users in their own peixaria
    if (roleData === "administrador" && appUser.peixaria_id !== callerPeixariaId) {
      return new Response(JSON.stringify({ error: "Sem permissão para este usuário" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: updateError } = await adminClient.auth.admin.updateUserById(
      appUser.auth_user_id,
      { password: new_password }
    );

    if (updateError) {
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
