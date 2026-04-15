
-- 1. Create peixarias table
CREATE TABLE public.peixarias (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  razao_social TEXT NOT NULL,
  cpf_cnpj TEXT NOT NULL DEFAULT '',
  proprietario TEXT NOT NULL DEFAULT '',
  whatsapp TEXT NOT NULL DEFAULT '',
  endereco TEXT NOT NULL DEFAULT '',
  cidade TEXT NOT NULL DEFAULT '',
  dia_pagamento INTEGER NOT NULL DEFAULT 10,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.peixarias ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_peixarias_updated_at BEFORE UPDATE ON public.peixarias FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Add peixaria_id to all data tables
ALTER TABLE public.app_users ADD COLUMN peixaria_id UUID REFERENCES public.peixarias(id) ON DELETE CASCADE;
ALTER TABLE public.clientes ADD COLUMN peixaria_id UUID REFERENCES public.peixarias(id) ON DELETE CASCADE;
ALTER TABLE public.fornecedores ADD COLUMN peixaria_id UUID REFERENCES public.peixarias(id) ON DELETE CASCADE;
ALTER TABLE public.produtos ADD COLUMN peixaria_id UUID REFERENCES public.peixarias(id) ON DELETE CASCADE;
ALTER TABLE public.pedidos ADD COLUMN peixaria_id UUID REFERENCES public.peixarias(id) ON DELETE CASCADE;
ALTER TABLE public.vendas ADD COLUMN peixaria_id UUID REFERENCES public.peixarias(id) ON DELETE CASCADE;
ALTER TABLE public.itens_venda ADD COLUMN peixaria_id UUID REFERENCES public.peixarias(id) ON DELETE CASCADE;
ALTER TABLE public.itens_pedido ADD COLUMN peixaria_id UUID REFERENCES public.peixarias(id) ON DELETE CASCADE;
ALTER TABLE public.movimentacoes_estoque ADD COLUMN peixaria_id UUID REFERENCES public.peixarias(id) ON DELETE CASCADE;
ALTER TABLE public.pagamentos_entrada ADD COLUMN peixaria_id UUID REFERENCES public.peixarias(id) ON DELETE CASCADE;
ALTER TABLE public.pagamentos_saida ADD COLUMN peixaria_id UUID REFERENCES public.peixarias(id) ON DELETE CASCADE;
ALTER TABLE public.dividas_compra ADD COLUMN peixaria_id UUID REFERENCES public.peixarias(id) ON DELETE CASCADE;

-- 3. Helper functions
CREATE OR REPLACE FUNCTION public.get_my_peixaria_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT peixaria_id FROM public.app_users WHERE auth_user_id = auth.uid() AND active = true LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_my_peixaria_active()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT p.ativo FROM public.peixarias p JOIN public.app_users u ON u.peixaria_id = p.id
     WHERE u.auth_user_id = auth.uid() AND u.active = true LIMIT 1), false)
$$;

-- 4. Update get_my_role (root bypasses peixaria check)
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS app_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.app_users u
  WHERE u.auth_user_id = auth.uid() AND u.active = true
    AND (u.role = 'root' OR u.peixaria_id IS NULL OR EXISTS (SELECT 1 FROM public.peixarias p WHERE p.id = u.peixaria_id AND p.ativo = true))
  LIMIT 1
$$;

-- 5. Update has_role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.app_users u
    WHERE u.auth_user_id = _user_id AND u.role = _role AND u.active = true
      AND (_role = 'root' OR u.peixaria_id IS NULL OR EXISTS (SELECT 1 FROM public.peixarias p WHERE p.id = u.peixaria_id AND p.ativo = true))
  )
$$;

