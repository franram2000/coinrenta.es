create or replace function public.delete_exchange_secret_for_admin(
  p_connection_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_secret_id uuid;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select api_secret_id
    into v_secret_id
  from public.exchange_connections
  where id = p_connection_id
    and user_id = p_user_id;

  if not found then
    raise exception 'Connection not found';
  end if;

  if v_secret_id is not null then
    delete from vault.secrets where id = v_secret_id;
  end if;

  delete from public.exchange_connection_secrets
  where connection_id = p_connection_id
    and user_id = p_user_id;

  update public.exchange_connections
  set api_secret_id = null,
      updated_at = now()
  where id = p_connection_id
    and user_id = p_user_id;
end;
$$;

revoke all on function public.delete_exchange_secret_for_admin(uuid, uuid) from public, anon, authenticated;
grant execute on function public.delete_exchange_secret_for_admin(uuid, uuid) to service_role;
