-- Assets are a shared catalog, not user-owned rows.
-- Authenticated imports may create missing symbols discovered in exchange CSV/API data.
create policy "assets_insert"
on public.assets
for insert
to authenticated
with check (
  nullif(btrim(symbol), '') is not null
  and symbol = upper(symbol)
  and asset_type = any (array['crypto'::text, 'fiat'::text, 'stablecoin'::text, 'token'::text, 'other'::text])
);

create unique index if not exists assets_symbol_upper_unique
  on public.assets (upper(symbol));
