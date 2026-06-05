create extension if not exists "uuid-ossp";

create type restaurant_status as enum ('draft', 'pending', 'published', 'rejected', 'suspended');
create type halal_grade as enum ('A', 'B', 'C');
create type subscription_plan as enum ('free', 'basic', 'pro', 'premium');

create table public.countries (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  code text not null unique,
  flag text not null default '🌍',
  created_at timestamptz not null default now()
);

create table public.cities (
  id uuid primary key default uuid_generate_v4(),
  country_id uuid not null references public.countries(id) on delete cascade,
  name text not null,
  lat double precision,
  lng double precision,
  created_at timestamptz not null default now(),
  unique(country_id, name)
);

create table public.owner_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  company_name text,
  created_at timestamptz not null default now()
);

create table public.restaurants (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid references public.owner_profiles(id) on delete set null,
  country_id uuid references public.countries(id),
  city_id uuid references public.cities(id),
  name text not null,
  slug text not null unique,
  cuisine text not null default 'turkish',
  description text,
  address text not null,
  phone text,
  email text,
  website text,
  instagram text,
  opening_hours text,
  lat double precision,
  lng double precision,
  google_place_id text,
  price_level int check (price_level between 1 and 4),
  halal_grade halal_grade not null default 'B',
  status restaurant_status not null default 'pending',
  subscription_plan subscription_plan not null default 'free',
  is_featured boolean not null default false,
  alcohol_free boolean not null default false,
  prayer_room boolean not null default false,
  family_friendly boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.restaurant_photos (
  id uuid primary key default uuid_generate_v4(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  storage_path text not null,
  alt_text text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table public.menu_categories (
  id uuid primary key default uuid_generate_v4(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null,
  sort_order int not null default 0
);

create table public.menu_items (
  id uuid primary key default uuid_generate_v4(),
  category_id uuid not null references public.menu_categories(id) on delete cascade,
  name text not null,
  description text,
  price numeric(8,2),
  currency text not null default 'EUR',
  allergens text,
  is_available boolean not null default true,
  sort_order int not null default 0
);

create table public.certificates (
  id uuid primary key default uuid_generate_v4(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  body text not null,
  certificate_number text,
  valid_from date,
  valid_until date,
  storage_path text,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create table public.reviews (
  id uuid primary key default uuid_generate_v4(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  author_name text,
  rating int not null check (rating between 1 and 5),
  halal_rating int check (halal_rating between 1 and 5),
  food_rating int check (food_rating between 1 and 5),
  service_rating int check (service_rating between 1 and 5),
  body text,
  owner_response text,
  created_at timestamptz not null default now()
);

create table public.subscriptions (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references public.owner_profiles(id) on delete cascade,
  plan subscription_plan not null default 'free',
  stripe_customer_id text,
  stripe_subscription_id text,
  status text not null default 'active',
  current_period_end timestamptz,
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default uuid_generate_v4(),
  actor_id uuid references auth.users(id) on delete set null,
  entity text not null,
  entity_id uuid,
  action text not null,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.countries enable row level security;
alter table public.cities enable row level security;
alter table public.restaurants enable row level security;
alter table public.restaurant_photos enable row level security;
alter table public.menu_categories enable row level security;
alter table public.menu_items enable row level security;
alter table public.certificates enable row level security;
alter table public.reviews enable row level security;
alter table public.owner_profiles enable row level security;
alter table public.subscriptions enable row level security;

create policy "Public can read countries" on public.countries for select using (true);
create policy "Public can read cities" on public.cities for select using (true);
create policy "Public can read published restaurants" on public.restaurants for select using (status = 'published');
create policy "Public can read restaurant photos" on public.restaurant_photos for select using (true);
create policy "Public can read menu categories" on public.menu_categories for select using (true);
create policy "Public can read menu items" on public.menu_items for select using (true);
create policy "Public can read approved certificates" on public.certificates for select using (status = 'approved');
create policy "Public can read reviews" on public.reviews for select using (true);

create policy "Owners can manage profile" on public.owner_profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "Owners can manage own restaurants" on public.restaurants
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "Owners can manage own certificates" on public.certificates
  for all using (
    exists (select 1 from public.restaurants r where r.id = restaurant_id and r.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.restaurants r where r.id = restaurant_id and r.owner_id = auth.uid())
  );

create index restaurants_city_status_idx on public.restaurants(city_id, status);
create index restaurants_owner_idx on public.restaurants(owner_id);
create index menu_categories_restaurant_idx on public.menu_categories(restaurant_id);
create index menu_items_category_idx on public.menu_items(category_id);
