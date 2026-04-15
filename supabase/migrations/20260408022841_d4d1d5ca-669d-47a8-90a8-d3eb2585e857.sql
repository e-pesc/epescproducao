
-- Create role enum
CREATE TYPE public.app_role AS ENUM ('vendedor', 'administrador');

-- Create app_users table for system user management
CREATE TABLE public.app_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  cpf TEXT NOT NULL DEFAULT '',
  whatsapp TEXT NOT NULL DEFAULT '',
  role app_role NOT NULL DEFAULT 'vendedor',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.app_users
    WHERE auth_user_id = _user_id
      AND role = _role
      AND active = true
  )
$$;

-- Function to get current user's role
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.app_users
  WHERE auth_user_id = auth.uid()
    AND active = true
  LIMIT 1
$$;

-- Policies: admins can do everything, users can read their own
CREATE POLICY "Admins can view all users"
  ON public.app_users FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'administrador') OR auth_user_id = auth.uid());

CREATE POLICY "Admins can insert users"
  ON public.app_users FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'administrador'));

CREATE POLICY "Admins can update users"
  ON public.app_users FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'administrador'));

CREATE POLICY "Admins can delete users"
  ON public.app_users FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'administrador'));

-- Timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_app_users_updated_at
  BEFORE UPDATE ON public.app_users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
