# HalalSofra Live MVP

Bu klasör HalalSofra'yı canlı ürüne dönüştürmek için oluşturulmuş Next.js + Supabase başlangıç projesidir.

## Hızlı Kurulum

```bash
cd halalsofra_live_mvp
npm install
cp .env.example .env.local
npm run dev
```

## Supabase

1. Supabase'de yeni proje aç.
2. SQL Editor içinde `supabase/schema.sql` çalıştır.
3. Ardından `supabase/seed.sql` çalıştır.
4. `.env.local` içine şu değerleri gir:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

## Stripe

1. Stripe'da ürünleri oluştur:
   - Basic: €9/ay
   - Pro: €19/ay
   - Premium: €39/ay
2. Checkout endpoint ve webhook sonraki sprintte bağlanacak.

## Yayına Alma

En hızlı yol Vercel:

1. GitHub repo oluştur.
2. Bu klasörü repo olarak push et.
3. Vercel'e import et.
4. Environment variables ekle.
5. Deploy et.

## İlk Canlı MVP Kapsamı

- Ülke ve şehir bazlı restoran listeleme.
- İşletme kayıt akışı.
- Restoran başvurusu.
- Menü/fotoğraf/sertifika veri modeli.
- Admin onay kuyruğu.
- Abonelik paketleri.

## Sonraki Yapılacaklar

- Supabase Auth formlarını bağla.
- Restoran başvurusunu `restaurants` tablosuna yaz.
- Supabase Storage ile fotoğraf/sertifika yükle.
- Admin onay aksiyonlarını bağla.
- Stripe Checkout ve webhook ekle.
- Google Places proxy ekle.
