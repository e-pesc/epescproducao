
ALTER TABLE public.produtos DROP CONSTRAINT IF EXISTS produtos_sku_key;
CREATE UNIQUE INDEX produtos_sku_peixaria_unique ON public.produtos (sku, peixaria_id);
