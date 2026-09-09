alter table public.exchange_connections add column if not exists api_secret_id uuid;
alter table public.exchange_connections add column if not exists provider_type text not null default 'api';

create table if not exists public.exchange_connection_secrets (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null unique references public.exchange_connections(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  secret_id uuid not null,
  created_at timestamptz not null default now()
);

alter table public.exchange_connection_secrets enable row level security;
create policy "Users can view own exchange connection secret metadata" on public.exchange_connection_secrets for select to authenticated using (auth.uid() = user_id);
create policy "Users can insert own exchange connection secret metadata" on public.exchange_connection_secrets for insert to authenticated with check (auth.uid() = user_id);
create policy "Users can delete own exchange connection secret metadata" on public.exchange_connection_secrets for delete to authenticated using (auth.uid() = user_id);

create or replace function public.store_exchange_api_key(p_connection_id uuid, p_api_key text)
returns uuid language plpgsql security definer set search_path = public, vault as $$
declare v_user uuid := auth.uid(); v_secret_id uuid;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if not exists (select 1 from public.exchange_connections where id=p_connection_id and user_id=v_user) then raise exception 'Connection not found'; end if;
  if coalesce(trim(p_api_key),'')='' then raise exception 'API key is required'; end if;
  v_secret_id := vault.create_secret(trim(p_api_key),'coinrenta-bitpanda-'||p_connection_id::text,'Bitpanda read-only API key for CoinRenta');
  insert into public.exchange_connection_secrets(connection_id,user_id,secret_id) values(p_connection_id,v_user,v_secret_id)
    on conflict(connection_id) do update set secret_id=excluded.secret_id,created_at=now();
  update public.exchange_connections set api_secret_id=v_secret_id,status='connected',last_sync_status='credentials_saved',last_sync_error=null,updated_at=now() where id=p_connection_id and user_id=v_user;
  return v_secret_id;
end; $$;

create or replace function public.get_exchange_api_key(p_connection_id uuid)
returns text language plpgsql security definer set search_path = public, vault as $$
declare v_secret_id uuid; v_secret text;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select api_secret_id into v_secret_id from public.exchange_connections where id=p_connection_id and user_id=auth.uid();
  if v_secret_id is null then return null; end if;
  select decrypted_secret into v_secret from vault.decrypted_secrets where id=v_secret_id;
  return v_secret;
end; $$;

grant execute on function public.store_exchange_api_key(uuid,text) to authenticated;
grant execute on function public.get_exchange_api_key(uuid) to authenticated;
create index if not exists idx_exchange_connections_api_secret_id on public.exchange_connections(api_secret_id);
create index if not exists idx_exchange_connection_secrets_user_id on public.exchange_connection_secrets(user_id);
