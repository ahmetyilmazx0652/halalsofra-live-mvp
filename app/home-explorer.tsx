"use client";

import { useMemo, useState } from "react";
import type { HomeCountry, HomeRestaurant, HomeData } from "@/lib/home-data";

type HomeExplorerProps = {
  countries: HomeCountry[];
  restaurants: HomeRestaurant[];
  stats: HomeData["stats"];
  source: HomeData["source"];
  notice?: string;
  initialCountry?: string;
  initialCity?: string;
  initialQuery?: string;
  initialFeature?: string;
  initialSort?: string;
};

const ALL_CITIES = "__all_cities__";
const ALL_COUNTRIES = "__all_countries__";

const featureFilters = [
  { id: "all", label: "Tümü" },
  { id: "grade-a", label: "Grade A" },
  { id: "alcohol-free", label: "Alkolsüz" },
  { id: "prayer-room", label: "Mescid" },
  { id: "family-friendly", label: "Aile dostu" },
  { id: "certified", label: "Sertifikalı" },
  { id: "with-menu", label: "Menülü" },
  { id: "with-reviews", label: "Yorumlu" },
  { id: "precise-location", label: "Konumu net" },
  { id: "featured", label: "Öne çıkan" }
] as const;

type FeatureFilter = typeof featureFilters[number]["id"];
type SortMode = "featured" | "complete" | "name" | "reviews";

function isFeatureFilter(value: string | undefined): value is FeatureFilter {
  return featureFilters.some((filter) => filter.id === value);
}

function isSortMode(value: string | undefined): value is SortMode {
  return value === "featured" || value === "complete" || value === "name" || value === "reviews";
}

function normalize(value: string) {
  return value.toLocaleLowerCase("tr").trim();
}

function completenessScore(restaurant: HomeRestaurant) {
  return [
    restaurant.featured,
    restaurant.grade === "A",
    restaurant.hasCertificate,
    restaurant.menuItemCount > 0,
    restaurant.reviewCount > 0,
    restaurant.hasPreciseLocation,
    restaurant.alcoholFree,
    restaurant.prayerRoom,
    restaurant.familyFriendly
  ].filter(Boolean).length;
}

