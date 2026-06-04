import { demoCountries, demoRestaurants } from "@/lib/demo-data";

export default function HomePage() {
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
              {demoCountries.map((country) => (
                <option key={country.id}>{country.flag} {country.name}</option>
              ))}
            </select>
            <select aria-label="Şehir">
              {demoCountries[0].cities.map((city) => (
                <option key={city}>{city}</option>
              ))}
            </select>
            <input aria-label="Arama" placeholder="Restoran, yemek veya adres ara" />
          </div>
          <div className="stats">
            <div className="stat"><strong>384</strong><span>başlangıç kaydı</span></div>
            <div className="stat"><strong>99</strong><span>şehir</span></div>
            <div className="stat"><strong>4</strong><span>abonelik paketi</span></div>
          </div>
        </div>
        <div className="panel">
          <h2>Canlı MVP durumu</h2>
          <p className="muted">
            Bu sayfa Supabase bağlanınca canlı restoran verisini okuyacak.
            Şimdilik lansman iskeleti demo verilerle gösteriliyor.
          </p>
          <a className="button primary" href="/owner">İşletme olarak başla</a>
        </div>
      </section>

      <section className="grid">
        {demoRestaurants.map((restaurant) => (
          <article className={`card ${restaurant.featured ? "featured" : ""}`} key={restaurant.id}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <span className="pill">Grade {restaurant.grade}</span>
              {restaurant.featured ? <span className="pill">Öne çıkan</span> : null}
            </div>
            <h3>{restaurant.name}</h3>
            <p className="muted">{restaurant.country} · {restaurant.city}</p>
            <p>{restaurant.address}</p>
            <p><strong>★ {restaurant.rating}</strong> · {restaurant.cuisine} · {restaurant.price}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
