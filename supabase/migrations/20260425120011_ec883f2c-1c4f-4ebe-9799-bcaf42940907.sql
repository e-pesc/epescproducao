-- 1) Peixarias: adicionar campos para plano gratuito e desconto único do mês
ALTER TABLE public.peixarias
  ADD COLUMN IF NOT EXISTS plano_gratuito boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS desconto_mensalidade numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS desconto_mes_referencia text;

-- 2) pagamentos_saida: campos de cancelamento (cancelado_motivo + cancelado_por)
ALTER TABLE public.pagamentos_saida
  ADD COLUMN IF NOT EXISTS cancelado_motivo text,
  ADD COLUMN IF NOT EXISTS cancelado_por uuid;

-- 3) pagamentos_entrada: campos de cancelamento (motivo + por)
ALTER TABLE public.pagamentos_entrada
  ADD COLUMN IF NOT EXISTS cancelado_motivo text,
  ADD COLUMN IF NOT EXISTS cancelado_por uuid;