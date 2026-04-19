ALTER TABLE public.dividas_compra
  ADD COLUMN IF NOT EXISTS cancelado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cancelado_motivo text,
  ADD COLUMN IF NOT EXISTS cancelado_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelado_por uuid;

ALTER TABLE public.pagamentos_saida
  ADD COLUMN IF NOT EXISTS cancelado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cancelado_at timestamptz;