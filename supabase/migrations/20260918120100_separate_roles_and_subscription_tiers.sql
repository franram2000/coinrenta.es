alter table public.profiles
  add column if not exists subscription_complimentary boolean not null default false;

update public.profiles
set
  subscription_plan = case when role = 'pro' and coalesce(subscription_plan, 'free') = 'free' then 'pro' else subscription_plan end,
  subscription_status = case when role = 'pro' and coalesce(subscription_plan, 'free') = 'free' then 'active' else subscription_status end,
  subscription_complimentary = case when role = 'pro' then true else subscription_complimentary end
where role in ('free', 'pro');

alter table public.profiles
  drop constraint if exists profiles_role_check;

update public.profiles
set role = case when role = 'admin' then 'admin' else 'user' end;

alter table public.profiles
  alter column role set default 'user';

alter table public.profiles
  add constraint profiles_role_check check (role = any (array['user'::text, 'admin'::text]));