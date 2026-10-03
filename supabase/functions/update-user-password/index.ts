import { cloudAdmin,corsHeaders,requireManager,response } from '../_shared/neon-admin.ts';
Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders});
  try{
    const {sql,caller}=await requireManager(req);
    const {app_user_id,new_password}=await req.json();
    if(!app_user_id||typeof new_password!=='string'||new_password.length<6)return response({error:'Senha deve ter no mínimo 6 caracteres'},400);
    const rows=await sql.query('SELECT auth_user_id,peixaria_id FROM public.app_users WHERE id=$1',[app_user_id]);
    const target=rows[0];
    if(!target?.auth_user_id)return response({error:'Usuário não encontrado'},404);
    if(caller.role!=='root'&&target.peixaria_id!==caller.peixaria_id)return response({error:'Sem permissão'},403);
    const {error}=await cloudAdmin().auth.admin.updateUserById(target.auth_user_id,{password:new_password});
    return error?response({error:error.message},400):response({success:true});
  }catch(e){console.error('update-user-password',e instanceof Error?e.name:'Error');return response({error:'Sem permissão'},403);}
});
