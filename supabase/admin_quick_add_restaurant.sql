create or replace function public.admin_create_published_restaurant(
  next_name text,
  next_slug text,
  next_city_id uuid,
  next_address text,
  next_phone text,
  next_email text,
  next_opening_hours text,
  next_description text,
  next_cuisine text,
  next_halal_grade text,
  next_price_level int,
  next_google_place_id text,
  next_alcohol_free boolean,
  next_prayer_room boolean,
  next_family_friendly boolean,
  next_is_featured boolean
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  next_country_id uuid;
  created_restaurant_id uuid;
begin
  if nullif(trim(next_name), '') is null then
    raise exception 'Restaurant name is required';
  end if;

  if nullif(trim(next_address), '') is null then
    raise exception 'Restaurant address is required';
  end if;

  if next_halal_grade not in ('A', 'B', 'C') then
    raise exception 'Invalid halal grade: %', next_halal_grade;
  end if;

  select c.country_id
  into next_country_id
  from public.cities c
  where c.id = next_city_id;

  if next_country_id is null then
    raise exception 'Invalid city id: %', next_city_id;
  end if;

  insert into public.restaurants (
    country_id,
    city_id,
    name,
    slug,
    cuisine,
    description,
    address,
    phone,
    email,
    opening_hours,
    google_place_id,
    price_level,
    halal_grade,
    status,
    subscription_plan,
    is_featured,
    alcohol_free,
    prayer_room,
    family_friendly
  )
  values (
    next_country_id,
    next_city_id,
    trim(next_name),
    trim(next_slug),
    coalesce(nullif(trim(next_cuisine), ''), 'turkish'),
    nullif(trim(next_description), ''),
    trim(next_address),
    nullif(trim(next_phone), ''),
    nullif(trim(next_email), ''),
    nullif(trim(next_opening_hours), ''),
    nullif(trim(next_google_place_id), ''),
    least(greatest(coalesce(next_price_level, 2), 1), 4),
    next_halal_grade::halal_grade,
    'published',
    'free',
    coalesce(next_is_featured, false),
    coalesce(next_alcohol_free, false),
    coalesce(next_prayer_room, false),
    coalesce(next_family_friendly, false)
  )
  returning id into created_restaurant_id;

  return created_restaurant_id;
end;
$$;

grant execute on function public.admin_create_published_restaurant(
  text, text, uuid, text, text, text, text, text, text, text, int, text, boolean, boolean, boolean, boolean
) to anon, authenticated;

notify pgrst, 'reload schema';
