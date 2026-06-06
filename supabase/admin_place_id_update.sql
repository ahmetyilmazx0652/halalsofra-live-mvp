create or replace function public.update_pending_restaurant(
  target_restaurant_id uuid,
  next_name text,
  next_address text,
  next_phone text,
  next_email text,
  next_opening_hours text,
  next_description text,
  next_halal_grade text,
  next_city_id uuid,
  next_certificate_body text,
  next_certificate_number text,
  next_certificate_url text,
  next_google_place_id text,
  next_lat double precision,
  next_lng double precision
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  has_certificate_update boolean;
  next_country_id uuid;
begin
  if next_halal_grade not in ('A', 'B', 'C') then
    raise exception 'Invalid halal grade: %', next_halal_grade;
  end if;

  if next_city_id is not null then
    select c.country_id
    into next_country_id
    from public.cities c
    where c.id = next_city_id;

    if next_country_id is null then
      raise exception 'Invalid city id: %', next_city_id;
    end if;
  end if;

  update public.restaurants
  set name = coalesce(nullif(trim(next_name), ''), name),
      address = coalesce(nullif(trim(next_address), ''), address),
      phone = nullif(trim(next_phone), ''),
      email = nullif(trim(next_email), ''),
      opening_hours = nullif(trim(next_opening_hours), ''),
      description = nullif(trim(next_description), ''),
      halal_grade = next_halal_grade::halal_grade,
      city_id = coalesce(next_city_id, city_id),
      country_id = coalesce(next_country_id, country_id),
      google_place_id = nullif(trim(next_google_place_id), ''),
      lat = coalesce(next_lat, lat),
      lng = coalesce(next_lng, lng),
      updated_at = now()
  where id = target_restaurant_id
    and status = 'pending';

  has_certificate_update =
    nullif(trim(coalesce(next_certificate_body, '')), '') is not null
    or nullif(trim(coalesce(next_certificate_number, '')), '') is not null
    or nullif(trim(coalesce(next_certificate_url, '')), '') is not null;

  if has_certificate_update then
    update public.certificates
    set body = coalesce(nullif(trim(next_certificate_body), ''), body),
        certificate_number = nullif(trim(next_certificate_number), ''),
        storage_path = nullif(trim(next_certificate_url), ''),
        status = 'pending'
    where id = (
      select c.id
      from public.certificates c
      where c.restaurant_id = target_restaurant_id
        and c.status = 'pending'
      order by c.created_at desc
      limit 1
    );

    if not found then
      insert into public.certificates (
        restaurant_id,
        body,
        certificate_number,
        storage_path,
        status
      )
      values (
        target_restaurant_id,
        coalesce(nullif(trim(next_certificate_body), ''), 'İşletme beyanı'),
        nullif(trim(next_certificate_number), ''),
        nullif(trim(next_certificate_url), ''),
        'pending'
      );
    end if;
  end if;
end;
$$;

grant execute on function public.update_pending_restaurant(uuid, text, text, text, text, text, text, text, uuid, text, text, text, text, double precision, double precision) to anon, authenticated;

create or replace function public.update_published_restaurant(
  target_restaurant_id uuid,
  next_name text,
  next_address text,
  next_phone text,
  next_email text,
  next_opening_hours text,
  next_description text,
  next_halal_grade text,
  next_city_id uuid,
  next_is_featured boolean,
  next_alcohol_free boolean,
  next_prayer_room boolean,
  next_family_friendly boolean,
  next_certificate_body text,
  next_certificate_number text,
  next_certificate_url text,
  next_google_place_id text,
  next_lat double precision,
  next_lng double precision
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  has_certificate_update boolean;
  next_country_id uuid;
begin
  if next_halal_grade not in ('A', 'B', 'C') then
    raise exception 'Invalid halal grade: %', next_halal_grade;
  end if;

  if next_city_id is not null then
    select c.country_id
    into next_country_id
    from public.cities c
    where c.id = next_city_id;

    if next_country_id is null then
      raise exception 'Invalid city id: %', next_city_id;
    end if;
  end if;

  update public.restaurants
  set name = coalesce(nullif(trim(next_name), ''), name),
      address = coalesce(nullif(trim(next_address), ''), address),
      phone = nullif(trim(next_phone), ''),
      email = nullif(trim(next_email), ''),
      opening_hours = nullif(trim(next_opening_hours), ''),
      description = nullif(trim(next_description), ''),
      halal_grade = next_halal_grade::halal_grade,
      city_id = coalesce(next_city_id, city_id),
      country_id = coalesce(next_country_id, country_id),
      is_featured = coalesce(next_is_featured, false),
      alcohol_free = coalesce(next_alcohol_free, false),
      prayer_room = coalesce(next_prayer_room, false),
      family_friendly = coalesce(next_family_friendly, false),
      google_place_id = nullif(trim(next_google_place_id), ''),
      lat = coalesce(next_lat, lat),
      lng = coalesce(next_lng, lng),
      updated_at = now()
  where id = target_restaurant_id
    and status = 'published';

  has_certificate_update =
    nullif(trim(coalesce(next_certificate_body, '')), '') is not null
    or nullif(trim(coalesce(next_certificate_number, '')), '') is not null
    or nullif(trim(coalesce(next_certificate_url, '')), '') is not null;

  if has_certificate_update then
    update public.certificates
    set body = coalesce(nullif(trim(next_certificate_body), ''), body),
        certificate_number = nullif(trim(next_certificate_number), ''),
        storage_path = nullif(trim(next_certificate_url), ''),
        status = 'approved'
    where id = (
      select c.id
      from public.certificates c
      where c.restaurant_id = target_restaurant_id
        and c.status = 'approved'
      order by c.created_at desc
      limit 1
    );

    if not found then
      insert into public.certificates (
        restaurant_id,
        body,
        certificate_number,
        storage_path,
        status
      )
      values (
        target_restaurant_id,
        coalesce(nullif(trim(next_certificate_body), ''), 'İşletme beyanı'),
        nullif(trim(next_certificate_number), ''),
        nullif(trim(next_certificate_url), ''),
        'approved'
      );
    end if;
  end if;
end;
$$;

grant execute on function public.update_published_restaurant(uuid, text, text, text, text, text, text, text, uuid, boolean, boolean, boolean, boolean, text, text, text, text, double precision, double precision) to anon, authenticated;
