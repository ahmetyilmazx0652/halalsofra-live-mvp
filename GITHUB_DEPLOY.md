# GitHub ve Vercel Yayın Akışı

## 1. GitHub reposu oluştur

GitHub'da yeni repo aç:

```txt
halalsofra-live-mvp
```

Public veya private olabilir. İlk aşamada private daha iyi.

## 2. Lokal klasörü GitHub'a gönder

```bash
cd halalsofra_live_mvp
git init
git add .
git commit -m "Initial HalalSofra live MVP"
git branch -M main
git remote add origin https://github.com/KULLANICI_ADIN/halalsofra-live-mvp.git
git push -u origin main
```

## 3. Supabase kur

Supabase'de yeni proje aç.

SQL Editor içinde sırayla çalıştır:

```txt
supabase/schema.sql
supabase/seed.sql
```

Sonra Project Settings -> API kısmından değerleri al:

```txt
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

## 4. Vercel'e bağla

Vercel'de:

```txt
Add New Project -> GitHub repo seç -> Deploy
```

Environment Variables kısmına şunları ekle:

```txt
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_APP_URL
```

Stripe ve Google daha sonra eklenebilir:

```txt
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
GOOGLE_PLACES_API_KEY
```

## 5. İlk canlı hedef

İlk deploy sonrası yapılacaklar:

- İşletme kayıt formunu Supabase'e yazdır.
- Admin onay butonlarını bağla.
- Restoran listelemeyi DB'den çek.
- Supabase Storage ile fotoğraf/sertifika yüklemeyi bağla.
- Stripe Checkout ekle.