-- 6. Drop ALL existing RLS policies
DROP POLICY IF EXISTS "Admins can delete users" ON public.app_users;
DROP POLICY IF EXISTS "Admins can insert users" ON public.app_users;
DROP POLICY IF EXISTS "Admins can update users" ON public.app_users;
DROP POLICY IF EXISTS "Admins can view all users" ON public.app_users;
DROP POLICY IF EXISTS "admin_all_clientes" ON public.clientes;
DROP POLICY IF EXISTS "vendedor_select_clientes" ON public.clientes;
DROP POLICY IF EXISTS "vendedor_update_clientes" ON public.clientes;
DROP POLICY IF EXISTS "admin_all_fornecedores" ON public.fornecedores;
DROP POLICY IF EXISTS "vendedor_select_fornecedores" ON public.fornecedores;
DROP POLICY IF EXISTS "admin_all_produtos" ON public.produtos;
DROP POLICY IF EXISTS "vendedor_select_produtos" ON public.produtos;
DROP POLICY IF EXISTS "admin_all_pedidos" ON public.pedidos;
DROP POLICY IF EXISTS "vendedor_insert_pedidos" ON public.pedidos;
DROP POLICY IF EXISTS "vendedor_select_pedidos" ON public.pedidos;
DROP POLICY IF EXISTS "vendedor_update_pedidos" ON public.pedidos;
DROP POLICY IF EXISTS "admin_all_vendas" ON public.vendas;
DROP POLICY IF EXISTS "vendedor_insert_vendas" ON public.vendas;
DROP POLICY IF EXISTS "vendedor_select_vendas" ON public.vendas;
DROP POLICY IF EXISTS "admin_all_itens_venda" ON public.itens_venda;
DROP POLICY IF EXISTS "vendedor_insert_itens_venda" ON public.itens_venda;
DROP POLICY IF EXISTS "vendedor_select_itens_venda" ON public.itens_venda;
DROP POLICY IF EXISTS "admin_all_itens_pedido" ON public.itens_pedido;
DROP POLICY IF EXISTS "vendedor_insert_itens_pedido" ON public.itens_pedido;
DROP POLICY IF EXISTS "vendedor_select_itens_pedido" ON public.itens_pedido;
DROP POLICY IF EXISTS "admin_all_movimentacoes" ON public.movimentacoes_estoque;
DROP POLICY IF EXISTS "vendedor_select_movimentacoes" ON public.movimentacoes_estoque;
DROP POLICY IF EXISTS "admin_all_pag_entrada" ON public.pagamentos_entrada;
DROP POLICY IF EXISTS "vendedor_insert_pag_entrada" ON public.pagamentos_entrada;
DROP POLICY IF EXISTS "vendedor_select_pag_entrada" ON public.pagamentos_entrada;
DROP POLICY IF EXISTS "admin_all_pag_saida" ON public.pagamentos_saida;
DROP POLICY IF EXISTS "vendedor_insert_pag_saida" ON public.pagamentos_saida;
DROP POLICY IF EXISTS "vendedor_select_pag_saida" ON public.pagamentos_saida;
DROP POLICY IF EXISTS "admin_all_dividas" ON public.dividas_compra;
DROP POLICY IF EXISTS "vendedor_insert_dividas" ON public.dividas_compra;
DROP POLICY IF EXISTS "vendedor_select_dividas" ON public.dividas_compra;
DROP POLICY IF EXISTS "vendedor_update_dividas" ON public.dividas_compra;

-- 7. New RLS policies with peixaria_id isolation

-- peixarias
CREATE POLICY "root_all_peixarias" ON public.peixarias FOR ALL TO authenticated USING (has_role(auth.uid(), 'root')) WITH CHECK (has_role(auth.uid(), 'root'));
CREATE POLICY "tenant_select_own" ON public.peixarias FOR SELECT TO authenticated USING (id = get_my_peixaria_id());

-- app_users
CREATE POLICY "root_all_users" ON public.app_users FOR ALL TO authenticated USING (has_role(auth.uid(), 'root')) WITH CHECK (has_role(auth.uid(), 'root'));
CREATE POLICY "admin_manage_peixaria_users" ON public.app_users FOR ALL TO authenticated USING (has_role(auth.uid(), 'administrador') AND peixaria_id = get_my_peixaria_id()) WITH CHECK (has_role(auth.uid(), 'administrador') AND peixaria_id = get_my_peixaria_id());
CREATE POLICY "user_select_self" ON public.app_users FOR SELECT TO authenticated USING (auth_user_id = auth.uid());

-- clientes
CREATE POLICY "root_all_clientes" ON public.clientes FOR ALL TO authenticated USING (has_role(auth.uid(), 'root')) WITH CHECK (has_role(auth.uid(), 'root'));
CREATE POLICY "admin_all_clientes" ON public.clientes FOR ALL TO authenticated USING (has_role(auth.uid(), 'administrador') AND peixaria_id = get_my_peixaria_id()) WITH CHECK (has_role(auth.uid(), 'administrador') AND peixaria_id = get_my_peixaria_id());
CREATE POLICY "vendedor_select_clientes" ON public.clientes FOR SELECT TO authenticated USING (peixaria_id = get_my_peixaria_id());
CREATE POLICY "vendedor_update_clientes" ON public.clientes FOR UPDATE TO authenticated USING (peixaria_id = get_my_peixaria_id()) WITH CHECK (peixaria_id = get_my_peixaria_id());

