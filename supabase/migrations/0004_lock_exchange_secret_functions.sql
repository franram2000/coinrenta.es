revoke execute on function public.get_exchange_api_key(uuid) from public, anon, authenticated;
revoke execute on function public.store_exchange_api_key(uuid,text) from public, anon, authenticated;
grant execute on function public.get_exchange_api_key(uuid) to authenticated;
grant execute on function public.store_exchange_api_key(uuid,text) to authenticated;