
-- Fix pedidos: drop overly permissive vendedor policy, add scoped ones
DROP POLICY IF EXISTS "vendedor_crud_pedidos" ON public.pedidos;

CREATE POLICY "vendedor_select_pedidos" ON public.pedidos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "vendedor_insert_pedidos" ON public.pedidos
  FOR INSERT TO authenticated WITH CHECK (true);

-- Fix itens_pedido: drop overly permissive vendedor policy, add scoped ones
DROP POLICY IF EXISTS "vendedor_crud_itens_pedido" ON public.itens_pedido;

CREATE POLICY "vendedor_select_itens_pedido" ON public.itens_pedido
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "vendedor_insert_itens_pedido" ON public.itens_pedido
  FOR INSERT TO authenticated WITH CHECK (true);
