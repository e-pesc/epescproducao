
-- =============================================
-- TABLES
-- =============================================

-- Clientes
CREATE TABLE public.clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  cpf_cnpj text NOT NULL DEFAULT '',
  whatsapp text NOT NULL DEFAULT '',
  endereco text NOT NULL DEFAULT '',
  cidade text NOT NULL DEFAULT '',
  ativo boolean NOT NULL DEFAULT true,
  debito numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Fornecedores
CREATE TABLE public.fornecedores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  cpf_cnpj text NOT NULL DEFAULT '',
  whatsapp text NOT NULL DEFAULT '',
  endereco text NOT NULL DEFAULT '',
  cidade text NOT NULL DEFAULT '',
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Produtos
CREATE TYPE public.produto_tipo AS ENUM ('inteiro', 'tratado');

CREATE TABLE public.produtos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku text NOT NULL UNIQUE,
  nome text NOT NULL,
  tipo produto_tipo NOT NULL DEFAULT 'inteiro',
  linked_sku text,
  estoque_kg numeric(12,3) NOT NULL DEFAULT 0,
  preco_compra numeric(12,2) NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Movimentações de Estoque
CREATE TYPE public.movimento_tipo AS ENUM ('perda', 'quebra', 'outros', 'processamento', 'venda');

CREATE TABLE public.movimentacoes_estoque (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id uuid NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  tipo movimento_tipo NOT NULL,
  kg numeric(12,3) NOT NULL,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Pedidos
CREATE TYPE public.pedido_status AS ENUM ('pendente', 'atendido');
CREATE TYPE public.pagamento_tipo AS ENUM ('avista', 'prazo');
CREATE TYPE public.prepaid_method AS ENUM ('pix', 'cartao', 'dinheiro');

CREATE TABLE public.pedidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero serial,
  cliente_id uuid NOT NULL REFERENCES public.clientes(id),
  status pedido_status NOT NULL DEFAULT 'pendente',
  pagamento pagamento_tipo,
  entrada numeric(12,2),
  prepaid boolean NOT NULL DEFAULT false,
  prepaid_method prepaid_method,
  valor_total numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  fulfilled_at timestamptz
);

-- Itens do Pedido
CREATE TABLE public.itens_pedido (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  produto_id uuid NOT NULL REFERENCES public.produtos(id),
  kg numeric(12,3) NOT NULL,
  preco_kg numeric(12,2) NOT NULL
);

-- Vendas (diretas no PDV)
CREATE TABLE public.vendas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid REFERENCES public.clientes(id),
  vendedor_id uuid REFERENCES auth.users(id),
  produto_id uuid NOT NULL REFERENCES public.produtos(id),
  kg numeric(12,3) NOT NULL,
  preco_kg numeric(12,2) NOT NULL,
  valor_total numeric(12,2) NOT NULL,
  forma_pagamento pagamento_tipo NOT NULL DEFAULT 'avista',
  entrada numeric(12,2),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Dívidas de Compra (A Pagar)
