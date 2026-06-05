import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function priceLabel(level: number | null) {
  if (!level) return "Fiyat bekleniyor";
  return "€".repeat(Math.max(1, Math.min(level, 4)));
}

function mapsUrl(address: string, lat: number | null, lng: number | null) {
  const destination = lat !== null && lng !== null ? `${lat},${lng}` : address;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
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
            <a className="button primary" href={mapsUrl(restaurant.address, restaurant.lat, restaurant.lng)} target="_blank" rel="noreferrer">
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
          </div>
        </aside>
      </section>

      <section className="grid">
        <article className="card">
          <span className="pill">Helal Durumu</span>
          <h3>Grade {restaurant.halal_grade}</h3>
          <p className="muted">Detaylı sertifika ve belge görüntüleme alanı bir sonraki sürümde bağlanacak.</p>
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
        <article className="card">
          <span className="pill">Menü</span>
          <h3>Menü yakında</h3>
          <p className="muted">İşletmeler menü ve fiyatlarını eklediğinde bu alanda görünecek.</p>
        </article>
      </section>
    </main>
  );
}
