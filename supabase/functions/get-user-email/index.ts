import { cloudAdmin,corsHeaders,requireManager,response } from '../_shared/neon-admin.ts';
Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders});
  try{
    const {sql,caller}=await requireManager(req);
    const {app_user_id,peixaria_id}=await req.json();
    if(peixaria_id&&caller.role!=='root')return response({error:'Sem permissão'},403);
    if(!app_user_id&&!peixaria_id)return response({error:'ID obrigatório'},400);
    const rows=app_user_id
      ?await sql.query('SELECT auth_user_id,id,peixaria_id FROM public.app_users WHERE id=$1',[app_user_id])
      :await sql.query(`SELECT u.auth_user_id,u.id,u.peixaria_id FROM public.app_users u JOIN public.user_roles r ON r.user_id=u.id WHERE u.peixaria_id=$1 AND r.role='administrador' AND u.active ORDER BY u.created_at LIMIT 1`,[peixaria_id]);
    const target=rows[0];
    if(!target?.auth_user_id)return response({email:null,app_user_id:null});
    if(caller.role!=='root'&&target.peixaria_id!==caller.peixaria_id)return response({error:'Sem permissão'},403);
    const {data,error}=await cloudAdmin().auth.admin.getUserById(target.auth_user_id);
    if(error||!data.user)return response({error:'Email não encontrado'},404);
    return response({email:data.user.email??null,app_user_id:target.id});
  }catch(e){console.error('get-user-email',e instanceof Error?e.name:'Error');return response({error:'Sem permissão'},403);}
});
