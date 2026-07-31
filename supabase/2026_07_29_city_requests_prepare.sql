-- =====================================================================
-- HalalSofra — Aşama A: city_requests tablosu + tüm RPC'ler.
-- Mevcut restaurants INSERT grant/policy'sine DOKUNMAZ — eski
-- owner/page.tsx kodu bu migration sonrası da çalışmaya devam eder.
-- Henüz ÇALIŞTIRILMADI.
-- =====================================================================

begin;

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- 1) city_requests tablosu
-- ---------------------------------------------------------------------
create table if not exists public.city_requests (
  id uuid primary key default gen_random_uuid(),
  country_id uuid not null references public.countries(id) on delete cascade,
  requested_name text not null,
  requested_region text,
  restaurant_id uuid references public.restaurants(id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  resolved_city_id uuid references public.cities(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists city_requests_status_idx on public.city_requests(status);
create index if not exists city_requests_country_idx on public.city_requests(country_id);
create index if not exists city_requests_restaurant_idx on public.city_requests(restaurant_id);

alter table public.city_requests enable row level security;

-- anon/authenticated'e hiçbir tablo grant'i yok. Tek yazma yolu
-- aşağıdaki SECURITY DEFINER RPC'lerdir.
revoke all on public.city_requests from anon, authenticated, public;
grant select, insert, update, delete on public.city_requests to service_role;

-- ---------------------------------------------------------------------
-- 2) Public RPC: submit_restaurant_application
-- ---------------------------------------------------------------------
create or replace function public.submit_restaurant_application(
  p_name text,
  p_slug text,
  p_address text,
  p_city_id uuid default null,
  p_requested_country_id uuid default null,
  p_requested_city_name text default null,
  p_requested_region text default null,
  p_cuisine text default 'restaurant',
  p_description text default null,
  p_phone text default null,
  p_email text default null,
  p_website text default null,
  p_instagram text default null,
  p_opening_hours text default null,
  p_google_place_id text default null,
  p_price_level int default null,
  p_halal_grade text default 'B',
  p_alcohol_free boolean default false,
  p_prayer_room boolean default false,
  p_family_friendly boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_country_id uuid;
  v_city_id uuid;
  v_restaurant_id uuid;
begin
  if nullif(trim(coalesce(p_name, '')), '') is null then
    raise exception 'Restaurant name is required';
  end if;
  if nullif(trim(coalesce(p_address, '')), '') is null then
    raise exception 'Address is required';
  end if;
  if nullif(trim(coalesce(p_slug, '')), '') is null
     or p_slug !~ '^[a-z0-9-]+$' then
    raise exception 'Invalid slug';
  end if;

  if char_length(p_name) > 160 then raise exception 'Name too long'; end if;
  if char_length(p_slug) > 180 then raise exception 'Slug too long'; end if;
  if char_length(p_address) > 300 then raise exception 'Address too long'; end if;
  if p_description is not null and char_length(p_description) > 2000 then
    raise exception 'Description too long';
  end if;
  if p_phone is not null and char_length(p_phone) > 40 then raise exception 'Phone too long'; end if;
  if p_email is not null and char_length(p_email) > 255 then raise exception 'Email too long'; end if;
  if p_website is not null and char_length(p_website) > 255 then raise exception 'Website too long'; end if;
  if p_instagram is not null and char_length(p_instagram) > 100 then raise exception 'Instagram too long'; end if;
  if p_opening_hours is not null and char_length(p_opening_hours) > 200 then
    raise exception 'Opening hours too long';
  end if;
  if p_google_place_id is not null and char_length(p_google_place_id) > 255 then
    raise exception 'Google place id too long';
  end if;
  if p_requested_city_name is not null and char_length(p_requested_city_name) > 120 then
    raise exception 'Requested city name too long';
  end if;
  if p_requested_region is not null and char_length(p_requested_region) > 120 then
    raise exception 'Requested region too long';
  end if;

  if p_halal_grade not in ('A', 'B', 'C') then
    raise exception 'Invalid halal grade: %', p_halal_grade;
  end if;
  if p_price_level is not null and (p_price_level < 1 or p_price_level > 4) then
    raise exception 'Invalid price level: %', p_price_level;
  end if;
  if p_city_id is not null and p_requested_country_id is not null then
    raise exception 'Provide either city_id or requested city details, not both';
  end if;

  if p_city_id is not null then
    select c.country_id into v_country_id
    from public.cities c
    where c.id = p_city_id;

    if v_country_id is null then
      raise exception 'City not found: %', p_city_id;
    end if;

    v_city_id := p_city_id;
  else
    if p_requested_country_id is null then
      raise exception 'Requested country is required when city is not selected';
    end if;
    if nullif(trim(coalesce(p_requested_city_name, '')), '') is null then
      raise exception 'Requested city name is required when city is not selected';
    end if;
    if not exists (select 1 from public.countries where id = p_requested_country_id) then
      raise exception 'Country not found: %', p_requested_country_id;
    end if;

    v_country_id := p_requested_country_id;
    v_city_id := null;
  end if;

  insert into public.restaurants (
    country_id, city_id, name, slug, cuisine, description, address,
    phone, email, website, instagram, opening_hours, google_place_id,
    price_level, halal_grade, status, subscription_plan,
    alcohol_free, prayer_room, family_friendly
  )
  values (
    v_country_id, v_city_id, trim(p_name), p_slug,
    coalesce(nullif(trim(p_cuisine), ''), 'restaurant'),
    nullif(trim(coalesce(p_description, '')), ''),
    trim(p_address),
    nullif(trim(coalesce(p_phone, '')), ''),
    nullif(trim(coalesce(p_email, '')), ''),
    nullif(trim(coalesce(p_website, '')), ''),
    nullif(trim(coalesce(p_instagram, '')), ''),
    nullif(trim(coalesce(p_opening_hours, '')), ''),
    nullif(trim(coalesce(p_google_place_id, '')), ''),
    p_price_level,
    p_halal_grade::public.halal_grade,
    'pending'::public.restaurant_status,
    'free'::public.subscription_plan,
    coalesce(p_alcohol_free, false),
    coalesce(p_prayer_room, false),
    coalesce(p_family_friendly, false)
  )
  returning id into v_restaurant_id;

  if p_city_id is null then
    insert into public.city_requests (
      country_id, requested_name, requested_region, restaurant_id, status
    )
    values (
      p_requested_country_id,
      trim(p_requested_city_name),
      nullif(trim(coalesce(p_requested_region, '')), ''),
      v_restaurant_id,
      'pending'
    );
  end if;

  return v_restaurant_id;
end;
$$;

revoke execute on function public.submit_restaurant_application(
  text, text, text, uuid, uuid, text, text, text, text, text, text,
  text, text, text, text, int, text, boolean, boolean, boolean
) from public;

grant execute on function public.submit_restaurant_application(
  text, text, text, uuid, uuid, text, text, text, text, text, text,
  text, text, text, text, int, text, boolean, boolean, boolean
) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 3) Admin RPC: mevcut şehirle eşleştir
--    Bağlı restoranın var ve pending olduğu doğrulanır; güncelleme
--    başarısızsa talep approved yapılmaz.
-- ---------------------------------------------------------------------
create or replace function public.resolve_city_request_with_existing_city(
  p_request_id uuid,
  p_city_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request record;
  v_city_country_id uuid;
  v_updated_rows int;
begin
  select id, country_id, restaurant_id, status
  into v_request
  from public.city_requests
  where id = p_request_id
  for update;

  if v_request.id is null then
    raise exception 'City request not found: %', p_request_id;
  end if;
  if v_request.status <> 'pending' then
    raise exception 'City request is not pending: %', p_request_id;
  end if;

  select country_id into v_city_country_id
  from public.cities
  where id = p_city_id;

  if v_city_country_id is null then
    raise exception 'City not found: %', p_city_id;
  end if;
  if v_city_country_id <> v_request.country_id then
    raise exception 'Selected city does not belong to the requested country';
  end if;

  if v_request.restaurant_id is not null then
    update public.restaurants
    set city_id = p_city_id, updated_at = now()
    where id = v_request.restaurant_id
      and status = 'pending'::public.restaurant_status;

    get diagnostics v_updated_rows = row_count;

    if v_updated_rows = 0 then
      raise exception 'Linked restaurant not found or not pending: %', v_request.restaurant_id;
    end if;
  end if;

  update public.city_requests
  set status = 'approved', resolved_city_id = p_city_id
  where id = p_request_id;
end;
$$;

revoke execute on function public.resolve_city_request_with_existing_city(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.resolve_city_request_with_existing_city(uuid, uuid)
  to service_role;

-- ---------------------------------------------------------------------
-- 4) Admin RPC: yeni şehir oluştur (veya varsa mevcut şehri kullan,
--    koordinatlarını değiştirmeden). Bağlı restoran doğrulaması var.
-- ---------------------------------------------------------------------
create or replace function public.resolve_city_request_with_new_city(
  p_request_id uuid,
  p_lat double precision default null,
  p_lng double precision default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request record;
  v_new_city_id uuid;
  v_updated_rows int;
begin
  if p_lat is not null and (p_lat <> p_lat or p_lat < -90 or p_lat > 90) then
    raise exception 'Invalid latitude: %', p_lat;
  end if;
  if p_lng is not null and (p_lng <> p_lng or p_lng < -180 or p_lng > 180) then
    raise exception 'Invalid longitude: %', p_lng;
  end if;

  select id, country_id, requested_name, restaurant_id, status
  into v_request
  from public.city_requests
  where id = p_request_id
  for update;

  if v_request.id is null then
    raise exception 'City request not found: %', p_request_id;
  end if;
  if v_request.status <> 'pending' then
    raise exception 'City request is not pending: %', p_request_id;
  end if;

  -- Şehir zaten varsa (country_id, name) eşleşmesiyle onu kullan;
  -- var olan şehrin lat/lng'si OTOMATİK DEĞİŞTİRİLMEZ (name=excluded.name
  -- no-op update sadece RETURNING id çalışsın diye yapılıyor).
  insert into public.cities (country_id, name, lat, lng)
  values (v_request.country_id, trim(v_request.requested_name), p_lat, p_lng)
  on conflict (country_id, name) do update
  set name = excluded.name
  returning id into v_new_city_id;

  if v_request.restaurant_id is not null then
    update public.restaurants
    set city_id = v_new_city_id, updated_at = now()
    where id = v_request.restaurant_id
      and status = 'pending'::public.restaurant_status;

    get diagnostics v_updated_rows = row_count;

    if v_updated_rows = 0 then
      raise exception 'Linked restaurant not found or not pending: %', v_request.restaurant_id;
    end if;
  end if;

  update public.city_requests
  set status = 'approved', resolved_city_id = v_new_city_id
  where id = p_request_id;

  return v_new_city_id;
end;
$$;

revoke execute on function public.resolve_city_request_with_new_city(uuid, double precision, double precision)
  from public, anon, authenticated;
grant execute on function public.resolve_city_request_with_new_city(uuid, double precision, double precision)
  to service_role;

-- ---------------------------------------------------------------------
-- 5) Admin RPC: reddet — bağlı restoran da aynı transaction'da rejected
-- ---------------------------------------------------------------------
create or replace function public.reject_city_request(
  p_request_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request record;
begin
  select id, restaurant_id, status
  into v_request
  from public.city_requests
  where id = p_request_id
  for update;

  if v_request.id is null then
    raise exception 'City request not found: %', p_request_id;
  end if;
  if v_request.status <> 'pending' then
    raise exception 'City request is not pending: %', p_request_id;
  end if;

  update public.city_requests
  set status = 'rejected'
  where id = p_request_id;

  if v_request.restaurant_id is not null then
    update public.restaurants
    set status = 'rejected'::public.restaurant_status, updated_at = now()
    where id = v_request.restaurant_id
      and status = 'pending'::public.restaurant_status;
  end if;
end;
$$;

revoke execute on function public.reject_city_request(uuid)
  from public, anon, authenticated;
grant execute on function public.reject_city_request(uuid)
  to service_role;

commit;

notify pgrst, 'reload schema';
