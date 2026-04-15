
-- Add mensalidade field to peixarias
ALTER TABLE public.peixarias ADD COLUMN mensalidade numeric NOT NULL DEFAULT 0;

-- Create table to track monthly payment confirmations
CREATE TABLE public.pagamentos_mensalidade (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  peixaria_id uuid NOT NULL REFERENCES public.peixarias(id) ON DELETE CASCADE,
  mes_referencia text NOT NULL,
  confirmado boolean NOT NULL DEFAULT false,
  confirmado_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(peixaria_id, mes_referencia)
);

ALTER TABLE public.pagamentos_mensalidade ENABLE ROW LEVEL SECURITY;

CREATE POLICY "root_all_pag_mensalidade"
ON public.pagamentos_mensalidade
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'root'::app_role))
WITH CHECK (has_role(auth.uid(), 'root'::app_role));
