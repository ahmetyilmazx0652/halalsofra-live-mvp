-- =====================================================================
-- HalalSofra — Aşama B: eski doğrudan public restaurant insert yolunu
-- kapatır. YALNIZCA owner/page.tsx yeni RPC ile deploy + doğrulandıktan
-- SONRA çalıştırılmalı — aksi halde eski kod çalışmaz hale gelir.
-- Henüz ÇALIŞTIRILMADI.
-- =====================================================================

begin;

drop policy if exists "Public can submit pending restaurants" on public.restaurants;
revoke insert on public.restaurants from anon, authenticated;

commit;

notify pgrst, 'reload schema';
