import { unstable_noStore as noStore } from "next/cache";
import { getHomeData } from "@/lib/home-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HomePage() {
  noStore();
  const { countries, restaurants, stats, source, notice } = await getHomeData();
  const firstCountryCities = countries[0]?.cities ?? [];

  return (
    <main className="page">
      <section className="hero">
        <div className="panel">
          <span className="pill">Avrupa Helal Restoran Rehberi</span>
          <h1>Ülke seç, şehir seç, güvenilir helal mekan bul.</h1>
          <p>
            HalalSofra; restoran, kafe, fırın, market ve kasapları sertifika,
            menü, fiyat ve konum bilgileriyle tek yerde toplar.
          </p>
          <div className="filters">
            <select aria-label="Ülke">
              {countries.map((country) => (
                <option key={country.id}>{country.flag} {country.name}</option>
              ))}
            </select>
            <select aria-label="Şehir">
              {firstCountryCities.map((city) => (
                <option key={city}>{city}</option>
              ))}
            </select>
            <input aria-label="Arama" placeholder="Restoran, yemek veya adres ara" />
          </div>
          <div className="stats">
            <div className="stat"><strong>{stats.restaurants}</strong><span>{source === "supabase" ? "canlı restoran" : "başlangıç kaydı"}</span></div>
            <div className="stat"><strong>{stats.cities}</strong><span>şehir</span></div>
            <div className="stat"><strong>{stats.plans}</strong><span>abonelik paketi</span></div>
          </div>
        </div>
        <div className="panel">
          <h2>Canlı MVP durumu</h2>
          <p className="muted">
            {notice}
          </p>
          <a className="button primary" href="/owner">İşletme olarak başla</a>
        </div>
      </section>

      <section className="grid">
        {restaurants.map((restaurant) => (
          <article className={`card ${restaurant.featured ? "featured" : ""}`} key={restaurant.id}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <span className="pill">Grade {restaurant.grade}</span>
              {restaurant.featured ? <span className="pill">Öne çıkan</span> : null}
            </div>
            <h3>{restaurant.name}</h3>
            <p className="muted">{restaurant.country} · {restaurant.city}</p>
            <p>{restaurant.address}</p>
            <p>
              {restaurant.rating ? <><strong>★ {restaurant.rating}</strong> · </> : null}
              {restaurant.cuisine} · {restaurant.price}
            </p>
          </article>
        ))}
      </section>

      {restaurants.length === 0 ? (
        <section className="empty-state">
          <span className="pill">Veritabanı hazır</span>
          <h2>Henüz yayınlanmış restoran yok.</h2>
          <p className="muted">
            Admin onaylı restoranlar eklendiğinde burada gerçek canlı veriler görünecek.
          </p>
          <a className="button primary" href="/owner">İlk restoran başvurusunu oluştur</a>
        </section>
      ) : null}
    </main>
  );
}
