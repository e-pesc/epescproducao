import { neon } from 'npm:@neondatabase/serverless@1.2.0';
import { createClient } from 'npm:@supabase/supabase-js@2';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};
export const response = (body:unknown,status=200) => new Response(JSON.stringify(body),{status,headers:corsHeaders});
export const database = () => {
  const url=Deno.env.get('DATABASE_URL'); if(!url) throw Error('Neon indisponível'); return neon(url);
};
export const cloudAdmin = () => createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
export async function requireManager(req:Request) {
  const token=req.headers.get('authorization');
  if(!token?.startsWith('Bearer ')) throw Error('Sem permissão');
  const client=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{auth:{persistSession:false}});
  const {data:{user},error}=await client.auth.getUser(token.slice(7));
  if(error||!user) throw Error('Sem permissão');
  const sql=database();
  const rows=await sql.query(`SELECT u.id,u.peixaria_id,r.role FROM public.app_users u JOIN public.user_roles r ON r.user_id=u.id LEFT JOIN public.peixarias p ON p.id=u.peixaria_id WHERE u.auth_user_id=$1 AND u.active AND (r.role='root' OR p.ativo) AND r.role IN ('root','administrador') LIMIT 1`,[user.id]);
  if(!rows[0]) throw Error('Sem permissão');
  return {sql,caller:rows[0] as {id:string;peixaria_id:string|null;role:'root'|'administrador'}};
}
