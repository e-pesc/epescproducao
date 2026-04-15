-- Add venda_id column to pagamentos_entrada for sale traceability
ALTER TABLE public.pagamentos_entrada
ADD COLUMN venda_id UUID REFERENCES public.vendas(id) ON DELETE SET NULL;