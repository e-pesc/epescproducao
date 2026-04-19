-- Add cancellation fields to vendas
ALTER TABLE public.vendas
  ADD COLUMN IF NOT EXISTS cancelado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cancelado_motivo text,
  ADD COLUMN IF NOT EXISTS cancelado_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelado_por uuid;

-- Add cancellation fields to pedidos
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS cancelado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cancelado_motivo text,
  ADD COLUMN IF NOT EXISTS cancelado_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelado_por uuid;

-- Add cancellation flag to pagamentos_entrada (so historical rows can be hidden from totals)
ALTER TABLE public.pagamentos_entrada
  ADD COLUMN IF NOT EXISTS cancelado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cancelado_at timestamptz;