-- fornecedores
CREATE POLICY "root_all_fornecedores" ON public.fornecedores FOR ALL TO authenticated USING (has_role(auth.uid(), 'root')) WITH CHECK (has_role(auth.uid(), 'root'));
CREATE POLICY "admin_all_fornecedores" ON public.fornecedores FOR ALL TO authenticated USING (has_role(auth.uid(), 'administrador') AND peixaria_id = get_my_peixaria_id()) WITH CHECK (has_role(auth.uid(), 'administrador') AND peixaria_id = get_my_peixaria_id());
CREATE POLICY "vendedor_select_fornecedores" ON public.fornecedores FOR SELECT TO authenticated USING (peixaria_id = get_my_peixaria_id());

-- produtos
CREATE POLICY "root_all_produtos" ON public.produtos FOR ALL TO authenticated USING (has_role(auth.uid(), 'root')) WITH CHECK (has_role(auth.uid(), 'root'));
CREATE POLICY "admin_all_produtos" ON public.produtos FOR ALL TO authenticated USING (has_role(auth.uid(), 'administrador') AND peixaria_id = get_my_peixaria_id()) WITH CHECK (has_role(auth.uid(), 'administrador') AND peixaria_id = get_my_peixaria_id());
CREATE POLICY "vendedor_select_produtos" ON public.produtos FOR SELECT TO authenticated USING (peixaria_id = get_my_peixaria_id());

-- pedidos
CREATE POLICY "root_all_pedidos" ON public.pedidos FOR ALL TO authenticated USING (has_role(auth.uid(), 'root')) WITH CHECK (has_role(auth.uid(), 'root'));
CREATE POLICY "admin_all_pedidos" ON public.pedidos FOR ALL TO authenticated USING (has_role(auth.uid(), 'administrador') AND peixaria_id = get_my_peixaria_id()) WITH CHECK (has_role(auth.uid(), 'administrador') AND peixaria_id = get_my_peixaria_id());
CREATE POLICY "vendedor_select_pedidos" ON public.pedidos FOR SELECT TO authenticated USING (peixaria_id = get_my_peixaria_id());
CREATE POLICY "vendedor_insert_pedidos" ON public.pedidos FOR INSERT TO authenticated WITH CHECK (peixaria_id = get_my_peixaria_id());
CREATE POLICY "vendedor_update_pedidos" ON public.pedidos FOR UPDATE TO authenticated USING (peixaria_id = get_my_peixaria_id()) WITH CHECK (peixaria_id = get_my_peixaria_id());

-- vendas
CREATE POLICY "root_all_vendas" ON public.vendas FOR ALL TO authenticated USING (has_role(auth.uid(), 'root')) WITH CHECK (has_role(auth.uid(), 'root'));
CREATE POLICY "admin_all_vendas" ON public.vendas FOR ALL TO authenticated USING (has_role(auth.uid(), 'administrador') AND peixaria_id = get_my_peixaria_id()) WITH CHECK (has_role(auth.uid(), 'administrador') AND peixaria_id = get_my_peixaria_id());
CREATE POLICY "vendedor_select_vendas" ON public.vendas FOR SELECT TO authenticated USING (peixaria_id = get_my_peixaria_id());
CREATE POLICY "vendedor_insert_vendas" ON public.vendas FOR INSERT TO authenticated WITH CHECK (peixaria_id = get_my_peixaria_id());

-- itens_venda
CREATE POLICY "root_all_itens_venda" ON public.itens_venda FOR ALL TO authenticated USING (has_role(auth.uid(), 'root')) WITH CHECK (has_role(auth.uid(), 'root'));
CREATE POLICY "admin_all_itens_venda" ON public.itens_venda FOR ALL TO authenticated USING (has_role(auth.uid(), 'administrador') AND peixaria_id = get_my_peixaria_id()) WITH CHECK (has_role(auth.uid(), 'administrador') AND peixaria_id = get_my_peixaria_id());
CREATE POLICY "vendedor_select_itens_venda" ON public.itens_venda FOR SELECT TO authenticated USING (peixaria_id = get_my_peixaria_id());
CREATE POLICY "vendedor_insert_itens_venda" ON public.itens_venda FOR INSERT TO authenticated WITH CHECK (peixaria_id = get_my_peixaria_id());

