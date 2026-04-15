
-- 1. Create itens_venda table
CREATE TABLE public.itens_venda (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  venda_id UUID NOT NULL REFERENCES public.vendas(id) ON DELETE CASCADE,
  produto_id UUID NOT NULL REFERENCES public.produtos(id),
  kg NUMERIC NOT NULL,
  preco_kg NUMERIC NOT NULL
);

-- 2. Enable RLS
ALTER TABLE public.itens_venda ENABLE ROW LEVEL SECURITY;

-- 3. RLS policies
CREATE POLICY "admin_all_itens_venda"
ON public.itens_venda FOR ALL TO authenticated
USING (has_role(auth.uid(), 'administrador'::app_role))
WITH CHECK (has_role(auth.uid(), 'administrador'::app_role));

CREATE POLICY "vendedor_select_itens_venda"
ON public.itens_venda FOR SELECT TO authenticated
USING (true);

CREATE POLICY "vendedor_insert_itens_venda"
ON public.itens_venda FOR INSERT TO authenticated
WITH CHECK (true);

-- 4. Replace the stock deduction trigger to work on itens_venda instead of vendas
DROP TRIGGER IF EXISTS deduct_stock_on_sale ON public.vendas;

CREATE OR REPLACE FUNCTION public.deduct_stock_on_sale_item()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.produtos
  SET estoque_kg = estoque_kg - NEW.kg
  WHERE id = NEW.produto_id;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER deduct_stock_on_sale_item
AFTER INSERT ON public.itens_venda
FOR EACH ROW
EXECUTE FUNCTION public.deduct_stock_on_sale_item();