export function HomeExplorer({
  countries,
  restaurants,
  stats,
  source,
  notice,
  initialCountry,
  initialCity,
  initialQuery,
  initialFeature,
  initialSort
}: HomeExplorerProps) {
  const hasInitialCountry = typeof initialCountry === "string" && countries.some((country) => country.name === initialCountry);
  const initialCountryValue = hasInitialCountry
    ? initialCountry
    : ALL_COUNTRIES;
  const hasInitialCity = typeof initialCity === "string" && (
    initialCountryValue === ALL_COUNTRIES
      ? countries.some((country) => country.cities.includes(initialCity))
      : countries.find((country) => country.name === initialCountryValue)?.cities.includes(initialCity)
  );
  const initialCityValue = hasInitialCity
    ? initialCity
    : ALL_CITIES;

  const [selectedCountry, setSelectedCountry] = useState(initialCountryValue);
  const [selectedCity, setSelectedCity] = useState(initialCityValue);
  const [selectedFeature, setSelectedFeature] = useState<FeatureFilter>(
    isFeatureFilter(initialFeature) ? initialFeature : "all"
  );
  const [query, setQuery] = useState(initialQuery?.trim() ?? "");
  const [sortMode, setSortMode] = useState<SortMode>(isSortMode(initialSort) ? initialSort : "featured");
  const countryCount = countries.length;

  const cityOptions = useMemo(() => {
    if (selectedCountry === ALL_COUNTRIES) {
      return Array.from(new Set(countries.flatMap((country) => country.cities))).sort((a, b) =>
        a.localeCompare(b, "tr")
      );
    }

    return countries.find((country) => country.name === selectedCountry)?.cities ?? [];
  }, [countries, selectedCountry]);
  const visibleCityCount = cityOptions.length;

  const filteredRestaurants = useMemo(() => {
    const q = normalize(query);

    const matches = restaurants.filter((restaurant) => {
      const countryMatch = selectedCountry === ALL_COUNTRIES || restaurant.country === selectedCountry;
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
      const featureMatch =
        selectedFeature === "all" ||
        (selectedFeature === "grade-a" && restaurant.grade === "A") ||
        (selectedFeature === "alcohol-free" && restaurant.alcoholFree) ||
        (selectedFeature === "prayer-room" && restaurant.prayerRoom) ||
        (selectedFeature === "family-friendly" && restaurant.familyFriendly) ||
        (selectedFeature === "certified" && restaurant.hasCertificate) ||
        (selectedFeature === "with-menu" && restaurant.menuItemCount > 0) ||
        (selectedFeature === "with-reviews" && restaurant.reviewCount > 0) ||
        (selectedFeature === "precise-location" && restaurant.hasPreciseLocation) ||
        (selectedFeature === "featured" && restaurant.featured);

      return countryMatch && cityMatch && queryMatch && featureMatch;
    });

    return [...matches].sort((a, b) => {
      if (sortMode === "name") {
        return a.name.localeCompare(b.name, "tr");
      }
      if (sortMode === "reviews") {
        return b.reviewCount - a.reviewCount || b.menuItemCount - a.menuItemCount || a.name.localeCompare(b.name, "tr");
      }
      if (sortMode === "complete") {
        return completenessScore(b) - completenessScore(a) || b.reviewCount - a.reviewCount || a.name.localeCompare(b.name, "tr");
      }

      return Number(b.featured) - Number(a.featured) || completenessScore(b) - completenessScore(a) || a.name.localeCompare(b.name, "tr");
    });
  }, [query, restaurants, selectedCity, selectedCountry, selectedFeature, sortMode]);

  return (
    <main className="page">
      <section className="hero">
        <div className="panel">
          <span className="pill">HalalSofra Beta</span>
<h1>Avrupa'daki helal restoranları keşfet.</h1>
<p>
  Yakınındaki doğrulanmış helal restoranları, kafeleri ve fırınları bul.
  Yeni şehirler ve restoranlar düzenli olarak ekleniyor.
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
              <option value={ALL_COUNTRIES}>Tüm ülkeler</option>
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
          <div className="filter-chips" aria-label="Özellik filtresi">
            {featureFilters.map((filter) => (
              <button
                className={`chip ${selectedFeature === filter.id ? "active" : ""}`}
                key={filter.id}
                type="button"
                onClick={() => setSelectedFeature(filter.id)}
              >
                {filter.label}
              </button>
            ))}
          </div>
          <div className="stats">
            <div className="stat"><strong>{filteredRestaurants.length}</strong><span>sonuç</span></div>
            <div className="stat"><strong>{stats.restaurants}</strong><span>{source === "supabase" ? "yayındaki mekan" : "örnek kayıt"}</span></div>
            <div className="stat"><strong>{stats.cities}</strong><span>şehir</span></div>
          </div>
        </div>
        <div className="panel">
          <h2>Büyüyen Avrupa helal rehberi</h2>
          <p className="muted">
            {notice}
          </p>
          <div className="mini-stats">
            <span>{countryCount} ülke</span>
            <span>{stats.cities} şehir</span>
            <span>{stats.plans} işletme paketi</span>
          </div>
          <div className="detail-actions">
            <a className="button primary" href="/owner">İşletme olarak başla</a>
            <a className="button" href="#results">Mekanlara Bak</a>
          </div>
        </div>
      </section>

      <section className="launch-strip" aria-label="HalalSofra yayın kapsamı">
        <article>
          <span className="pill">Kapsam</span>
          <strong>{countryCount} ülke ve {stats.cities} şehir</strong>
          <p className="muted">Rehber ülke ve şehir bazında büyüyecek şekilde kuruldu.</p>
        </article>
        <article>
          <span className="pill">Doğrulama</span>
          <strong>Admin onaylı yayın</strong>
          <p className="muted">Yeni işletmeler önce kontrol kuyruğuna düşer, sonra yayına alınır.</p>
        </article>
        <article>
          <span className="pill">İşletme</span>
          <strong>Menü, fotoğraf ve sertifika</strong>
          <p className="muted">İşletmeler kayıtlarını zamanla tamamlayabilir.</p>
        </article>
      </section>

      <section className="results-toolbar" id="results" aria-label="Sonuç kontrolü">
        <div>
          <span className="pill">Sonuçlar</span>
          <strong>{filteredRestaurants.length} mekan listeleniyor</strong>
          <span className="muted">{selectedCountry === ALL_COUNTRIES ? `${visibleCityCount} şehir taranıyor` : selectedCountry}</span>
        </div>
        <label>
          <span>Sırala</span>
          <select
            aria-label="Sıralama"
            value={sortMode}
            onChange={(event) => setSortMode(event.target.value as SortMode)}
          >
            <option value="featured">Öne çıkan ve güven sinyali</option>
            <option value="complete">En dolu kayıt</option>
            <option value="reviews">En çok yorum</option>
            <option value="name">Ada göre</option>
          </select>
        </label>
      </section>

      <section className="grid">
        {filteredRestaurants.map((restaurant) => (
          <a className={`card restaurant-card ${restaurant.featured ? "featured" : ""}`} href={`/restaurants/${restaurant.slug}`} key={restaurant.id}>
            {restaurant.photoUrl ? (
              <img className="restaurant-card-photo" src={restaurant.photoUrl} alt={`${restaurant.name} fotoğrafı`} loading="lazy" />
            ) : null}
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
            <div className="card-signals" aria-label={`${restaurant.name} öne çıkan bilgiler`}>
  {restaurant.hasCertificate ? <span>Sertifikalı</span> : null}
  {restaurant.alcoholFree ? <span>Alkolsüz</span> : null}
  {restaurant.familyFriendly ? <span>Aile dostu</span> : null}
            </div>
        
          </a>
        ))}
      </section>

      {restaurants.length === 0 ? (
        <section className="empty-state">
          <span className="pill">Veritabanı hazır</span>
          <h2>Henüz yayınlanmış restoran yok.</h2>
          <p className="muted">
            Onaylanan restoranlar eklendiğinde burada güvenilir mekanlar listelenecek.
          </p>
          <a className="button primary" href="/owner">İlk restoran başvurusunu oluştur</a>
        </section>
      ) : null}

      {restaurants.length > 0 && filteredRestaurants.length === 0 ? (
        <section className="empty-state">
          <span className="pill">Sonuç yok</span>
          <h2>Bu filtrelerle restoran bulunamadı.</h2>
          <p className="muted">
            Başka bir şehir seçin, özellik filtresini değiştirin veya arama metnini kısaltın.
          </p>
          <button className="button" type="button" onClick={() => {
            setSelectedFeature("all");
            setQuery("");
          }}>
            Filtreleri Hafiflet
          </button>
        </section>
      ) : null}
    </main>
  );
}
