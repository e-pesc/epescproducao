
CREATE TABLE public.activity_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  user_name text NOT NULL DEFAULT '',
  action text NOT NULL,
  entity text NOT NULL DEFAULT '',
  entity_id text NOT NULL DEFAULT '',
  amount numeric NULL,
  description text NOT NULL DEFAULT '',
  peixaria_id uuid NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_activity_logs_peixaria_created ON public.activity_logs (peixaria_id, created_at DESC);
CREATE INDEX idx_activity_logs_action ON public.activity_logs (action);
CREATE INDEX idx_activity_logs_user ON public.activity_logs (user_id);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Admin e root podem ver logs da sua peixaria
CREATE POLICY "root_all_logs" ON public.activity_logs
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'root'::app_role))
  WITH CHECK (has_role(auth.uid(), 'root'::app_role));

CREATE POLICY "admin_select_logs" ON public.activity_logs
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'administrador'::app_role) AND peixaria_id = get_my_peixaria_id());

-- Todos podem inserir logs na sua peixaria
CREATE POLICY "authenticated_insert_logs" ON public.activity_logs
  FOR INSERT TO authenticated
  WITH CHECK (peixaria_id = get_my_peixaria_id());
