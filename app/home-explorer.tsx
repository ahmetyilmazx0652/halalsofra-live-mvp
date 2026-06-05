"use client";

import { useMemo, useState } from "react";
import type { HomeCountry, HomeRestaurant, HomeData } from "@/lib/home-data";

type HomeExplorerProps = {
  countries: HomeCountry[];
  restaurants: HomeRestaurant[];
  stats: HomeData["stats"];
  source: HomeData["source"];
  notice?: string;
};

const ALL_CITIES = "__all_cities__";

function normalize(value: string) {
  return value.toLocaleLowerCase("tr").trim();
}

export function HomeExplorer({
  countries,
  restaurants,
  stats,
  source,
  notice
}: HomeExplorerProps) {
  const [selectedCountry, setSelectedCountry] = useState(countries[0]?.name ?? "");
  const [selectedCity, setSelectedCity] = useState(ALL_CITIES);
  const [query, setQuery] = useState("");

  const cityOptions = useMemo(() => {
    return countries.find((country) => country.name === selectedCountry)?.cities ?? [];
  }, [countries, selectedCountry]);

  const filteredRestaurants = useMemo(() => {
    const q = normalize(query);

    return restaurants.filter((restaurant) => {
      const countryMatch = !selectedCountry || restaurant.country === selectedCountry;
      const cityMatch = selectedCity === ALL_CITIES || restaurant.city === selectedCity;
      const haystack = normalize(
        [
          restaurant.name,
          restaurant.address,
          restaurant.city,
          restaurant.country,
          restaurant.cuisine,
          restaurant.grade
        ].join(" ")
      );
      const queryMatch = !q || haystack.includes(q);

      return countryMatch && cityMatch && queryMatch;
    });
  }, [query, restaurants, selectedCity, selectedCountry]);

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
            <select
              aria-label="Ülke"
              value={selectedCountry}
              onChange={(event) => {
                setSelectedCountry(event.target.value);
                setSelectedCity(ALL_CITIES);
              }}
            >
              {countries.map((country) => (
                <option key={country.id} value={country.name}>{country.flag} {country.name}</option>
              ))}
            </select>
            <select
              aria-label="Şehir"
              value={selectedCity}
              onChange={(event) => setSelectedCity(event.target.value)}
            >
              <option value={ALL_CITIES}>Tüm şehirler</option>
              {cityOptions.map((city) => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>
            <input
              aria-label="Arama"
              placeholder="Restoran, yemek veya adres ara"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <div className="stats">
            <div className="stat"><strong>{filteredRestaurants.length}</strong><span>sonuç</span></div>
            <div className="stat"><strong>{stats.restaurants}</strong><span>{source === "supabase" ? "canlı restoran" : "başlangıç kaydı"}</span></div>
            <div className="stat"><strong>{stats.cities}</strong><span>şehir</span></div>
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
        {filteredRestaurants.map((restaurant) => (
          <a className={`card restaurant-card ${restaurant.featured ? "featured" : ""}`} href={`/restaurants/${restaurant.slug}`} key={restaurant.id}>
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
          </a>
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

      {restaurants.length > 0 && filteredRestaurants.length === 0 ? (
        <section className="empty-state">
          <span className="pill">Sonuç yok</span>
          <h2>Bu filtrelerle restoran bulunamadı.</h2>
          <p className="muted">
            Başka bir şehir seçin veya arama metnini kısaltın.
          </p>
        </section>
      ) : null}
    </main>
  );
}
