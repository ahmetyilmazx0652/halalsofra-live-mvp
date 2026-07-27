create or replace function public.admin_create_city(
  target_country_id uuid,
  next_name text,
  next_lat double precision default null,
  next_lng double precision default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  saved_city_id uuid;
begin
  if target_country_id is null then
    raise exception 'Country is required';
  end if;

  if nullif(trim(coalesce(next_name, '')), '') is null then
    raise exception 'City name is required';
  end if;

  if not exists (
    select 1
    from public.countries c
    where c.id = target_country_id
  ) then
    raise exception 'Country not found: %', target_country_id;
  end if;

  insert into public.cities (
    country_id,
    name,
    lat,
    lng
  )
  values (
    target_country_id,
    trim(next_name),
    next_lat,
    next_lng
  )
  on conflict (country_id, name) do update
  set lat = coalesce(excluded.lat, public.cities.lat),
      lng = coalesce(excluded.lng, public.cities.lng)
  returning id into saved_city_id;

  return saved_city_id;
end;
$$;

grant execute on function public.admin_create_city(uuid, text, double precision, double precision) to anon, authenticated;
