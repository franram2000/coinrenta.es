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
      or p.role = 'pro'
      or (
        p.subscription_plan = 'pro'
        and p.subscription_status in ('active', 'trialing', 'past_due')
      )
    from public.profiles p
    where p.id = auth.uid()
  ), false);
$$;

revoke all on function private.can_use_api_import() from public, anon, authenticated;
grant execute on function private.can_use_api_import() to authenticated;

drop policy if exists connections_self on public.exchange_connections;
create policy connections_self
on public.exchange_connections
for all
to authenticated
using (user_id = (select auth.uid()))
with check (
  user_id = (select auth.uid())
  and (
    coalesce(provider_type, 'api') <> 'api'
    or private.can_use_api_import()
  )
);

drop policy if exists imports_self on public.imports;
create policy imports_self
on public.imports
for all
to authenticated
using (user_id = (select auth.uid()))
with check (
  user_id = (select auth.uid())
  and (
    source_type <> 'api'
    or private.can_use_api_import()
  )
);

drop policy if exists transactions_self on public.transactions;
create policy transactions_self
on public.transactions
for all
to authenticated
using (user_id = (select auth.uid()))
with check (
  user_id = (select auth.uid())
  and (
    source <> 'api'
    or private.can_use_api_import()
  )
);

drop policy if exists snapshots_self on public.balance_snapshots;
create policy snapshots_self
on public.balance_snapshots
for all
to authenticated
using (user_id = (select auth.uid()))
with check (
  user_id = (select auth.uid())
  and (
    source <> 'api'
    or private.can_use_api_import()
  )
);

create or replace function public.store_exchange_api_key(p_connection_id uuid, p_api_key text)
returns uuid
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_user uuid := auth.uid();
  v_secret_id uuid;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if not private.can_use_api_import() then raise exception 'La importación por API requiere un plan Pro o una cuenta Admin.' using errcode = '42501'; end if;
  if not exists (select 1 from public.exchange_connections where id=p_connection_id and user_id=v_user) then raise exception 'Connection not found'; end if;
  if coalesce(trim(p_api_key),'')='' then raise exception 'API key is required'; end if;

  v_secret_id := vault.create_secret(
    trim(p_api_key),
    'coinrenta-bitpanda-'||p_connection_id::text,
    'Bitpanda read-only API key for CoinRenta'
  );

  insert into public.exchange_connection_secrets(connection_id,user_id,secret_id)
  values(p_connection_id,v_user,v_secret_id)
  on conflict(connection_id) do update set secret_id=excluded.secret_id,created_at=now();

  update public.exchange_connections
  set api_secret_id=v_secret_id,status='active',last_sync_status=null,last_sync_error=null,updated_at=now()
  where id=p_connection_id and user_id=v_user;

  return v_secret_id;
end;
$$;

create or replace function public.get_exchange_api_key(p_connection_id uuid)
returns text
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_user uuid := auth.uid();
  v_secret_id uuid;
  v_secret text;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if not private.can_use_api_import() then raise exception 'La importación por API requiere un plan Pro o una cuenta Admin.' using errcode = '42501'; end if;

  select api_secret_id
  into v_secret_id
  from public.exchange_connections
  where id=p_connection_id and user_id=v_user;

  if v_secret_id is null then return null; end if;

  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where id=v_secret_id;

  return v_secret;
end;
$$;

revoke execute on function public.get_exchange_api_key(uuid) from public, anon, authenticated;
revoke execute on function public.store_exchange_api_key(uuid,text) from public, anon, authenticated;
grant execute on function public.get_exchange_api_key(uuid) to authenticated;
grant execute on function public.store_exchange_api_key(uuid,text) to authenticated;
