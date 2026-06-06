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

function cleanPrice(value: FormDataEntryValue | null) {
  const text = cleanText(value).replace(",", ".");
  const price = Number(text);
  return Number.isFinite(price) && price > 0 ? price : null;
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
    website: cleanText(formData.get("website")),
    instagram: cleanText(formData.get("instagram")),
    opening_hours: cleanText(formData.get("opening_hours")),
    google_place_id: cleanText(formData.get("google_place_id")),
    price_level: Math.min(Math.max(priceLevel, 1), 4),
    halal_grade: cleanText(formData.get("halal_grade")) || "B",
    status: "pending",
    subscription_plan: cleanText(formData.get("subscription_plan")) || "free",
    alcohol_free: formData.get("alcohol_free") === "on",
    prayer_room: formData.get("prayer_room") === "on",
    family_friendly: formData.get("family_friendly") === "on"
  }).select("id").single();

  if (insertResult.error) {
    redirect(`/owner?error=${encodeURIComponent(insertResult.error.message)}`);
  }

  const menuItems = [1, 2, 3]
    .map((index) => ({
      name: cleanText(formData.get(`menu_name_${index}`)),
      description: cleanText(formData.get(`menu_description_${index}`)),
      price: cleanPrice(formData.get(`menu_price_${index}`))
    }))
    .filter((item) => item.name);

  if (menuItems.length > 0) {
    const categoryResult = await supabase
      .from("menu_categories")
      .insert({
        restaurant_id: insertResult.data.id,
        name: cleanText(formData.get("menu_category")) || "Popüler",
        sort_order: 0
      })
      .select("id")
      .single();

    if (categoryResult.error) {
      redirect(`/owner?error=${encodeURIComponent(categoryResult.error.message)}`);
    }

    const itemResult = await supabase.from("menu_items").insert(
      menuItems.map((item, index) => ({
        category_id: categoryResult.data.id,
        name: item.name,
        description: item.description,
        price: item.price,
        currency: "EUR",
        sort_order: index
      }))
    );

    if (itemResult.error) {
      redirect(`/owner?error=${encodeURIComponent(itemResult.error.message)}`);
    }
  }

  const photoUrls = [1, 2, 3]
    .map((index) => cleanText(formData.get(`photo_url_${index}`)))
    .filter(Boolean);

  if (photoUrls.length > 0) {
    const photoResult = await supabase.from("restaurant_photos").insert(
      photoUrls.map((url, index) => ({
        restaurant_id: insertResult.data.id,
        storage_path: url,
        alt_text: `${name} fotoğrafı ${index + 1}`,
        sort_order: index
      }))
    );

    if (photoResult.error) {
      redirect(`/owner?error=${encodeURIComponent(photoResult.error.message)}`);
    }
  }

  const certificateBody = cleanText(formData.get("certificate_body"));
  const certificateUrl = cleanText(formData.get("certificate_url"));
  const certificateNumber = cleanText(formData.get("certificate_number"));

  if (certificateBody || certificateUrl || certificateNumber) {
    const certificateResult = await supabase.from("certificates").insert({
      restaurant_id: insertResult.data.id,
      body: certificateBody || "İşletme beyanı",
      certificate_number: certificateNumber,
      valid_from: cleanText(formData.get("certificate_valid_from")) || null,
      valid_until: cleanText(formData.get("certificate_valid_until")) || null,
      storage_path: certificateUrl,
      status: "pending"
    });

    if (certificateResult.error) {
      redirect(`/owner?error=${encodeURIComponent(certificateResult.error.message)}`);
    }
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
  searchParams?: { submitted?: string; error?: string; plan?: string };
}) {
  const cities = await getCities();
  const submitted = searchParams?.submitted === "1";
  const selectedPlan = plans.some((plan) => plan.id === searchParams?.plan)
    ? searchParams?.plan
    : "free";

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
          <article className={`plan ${plan.recommended ? "recommended" : ""} ${selectedPlan === plan.id ? "selected" : ""}`} key={plan.id}>
            {plan.recommended ? <span className="pill">Önerilen</span> : null}
            {selectedPlan === plan.id ? <span className="pill">Seçili</span> : null}
            <h3>{plan.name}</h3>
            <h2>{plan.price}<span className="muted" style={{ fontSize: 14 }}>/ay</span></h2>
            <p className="muted">{plan.description}</p>
            {plan.features.map((feature) => (
              <p key={feature}>✓ {feature}</p>
            ))}
            <a className="button primary" style={{ width: "100%", textAlign: "center" }} href={`/owner?plan=${plan.id}#restaurant-application`}>
              Paketi Seç
            </a>
          </article>
        ))}
      </section>

      <section className="panel" id="restaurant-application" style={{ marginTop: 16 }}>
        <h2>Restoran Başvurusu</h2>
        <p className="muted">
          Zorunlu alanlar: restoran adı, ülke/şehir ve tam adres. Menü, sertifika, telefon ve diğer bilgiler opsiyoneldir.
        </p>
        <div className="application-guide" aria-label="Başvuru hazırlık rehberi">
          <article>
            <span className="pill">Zorunlu</span>
            <h3>Yayına hazırlık için temel bilgiler</h3>
            <p>Restoran adı, şehir ve tam adres olmadan başvuru kaydedilmez.</p>
          </article>
          <article>
            <span className="pill">Önerilen</span>
            <h3>Daha güvenilir görünürlük</h3>
            <p>Telefon, çalışma saati, menü, sertifika ve Google Place ID kullanıcı güvenini artırır.</p>
          </article>
          <article>
            <span className="pill">Sonradan</span>
            <h3>Eksikler admin panelinde tamamlanabilir</h3>
            <p>Fotoğraf, sertifika linki ve açıklama daha sonra düzenlenebilir.</p>
          </article>
        </div>
        {searchParams?.error ? (
          <div className="notice error">Başvuru kaydedilemedi: {decodeURIComponent(searchParams.error)}</div>
        ) : null}
        {submitted ? (
          <div className="submission-status">
            <span className="pill">Başvuru alındı</span>
            <h3>Restoranın onay kuyruğuna eklendi.</h3>
            <p className="muted">
              Bilgiler admin kontrolünden sonra yayına alınır. Sertifika, menü ve adres bilgileri eksikse admin yayın metnini düzeltebilir.
            </p>
            <div className="status-steps">
              <div>
                <strong>1</strong>
                <span>Başvuru kaydedildi</span>
              </div>
              <div>
                <strong>2</strong>
                <span>Admin kontrolü</span>
              </div>
              <div>
                <strong>3</strong>
                <span>Yayına alma</span>
              </div>
            </div>
            <div className="detail-actions">
              <a className="button primary" href="/">Ana Sayfaya Dön</a>
              <a className="button" href="/owner">Yeni Başvuru Ekle</a>
            </div>
          </div>
        ) : (
        <form action={submitRestaurant}>
          <div className="form-grid">
            <input name="name" placeholder="Restoran adı (zorunlu)" required />
            <input name="phone" placeholder="Telefon (opsiyonel)" />
            <input name="email" type="email" placeholder="E-posta (opsiyonel)" />
            <input name="website" type="url" placeholder="Web sitesi, örn. https://..." />
            <input name="instagram" placeholder="Instagram, örn. @halalsofra" />
            <input name="opening_hours" placeholder="Çalışma saatleri, örn. Her gün 11:00-22:00" />
            <select name="city_id" required>
              <option value="">Ülke / şehir seç (zorunlu)</option>
              {cities.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.countryFlag} {city.countryName} / {city.name}
                </option>
              ))}
            </select>
            <input name="address" placeholder="Tam adres (zorunlu)" required />
            <input name="google_place_id" placeholder="Google Place ID (opsiyonel)" />
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
            <select name="subscription_plan" defaultValue={selectedPlan}>
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>{plan.name}</option>
              ))}
            </select>
          </div>
          <textarea name="description" style={{ marginTop: 12 }} placeholder="Kısa açıklama (opsiyonel)" />
          <div className="menu-form">
            <h3>Menüden örnekler</h3>
            <p className="muted">Opsiyonel. İsterseniz en popüler 1-3 ürünü girin; boş bırakılırsa başvuru yine gönderilir.</p>
            <input name="menu_category" placeholder="Menü kategorisi, örn. Popüler / Kebaplar / Tatlılar (opsiyonel)" />
            {[1, 2, 3].map((index) => (
              <div className="menu-input-row" key={index}>
                <input name={`menu_name_${index}`} placeholder={`Ürün ${index} adı (opsiyonel)`} />
                <input name={`menu_description_${index}`} placeholder="Kısa açıklama (opsiyonel)" />
                <input name={`menu_price_${index}`} inputMode="decimal" placeholder="Fiyat € (opsiyonel)" />
              </div>
            ))}
          </div>
          <div className="menu-form">
            <h3>Fotoğraflar</h3>
            <p className="muted">Opsiyonel. Şimdilik fotoğraf linki ekleyin; dosya yükleme daha sonra bağlanacak.</p>
            <div className="form-grid">
              <input name="photo_url_1" type="url" placeholder="Fotoğraf linki 1, örn. https://..." />
              <input name="photo_url_2" type="url" placeholder="Fotoğraf linki 2, örn. https://..." />
              <input name="photo_url_3" type="url" placeholder="Fotoğraf linki 3, örn. https://..." />
            </div>
          </div>
          <div className="menu-form">
            <h3>Sertifika bilgisi</h3>
            <p className="muted">Opsiyonel. PDF veya belge linki varsa ekleyin; yoksa bu bölümü tamamen boş bırakabilirsiniz.</p>
            <div className="form-grid">
              <input name="certificate_body" placeholder="Sertifika kurumu, örn. HMC Europe (opsiyonel)" />
              <input name="certificate_number" placeholder="Sertifika numarası (opsiyonel)" />
              <input name="certificate_url" placeholder="Sertifika PDF/resim linki (opsiyonel)" />
              <input name="certificate_valid_from" type="date" aria-label="Geçerlilik başlangıcı" />
              <input name="certificate_valid_until" type="date" aria-label="Geçerlilik bitişi" />
            </div>
          </div>
          <div className="checks">
            <label><input name="alcohol_free" type="checkbox" /> Alkolsüz</label>
            <label><input name="prayer_room" type="checkbox" /> Mescid var</label>
            <label><input name="family_friendly" type="checkbox" /> Aile dostu</label>
          </div>
          <button className="button primary" style={{ marginTop: 12 }}>Başvuruyu Gönder</button>
        </form>
        )}
      </section>
    </main>
  );
}
