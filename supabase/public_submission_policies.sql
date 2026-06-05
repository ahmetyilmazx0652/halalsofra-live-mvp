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

create or replace function public.review_restaurant(restaurant_id uuid, next_status text)
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
  where id = review_restaurant.restaurant_id
    and status = 'pending';

  update public.certificates
  set status = case when next_status = 'published' then 'approved' else 'rejected' end
  where restaurant_id = review_restaurant.restaurant_id
    and status = 'pending';
end;
$$;

grant execute on function public.review_restaurant(uuid, text) to anon, authenticated;

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
