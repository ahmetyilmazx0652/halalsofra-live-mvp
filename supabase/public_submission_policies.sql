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
  where id = restaurant_id
    and status = 'pending';
end;
$$;

grant execute on function public.review_restaurant(uuid, text) to anon, authenticated;
