const corsHeaders = { 'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type' };
import { createClient } from 'npm:@supabase/supabase-js@2';
import { neon } from 'npm:@neondatabase/serverless@1.2.0';
import { z } from 'npm:zod@3.25.76';

const tables = ['activity_logs','app_users','clientes','dividas_compra','fornecedores','itens_pedido','itens_venda','movimentacoes_estoque','pagamentos_entrada','pagamentos_mensalidade','pagamentos_saida','pedidos','peixarias','produtos','vendas'] as const;
const Table = z.enum(tables);
const Filter = z.object({ column:z.string().regex(/^[a-z_]+$/), op:z.enum(['eq','gte','lte','in','not_null']), value:z.unknown().optional() });
const Body = z.object({ table:Table, action:z.enum(['select','insert','update','delete','profile']), columns:z.string().max(500).default('*'), filters:z.array(Filter).max(20).default([]), order:z.object({column:z.string().regex(/^[a-z_]+$/),ascending:z.boolean()}).optional(), limit:z.number().int().min(1).max(5000).optional(), rows:z.union([z.record(z.unknown()),z.array(z.record(z.unknown()))]).optional(), single:z.boolean().optional(), maybeSingle:z.boolean().optional(), returning:z.boolean().optional() });
type TableName = z.infer<typeof Table>;
const id = (name:string) => '"'+name+'"';
const reply = (body:unknown,status=200) => new Response(JSON.stringify(body), { status, headers:{...corsHeaders,'Content-Type':'application/json'} });
const linked:Record<string,Array<[string,string]>> = {
  peixarias:[['vendedor_root_id','app_users']], app_users:[['peixaria_id','peixarias']],
  pedidos:[['cliente_id','clientes']], itens_pedido:[['pedido_id','pedidos'],['produto_id','produtos']],
  vendas:[['cliente_id','clientes'],['produto_id','produtos']], itens_venda:[['venda_id','vendas'],['produto_id','produtos']],
  movimentacoes_estoque:[['produto_id','produtos']], dividas_compra:[['fornecedor_id','fornecedores'],['produto_id','produtos']],
  pagamentos_saida:[['divida_id','dividas_compra'],['fornecedor_id','fornecedores']],
  pagamentos_entrada:[['cliente_id','clientes'],['pedido_id','pedidos'],['venda_id','vendas'],['produto_id','produtos']],
};
const tenantTable = (table:string) => table==='peixarias' ? 'id' : 'peixaria_id';
const requiredTenant = new Set(['clientes','fornecedores','produtos','movimentacoes_estoque','pedidos','itens_pedido','vendas','itens_venda','dividas_compra','pagamentos_saida','pagamentos_entrada']);

