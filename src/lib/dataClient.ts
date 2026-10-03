import { supabase } from '@/integrations/supabase/client';

type Filter = {column:string;op:'eq'|'gte'|'lte'|'in'|'not_null';value?:unknown};
type Query = {table:string;action:'select'|'insert'|'update'|'delete';columns:string;filters:Filter[];rows?:unknown;order?:{column:string;ascending:boolean};limit?:number;single?:boolean;maybeSingle?:boolean;returning?:boolean};

class NeonQuery implements PromiseLike<{data:any;error:any}> {
  private q:Query;
  constructor(table:string) {this.q={table,action:'select',columns:'*',filters:[]};}
  select(columns='*') {this.q.columns=columns;this.q.returning=true;return this;}
  insert(rows:unknown) {this.q.action='insert';this.q.rows=rows;this.q.returning=false;return this;}
  update(rows:unknown) {this.q.action='update';this.q.rows=rows;return this;}
  delete() {this.q.action='delete';return this;}
  eq(column:string,value:unknown) {this.q.filters.push({column,op:'eq',value});return this;}
  gte(column:string,value:unknown) {this.q.filters.push({column,op:'gte',value});return this;}
  lte(column:string,value:unknown) {this.q.filters.push({column,op:'lte',value});return this;}
  in(column:string,value:unknown[]) {this.q.filters.push({column,op:'in',value});return this;}
  not(column:string,operator:string,value:unknown) {if(operator!=='is'||value!==null) throw Error('Filtro não suportado');this.q.filters.push({column,op:'not_null'});return this;}
  order(column:string,options?:{ascending?:boolean}) {this.q.order={column,ascending:options?.ascending??true};return this;}
  limit(limit:number) {this.q.limit=limit;return this;}
  single() {this.q.single=true;return this;}
  maybeSingle() {this.q.maybeSingle=true;return this;}
  async execute() {
    const {data,error}=await supabase.functions.invoke('neon-data',{body:this.q});
    if(error) return {data:null,error};
    return {data:data?.data??null,error:data?.error?new Error(data.error):null};
  }
  then<TResult1 = {data:any;error:any},TResult2 = never>(onfulfilled?:((value:{data:any;error:any})=>TResult1|PromiseLike<TResult1>)|null,onrejected?:((reason:any)=>TResult2|PromiseLike<TResult2>)|null):Promise<TResult1|TResult2> {
    return this.execute().then(onfulfilled,onrejected);
  }
}

// Keep the Cloud client exclusively for login and managed Auth/Function calls.
// Operational tables are accessed only through the authenticated Neon function.
export const dataClient = new Proxy(supabase, {
  get(target,property,receiver) {
    if(property==='from') return (table:string)=>new NeonQuery(table);
    return Reflect.get(target,property,receiver);
  },
}) as typeof supabase;
