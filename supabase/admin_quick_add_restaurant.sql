create or replace function public.normalize_restaurant_key(input_text text)
returns text
language sql
immutable
as $$
  select trim(regexp_replace(
    replace(
      replace(
        replace(
          replace(
            replace(
              replace(
                replace(
                  replace(lower(coalesce(input_text, '')), 'i̇', 'i'),
                  'ı', 'i'
                ),
                'ş', 's'
              ),
              'ğ', 'g'
            ),
            'ü', 'u'
          ),
          'ö', 'o'
        ),
        'ç', 'c'
      ),
      'â', 'a'
    ),
    '[^a-z0-9]+',
    ' ',
    'g'
  ));
$$;

create or replace function public.prevent_duplicate_restaurant_submission()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  duplicate_restaurant_id uuid;
begin
  if new.status in ('pending', 'published') then
    select r.id
    into duplicate_restaurant_id
    from public.restaurants r
    where r.city_id = new.city_id
      and r.status in ('pending', 'published')
      and public.normalize_restaurant_key(r.name) = public.normalize_restaurant_key(new.name)
      and r.id <> new.id
    order by case when r.status = 'published' then 0 else 1 end, r.updated_at desc
    limit 1;

    if duplicate_restaurant_id is not null then
      raise exception 'DUPLICATE_RESTAURANT:%', duplicate_restaurant_id
        using errcode = '23505';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_duplicate_restaurant_submission on public.restaurants;
create trigger prevent_duplicate_restaurant_submission
before insert on public.restaurants
for each row
execute function public.prevent_duplicate_restaurant_submission();

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
  existing_restaurant_id uuid;
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

  select r.id
  into existing_restaurant_id
  from public.restaurants r
  where r.city_id = next_city_id
    and public.normalize_restaurant_key(r.name) = public.normalize_restaurant_key(next_name)
    and r.status in ('pending', 'published')
  order by case when r.status = 'published' then 0 else 1 end, r.updated_at desc
  limit 1;

  if existing_restaurant_id is not null then
    update public.restaurants
    set country_id = next_country_id,
        city_id = next_city_id,
        name = trim(next_name),
        cuisine = coalesce(nullif(trim(next_cuisine), ''), cuisine, 'restaurant'),
        description = coalesce(nullif(trim(next_description), ''), description),
        address = trim(next_address),
        phone = coalesce(nullif(trim(next_phone), ''), phone),
        email = coalesce(nullif(trim(next_email), ''), email),
        opening_hours = coalesce(nullif(trim(next_opening_hours), ''), opening_hours),
        google_place_id = coalesce(nullif(trim(next_google_place_id), ''), google_place_id),
        price_level = case
          when next_price_level between 1 and 4 then next_price_level
          else price_level
        end,
        halal_grade = next_halal_grade::halal_grade,
        status = 'published',
        is_featured = coalesce(next_is_featured, is_featured, false),
        alcohol_free = coalesce(next_alcohol_free, alcohol_free, false),
        prayer_room = coalesce(next_prayer_room, prayer_room, false),
        family_friendly = coalesce(next_family_friendly, family_friendly, false),
        updated_at = now()
    where id = existing_restaurant_id;

    return existing_restaurant_id;
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
    coalesce(nullif(trim(next_cuisine), ''), 'restaurant'),
    nullif(trim(next_description), ''),
    trim(next_address),
    nullif(trim(next_phone), ''),
    nullif(trim(next_email), ''),
    nullif(trim(next_opening_hours), ''),
    nullif(trim(next_google_place_id), ''),
    case
      when next_price_level between 1 and 4 then next_price_level
      else null
    end,
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
