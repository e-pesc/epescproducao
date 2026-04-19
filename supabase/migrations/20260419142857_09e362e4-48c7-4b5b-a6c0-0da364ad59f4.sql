-- Allow despesas avulsas (no supplier) and add description/recurrence metadata
ALTER TABLE public.dividas_compra ALTER COLUMN fornecedor_id DROP NOT NULL;
ALTER TABLE public.dividas_compra ALTER COLUMN produto_id DROP NOT NULL;
ALTER TABLE public.dividas_compra ALTER COLUMN kg DROP NOT NULL;
ALTER TABLE public.dividas_compra ALTER COLUMN preco_kg DROP NOT NULL;
ALTER TABLE public.dividas_compra ADD COLUMN IF NOT EXISTS descricao text;
ALTER TABLE public.dividas_compra ADD COLUMN IF NOT EXISTS recorrente boolean NOT NULL DEFAULT false;
ALTER TABLE public.dividas_compra ADD COLUMN IF NOT EXISTS mes_referencia text;
ALTER TABLE public.dividas_compra ADD COLUMN IF NOT EXISTS vencimento date;

ALTER TABLE public.pagamentos_saida ALTER COLUMN fornecedor_id DROP NOT NULL;
ALTER TABLE public.pagamentos_saida ADD COLUMN IF NOT EXISTS descricao text;

-- Track Root user that closed the deal for a peixaria
ALTER TABLE public.peixarias ADD COLUMN IF NOT EXISTS vendedor_root_id uuid REFERENCES public.app_users(id) ON DELETE SET NULL;