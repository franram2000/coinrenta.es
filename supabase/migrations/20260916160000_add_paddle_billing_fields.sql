-- Paddle Billing fields kept alongside the existing Stripe fields during migration.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS paddle_customer_id text,
  ADD COLUMN IF NOT EXISTS paddle_subscription_id text,
  ADD COLUMN IF NOT EXISTS paddle_transaction_id text;

CREATE INDEX IF NOT EXISTS profiles_paddle_customer_id_idx
  ON public.profiles (paddle_customer_id)
  WHERE paddle_customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS profiles_paddle_subscription_id_idx
  ON public.profiles (paddle_subscription_id)
  WHERE paddle_subscription_id IS NOT NULL;
