import { unstable_noStore as noStore } from "next/cache";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DebugPage() {
  noStore();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const checks = {
    hasUrl: Boolean(url),
    urlLooksValid: url.startsWith("https://") && url.endsWith(".supabase.co"),
    hasAnonKey: Boolean(anonKey),
    anonKeyLooksValid: anonKey.startsWith("eyJ") || anonKey.startsWith("sb_publishable_")
  };

  let result = "Supabase client olusmadi.";
  let counts = {
    countries: 0,
    cities: 0,
    restaurants: 0
  };

  if (hasSupabaseConfig && supabase) {
    const [countries, cities, restaurants] = await Promise.all([
      supabase.from("countries").select("id", { count: "exact", head: true }),
      supabase.from("cities").select("id", { count: "exact", head: true }),
      supabase
        .from("restaurants")
        .select("id", { count: "exact", head: true })
        .eq("status", "published")
    ]);

    const error = countries.error ?? cities.error ?? restaurants.error;
    if (error) {
      result = error.message;
    } else {
      result = "Supabase okunuyor.";
      counts = {
        countries: countries.count ?? 0,
        cities: cities.count ?? 0,
        restaurants: restaurants.count ?? 0
      };
    }
  }

  return (
    <main className="page">
      <section className="panel">
        <span className="pill">Debug</span>
        <h1>Supabase bağlantı kontrolü</h1>
        <p className="muted">Bu sayfa anahtar degerlerini gostermez, sadece baglantiyi test eder.</p>
      </section>

      <section className="grid" style={{ marginTop: 16 }}>
        <article className="card">
          <h3>Environment</h3>
          <p>URL var: {checks.hasUrl ? "evet" : "hayir"}</p>
          <p>URL formati dogru: {checks.urlLooksValid ? "evet" : "hayir"}</p>
          <p>Anon key var: {checks.hasAnonKey ? "evet" : "hayir"}</p>
          <p>Anon key formati dogru: {checks.anonKeyLooksValid ? "evet" : "hayir"}</p>
        </article>
        <article className="card">
          <h3>Okuma Testi</h3>
          <p>{result}</p>
          <p>Ulkeler: {counts.countries}</p>
          <p>Sehirler: {counts.cities}</p>
          <p>Yayin restoran: {counts.restaurants}</p>
        </article>
      </section>
    </main>
  );
}
