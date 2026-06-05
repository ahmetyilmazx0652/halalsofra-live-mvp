import { plans } from "@/lib/plans";
import { redirect } from "next/navigation";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type CityOption = {
  id: string;
  name: string;
  country_id: string;
  countryName: string;
  countryFlag: string;
};

function cleanText(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function slugify(value: string) {
  return value
    .toLocaleLowerCase("tr")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function submitRestaurant(formData: FormData) {
  "use server";

  if (!hasSupabaseConfig || !supabase) {
    redirect("/owner?error=config");
  }

  const name = cleanText(formData.get("name"));
  const cityId = cleanText(formData.get("city_id"));
  const address = cleanText(formData.get("address"));

  if (!name || !cityId || !address) {
    redirect("/owner?error=missing");
  }

  const cityResult = await supabase
    .from("cities")
    .select("id,country_id")
    .eq("id", cityId)
    .single();

  if (cityResult.error || !cityResult.data) {
    redirect("/owner?error=city");
  }

  const slug = `${slugify(name)}-${Date.now()}`;
  const priceLevel = Number(cleanText(formData.get("price_level"))) || 2;
  const insertResult = await supabase.from("restaurants").insert({
    country_id: cityResult.data.country_id,
    city_id: cityResult.data.id,
    name,
    slug,
    cuisine: cleanText(formData.get("cuisine")) || "turkish",
    description: cleanText(formData.get("description")),
    address,
    phone: cleanText(formData.get("phone")),
    email: cleanText(formData.get("email")),
    google_place_id: cleanText(formData.get("google_place_id")),
    price_level: Math.min(Math.max(priceLevel, 1), 4),
    halal_grade: cleanText(formData.get("halal_grade")) || "B",
    status: "pending",
    subscription_plan: cleanText(formData.get("subscription_plan")) || "free",
    alcohol_free: formData.get("alcohol_free") === "on",
    prayer_room: formData.get("prayer_room") === "on",
    family_friendly: formData.get("family_friendly") === "on"
  });

  if (insertResult.error) {
    redirect(`/owner?error=${encodeURIComponent(insertResult.error.message)}`);
  }

  redirect("/owner?submitted=1");
}

async function getCities() {
  if (!hasSupabaseConfig || !supabase) return [];

  const result = await supabase
    .from("cities")
    .select("id,name,country_id,countries(name,flag)")
    .order("name");

  if (result.error) return [];
  return (result.data ?? []).map((city: any) => ({
    id: city.id,
    name: city.name,
    country_id: city.country_id,
    countryName: city.countries?.[0]?.name ?? city.countries?.name ?? "Bilinmiyor",
    countryFlag: city.countries?.[0]?.flag ?? city.countries?.flag ?? "🌍"
  }));
}

export default async function OwnerPage({
  searchParams
}: {
  searchParams?: { submitted?: string; error?: string };
}) {
  const cities = await getCities();

  return (
    <main className="page">
      <section className="panel">
        <span className="pill">İşletme Paneli</span>
        <h1>Restoranını ekle, menünü ve sertifikanı yönet.</h1>
        <p className="muted">
          Başvurular Supabase'e pending olarak kaydedilir; admin onayından sonra yayına çıkar.
        </p>
      </section>

      <section className="plans" style={{ marginTop: 16 }}>
        {plans.map((plan) => (
          <article className={`plan ${plan.recommended ? "recommended" : ""}`} key={plan.id}>
            {plan.recommended ? <span className="pill">Önerilen</span> : null}
            <h3>{plan.name}</h3>
            <h2>{plan.price}<span className="muted" style={{ fontSize: 14 }}>/ay</span></h2>
            <p className="muted">{plan.description}</p>
            {plan.features.map((feature) => (
              <p key={feature}>✓ {feature}</p>
            ))}
            <button className="button primary" style={{ width: "100%" }}>Paketi Seç</button>
          </article>
        ))}
      </section>

      <section className="panel" style={{ marginTop: 16 }}>
        <h2>Restoran Başvurusu</h2>
        {searchParams?.submitted ? (
          <div className="notice success">Başvuru alındı. Admin onayından sonra yayına çıkacak.</div>
        ) : null}
        {searchParams?.error ? (
          <div className="notice error">Başvuru kaydedilemedi: {decodeURIComponent(searchParams.error)}</div>
        ) : null}
        <form action={submitRestaurant}>
          <div className="form-grid">
            <input name="name" placeholder="Restoran adı" required />
            <input name="phone" placeholder="Telefon" />
            <input name="email" type="email" placeholder="E-posta" />
            <select name="city_id" required>
              <option value="">Ülke / şehir seç</option>
              {cities.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.countryFlag} {city.countryName} / {city.name}
                </option>
              ))}
            </select>
            <input name="address" placeholder="Tam adres" required />
            <input name="google_place_id" placeholder="Google Place ID" />
            <select name="cuisine" defaultValue="turkish">
              <option value="turkish">Türk</option>
              <option value="arabic">Arap</option>
              <option value="burger">Burger</option>
              <option value="bakery">Fırın</option>
              <option value="market">Market</option>
              <option value="butcher">Kasap</option>
            </select>
            <select name="halal_grade" defaultValue="B">
              <option value="A">Grade A</option>
              <option value="B">Grade B</option>
              <option value="C">Grade C</option>
            </select>
            <select name="price_level" defaultValue="2">
              <option value="1">€</option>
              <option value="2">€€</option>
              <option value="3">€€€</option>
              <option value="4">€€€€</option>
            </select>
            <select name="subscription_plan" defaultValue="free">
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>{plan.name}</option>
              ))}
            </select>
          </div>
          <textarea name="description" style={{ marginTop: 12 }} placeholder="Kısa açıklama" />
          <div className="checks">
            <label><input name="alcohol_free" type="checkbox" /> Alkolsüz</label>
            <label><input name="prayer_room" type="checkbox" /> Mescid var</label>
            <label><input name="family_friendly" type="checkbox" /> Aile dostu</label>
          </div>
          <button className="button primary" style={{ marginTop: 12 }}>Başvuruyu Gönder</button>
        </form>
      </section>
    </main>
  );
}