-- itens_pedido
CREATE POLICY "root_all_itens_pedido" ON public.itens_pedido FOR ALL TO authenticated USING (has_role(auth.uid(), 'root')) WITH CHECK (has_role(auth.uid(), 'root'));
CREATE POLICY "admin_all_itens_pedido" ON public.itens_pedido FOR ALL TO authenticated USING (has_role(auth.uid(), 'administrador') AND peixaria_id = get_my_peixaria_id()) WITH CHECK (has_role(auth.uid(), 'administrador') AND peixaria_id = get_my_peixaria_id());
CREATE POLICY "vendedor_select_itens_pedido" ON public.itens_pedido FOR SELECT TO authenticated USING (peixaria_id = get_my_peixaria_id());
CREATE POLICY "vendedor_insert_itens_pedido" ON public.itens_pedido FOR INSERT TO authenticated WITH CHECK (peixaria_id = get_my_peixaria_id());

-- movimentacoes_estoque
CREATE POLICY "root_all_movimentacoes" ON public.movimentacoes_estoque FOR ALL TO authenticated USING (has_role(auth.uid(), 'root')) WITH CHECK (has_role(auth.uid(), 'root'));
CREATE POLICY "admin_all_movimentacoes" ON public.movimentacoes_estoque FOR ALL TO authenticated USING (has_role(auth.uid(), 'administrador') AND peixaria_id = get_my_peixaria_id()) WITH CHECK (has_role(auth.uid(), 'administrador') AND peixaria_id = get_my_peixaria_id());
CREATE POLICY "vendedor_select_movimentacoes" ON public.movimentacoes_estoque FOR SELECT TO authenticated USING (peixaria_id = get_my_peixaria_id());
CREATE POLICY "vendedor_insert_movimentacoes" ON public.movimentacoes_estoque FOR INSERT TO authenticated WITH CHECK (peixaria_id = get_my_peixaria_id());

-- pagamentos_entrada
CREATE POLICY "root_all_pag_entrada" ON public.pagamentos_entrada FOR ALL TO authenticated USING (has_role(auth.uid(), 'root')) WITH CHECK (has_role(auth.uid(), 'root'));
CREATE POLICY "admin_all_pag_entrada" ON public.pagamentos_entrada FOR ALL TO authenticated USING (has_role(auth.uid(), 'administrador') AND peixaria_id = get_my_peixaria_id()) WITH CHECK (has_role(auth.uid(), 'administrador') AND peixaria_id = get_my_peixaria_id());
CREATE POLICY "vendedor_select_pag_entrada" ON public.pagamentos_entrada FOR SELECT TO authenticated USING (peixaria_id = get_my_peixaria_id());
CREATE POLICY "vendedor_insert_pag_entrada" ON public.pagamentos_entrada FOR INSERT TO authenticated WITH CHECK (peixaria_id = get_my_peixaria_id());

-- pagamentos_saida
CREATE POLICY "root_all_pag_saida" ON public.pagamentos_saida FOR ALL TO authenticated USING (has_role(auth.uid(), 'root')) WITH CHECK (has_role(auth.uid(), 'root'));
CREATE POLICY "admin_all_pag_saida" ON public.pagamentos_saida FOR ALL TO authenticated USING (has_role(auth.uid(), 'administrador') AND peixaria_id = get_my_peixaria_id()) WITH CHECK (has_role(auth.uid(), 'administrador') AND peixaria_id = get_my_peixaria_id());
CREATE POLICY "vendedor_select_pag_saida" ON public.pagamentos_saida FOR SELECT TO authenticated USING (peixaria_id = get_my_peixaria_id());
CREATE POLICY "vendedor_insert_pag_saida" ON public.pagamentos_saida FOR INSERT TO authenticated WITH CHECK (peixaria_id = get_my_peixaria_id());

-- dividas_compra
CREATE POLICY "root_all_dividas" ON public.dividas_compra FOR ALL TO authenticated USING (has_role(auth.uid(), 'root')) WITH CHECK (has_role(auth.uid(), 'root'));
CREATE POLICY "admin_all_dividas" ON public.dividas_compra FOR ALL TO authenticated USING (has_role(auth.uid(), 'administrador') AND peixaria_id = get_my_peixaria_id()) WITH CHECK (has_role(auth.uid(), 'administrador') AND peixaria_id = get_my_peixaria_id());
CREATE POLICY "vendedor_select_dividas" ON public.dividas_compra FOR SELECT TO authenticated USING (peixaria_id = get_my_peixaria_id());
CREATE POLICY "vendedor_insert_dividas" ON public.dividas_compra FOR INSERT TO authenticated WITH CHECK (peixaria_id = get_my_peixaria_id());
CREATE POLICY "vendedor_update_dividas" ON public.dividas_compra FOR UPDATE TO authenticated USING (peixaria_id = get_my_peixaria_id()) WITH CHECK (peixaria_id = get_my_peixaria_id());
