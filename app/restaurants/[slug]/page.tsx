import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";
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
  lng: number | null
) {
  const destination = lat !== null && lng !== null
    ? `${lat},${lng}`
    : [name, address, cityName, countryName].filter(Boolean).join(", ");

  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
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

export default async function RestaurantDetailPage({
  params
}: {
  params: { slug: string };
}) {
  noStore();

  if (!hasSupabaseConfig || !supabase) {
    notFound();
  }

  const result = await supabase
    .from("restaurants")
    .select("id,name,slug,cuisine,description,address,phone,email,website,instagram,lat,lng,price_level,halal_grade,alcohol_free,prayer_room,family_friendly,subscription_plan,cities(name),countries(name,flag)")
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

  return (
    <main className="page">
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
                restaurant.lng
              )}
              target="_blank"
              rel="noreferrer"
            >
              Yol Tarifi
            </a>
            {restaurant.phone ? <a className="button" href={`tel:${restaurant.phone}`}>Ara</a> : null}
          </div>
        </div>

        <aside className="panel">
          <h2>Restoran Bilgileri</h2>
          <div className="info-list">
            <p><strong>Adres</strong><span>{restaurant.address}</span></p>
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

      <section className="panel menu-panel">
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
    </main>
  );
}
