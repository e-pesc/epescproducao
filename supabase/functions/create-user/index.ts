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

    // Verify caller is admin or root
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

    const { email, password, name, cpf, whatsapp, role, peixaria_id } = await req.json();

    // Admins can only create users in their own peixaria
    const targetPeixariaId = roleData === "root" ? peixaria_id : callerPeixariaId;

    // Create auth user
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError || !authData.user) {
      return new Response(JSON.stringify({ error: authError?.message || "Erro ao criar usuário" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create app_user record
    const { error: userError } = await adminClient.from("app_users").insert({
      auth_user_id: authData.user.id,
      name,
      cpf: cpf || "",
      whatsapp: whatsapp || "",
      role: role || "vendedor",
      peixaria_id: targetPeixariaId,
    });

    if (userError) {
      await adminClient.auth.admin.deleteUser(authData.user.id);
      return new Response(JSON.stringify({ error: userError.message }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, user_id: authData.user.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
