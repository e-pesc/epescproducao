-- Initial isolated connection test on Neon. The application's existing data stays in Lovable Cloud.
CREATE TABLE IF NOT EXISTS public.conexao_teste (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);