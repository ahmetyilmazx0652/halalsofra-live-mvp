grant insert on public.restaurants to anon, authenticated;
grant select on public.restaurants to anon, authenticated;
grant update on public.restaurants to anon, authenticated;

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
