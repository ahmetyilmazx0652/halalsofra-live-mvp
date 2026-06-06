import { revalidatePath, unstable_noStore as noStore } from "next/cache";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { absoluteUrl } from "@/lib/site";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function priceLabel(level: number | null) {
  if (!level) return "Fiyat bekleniyor";
  return "€".repeat(Math.max(1, Math.min(level, 4)));
}

function mapsUrl(
  name: string,
  address: string,
  cityName: string | null,
  countryName: string | null,
  lat: number | null,
  lng: number | null,
  googlePlaceId: string | null
) {
  if (googlePlaceId) {
    const destination = [name, address, cityName, countryName].filter(Boolean).join(", ");
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&destination_place_id=${encodeURIComponent(googlePlaceId)}`;
  }

  const destination = lat !== null && lng !== null
    ? `${lat},${lng}`
    : [name, address, cityName, countryName].filter(Boolean).join(", ");

  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}

function googleSearchUrl(name: string, address: string, cityName: string | null, countryName: string | null) {
  const query = [name, address, cityName, countryName].filter(Boolean).join(", ");
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

function formatMenuPrice(price: number | string | null, currency: string | null) {
  if (price === null) return "Fiyat bekleniyor";
  const numericPrice = typeof price === "string" ? Number(price) : price;
  if (!Number.isFinite(numericPrice)) return "Fiyat bekleniyor";
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: currency || "EUR"
  }).format(numericPrice);
}

function formatDate(value: string | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  }).format(new Date(value));
}

function formatReviewDate(value: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

function cleanText(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanRating(value: FormDataEntryValue | null) {
  const rating = Number(cleanText(value));
  return Number.isInteger(rating) && rating >= 1 && rating <= 5 ? rating : null;
}

function stars(value: number | null) {
  if (!value) return "Puan yok";
  return "★".repeat(value) + "☆".repeat(5 - value);
}

function websiteUrl(value: string | null) {
  if (!value) return null;
  return value.startsWith("http://") || value.startsWith("https://") ? value : `https://${value}`;
}

function instagramUrl(value: string | null) {
  if (!value) return null;
  const cleanValue = value.trim();
  if (cleanValue.startsWith("http://") || cleanValue.startsWith("https://")) return cleanValue;
  return `https://www.instagram.com/${cleanValue.replace(/^@/, "")}`;
}

function plainDescription(value: string | null, name: string, cityName: string | null, countryName: string | null) {
  const fallback = `${name} için helal durumu, menü, fiyat, adres ve yol tarifi bilgilerini HalalSofra'da incele.`;
  const text = (value || fallback).replace(/\s+/g, " ").trim();
  const location = [cityName, countryName].filter(Boolean).join(", ");
  const suffix = location ? ` ${location}.` : "";
  return `${text}${suffix}`.slice(0, 165);
}

async function submitReview(formData: FormData) {
  "use server";

  const restaurantId = cleanText(formData.get("restaurant_id"));
  const slug = cleanText(formData.get("slug"));
  const rating = cleanRating(formData.get("rating"));
  const body = cleanText(formData.get("body"));

  if (!hasSupabaseConfig || !supabase) {
    redirect(`/restaurants/${slug}?reviewError=config`);
  }
  if (!restaurantId || !slug || !rating || !body) {
    redirect(`/restaurants/${slug}?reviewError=missing`);
  }

  const result = await supabase.from("reviews").insert({
    restaurant_id: restaurantId,
    author_name: cleanText(formData.get("author_name")) || "Misafir",
    rating,
    halal_rating: cleanRating(formData.get("halal_rating")),
    food_rating: cleanRating(formData.get("food_rating")),
    status: "pending",
    body
  });

  if (result.error) {
    redirect(`/restaurants/${slug}?reviewError=${encodeURIComponent(result.error.message)}`);
  }

  revalidatePath(`/restaurants/${slug}`);
  redirect(`/restaurants/${slug}?reviewed=1`);
}

export async function generateMetadata({
  params
}: {
  params: { slug: string };
}): Promise<Metadata> {
  if (!hasSupabaseConfig || !supabase) {
    return {
      title: "Restoran bulunamadı",
      robots: { index: false, follow: false }
    };
  }

  const result = await supabase
    .from("restaurants")
    .select("name,slug,description,address,halal_grade,cities(name),countries(name)")
    .eq("slug", params.slug)
    .eq("status", "published")
    .single();

  if (result.error || !result.data) {
    return {
      title: "Restoran bulunamadı",
      robots: { index: false, follow: false }
    };
  }

  const restaurant: any = result.data;
  const country = restaurant.countries?.[0] ?? restaurant.countries;
  const city = restaurant.cities?.[0] ?? restaurant.cities;
  const title = `${restaurant.name} - Grade ${restaurant.halal_grade} Helal Restoran`;
  const description = plainDescription(
    restaurant.description,
    restaurant.name,
    city?.name ?? null,
    country?.name ?? null
  );

  return {
    title,
    description,
    alternates: {
      canonical: `/restaurants/${restaurant.slug}`
    },
    openGraph: {
      title,
      description,
      type: "article",
      url: `/restaurants/${restaurant.slug}`
    }
  };
}

export default async function RestaurantDetailPage({
  params,
  searchParams
}: {
  params: { slug: string };
  searchParams?: { reviewed?: string; reviewError?: string };
}) {
  noStore();

  if (!hasSupabaseConfig || !supabase) {
    notFound();
  }

  const result = await supabase
    .from("restaurants")
    .select("id,name,slug,cuisine,description,address,phone,email,website,instagram,opening_hours,google_place_id,lat,lng,price_level,halal_grade,alcohol_free,prayer_room,family_friendly,subscription_plan,cities(name),countries(name,flag)")
    .eq("slug", params.slug)
    .eq("status", "published")
    .single();

  if (result.error || !result.data) {
    notFound();
  }

  const restaurant: any = result.data;
  const country = restaurant.countries?.[0] ?? restaurant.countries;
  const city = restaurant.cities?.[0] ?? restaurant.cities;
  const website = websiteUrl(restaurant.website);
  const instagram = instagramUrl(restaurant.instagram);
  const menuResult = await supabase
    .from("menu_categories")
    .select("id,name,sort_order,menu_items(id,name,description,price,currency,is_available,sort_order)")
    .eq("restaurant_id", restaurant.id)
    .order("sort_order", { ascending: true });
  const menuCategories = (menuResult.data ?? [])
    .map((category: any) => ({
      ...category,
      menu_items: (category.menu_items ?? [])
        .filter((item: any) => item.is_available)
        .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    }))
    .filter((category: any) => category.menu_items.length > 0);
  const certificateResult = await supabase
    .from("certificates")
    .select("id,body,certificate_number,valid_from,valid_until,storage_path,status")
    .eq("restaurant_id", restaurant.id)
    .eq("status", "approved")
    .order("valid_until", { ascending: false });
  const certificate: any = certificateResult.data?.[0] ?? null;
  const photoResult = await supabase
    .from("restaurant_photos")
    .select("id,storage_path,alt_text,sort_order")
    .eq("restaurant_id", restaurant.id)
    .order("sort_order", { ascending: true });
  const photos = photoResult.data ?? [];
  const reviewsResult = await supabase
    .from("reviews")
    .select("id,author_name,rating,halal_rating,food_rating,body,owner_response,created_at")
    .eq("restaurant_id", restaurant.id)
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(20);
  const reviews = reviewsResult.data ?? [];
  const menuItemCount = menuCategories.reduce((total: number, category: any) => total + category.menu_items.length, 0);
  const averageRating = reviews.length > 0
    ? reviews.reduce((total: number, review: any) => total + (review.rating ?? 0), 0) / reviews.length
    : null;
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    name: restaurant.name,
    description: restaurant.description || undefined,
    address: restaurant.address,
    telephone: restaurant.phone || undefined,
    email: restaurant.email || undefined,
    servesCuisine: restaurant.cuisine,
    url: absoluteUrl(`/restaurants/${restaurant.slug}`),
    image: photos.map((photo) => photo.storage_path),
    priceRange: priceLabel(restaurant.price_level),
    aggregateRating: averageRating
      ? {
          "@type": "AggregateRating",
          ratingValue: Number(averageRating.toFixed(1)),
          reviewCount: reviews.length
        }
      : undefined,
    geo: restaurant.lat !== null && restaurant.lng !== null
      ? {
          "@type": "GeoCoordinates",
          latitude: restaurant.lat,
          longitude: restaurant.lng
        }
      : undefined
  };
  const countryHref = country?.name ? `/?country=${encodeURIComponent(country.name)}` : "/";
  const cityHref = country?.name && city?.name
    ? `/?country=${encodeURIComponent(country.name)}&city=${encodeURIComponent(city.name)}`
    : countryHref;

  return (
    <main className="page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <nav className="breadcrumb" aria-label="Sayfa yolu">
        <a href="/">Restoranlar</a>
        <a href={countryHref}>{country?.flag} {country?.name ?? "Bilinmiyor"}</a>
        <a href={cityHref}>{city?.name ?? "Bilinmiyor"}</a>
      </nav>
      <section className="detail-hero">
        <div className="panel">
          <div className="card-top">
            <span className="pill">Grade {restaurant.halal_grade}</span>
            <span className="pill">{restaurant.subscription_plan}</span>
            {restaurant.alcohol_free ? <span className="pill">Alkolsüz</span> : null}
          </div>
          <h1>{restaurant.name}</h1>
          <p className="muted">
            {country?.flag} {country?.name ?? "Bilinmiyor"} · {city?.name ?? "Bilinmiyor"}
          </p>
          <p>{restaurant.description || "Bu restoran için açıklama yakında eklenecek."}</p>
          <div className="detail-actions">
            <a
              className="button primary"
              href={mapsUrl(
                restaurant.name,
                restaurant.address,
                city?.name ?? null,
                country?.name ?? null,
                restaurant.lat,
                restaurant.lng,
                restaurant.google_place_id
              )}
              target="_blank"
              rel="noreferrer"
            >
              Yol Tarifi
            </a>
            {restaurant.phone ? <a className="button" href={`tel:${restaurant.phone}`}>Ara</a> : null}
            {website ? <a className="button" href={website} target="_blank" rel="noreferrer">Web</a> : null}
            {instagram ? <a className="button" href={instagram} target="_blank" rel="noreferrer">Instagram</a> : null}
            <a
              className="button"
              href={googleSearchUrl(restaurant.name, restaurant.address, city?.name ?? null, country?.name ?? null)}
              target="_blank"
              rel="noreferrer"
            >
              Google'da Ara
            </a>
            <a className="button" href="#menu">Menü</a>
            <a className="button" href="#reviews">Yorumlar</a>
          </div>
        </div>

        <aside className="panel">
          <h2>Restoran Bilgileri</h2>
          <div className="info-list">
            <p><strong>Adres</strong><span>{restaurant.address}</span></p>
            {restaurant.opening_hours ? <p><strong>Çalışma saatleri</strong><span>{restaurant.opening_hours}</span></p> : null}
            <p><strong>Mutfak</strong><span>{restaurant.cuisine}</span></p>
            <p><strong>Fiyat</strong><span>{priceLabel(restaurant.price_level)}</span></p>
            {restaurant.phone ? <p><strong>Telefon</strong><span>{restaurant.phone}</span></p> : null}
            {restaurant.email ? <p><strong>E-posta</strong><span>{restaurant.email}</span></p> : null}
            {website ? (
              <p><strong>Web</strong><span><a href={website} target="_blank" rel="noreferrer">Web sitesini aç</a></span></p>
            ) : null}
            {instagram ? (
              <p><strong>Instagram</strong><span><a href={instagram} target="_blank" rel="noreferrer">{restaurant.instagram}</a></span></p>
            ) : null}
          </div>
        </aside>
      </section>

      <section className="trust-strip" aria-label="Restoran kayıt özeti">
        <article className="trust-item">
          <span>Konum</span>
          <strong>{restaurant.google_place_id || (restaurant.lat !== null && restaurant.lng !== null) ? "Doğrulanabilir" : "Adresle aranır"}</strong>
          <p>{restaurant.google_place_id ? "Google Place ID bağlı" : restaurant.lat !== null && restaurant.lng !== null ? "Koordinat kayıtlı" : "Koordinat bekleniyor"}</p>
        </article>
        <article className="trust-item">
          <span>Sertifika</span>
          <strong>{certificate ? "Belge var" : "Belge bekleniyor"}</strong>
          <p>{certificate?.body ?? "Admin onayından sonra burada görünür"}</p>
        </article>
        <article className="trust-item">
          <span>Menü</span>
          <strong>{menuItemCount > 0 ? `${menuItemCount} ürün` : "Henüz yok"}</strong>
          <p>{menuCategories.length > 0 ? `${menuCategories.length} kategori yayında` : "İşletme menü ekleyebilir"}</p>
        </article>
        <article className="trust-item">
          <span>Yorum</span>
          <strong>{averageRating ? averageRating.toFixed(1) : "Bekleniyor"}</strong>
          <p>{reviews.length > 0 ? `${reviews.length} onaylı yorum` : "İlk yorum bekleniyor"}</p>
        </article>
      </section>

      {photos.length > 0 ? (
        <section className="panel photo-panel">
          <span className="pill">Fotoğraflar</span>
          <div className="photo-grid">
            {photos.map((photo) => (
              <img
                key={photo.id}
                src={photo.storage_path}
                alt={photo.alt_text || `${restaurant.name} fotoğrafı`}
                loading="lazy"
              />
            ))}
          </div>
        </section>
      ) : null}

      <section className="grid">
        <article className="card">
          <span className="pill">Helal Durumu</span>
          <h3>Grade {restaurant.halal_grade}</h3>
          {certificate ? (
            <div className="certificate-box">
              <p><strong>{certificate.body}</strong></p>
              {certificate.certificate_number ? <p className="muted">Belge no: {certificate.certificate_number}</p> : null}
              {certificate.valid_until ? <p className="muted">Geçerli: {formatDate(certificate.valid_until)}</p> : null}
              {certificate.storage_path ? (
                <a className="button" href={certificate.storage_path} target="_blank" rel="noreferrer">
                  Sertifikayı Görüntüle
                </a>
              ) : null}
            </div>
          ) : (
            <p className="muted">Bu restoran için onaylı sertifika belgesi henüz eklenmedi.</p>
          )}
        </article>
        <article className="card">
          <span className="pill">Özellikler</span>
          <div className="feature-row" style={{ marginTop: 12 }}>
            {restaurant.alcohol_free ? <span className="pill">Alkolsüz</span> : null}
            {restaurant.prayer_room ? <span className="pill">Mescid</span> : null}
            {restaurant.family_friendly ? <span className="pill">Aile dostu</span> : null}
            {!restaurant.alcohol_free && !restaurant.prayer_room && !restaurant.family_friendly ? (
              <span className="muted">Henüz özellik eklenmedi.</span>
            ) : null}
          </div>
        </article>
      </section>

      <section className="panel menu-panel" id="menu">
        <span className="pill">Menü</span>
        <h2>Menü ve fiyatlar</h2>
        {menuCategories.length > 0 ? (
          <div className="menu-grid">
            {menuCategories.map((category: any) => (
              <div className="menu-category" key={category.id}>
                <h3>{category.name}</h3>
                <div className="menu-items">
                  {category.menu_items.map((item: any) => (
                    <article className="menu-item" key={item.id}>
                      <div>
                        <h4>{item.name}</h4>
                        {item.description ? <p className="muted">{item.description}</p> : null}
                      </div>
                      <strong>{formatMenuPrice(item.price, item.currency)}</strong>
                    </article>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <span className="pill">Menü bekleniyor</span>
            <h3>Bu restoran için menü henüz eklenmedi.</h3>
            <p className="muted">İşletme menü ve fiyatlarını eklediğinde burada görünecek.</p>
          </div>
        )}
      </section>

      <section className="panel reviews-panel" id="reviews">
        <div className="section-heading">
          <div>
            <span className="pill">Yorumlar</span>
            <h2>Kullanıcı deneyimleri</h2>
          </div>
          {averageRating ? (
            <div className="rating-summary">
              <strong>{averageRating.toFixed(1)}</strong>
              <span>{reviews.length} yorum</span>
            </div>
          ) : null}
        </div>

        {searchParams?.reviewed ? (
          <div className="notice success">Yorumun alındı. Admin onayından sonra yayına çıkacak.</div>
        ) : null}
        {searchParams?.reviewError ? (
          <div className="notice error">Yorum kaydedilemedi: {decodeURIComponent(searchParams.reviewError)}</div>
        ) : null}

        <form action={submitReview} className="review-form">
          <input type="hidden" name="restaurant_id" value={restaurant.id} />
          <input type="hidden" name="slug" value={restaurant.slug} />
          <div className="form-grid">
            <input name="author_name" placeholder="Adınız (opsiyonel)" />
            <select name="rating" defaultValue="5" required>
              <option value="5">5 yıldız</option>
              <option value="4">4 yıldız</option>
              <option value="3">3 yıldız</option>
              <option value="2">2 yıldız</option>
              <option value="1">1 yıldız</option>
            </select>
            <select name="halal_rating" defaultValue="">
              <option value="">Helal uyumu puanı</option>
              <option value="5">Helal uyumu 5</option>
              <option value="4">Helal uyumu 4</option>
              <option value="3">Helal uyumu 3</option>
              <option value="2">Helal uyumu 2</option>
              <option value="1">Helal uyumu 1</option>
            </select>
            <select name="food_rating" defaultValue="">
              <option value="">Yemek puanı</option>
              <option value="5">Yemek 5</option>
              <option value="4">Yemek 4</option>
              <option value="3">Yemek 3</option>
              <option value="2">Yemek 2</option>
              <option value="1">Yemek 1</option>
            </select>
          </div>
          <textarea name="body" required placeholder="Deneyiminizi yazın. Menü, temizlik, helal hassasiyeti veya servis hakkında kısa bir not bırakabilirsiniz." />
          <button className="button primary" type="submit">Yorumu Gönder</button>
        </form>

        {reviews.length > 0 ? (
          <div className="review-list">
            {reviews.map((review: any) => (
              <article className="review-card" key={review.id}>
                <div className="review-top">
                  <strong>{review.author_name || "Misafir"}</strong>
                  <span>{formatReviewDate(review.created_at)}</span>
                </div>
                <p className="review-stars">{stars(review.rating)}</p>
                <p>{review.body}</p>
                <div className="feature-row">
                  {review.halal_rating ? <span className="pill">Helal {review.halal_rating}/5</span> : null}
                  {review.food_rating ? <span className="pill">Yemek {review.food_rating}/5</span> : null}
                </div>
                {review.owner_response ? (
                  <div className="owner-response">
                    <strong>İşletme yanıtı</strong>
                    <p>{review.owner_response}</p>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <span className="pill">İlk yorum</span>
            <h3>Bu restoran için henüz yorum yok.</h3>
            <p className="muted">Deneyimini paylaşarak diğer kullanıcılara yardımcı olabilirsin.</p>
          </div>
        )}
      </section>
    </main>
  );
}
