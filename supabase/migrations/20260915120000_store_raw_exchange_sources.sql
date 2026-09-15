alter table public.imports add column if not exists source_content text;
alter table public.imports add column if not exists source_sha256 text;

create index if not exists idx_imports_source_sha256 on public.imports(source_sha256);

create or replace function public.delete_exchange_secret(p_connection_id uuid)
returns void
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_user uuid := auth.uid();
  v_secret_id uuid;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  select api_secret_id
    into v_secret_id
  from public.exchange_connections
  where id = p_connection_id
    and user_id = v_user;

  if not found then
    raise exception 'Connection not found';
  end if;

  if v_secret_id is not null then
    delete from vault.secrets where id = v_secret_id;
  end if;

  delete from public.exchange_connection_secrets
  where connection_id = p_connection_id
    and user_id = v_user;

  update public.exchange_connections
  set api_secret_id = null,
      updated_at = now()
  where id = p_connection_id
    and user_id = v_user;
end;
$$;

grant execute on function public.delete_exchange_secret(uuid) to authenticated;
