grant insert on public.restaurants to anon, authenticated;
grant select on public.restaurants to anon, authenticated;
grant update on public.restaurants to anon, authenticated;
grant insert on public.menu_categories to anon, authenticated;
grant select on public.menu_categories to anon, authenticated;
grant insert on public.menu_items to anon, authenticated;
grant select on public.menu_items to anon, authenticated;
grant insert on public.certificates to anon, authenticated;
grant select on public.certificates to anon, authenticated;

drop policy if exists "Public can submit pending restaurants" on public.restaurants;
create policy "Public can submit pending restaurants"
on public.restaurants
for insert
to anon, authenticated
with check (
  status = 'pending'
  and owner_id is null
  and name is not null
  and address is not null
);

drop policy if exists "Public can read pending restaurants for MVP admin" on public.restaurants;
create policy "Public can read pending restaurants for MVP admin"
on public.restaurants
for select
to anon, authenticated
using (status = 'pending');

drop policy if exists "Public MVP admin can review pending restaurants" on public.restaurants;
create policy "Public MVP admin can review pending restaurants"
on public.restaurants
for update
to anon, authenticated
using (status = 'pending')
with check (status in ('published', 'rejected'));

create or replace function public.review_restaurant(target_restaurant_id uuid, next_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if next_status not in ('published', 'rejected') then
    raise exception 'Invalid restaurant status: %', next_status;
  end if;

  update public.restaurants
  set status = next_status::restaurant_status,
      updated_at = now()
  where id = target_restaurant_id
    and status = 'pending';

  update public.certificates
  set status = case when next_status = 'published' then 'approved' else 'rejected' end
  where certificates.restaurant_id = target_restaurant_id
    and status = 'pending';
end;
$$;

grant execute on function public.review_restaurant(uuid, text) to anon, authenticated;

drop function if exists public.update_pending_restaurant(uuid, text, text, text, text, text, text, text, text, text);

create or replace function public.update_pending_restaurant(
  target_restaurant_id uuid,
  next_name text,
  next_address text,
  next_phone text,
  next_email text,
  next_description text,
  next_halal_grade text,
  next_certificate_body text,
  next_certificate_number text,
  next_certificate_url text,
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
begin
  if next_halal_grade not in ('A', 'B', 'C') then
    raise exception 'Invalid halal grade: %', next_halal_grade;
  end if;

  update public.restaurants
  set name = coalesce(nullif(trim(next_name), ''), name),
      address = coalesce(nullif(trim(next_address), ''), address),
      phone = nullif(trim(next_phone), ''),
      email = nullif(trim(next_email), ''),
      description = nullif(trim(next_description), ''),
      halal_grade = next_halal_grade::halal_grade,
      lat = next_lat,
      lng = next_lng,
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

grant execute on function public.update_pending_restaurant(uuid, text, text, text, text, text, text, text, text, text, double precision, double precision) to anon, authenticated;

drop function if exists public.update_published_restaurant(uuid, text, text, text, text, text, text, boolean, boolean, boolean, text, text, text);

create or replace function public.update_published_restaurant(
  target_restaurant_id uuid,
  next_name text,
  next_address text,
  next_phone text,
  next_email text,
  next_description text,
  next_halal_grade text,
  next_alcohol_free boolean,
  next_prayer_room boolean,
  next_family_friendly boolean,
  next_certificate_body text,
  next_certificate_number text,
  next_certificate_url text,
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
begin
  if next_halal_grade not in ('A', 'B', 'C') then
    raise exception 'Invalid halal grade: %', next_halal_grade;
  end if;

  update public.restaurants
  set name = coalesce(nullif(trim(next_name), ''), name),
      address = coalesce(nullif(trim(next_address), ''), address),
      phone = nullif(trim(next_phone), ''),
      email = nullif(trim(next_email), ''),
      description = nullif(trim(next_description), ''),
      halal_grade = next_halal_grade::halal_grade,
      alcohol_free = coalesce(next_alcohol_free, false),
      prayer_room = coalesce(next_prayer_room, false),
      family_friendly = coalesce(next_family_friendly, false),
      lat = next_lat,
      lng = next_lng,
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

grant execute on function public.update_published_restaurant(uuid, text, text, text, text, text, text, boolean, boolean, boolean, text, text, text, double precision, double precision) to anon, authenticated;

drop policy if exists "Public can add menu category for submitted restaurants" on public.menu_categories;
create policy "Public can add menu category for submitted restaurants"
on public.menu_categories
for insert
to anon, authenticated
with check (
  exists (
    select 1
    from public.restaurants r
    where r.id = restaurant_id
      and r.status = 'pending'
      and r.owner_id is null
  )
);

drop policy if exists "Public can add menu items for submitted restaurants" on public.menu_items;
create policy "Public can add menu items for submitted restaurants"
on public.menu_items
for insert
to anon, authenticated
with check (
  exists (
    select 1
    from public.menu_categories c
    join public.restaurants r on r.id = c.restaurant_id
    where c.id = category_id
      and r.status = 'pending'
      and r.owner_id is null
  )
);

drop policy if exists "Public can add certificates for submitted restaurants" on public.certificates;
create policy "Public can add certificates for submitted restaurants"
on public.certificates
for insert
to anon, authenticated
with check (
  exists (
    select 1
    from public.restaurants r
    where r.id = restaurant_id
      and r.status = 'pending'
      and r.owner_id is null
  )
);

drop policy if exists "Public MVP admin can read pending certificates" on public.certificates;
create policy "Public MVP admin can read pending certificates"
on public.certificates
for select
to anon, authenticated
using (status = 'pending');
