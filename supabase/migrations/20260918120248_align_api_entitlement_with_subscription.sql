create or replace function private.can_use_api_import()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select
      p.role = 'admin'
      or (
        p.subscription_plan = 'pro'
        and (
          p.subscription_status in ('active', 'trialing', 'past_due')
          or p.subscription_complimentary
        )
      )
    from public.profiles p
    where p.id = auth.uid()
  ), false);
$$;

revoke all on function private.can_use_api_import() from public, anon, authenticated;
grant execute on function private.can_use_api_import() to authenticated;