import { demoCountries, demoRestaurants } from "@/lib/demo-data";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";

export type HomeCountry = {
  id: string;
  name: string;
  flag: string;
  cities: string[];
};

export type HomeRestaurant = {
  id: string;
  name: string;
  country: string;
  city: string;
  cuisine: string;
  grade: string;
  price: string;
  rating: number | null;
  address: string;
  featured: boolean;
};

export type HomeData = {
  countries: HomeCountry[];
  restaurants: HomeRestaurant[];
  stats: {
    restaurants: number;
    cities: number;
    plans: number;
  };
  source: "demo" | "supabase" | "error";
  notice?: string;
};

function demoHomeData(): HomeData {
  const cityCount = demoCountries.reduce((count, country) => count + country.cities.length, 0);

  return {
    countries: demoCountries,
    restaurants: demoRestaurants.map((restaurant) => ({
      ...restaurant,
      rating: restaurant.rating
    })),
    stats: {
      restaurants: 384,
      cities: cityCount,
      plans: 4
    },
    source: "demo",
    notice: "Supabase ortam değişkenleri bulunamadığı için demo veri gösteriliyor."
  };
}

function priceLabel(level: number | null) {
  if (!level) return "Fiyat bekleniyor";
  return "€".repeat(Math.max(1, Math.min(level, 4)));
}

export async function getHomeData(): Promise<HomeData> {
  if (!hasSupabaseConfig || !supabase) {
    return demoHomeData();
  }

  const [countriesResult, citiesResult, restaurantsResult] = await Promise.all([
    supabase.from("countries").select("id,name,flag").order("name"),
    supabase.from("cities").select("id,country_id,name").order("name"),
    supabase
      .from("restaurants")
      .select("id,name,cuisine,address,price_level,halal_grade,is_featured,country_id,city_id")
      .eq("status", "published")
      .order("is_featured", { ascending: false })
      .order("created_at", { ascending: false })
  ]);

  if (countriesResult.error || citiesResult.error || restaurantsResult.error) {
    const message =
      countriesResult.error?.message ??
      citiesResult.error?.message ??
      restaurantsResult.error?.message ??
      "Supabase verisi okunamadı.";
    const fallback = demoHomeData();
    return {
      ...fallback,
      source: "error",
      notice: `Supabase bağlantısı kuruldu ama veri okunamadı: ${message}`
    };
  }

  const citiesByCountry = new Map<string, string[]>();
  const cityNameById = new Map<string, string>();
  for (const city of citiesResult.data ?? []) {
    const current = citiesByCountry.get(city.country_id) ?? [];
    current.push(city.name);
    citiesByCountry.set(city.country_id, current);
    cityNameById.set(city.id, city.name);
  }

  const countryNameById = new Map<string, string>();
  const countries = (countriesResult.data ?? []).map((country) => ({
    id: country.id,
    name: country.name,
    flag: country.flag,
    cities: citiesByCountry.get(country.id) ?? []
  }));
  for (const country of countries) {
    countryNameById.set(country.id, country.name);
  }

  const restaurants = (restaurantsResult.data ?? []).map((restaurant: any) => ({
    id: restaurant.id,
    name: restaurant.name,
    country: countryNameById.get(restaurant.country_id) ?? "Bilinmiyor",
    city: cityNameById.get(restaurant.city_id) ?? "Bilinmiyor",
    cuisine: restaurant.cuisine ?? "Restoran",
    grade: restaurant.halal_grade ?? "B",
    price: priceLabel(restaurant.price_level),
    rating: null,
    address: restaurant.address,
    featured: Boolean(restaurant.is_featured)
  }));

  return {
    countries,
    restaurants,
    stats: {
      restaurants: restaurants.length,
      cities: (citiesResult.data ?? []).length,
      plans: 4
    },
    source: "supabase",
    notice: "Supabase bağlantısı aktif. Yayındaki restoranlar veritabanından okunuyor."
  };
}
