-- Allow vendedores to update clientes (needed for debt management)
CREATE POLICY "vendedor_update_clientes"
ON public.clientes
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Allow vendedores to update pedidos (needed for fulfillment)
CREATE POLICY "vendedor_update_pedidos"
ON public.pedidos
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Allow vendedores to insert pagamentos_saida
CREATE POLICY "vendedor_insert_pag_saida"
ON public.pagamentos_saida
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow vendedores to update dividas_compra (needed for paying debts)
CREATE POLICY "vendedor_update_dividas"
ON public.dividas_compra
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Allow vendedores to insert dividas_compra
CREATE POLICY "vendedor_insert_dividas"
ON public.dividas_compra
FOR INSERT
TO authenticated
WITH CHECK (true);