-- Keeps the database migration history aligned with the production fix.
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
  if not exists (select 1 from public.exchange_connections where id=p_connection_id and user_id=v_user) then raise exception 'Connection not found'; end if;
  if coalesce(trim(p_api_key),'')='' then raise exception 'API key is required'; end if;
  v_secret_id := vault.create_secret(trim(p_api_key),'coinrenta-bitpanda-'||p_connection_id::text,'Bitpanda read-only API key for CoinRenta');
  insert into public.exchange_connection_secrets(connection_id,user_id,secret_id)
  values(p_connection_id,v_user,v_secret_id)
  on conflict(connection_id) do update set secret_id=excluded.secret_id,created_at=now();
  update public.exchange_connections
  set api_secret_id=v_secret_id,status='active',last_sync_status=null,last_sync_error=null,updated_at=now()
  where id=p_connection_id and user_id=v_user;
  return v_secret_id;
end;
$$;

grant execute on function public.store_exchange_api_key(uuid,text) to authenticated;

update public.exchange_connections set status='active' where status='connected';