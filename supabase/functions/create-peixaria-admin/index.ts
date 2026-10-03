import { cloudAdmin,corsHeaders,requireManager,response } from '../_shared/neon-admin.ts';
Deno.serve(async req=>{
  if(req.method==='OPTIONS') return new Response('ok',{headers:corsHeaders});
  try {
    const {sql,caller}=await requireManager(req);
    if(caller.role!=='root')return response({error:'Sem permissão'},403);
    const {email,password,name,peixaria_id}=await req.json();
    if(!email||!password||!name?.trim()||!peixaria_id)return response({error:'Dados inválidos'},400);
    const p=await sql.query('SELECT id FROM public.peixarias WHERE id=$1',[peixaria_id]);
    if(!p.length)return response({error:'Peixaria não encontrada'},404);
    const admin=cloudAdmin();
    const {data,error}=await admin.auth.admin.createUser({email,password,email_confirm:true});
    if(error||!data.user)return response({error:error?.message??'Falha no cadastro'},400);
    try {
      const result=await sql.query(`WITH u AS (INSERT INTO public.app_users(auth_user_id,name,peixaria_id) VALUES ($1,$2,$3) RETURNING id) INSERT INTO public.user_roles(user_id,role) SELECT id,'administrador'::public.app_role FROM u RETURNING user_id`,[data.user.id,name.trim(),peixaria_id]);
      return response({success:true,user_id:data.user.id,app_user_id:result[0].user_id});
    }catch(e){await admin.auth.admin.deleteUser(data.user.id);throw e;}
  }catch(e){console.error('create-peixaria-admin',e instanceof Error?e.name:'Error');return response({error:e instanceof Error&&e.message==='Sem permissão'?e.message:'Falha ao criar administrador'},e instanceof Error&&e.message==='Sem permissão'?403:400);}
});
