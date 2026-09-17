CREATE TABLE IF NOT EXISTS public.paddle_webhook_events (
  event_id text PRIMARY KEY,
  event_type text NOT NULL,
  notification_id text,
  subscription_id text,
  occurred_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing','processed','failed','ignored')),
  processed_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS paddle_webhook_events_subscription_idx
  ON public.paddle_webhook_events (subscription_id, occurred_at DESC)
  WHERE subscription_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS paddle_webhook_events_occurred_at_idx
  ON public.paddle_webhook_events (occurred_at DESC);

ALTER TABLE public.paddle_webhook_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.paddle_webhook_events FROM anon, authenticated;
