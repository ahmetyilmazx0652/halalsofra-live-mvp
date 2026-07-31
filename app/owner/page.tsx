import { plans } from "@/lib/plans";
import { redirect } from "next/navigation";
import { cuisineOptions } from "@/lib/cuisine";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";
import OwnerCityPicker from "@/app/owner-city-picker";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type CityOption = {
  id: string;
  name: string;
  country_id: string;
  countryName: string;
  countryFlag: string;
};

type CityGroup = {
  label: string;
  cities: CityOption[];
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

function normalizeRestaurantKey(value: string) {
  return value
    .toLocaleLowerCase("tr")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/ş/g, "s")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function cleanPrice(value: FormDataEntryValue | null) {
  const text = cleanText(value).replace(",", ".");
  const price = Number(text);
  return Number.isFinite(price) && price > 0 ? price : null;
}

function cleanPriceLevel(value: FormDataEntryValue | null) {
  const priceLevel = Number(cleanText(value));
  return Number.isInteger(priceLevel) && priceLevel >= 1 && priceLevel <= 4 ? priceLevel : null;
}

async function submitRestaurant(formData: FormData) {
  "use server";

  if (!hasSupabaseConfig || !supabase) {
    redirect("/owner?error=config");
  }

  const name = cleanText(formData.get("name"));
  const cityId = cleanText(formData.get("city_id"));
  const address = cleanText(formData.get("address"));
  const isOtherCity = cityId === "__other__";
  const requestedCountryId = cleanText(formData.get("requested_country_id"));
  const requestedCityName = cleanText(formData.get("requested_city_name"));
  const requestedRegion = cleanText(formData.get("requested_region"));

  if (!name || !cityId || !address) {
    redirect("/owner?error=missing");
  }

  if (isOtherCity && (!requestedCountryId || !requestedCityName)) {
    redirect("/owner?error=missing-city#restaurant-application");
  }

  const slug = `${slugify(name)}-${Date.now()}`;
  const priceLevel = cleanPriceLevel(formData.get("price_level"));

  const rpcResult = await supabase.rpc("submit_restaurant_application", {
    p_name: name,
    p_slug: slug,
    p_address: address,
    p_city_id: isOtherCity ? null : cityId,
    p_requested_country_id: isOtherCity ? requestedCountryId : null,
    p_requested_city_name: isOtherCity ? requestedCityName : null,
    p_requested_region: isOtherCity ? requestedRegion || null : null,
    p_cuisine: cleanText(formData.get("cuisine")) || "restaurant",
    p_description: cleanText(formData.get("description")),
    p_phone: cleanText(formData.get("phone")),
    p_email: cleanText(formData.get("email")),
    p_website: cleanText(formData.get("website")),
    p_instagram: cleanText(formData.get("instagram")),
    p_opening_hours: cleanText(formData.get("opening_hours")),
    p_google_place_id: cleanText(formData.get("google_place_id")),
    p_price_level: priceLevel,
    p_halal_grade: cleanText(formData.get("halal_grade")) || "B",
    p_alcohol_free: formData.get("alcohol_free") === "on",
    p_prayer_room: formData.get("prayer_room") === "on",
    p_family_friendly: formData.get("family_friendly") === "on"
  });

  if (rpcResult.error || !rpcResult.data) {
    if (rpcResult.error?.message.includes("DUPLICATE_RESTAURANT")) {
      redirect("/owner?duplicate=1#restaurant-application");
    }

    redirect(`/owner?error=${encodeURIComponent(rpcResult.error?.message ?? "unknown")}`);
  }

  const newRestaurantId = rpcResult.data as string;

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
        restaurant_id: newRestaurantId,
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
        restaurant_id: newRestaurantId,
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
      restaurant_id: newRestaurantId,
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

async function getCountries() {
  if (!hasSupabaseConfig || !supabase) return [];

  const result = await supabase
    .from("countries")
    .select("id,name,flag")
    .order("name");

  if (result.error) return [];
  return (result.data ?? []).map((country: any) => ({
    id: country.id,
    label: `${country.flag ?? ""} ${country.name}`.trim()
  }));
}

function groupCitiesByCountry(cities: CityOption[]): CityGroup[] {
  const groups = new Map<string, CityGroup>();

  for (const city of cities) {
    const label = `${city.countryFlag} ${city.countryName}`;
    const group = groups.get(label) ?? { label, cities: [] };
    group.cities.push(city);
    groups.set(label, group);
  }

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      cities: group.cities.sort((a, b) => a.name.localeCompare(b.name, "tr"))
    }))
    .sort((a, b) => a.label.localeCompare(b.label, "tr"));
}