CREATE TABLE public.dividas_compra (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fornecedor_id uuid NOT NULL REFERENCES public.fornecedores(id),
  produto_id uuid NOT NULL REFERENCES public.produtos(id),
  kg numeric(12,3) NOT NULL,
  preco_kg numeric(12,2) NOT NULL,
  valor_total numeric(12,2) NOT NULL,
  valor_pago numeric(12,2) NOT NULL DEFAULT 0,
  quitado boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Pagamentos de Saída
CREATE TABLE public.pagamentos_saida (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  divida_id uuid REFERENCES public.dividas_compra(id),
  fornecedor_id uuid NOT NULL REFERENCES public.fornecedores(id),
  valor numeric(12,2) NOT NULL,
  tipo text NOT NULL DEFAULT 'total',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Pagamentos de Entrada
CREATE TABLE public.pagamentos_entrada (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid REFERENCES public.clientes(id),
  origem text NOT NULL DEFAULT 'venda',
  pedido_id uuid REFERENCES public.pedidos(id),
  produto_id uuid REFERENCES public.produtos(id),
  kg numeric(12,3),
  valor numeric(12,2) NOT NULL,
  tipo text NOT NULL DEFAULT 'total',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =============================================
-- UPDATED_AT TRIGGERS
-- =============================================
CREATE TRIGGER set_updated_at_clientes BEFORE UPDATE ON public.clientes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_updated_at_fornecedores BEFORE UPDATE ON public.fornecedores FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_updated_at_produtos BEFORE UPDATE ON public.produtos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- STOCK DEDUCTION TRIGGER (on venda insert)
-- =============================================
CREATE OR REPLACE FUNCTION public.deduct_stock_on_sale()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.produtos
  SET estoque_kg = estoque_kg - NEW.kg
  WHERE id = NEW.produto_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_deduct_stock_sale
AFTER INSERT ON public.vendas
FOR EACH ROW EXECUTE FUNCTION public.deduct_stock_on_sale();

-- Stock deduction for fulfilled orders (triggered by status change)
CREATE OR REPLACE FUNCTION public.deduct_stock_on_order_fulfill()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status = 'pendente' AND NEW.status = 'atendido' THEN
    UPDATE public.produtos p
    SET estoque_kg = p.estoque_kg - ip.kg
    FROM public.itens_pedido ip
    WHERE ip.pedido_id = NEW.id AND p.id = ip.produto_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_deduct_stock_order_fulfill
AFTER UPDATE ON public.pedidos
FOR EACH ROW EXECUTE FUNCTION public.deduct_stock_on_order_fulfill();

-- =============================================
-- RLS
-- =============================================
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fornecedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimentacoes_estoque ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itens_pedido ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dividas_compra ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagamentos_saida ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagamentos_entrada ENABLE ROW LEVEL SECURITY;

-- Admin full access policies (using existing has_role function)
-- Clientes
CREATE POLICY "admin_all_clientes" ON public.clientes FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'administrador')) WITH CHECK (public.has_role(auth.uid(), 'administrador'));
CREATE POLICY "vendedor_select_clientes" ON public.clientes FOR SELECT TO authenticated USING (true);

-- Fornecedores
CREATE POLICY "admin_all_fornecedores" ON public.fornecedores FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'administrador')) WITH CHECK (public.has_role(auth.uid(), 'administrador'));
CREATE POLICY "vendedor_select_fornecedores" ON public.fornecedores FOR SELECT TO authenticated USING (true);

-- Produtos
CREATE POLICY "admin_all_produtos" ON public.produtos FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'administrador')) WITH CHECK (public.has_role(auth.uid(), 'administrador'));
CREATE POLICY "vendedor_select_produtos" ON public.produtos FOR SELECT TO authenticated USING (true);

-- Movimentações
CREATE POLICY "admin_all_movimentacoes" ON public.movimentacoes_estoque FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'administrador')) WITH CHECK (public.has_role(auth.uid(), 'administrador'));
CREATE POLICY "vendedor_select_movimentacoes" ON public.movimentacoes_estoque FOR SELECT TO authenticated USING (true);

-- Pedidos
CREATE POLICY "admin_all_pedidos" ON public.pedidos FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'administrador')) WITH CHECK (public.has_role(auth.uid(), 'administrador'));
CREATE POLICY "vendedor_crud_pedidos" ON public.pedidos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Itens Pedido
CREATE POLICY "admin_all_itens_pedido" ON public.itens_pedido FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'administrador')) WITH CHECK (public.has_role(auth.uid(), 'administrador'));
CREATE POLICY "vendedor_crud_itens_pedido" ON public.itens_pedido FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Vendas
CREATE POLICY "admin_all_vendas" ON public.vendas FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'administrador')) WITH CHECK (public.has_role(auth.uid(), 'administrador'));
CREATE POLICY "vendedor_insert_vendas" ON public.vendas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "vendedor_select_vendas" ON public.vendas FOR SELECT TO authenticated USING (true);

-- Dívidas Compra
CREATE POLICY "admin_all_dividas" ON public.dividas_compra FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'administrador')) WITH CHECK (public.has_role(auth.uid(), 'administrador'));
CREATE POLICY "vendedor_select_dividas" ON public.dividas_compra FOR SELECT TO authenticated USING (true);

-- Pagamentos Saída
CREATE POLICY "admin_all_pag_saida" ON public.pagamentos_saida FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'administrador')) WITH CHECK (public.has_role(auth.uid(), 'administrador'));
CREATE POLICY "vendedor_select_pag_saida" ON public.pagamentos_saida FOR SELECT TO authenticated USING (true);

-- Pagamentos Entrada
CREATE POLICY "admin_all_pag_entrada" ON public.pagamentos_entrada FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'administrador')) WITH CHECK (public.has_role(auth.uid(), 'administrador'));
CREATE POLICY "vendedor_insert_pag_entrada" ON public.pagamentos_entrada FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "vendedor_select_pag_entrada" ON public.pagamentos_entrada FOR SELECT TO authenticated USING (true);

-- Enable realtime for key tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.clientes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.fornecedores;
ALTER PUBLICATION supabase_realtime ADD TABLE public.produtos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pedidos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.vendas;