Deno.serve(async req => {
  if(req.method==='OPTIONS') return new Response('ok',{headers:corsHeaders});
  if(req.method!=='POST') return reply({error:'Método não permitido'},405);
  const auth = req.headers.get('Authorization');
  if(!auth?.startsWith('Bearer ')) return reply({error:'Não autorizado'},401);
  const parsed=Body.safeParse(await req.json().catch(()=>null));
  if(!parsed.success) return reply({error:'Consulta inválida',details:parsed.error.flatten().fieldErrors},400);
  const input=parsed.data;
  try {
    const url=Deno.env.get('SUPABASE_URL'); const key=Deno.env.get('SUPABASE_ANON_KEY'); const dbUrl=Deno.env.get('DATABASE_URL');
    if(!url||!key||!dbUrl) throw Error('Configuração indisponível');
    const authClient=createClient(url,key,{auth:{persistSession:false}});
    const {data:{user},error:authError}=await authClient.auth.getUser(auth.slice(7));
    if(authError||!user) return reply({error:'Não autorizado'},401);
    const sql=neon(dbUrl);
    const actorRows=await sql.query(`SELECT u.id,u.name,u.peixaria_id,u.active,r.role,p.ativo AS tenant_active FROM public.app_users u JOIN public.user_roles r ON r.user_id=u.id LEFT JOIN public.peixarias p ON p.id=u.peixaria_id WHERE u.auth_user_id=$1 LIMIT 1`,[user.id]);
    const actor=actorRows[0] as {id:string;name:string;peixaria_id:string|null;active:boolean;role:string;tenant_active:boolean|null}|undefined;
    if(!actor?.active || (actor.role!=='root' && (!actor.peixaria_id || !actor.tenant_active))) return reply({error:'Sem permissão'},403);
    if(input.action==='profile') return reply({data:{role:actor.role,peixaria_id:actor.peixaria_id},error:null});
    const root=actor.role==='root', admin=actor.role==='administrador', table:TableName=input.table;
    if(table==='pagamentos_mensalidade' && !root) return reply({error:'Sem permissão'},403);
    if(input.action==='select') {
      if(table==='activity_logs'&&!root&&!admin) return reply({error:'Sem permissão'},403);
    } else if (!root && !admin) {
      const vendorInsert=['activity_logs','movimentacoes_estoque','pedidos','itens_pedido','vendas','itens_venda','pagamentos_entrada','pagamentos_saida','dividas_compra'];
      const vendorUpdate=['pedidos','vendas','produtos','clientes','dividas_compra','pagamentos_entrada','pagamentos_saida'];
      if (!(input.action==='insert' && vendorInsert.includes(table)) && !(input.action==='update' && vendorUpdate.includes(table))) return reply({error:'Sem permissão'},403);
    }
    if(table==='peixarias'&&input.action!=='select'&&!root) return reply({error:'Sem permissão'},403);
    if(table==='app_users'&&input.action!=='select'&&!root&&!admin) return reply({error:'Sem permissão'},403);
    const metadata=await sql.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1`,[table]);
    const allowed=new Set(metadata.map(x=>x.column_name as string));
    const selectCols=input.columns==='*'?'*':input.columns.split(',').map(s=>s.trim()).join(',');
    const selected=selectCols==='*' ? '*' : selectCols.split(',').map(s=>{if(!allowed.has(s)) throw Error('Coluna inválida');return id(s)}).join(',');
    if(input.order&&!allowed.has(input.order.column)) throw Error('Ordenação inválida');
    const values:unknown[]=[];
    const where:string[]=[];
    const bind=(v:unknown)=>{values.push(v);return `$${values.length}`};
    const scope=tenantTable(table);
    if(!root) {
      if(table==='app_users') {
        if(!admin) where.push(`t.auth_user_id=${bind(user.id)}`);
        else where.push(`(t.peixaria_id=${bind(actor.peixaria_id)} OR t.auth_user_id=${bind(user.id)})`);
      } else where.push(`t.${id(scope)}=${bind(actor.peixaria_id)}`);
    }
    for(const f of input.filters) {
      if(f.column==='role' && table==='app_users') {
        if(f.op!=='eq'||!['root','vendedor','administrador'].includes(String(f.value))) throw Error('Filtro inválido');
        where.push(`EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id=t.id AND r.role=${bind(f.value)}::public.app_role)`);
        continue;
      }
      if(!allowed.has(f.column)) throw Error('Filtro inválido');
      if(f.op==='not_null') where.push(`t.${id(f.column)} IS NOT NULL`);
      else if(f.op==='in') { if(!Array.isArray(f.value)||f.value.length>500) throw Error('Lista inválida'); if(!f.value.length) where.push('false'); else where.push(`t.${id(f.column)} IN (${f.value.map(x=>bind(x)).join(',')})`); }
      else { if(f.value===undefined || (typeof f.value==='object' && f.value!==null)) throw Error('Valor inválido'); where.push(`t.${id(f.column)} ${f.op==='eq'?'=':f.op==='gte'?'>=':'<='} ${bind(f.value)}`); }
    }
    const clause=where.length?' WHERE '+where.join(' AND '):'';
    const name=`public.${id(table)}`;
    if(input.action==='select') {
      const rowJson=table==='app_users' ? `to_jsonb(t) || jsonb_build_object('role',(SELECT role FROM public.user_roles WHERE user_id=t.id LIMIT 1))` : `to_jsonb(t)`;
      const projection=selected==='*' ? rowJson : `(SELECT to_jsonb(x) FROM (SELECT ${selected.split(',').map(c=>`t.${c}`).join(',')}) x)`;
      const order=input.order?` ORDER BY t.${id(input.order.column)} ${input.order.ascending?'ASC':'DESC'}`:'';
      const result=await sql.query(`SELECT ${projection} AS record FROM ${name} t${clause}${order} LIMIT ${input.single||input.maybeSingle?2:input.limit??5000}`,values);
      if(input.single&&result.length!==1) return reply({data:null,error:result.length?'Múltiplos registros':'Registro não encontrado'},406);
      return reply({data:input.single||input.maybeSingle?result[0]?.record??null:result.map(r=>r.record),error:null});
    }
    if(input.action==='insert') {
      const rows=Array.isArray(input.rows)?input.rows:[input.rows];
      if(!rows.length||rows.length>200||rows.some(r=>!r || typeof r!=='object')) throw Error('Dados inválidos');
      const output=[];
      for(const original of rows) {
        const row={...original} as Record<string,unknown>;
        if(table==='app_users') {
          if(!root && row.role==='root') return reply({error:'Sem permissão'},403);
          if(!root) row.peixaria_id=actor.peixaria_id;
        } else if(table==='activity_logs') {row.user_id=user.id;row.user_name=String(actor.name??'Usuário');if(!root) row.peixaria_id=actor.peixaria_id;}
        else if(!root && table!=='peixarias') row.peixaria_id=actor.peixaria_id;
        else if(root && requiredTenant.has(table) && !row.peixaria_id) throw Error('Peixaria obrigatória');
        if(Object.keys(row).some(c=>!allowed.has(c)&&!(table==='app_users'&&c==='role'))) throw Error('Coluna inválida');
        if(table==='app_users' && (!['root','administrador','vendedor'].includes(String(row.role)) || !row.auth_user_id)) throw Error('Usuário inválido');
        if(table==='app_users' && !root && !row.peixaria_id) throw Error('Usuário inválido');
        if(table==='app_users' && row.role!=='root' && !row.peixaria_id) throw Error('Peixaria obrigatória');
        await checkReferences(sql,table,row,actor,root,linked);
        const role=row.role;delete row.role;
        const cols=Object.keys(row), params=Object.values(row);
        if(!cols.length) throw Error('Dados inválidos');
        const statement=`INSERT INTO ${name} AS t (${cols.map(id).join(',')}) VALUES (${cols.map((_,i)=>`$${i+1}`).join(',')}) RETURNING to_jsonb(t) AS record`;
        const created=await sql.query(statement,params);
        let record=created[0].record;
        if(table==='app_users') {
          await sql.query('INSERT INTO public.user_roles (user_id,role) VALUES ($1,$2::public.app_role)',[record.id,role]);
          record={...record,role};
        }
        output.push(record);
      }
      return reply({data:input.returning?(input.single?output[0]:output):null,error:null});
    }
    if(!input.filters.length) throw Error('Filtro obrigatório para alteração');
    if(table==='app_users'&&input.action==='delete') {
      const matches=await sql.query(`SELECT t.id FROM ${name} t${clause}`,values);
      if(matches.some(r=>r.id===actor.id)) return reply({error:'Não é permitido remover seu próprio acesso'},403);
      if(!root) { const roles=await sql.query(`SELECT t.id,r.role FROM ${name} t JOIN public.user_roles r ON r.user_id=t.id${clause}`,values); if(roles.some(r=>r.role==='root')) return reply({error:'Sem permissão'},403); }
    }
    if(input.action==='delete') {
      const deleted=await sql.query(`DELETE FROM ${name} t${clause} RETURNING t.id`,values);
      return reply({data:null,error:null,count:deleted.length});
    }
    if(!input.rows||Array.isArray(input.rows)) throw Error('Dados inválidos');
    const row={...input.rows} as Record<string,unknown>;
    if(!root && row.peixaria_id!==undefined && row.peixaria_id!==actor.peixaria_id) return reply({error:'Sem permissão'},403);
    if(row.peixaria_id!==undefined && table!=='peixarias') { const p=await sql.query('SELECT id FROM public.peixarias WHERE id=$1',[row.peixaria_id]); if(!p.length) throw Error('Peixaria inválida'); }
    if(table==='app_users'&&row.role==='root'&&!root) return reply({error:'Sem permissão'},403);
    if(Object.keys(row).some(c=>!allowed.has(c)&&!(table==='app_users'&&c==='role'))) throw Error('Coluna inválida');
    await checkReferences(sql,table,row,actor,root,linked);
    const newRole=row.role; delete row.role;
    if(!Object.keys(row).length && newRole===undefined) throw Error('Alteração vazia');
    if(table==='app_users' && (row.auth_user_id!==undefined || row.peixaria_id!==undefined || row.id!==undefined)) throw Error('Identidade imutável');
    const matches=await sql.query(`SELECT t.id${table==='app_users'?', (SELECT role FROM public.user_roles WHERE user_id=t.id LIMIT 1) AS role':''} FROM ${name} t${clause} LIMIT 201`,values);
    if(matches.length>200) throw Error('Muitos registros');
    if(table==='app_users'&&matches.some(r=>r.id===actor.id && (row.active===false||newRole!==undefined))) return reply({error:'Não é permitido alterar seu próprio acesso'},403);
    if(table==='app_users'&&!root&&matches.some(r=>r.role==='root')) return reply({error:'Sem permissão'},403);
    if(table==='app_users'&&!root&&newRole==='administrador'&&actor.role!=='administrador') return reply({error:'Sem permissão'},403);
    if(newRole!==undefined && (!['root','administrador','vendedor'].includes(String(newRole)) || table!=='app_users')) throw Error('Perfil inválido');
    const updated=[];
    for(const match of matches) {
      if(Object.keys(row).length) {
        const cols=Object.keys(row),params=Object.values(row);
        const result=await sql.query(`UPDATE ${name} AS t SET ${cols.map((c,i)=>`${id(c)}=$${i+1}`).join(',')} WHERE t.id=$${cols.length+1} RETURNING to_jsonb(t) AS record`,[...params,match.id]);
        updated.push(result[0]?.record);
      }
      if(newRole!==undefined) await sql.query('UPDATE public.user_roles SET role=$1::public.app_role WHERE user_id=$2',[newRole,match.id]);
    }
    return reply({data:null,error:null,count:matches.length});
  } catch(error) {
    console.error('Neon data operation failed',error instanceof Error?error.name:'UnknownError');
    return reply({error:error instanceof Error && ['Coluna inválida','Filtro inválido','Ordenação inválida','Valor inválido','Lista inválida','Dados inválidos','Usuário inválido','Perfil inválido','Identidade imutável','Filtro obrigatório para alteração','Muitos registros','Alteração vazia','Referência de outra peixaria','Peixaria obrigatória','Peixaria inválida'].includes(error.message)?error.message:'Falha ao acessar os dados'},400);
  }
});

async function checkReferences(sql:ReturnType<typeof neon<false,false>>,table:string,row:Record<string,unknown>,actor:{peixaria_id:string|null},root:boolean,refs:Record<string,Array<[string,string]>>) {
  for(const [field,target] of refs[table]??[]) {
    const value=row[field];if(!value) continue;
    const matches=await sql.query(`SELECT ${id(tenantTable(target))} AS tenant FROM public.${id(target)} WHERE id=$1 LIMIT 1`,[value]);
    const targetTenant=matches[0]?.tenant;
    if((!targetTenant && !(target==='app_users' && root)) || (!root && targetTenant!==actor.peixaria_id) || (row.peixaria_id && target!=='peixarias' && target!=='app_users' && targetTenant!==row.peixaria_id) || (target==='peixarias' && row.peixaria_id && value!==row.peixaria_id)) throw Error('Referência de outra peixaria');
  }
}
