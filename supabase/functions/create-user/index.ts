import { cloudAdmin,corsHeaders,database,requireManager,response } from '../_shared/neon-admin.ts';
Deno.serve(async req=>{
  if(req.method==='OPTIONS') return new Response('ok',{headers:corsHeaders});
  try {
    const {sql,caller}=await requireManager(req);
    const {email,password,name,cpf,whatsapp,role,peixaria_id}=await req.json();
    const target=caller.role==='root'?peixaria_id:caller.peixaria_id;
    if(!email||!password||!name?.trim()||!['vendedor','administrador','root'].includes(role)||(!target&&role!=='root')||(role==='root'&&caller.role!=='root')) return response({error:'Dados inválidos'},400);
    if(target){const p=await sql.query('SELECT id FROM public.peixarias WHERE id=$1',[target]);if(!p.length)return response({error:'Peixaria inválida'},400);}
    const admin=cloudAdmin();
    const {data,error}=await admin.auth.admin.createUser({email,password,email_confirm:true});
    if(error||!data.user) return response({error:error?.message??'Falha no cadastro'},400);
    try {
      const result=await sql.query(`WITH u AS (INSERT INTO public.app_users(auth_user_id,name,cpf,whatsapp,peixaria_id) VALUES ($1,$2,$3,$4,$5) RETURNING id) INSERT INTO public.user_roles(user_id,role) SELECT id,$6::public.app_role FROM u RETURNING user_id`,[data.user.id,name.trim(),cpf??'',whatsapp??'',target??null,role]);
      return response({success:true,user_id:data.user.id,app_user_id:result[0].user_id});
    } catch(e) {
      await admin.auth.admin.deleteUser(data.user.id);
      throw e;
    }
  } catch(e){console.error('create-user',e instanceof Error?e.name:'Error');return response({error:e instanceof Error&&e.message==='Sem permissão'?e.message:'Falha ao criar usuário'},e instanceof Error&&e.message==='Sem permissão'?403:400);}
});