export default async function OwnerPage({
  searchParams
}: {
  searchParams?: { submitted?: string; error?: string; plan?: string; duplicate?: string };
}) {
  const cities = await getCities();
  const cityGroups = groupCitiesByCountry(cities);
  const countryOptions = await getCountries();
  const submitted = searchParams?.submitted === "1";

  return (
    <main className="page">
      <section className="panel">
        <span className="pill">İşletme Paneli</span>
        <h1>Restoranını ekle, menünü ve sertifikanı yönet.</h1>
        <p className="muted">
          Önce temel bilgileri gönderin. Başvuru kontrol edildikten sonra yayına alınır; menü, fotoğraf ve sertifika bilgileri sonra tamamlanabilir.
        </p>
      </section>

      <section className="plans" style={{ marginTop: 16 }}>
        {plans.map((plan) => (
          <article className={`plan ${plan.recommended ? "recommended" : ""}`} key={plan.id} aria-disabled="true">
            {plan.recommended ? <span className="pill">Önerilen</span> : null}
            <span className="pill muted">Yakında</span>
            <h3>{plan.name}</h3>
            <h2>{plan.price}<span className="muted" style={{ fontSize: 14 }}>/ay</span></h2>
            <p className="muted">{plan.description}</p>
            {plan.features.map((feature) => (
              <p key={feature}>✓ {feature}</p>
            ))}
            <span
              className="button"
              style={{ width: "100%", textAlign: "center", cursor: "not-allowed", opacity: 0.6 }}
              aria-disabled="true"
            >
              Yakında kullanılabilir
            </span>
          </article>
        ))}
      </section>
      <p className="muted" style={{ marginTop: 8 }}>
        Ücretli paketler şu anda aktif değil. Tüm başvurular ücretsiz (free) plan ile oluşturulur.
      </p>

      <section className="panel" id="restaurant-application" style={{ marginTop: 16 }}>
        <h2>Restoran Başvurusu</h2>
        <p className="muted">
          Restoran adı, ülke/şehir ve tam adres yeterli. Diğer alanlar görünürlüğü artırır ama başvuru için zorunlu değildir.
        </p>
        <div className="application-guide" aria-label="Başvuru hazırlık rehberi">
          <article>
            <span className="pill">Zorunlu</span>
            <h3>3 bilgiyle başla</h3>
            <p>Restoran adı, ülke/şehir ve tam adres başvuruyu almak için yeterlidir.</p>
          </article>
          <article>
            <span className="pill">Önerilen</span>
            <h3>Güven sinyallerini ekle</h3>
            <p>Telefon, çalışma saati, menü, sertifika ve fotoğraf kullanıcı kararını kolaylaştırır.</p>
          </article>
          <article>
            <span className="pill">Sonradan</span>
            <h3>Eksikler sonra tamamlanır</h3>
            <p>Adres, açıklama, sertifika ve konum bilgileri admin kontrolünde düzeltilebilir.</p>
          </article>
        </div>
        {searchParams?.error ? (
          <div className="notice error">Başvuru kaydedilemedi: {decodeURIComponent(searchParams.error)}</div>
        ) : null}
        {searchParams?.duplicate === "1" ? (
          <div className="notice error">
            Bu şehirde aynı isimle bir restoran kaydı zaten var. Bilgilerde hata varsa bize güncelleme talebi gönderebilirsiniz.
          </div>
        ) : null}
        {submitted ? (
          <div className="submission-status">
            <span className="pill">Başvuru alındı</span>
            <h3>Restoranın onay kuyruğuna eklendi.</h3>
            <p className="muted">
              Bilgiler kontrol edildikten sonra yayına alınır. Sertifika, menü ve adres bilgileri eksikse yayın metni tamamlanabilir.
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
        <form action={submitRestaurant} className="owner-form">
          <div className="required-summary">
            <span className="pill">Sadece 3 zorunlu alan</span>
            <strong>Restoran adı, ülke/şehir ve tam adres.</strong>
            <p className="muted">Diğer alanlar isteğe bağlıdır. Ne kadar çok bilgi girilirse kayıt o kadar güvenilir görünür.</p>
          </div>
          <h3>Temel bilgiler</h3>
          <div className="form-grid">
            <input name="name" placeholder="Restoran adı (zorunlu)" required />
            <input name="phone" placeholder="Telefon (opsiyonel)" />
            <input name="email" type="email" placeholder="E-posta (opsiyonel)" />
            <input name="website" placeholder="Web sitesi, örn. halalsofra.com (opsiyonel)" />
            <input name="instagram" placeholder="Instagram, örn. @halalsofra" />
            <input name="opening_hours" placeholder="Çalışma saatleri, örn. Her gün 11:00-22:00" />
            <OwnerCityPicker cityGroups={cityGroups} countryOptions={countryOptions} />
            <input name="address" placeholder="Tam adres (zorunlu)" required />
            <input name="google_place_id" placeholder="Google Place ID (opsiyonel, bilmiyorsanız boş bırakın)" />
            <select name="cuisine" defaultValue="restaurant">
              {cuisineOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <select name="halal_grade" defaultValue="B">
              <option value="A">Grade A</option>
              <option value="B">Grade B</option>
              <option value="C">Grade C</option>
            </select>
            <select name="price_level" defaultValue="">
              <option value="">Kişi başı tahmin yok</option>
              <option value="1">Kişi başı 10-15 €</option>
              <option value="2">Kişi başı 15-25 €</option>
              <option value="3">Kişi başı 25-40 €</option>
              <option value="4">Kişi başı 40 €+</option>
            </select>
            <div className="plan-placeholder" aria-disabled="true" title="Ücretli paketler yakında aktif olacak">
              <span>Paket: Ücretsiz</span>
              <small className="muted">Ücretli paketler yakında</small>
            </div>
          </div>
          <textarea name="description" style={{ marginTop: 12 }} placeholder="Kısa açıklama (opsiyonel)" />
          <details className="optional-section">
            <summary>
              <span>Menüden örnekler</span>
              <small>Opsiyonel</small>
            </summary>
            <p className="muted">Opsiyonel. İsterseniz en popüler 1-3 ürünü girin; boş bırakılırsa başvuru yine gönderilir.</p>
            <input name="menu_category" placeholder="Menü kategorisi, örn. Popüler / Kebaplar / Tatlılar (opsiyonel)" />
            {[1, 2, 3].map((index) => (
              <div className="menu-input-row" key={index}>
                <input name={`menu_name_${index}`} placeholder={`Ürün ${index} adı (opsiyonel)`} />
                <input name={`menu_description_${index}`} placeholder="Kısa açıklama (opsiyonel)" />
                <input name={`menu_price_${index}`} inputMode="decimal" placeholder="Fiyat € (opsiyonel)" />
              </div>
            ))}
          </details>
          <details className="optional-section">
            <summary>
              <span>Fotoğraflar</span>
              <small>Opsiyonel</small>
            </summary>
            <p className="muted">Opsiyonel. Şimdilik fotoğraf linki ekleyin; dosya yükleme daha sonra bağlanacak.</p>
            <div className="form-grid">
              <input name="photo_url_1" placeholder="Fotoğraf linki 1, örn. https://..." />
              <input name="photo_url_2" placeholder="Fotoğraf linki 2, örn. https://..." />
              <input name="photo_url_3" placeholder="Fotoğraf linki 3, örn. https://..." />
            </div>
          </details>
          <details className="optional-section">
            <summary>
              <span>Sertifika bilgisi</span>
              <small>Opsiyonel</small>
            </summary>
            <p className="muted">Opsiyonel. PDF veya belge linki varsa ekleyin; yoksa bu bölümü tamamen boş bırakabilirsiniz.</p>
            <div className="form-grid">
              <input name="certificate_body" placeholder="Sertifika kurumu, örn. HMC Europe (opsiyonel)" />
              <input name="certificate_number" placeholder="Sertifika numarası (opsiyonel)" />
              <input name="certificate_url" placeholder="Sertifika PDF/resim linki (opsiyonel)" />
              <input name="certificate_valid_from" type="date" aria-label="Geçerlilik başlangıcı" />
              <input name="certificate_valid_until" type="date" aria-label="Geçerlilik bitişi" />
            </div>
          </details>
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
