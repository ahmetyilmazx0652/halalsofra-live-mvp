import { createHash } from "crypto";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ADMIN_COOKIE = "halalsofra_admin";

type AdminRestaurant = {
  id: string;
  slug: string;
  name: string;
  photoUrl: string | null;
  address: string;
  phone: string | null;
  email: string | null;
  openingHours: string | null;
  cuisine: string;
  description: string | null;
  halalGrade: string;
  subscriptionPlan: string;
  isFeatured: boolean;
  alcoholFree: boolean;
  prayerRoom: boolean;
  familyFriendly: boolean;
  googlePlaceId: string | null;
  lat: number | null;
  lng: number | null;
  hasCertificate: boolean;
  certificateBody: string | null;
  certificateNumber: string | null;
  certificateUrl: string | null;
  status: string;
  cityName: string;
  countryName: string;
};

function mapRestaurant(item: any): AdminRestaurant {
  return {
    id: item.id,
    slug: item.slug,
    name: item.name,
    photoUrl: (item.restaurant_photos ?? [])
      .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))[0]?.storage_path ?? null,
    address: item.address,
    phone: item.phone,
    email: item.email,
    openingHours: item.opening_hours,
    cuisine: item.cuisine,
    description: item.description,
    halalGrade: item.halal_grade,
    subscriptionPlan: item.subscription_plan,
    isFeatured: Boolean(item.is_featured),
    alcoholFree: Boolean(item.alcohol_free),
    prayerRoom: Boolean(item.prayer_room),
    familyFriendly: Boolean(item.family_friendly),
    googlePlaceId: item.google_place_id,
    lat: item.lat,
    lng: item.lng,
    hasCertificate: (item.certificates ?? []).length > 0,
    certificateBody: item.certificates?.[0]?.body ?? null,
    certificateNumber: item.certificates?.[0]?.certificate_number ?? null,
    certificateUrl: item.certificates?.[0]?.storage_path ?? null,
    status: item.status,
    cityName: item.cities?.[0]?.name ?? item.cities?.name ?? "Bilinmiyor",
    countryName: item.countries?.[0]?.name ?? item.countries?.name ?? "Bilinmiyor"
  };
}

async function getPendingRestaurants() {
  if (!hasSupabaseConfig || !supabase) return [];

  const result = await supabase
    .from("restaurants")
    .select("id,slug,name,address,phone,email,opening_hours,cuisine,description,halal_grade,subscription_plan,is_featured,alcohol_free,prayer_room,family_friendly,google_place_id,lat,lng,status,cities(name),countries(name),certificates(id,status,body,certificate_number,storage_path),restaurant_photos(storage_path,sort_order)")
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (result.error) return [];
  return (result.data ?? []).map(mapRestaurant);
}

async function getPublishedRestaurants(query?: string) {
  if (!hasSupabaseConfig || !supabase) return [];

  let request = supabase
    .from("restaurants")
    .select("id,slug,name,address,phone,email,opening_hours,cuisine,description,halal_grade,subscription_plan,is_featured,alcohol_free,prayer_room,family_friendly,google_place_id,lat,lng,status,cities(name),countries(name),certificates(id,status,body,certificate_number,storage_path),restaurant_photos(storage_path,sort_order)")
    .eq("status", "published");

  if (query) {
    request = request.or(`name.ilike.%${query}%,address.ilike.%${query}%,cuisine.ilike.%${query}%`);
  }

  const result = await request
    .order("updated_at", { ascending: false })
    .limit(query ? 60 : 24);

  if (result.error) return [];
  return (result.data ?? []).map(mapRestaurant);
}

async function getArchivedRestaurants() {
  if (!hasSupabaseConfig || !supabase) return [];

  const result = await supabase
    .from("restaurants")
    .select("id,slug,name,address,phone,email,opening_hours,cuisine,description,halal_grade,subscription_plan,is_featured,alcohol_free,prayer_room,family_friendly,google_place_id,lat,lng,status,cities(name),countries(name),certificates(id,status,body,certificate_number,storage_path),restaurant_photos(storage_path,sort_order)")
    .eq("status", "suspended")
    .order("updated_at", { ascending: false })
    .limit(24);

  if (result.error) return [];
  return (result.data ?? []).map(mapRestaurant);
}

function cleanText(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanCoordinate(value: FormDataEntryValue | null) {
  const text = cleanText(value).replace(",", ".");
  if (!text) return null;

  const coordinate = Number(text);
  return Number.isFinite(coordinate) ? coordinate : null;
}

function cleanSearch(value: string) {
  return value.replace(/[%(),]/g, " ").replace(/\s+/g, " ").trim();
}

function adminPasscode() {
  return process.env.ADMIN_PASSCODE?.trim() ?? "";
}

function adminSessionValue() {
  const passcode = adminPasscode();
  if (!passcode) return "";
  return createHash("sha256").update(passcode).digest("hex");
}

function isAdminUnlocked() {
  const sessionValue = adminSessionValue();
  if (!sessionValue) return false;
  return cookies().get(ADMIN_COOKIE)?.value === sessionValue;
}

function requireAdmin() {
  if (!isAdminUnlocked()) {
    redirect("/admin?error=auth");
  }
}

async function adminLogin(formData: FormData) {
  "use server";

  const passcode = adminPasscode();
  const attempt = cleanText(formData.get("passcode"));

  if (!passcode) {
    redirect("/admin?error=no-passcode");
  }

  if (attempt !== passcode) {
    redirect("/admin?error=bad-passcode");
  }

  cookies().set(ADMIN_COOKIE, adminSessionValue(), {
    httpOnly: true,
    maxAge: 60 * 60 * 12,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production"
  });

  redirect("/admin?loggedIn=1");
}

async function adminLogout() {
  "use server";

  cookies().delete(ADMIN_COOKIE);
  redirect("/admin");
}

async function updatePendingRestaurant(formData: FormData) {
  "use server";

  requireAdmin();

  if (!hasSupabaseConfig || !supabase) {
    redirect("/admin?error=config");
  }

  const id = cleanText(formData.get("id"));
  const halalGrade = cleanText(formData.get("halal_grade")) || "B";
  const lat = cleanCoordinate(formData.get("lat"));
  const lng = cleanCoordinate(formData.get("lng"));

  if (!id) {
    redirect("/admin?error=missing");
  }
  if (!["A", "B", "C"].includes(halalGrade)) {
    redirect("/admin?error=grade");
  }

  const result = await supabase.rpc("update_pending_restaurant", {
    target_restaurant_id: id,
    next_name: cleanText(formData.get("name")),
    next_address: cleanText(formData.get("address")),
    next_phone: cleanText(formData.get("phone")),
    next_email: cleanText(formData.get("email")),
    next_opening_hours: cleanText(formData.get("opening_hours")),
    next_description: cleanText(formData.get("description")),
    next_halal_grade: halalGrade,
    next_certificate_body: cleanText(formData.get("certificate_body")),
    next_certificate_number: cleanText(formData.get("certificate_number")),
    next_certificate_url: cleanText(formData.get("certificate_url")),
    next_lat: lat,
    next_lng: lng
  });

  if (result.error) {
    redirect(`/admin?error=${encodeURIComponent(result.error.message)}`);
  }

  revalidatePath("/admin");
  redirect("/admin?saved=1");
}

async function updatePublishedRestaurant(formData: FormData) {
  "use server";

  requireAdmin();

  if (!hasSupabaseConfig || !supabase) {
    redirect("/admin?error=config");
  }

  const id = cleanText(formData.get("id"));
  const halalGrade = cleanText(formData.get("halal_grade")) || "B";
  const lat = cleanCoordinate(formData.get("lat"));
  const lng = cleanCoordinate(formData.get("lng"));

  if (!id) {
    redirect("/admin?error=missing");
  }
  if (!["A", "B", "C"].includes(halalGrade)) {
    redirect("/admin?error=grade");
  }

  const result = await supabase.rpc("update_published_restaurant", {
    target_restaurant_id: id,
    next_name: cleanText(formData.get("name")),
    next_address: cleanText(formData.get("address")),
    next_phone: cleanText(formData.get("phone")),
    next_email: cleanText(formData.get("email")),
    next_opening_hours: cleanText(formData.get("opening_hours")),
    next_description: cleanText(formData.get("description")),
    next_halal_grade: halalGrade,
    next_is_featured: formData.get("is_featured") === "on",
    next_alcohol_free: formData.get("alcohol_free") === "on",
    next_prayer_room: formData.get("prayer_room") === "on",
    next_family_friendly: formData.get("family_friendly") === "on",
    next_certificate_body: cleanText(formData.get("certificate_body")),
    next_certificate_number: cleanText(formData.get("certificate_number")),
    next_certificate_url: cleanText(formData.get("certificate_url")),
    next_lat: lat,
    next_lng: lng
  });

  if (result.error) {
    redirect(`/admin?error=${encodeURIComponent(result.error.message)}`);
  }

  revalidatePath("/");
  revalidatePath("/admin");
  redirect("/admin?publishedSaved=1");
}

async function updateRestaurantStatus(formData: FormData) {
  "use server";

  requireAdmin();

  if (!hasSupabaseConfig || !supabase) {
    redirect("/admin?error=config");
  }

  const id = formData.get("id");
  const status = formData.get("status");

  if (typeof id !== "string" || typeof status !== "string") {
    redirect("/admin?error=missing");
  }
  if (!["published", "rejected"].includes(status)) {
    redirect("/admin?error=status");
  }

  const result = await supabase.rpc("review_restaurant", {
    target_restaurant_id: id,
    next_status: status
  });

  if (result.error) {
    redirect(`/admin?error=${encodeURIComponent(result.error.message)}`);
  }

  revalidatePath("/");
  revalidatePath("/admin");
  redirect(`/admin?reviewed=${status}`);
}

async function archivePublishedRestaurant(formData: FormData) {
  "use server";

  requireAdmin();

  if (!hasSupabaseConfig || !supabase) {
    redirect("/admin?error=config");
  }

  const id = cleanText(formData.get("id"));

  if (!id) {
    redirect("/admin?error=missing");
  }

  const result = await supabase.rpc("archive_published_restaurant", {
    target_restaurant_id: id
  });

  if (result.error) {
    redirect(`/admin?error=${encodeURIComponent(result.error.message)}`);
  }

  revalidatePath("/");
  revalidatePath("/admin");
  redirect("/admin?archived=1");
}

async function restoreArchivedRestaurant(formData: FormData) {
  "use server";

  requireAdmin();

  if (!hasSupabaseConfig || !supabase) {
    redirect("/admin?error=config");
  }

  const id = cleanText(formData.get("id"));

  if (!id) {
    redirect("/admin?error=missing");
  }

  const result = await supabase.rpc("restore_archived_restaurant", {
    target_restaurant_id: id
  });

  if (result.error) {
    redirect(`/admin?error=${encodeURIComponent(result.error.message)}`);
  }

  revalidatePath("/");
  revalidatePath("/admin");
  redirect("/admin?restored=1");
}

export default async function AdminPage({
  searchParams
}: {
  searchParams?: { reviewed?: string; saved?: string; publishedSaved?: string; archived?: string; restored?: string; loggedIn?: string; error?: string; q?: string };
}) {
  const unlocked = isAdminUnlocked();

  if (!unlocked) {
    const needsPasscode = searchParams?.error === "no-passcode";
    const wrongPasscode = searchParams?.error === "bad-passcode";
    const authError = searchParams?.error === "auth";

    return (
      <main className="page">
        <section className="panel">
          <span className="pill">Admin</span>
          <h1>Admin girişi.</h1>
          <p className="muted">
            Restoran onayı, yayın düzenleme ve sertifika kontrolü için yönetici şifresi gerekiyor.
          </p>
          {needsPasscode ? (
            <div className="notice error">Vercel Environment Variables içine ADMIN_PASSCODE eklenmeli.</div>
          ) : null}
          {wrongPasscode ? (
            <div className="notice error">Şifre yanlış. Tekrar dene.</div>
          ) : null}
          {authError ? (
            <div className="notice error">Bu işlem için admin girişi gerekiyor.</div>
          ) : null}
          <form action={adminLogin} className="form-grid" style={{ marginTop: 24 }}>
            <input name="passcode" type="password" placeholder="Admin şifresi" autoComplete="current-password" />
            <button className="button primary" type="submit">Giriş Yap</button>
          </form>
        </section>
      </main>
    );
  }

  const publishedQuery = cleanSearch(cleanText(searchParams?.q ?? ""));
  const [pendingRestaurants, publishedRestaurants, archivedRestaurants] = await Promise.all([
    getPendingRestaurants(),
    getPublishedRestaurants(publishedQuery),
    getArchivedRestaurants()
  ]);

  return (
    <main className="page">
      <section className="panel">
        <span className="pill">Admin</span>
        <h1>Restoran ve sertifika onay kuyruğu.</h1>
        <p className="muted">
          Bu ekran şifreli admin oturumu ile korunuyor.
        </p>
        <form action={adminLogout}>
          <button className="button" type="submit">Çıkış Yap</button>
        </form>
        {searchParams?.loggedIn ? (
          <div className="notice success">Admin girişi tamamlandı.</div>
        ) : null}
        {searchParams?.reviewed ? (
          <div className="notice success">İşlem tamamlandı: {searchParams.reviewed}</div>
        ) : null}
        {searchParams?.saved ? (
          <div className="notice success">Başvuru bilgileri güncellendi.</div>
        ) : null}
        {searchParams?.publishedSaved ? (
          <div className="notice success">Yayındaki restoran güncellendi.</div>
        ) : null}
        {searchParams?.archived ? (
          <div className="notice success">Restoran yayından kaldırıldı.</div>
        ) : null}
        {searchParams?.restored ? (
          <div className="notice success">Restoran yeniden yayına alındı.</div>
        ) : null}
        {searchParams?.error ? (
          <div className="notice error">İşlem yapılamadı: {decodeURIComponent(searchParams.error)}</div>
        ) : null}
      </section>

      <section className="grid">
        {pendingRestaurants.map((item) => (
          <article className="card admin-card" key={item.id}>
            <div className="card-top">
              <span className="pill">{item.status}</span>
              <span className="pill">Grade {item.halalGrade}</span>
              <span className="pill">{item.subscriptionPlan}</span>
              {item.isFeatured ? <span className="pill">Öne çıkan</span> : null}
            </div>
            {item.photoUrl ? <img className="admin-thumb" src={item.photoUrl} alt={`${item.name} fotoğrafı`} loading="lazy" /> : null}
            <h3>{item.name}</h3>
            <p className="muted">{item.countryName} · {item.cityName}</p>
            <p>{item.address}</p>
            <div className="meta-list">
              <span>{item.cuisine}</span>
              {item.phone ? <span>{item.phone}</span> : null}
              {item.email ? <span>{item.email}</span> : null}
              {item.openingHours ? <span>{item.openingHours}</span> : null}
              {item.googlePlaceId ? <span>Place ID var</span> : null}
              {item.lat !== null && item.lng !== null ? <span>Koordinat var</span> : null}
              {item.hasCertificate ? <span>Sertifika var</span> : null}
            </div>
            {item.description ? <p className="muted">{item.description}</p> : null}
            <div className="feature-row">
              {item.alcoholFree ? <span className="pill">Alkolsüz</span> : null}
              {item.prayerRoom ? <span className="pill">Mescid</span> : null}
              {item.familyFriendly ? <span className="pill">Aile dostu</span> : null}
            </div>
            <details className="admin-edit">
              <summary>Yayın metnini düzelt</summary>
              <form action={updatePendingRestaurant}>
                <input type="hidden" name="id" value={item.id} />
                <div className="form-grid">
                  <input name="name" defaultValue={item.name} placeholder="Restoran adı" />
                  <input name="address" defaultValue={item.address} placeholder="Adres" />
                  <input name="phone" defaultValue={item.phone ?? ""} placeholder="Telefon" />
                  <input name="email" defaultValue={item.email ?? ""} placeholder="E-posta" />
                  <input name="opening_hours" defaultValue={item.openingHours ?? ""} placeholder="Çalışma saatleri" />
                  <select name="halal_grade" defaultValue={item.halalGrade}>
                    <option value="A">Grade A</option>
                    <option value="B">Grade B</option>
                    <option value="C">Grade C</option>
                  </select>
                  <input name="certificate_body" defaultValue={item.certificateBody ?? ""} placeholder="Sertifika kurumu" />
                  <input name="certificate_number" defaultValue={item.certificateNumber ?? ""} placeholder="Sertifika numarası" />
                  <input name="certificate_url" defaultValue={item.certificateUrl ?? ""} placeholder="Sertifika PDF/resim linki" />
                </div>
                <textarea name="description" defaultValue={item.description ?? ""} placeholder="Kısa açıklama" />
                <button className="button primary" type="submit">Düzeltmeyi Kaydet</button>
              </form>
            </details>
            <div style={{ display: "flex", gap: 8 }}>
              <form action={updateRestaurantStatus}>
                <input type="hidden" name="id" value={item.id} />
                <input type="hidden" name="status" value="published" />
                <button className="button primary" type="submit">Onayla</button>
              </form>
              <form action={updateRestaurantStatus}>
                <input type="hidden" name="id" value={item.id} />
                <input type="hidden" name="status" value="rejected" />
                <button className="button" type="submit">Reddet</button>
              </form>
            </div>
          </article>
        ))}
      </section>

      {pendingRestaurants.length === 0 ? (
        <section className="empty-state">
          <span className="pill">Kuyruk boş</span>
          <h2>Bekleyen başvuru yok.</h2>
          <p className="muted">İşletme formundan gönderilen yeni restoranlar burada görünecek.</p>
        </section>
      ) : null}

      <section className="panel" style={{ marginTop: 24 }}>
        <span className="pill">Yayındaki Restoranlar</span>
        <h2>Canlı kayıtları düzenle.</h2>
        <p className="muted">
          Onaylanmış restoranlarda adres, açıklama, Grade, özellik ve sertifika bilgilerini sonradan düzeltebilirsin.
        </p>
        <form className="form-grid" style={{ marginTop: 14 }}>
          <input name="q" defaultValue={publishedQuery} placeholder="Yayındaki restoranlarda ara" />
          <button className="button primary" type="submit">Ara</button>
        </form>
        {publishedQuery ? (
          <div className="detail-actions">
            <span className="pill">{publishedRestaurants.length} sonuç</span>
            <a className="button" href="/admin">Aramayı Temizle</a>
          </div>
        ) : null}
      </section>

      <section className="grid">
        {publishedRestaurants.map((item) => (
          <article className="card admin-card" key={item.id}>
            <div className="card-top">
              <span className="pill">{item.status}</span>
              <span className="pill">Grade {item.halalGrade}</span>
              <span className="pill">{item.subscriptionPlan}</span>
              {item.isFeatured ? <span className="pill">Öne çıkan</span> : null}
            </div>
            {item.photoUrl ? <img className="admin-thumb" src={item.photoUrl} alt={`${item.name} fotoğrafı`} loading="lazy" /> : null}
            <h3>{item.name}</h3>
            <p className="muted">{item.countryName} · {item.cityName}</p>
            <p>{item.address}</p>
            <div className="meta-list">
              <span>{item.cuisine}</span>
              {item.phone ? <span>{item.phone}</span> : null}
              {item.email ? <span>{item.email}</span> : null}
              {item.openingHours ? <span>{item.openingHours}</span> : null}
              {item.googlePlaceId ? <span>Place ID var</span> : null}
              {item.lat !== null && item.lng !== null ? <span>Koordinat var</span> : null}
              {item.hasCertificate ? <span>Sertifika var</span> : null}
            </div>
            <div className="feature-row">
              {item.alcoholFree ? <span className="pill">Alkolsüz</span> : null}
              {item.prayerRoom ? <span className="pill">Mescid</span> : null}
              {item.familyFriendly ? <span className="pill">Aile dostu</span> : null}
            </div>
            <details className="admin-edit">
              <summary>Yayındaki bilgileri düzenle</summary>
              <form action={updatePublishedRestaurant}>
                <input type="hidden" name="id" value={item.id} />
                <div className="form-grid">
                  <input name="name" defaultValue={item.name} placeholder="Restoran adı" />
                  <input name="address" defaultValue={item.address} placeholder="Adres" />
                  <input name="phone" defaultValue={item.phone ?? ""} placeholder="Telefon" />
                  <input name="email" defaultValue={item.email ?? ""} placeholder="E-posta" />
                  <input name="opening_hours" defaultValue={item.openingHours ?? ""} placeholder="Çalışma saatleri" />
                  <select name="halal_grade" defaultValue={item.halalGrade}>
                    <option value="A">Grade A</option>
                    <option value="B">Grade B</option>
                    <option value="C">Grade C</option>
                  </select>
                  <input name="certificate_body" defaultValue={item.certificateBody ?? ""} placeholder="Sertifika kurumu" />
                  <input name="certificate_number" defaultValue={item.certificateNumber ?? ""} placeholder="Sertifika numarası" />
                  <input name="certificate_url" defaultValue={item.certificateUrl ?? ""} placeholder="Sertifika PDF/resim linki" />
                </div>
                <textarea name="description" defaultValue={item.description ?? ""} placeholder="Kısa açıklama" />
                <div className="checks">
                  <label><input name="is_featured" type="checkbox" defaultChecked={item.isFeatured} /> Öne çıkar</label>
                  <label><input name="alcohol_free" type="checkbox" defaultChecked={item.alcoholFree} /> Alkolsüz</label>
                  <label><input name="prayer_room" type="checkbox" defaultChecked={item.prayerRoom} /> Mescid var</label>
                  <label><input name="family_friendly" type="checkbox" defaultChecked={item.familyFriendly} /> Aile dostu</label>
                </div>
                <button className="button primary" type="submit">Canlı Kaydı Güncelle</button>
              </form>
            </details>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <a className="button" href={`/restaurants/${item.slug}`}>Detayı Aç</a>
              <form action={archivePublishedRestaurant}>
                <input type="hidden" name="id" value={item.id} />
                <button className="button danger" type="submit">Yayından Kaldır</button>
              </form>
            </div>
          </article>
        ))}
      </section>

      {publishedRestaurants.length === 0 ? (
        <section className="empty-state">
          <span className="pill">Canlı kayıt yok</span>
          <h2>Henüz yayında restoran yok.</h2>
          <p className="muted">Onaylanan restoranlar burada düzenlenebilir hale gelecek.</p>
        </section>
      ) : null}

      <section className="panel" style={{ marginTop: 24 }}>
        <span className="pill">Arşiv</span>
        <h2>Yayından kaldırılan restoranlar.</h2>
        <p className="muted">
          Yanlışlıkla kaldırılan restoranları buradan tekrar yayına alabilirsin.
        </p>
      </section>

      <section className="grid">
        {archivedRestaurants.map((item) => (
          <article className="card admin-card" key={item.id}>
            <div className="card-top">
              <span className="pill">{item.status}</span>
              <span className="pill">Grade {item.halalGrade}</span>
              <span className="pill">{item.subscriptionPlan}</span>
            </div>
            {item.photoUrl ? <img className="admin-thumb" src={item.photoUrl} alt={`${item.name} fotoğrafı`} loading="lazy" /> : null}
            <h3>{item.name}</h3>
            <p className="muted">{item.countryName} · {item.cityName}</p>
            <p>{item.address}</p>
            <div className="meta-list">
              <span>{item.cuisine}</span>
              {item.phone ? <span>{item.phone}</span> : null}
              {item.openingHours ? <span>{item.openingHours}</span> : null}
            </div>
            <form action={restoreArchivedRestaurant}>
              <input type="hidden" name="id" value={item.id} />
              <button className="button primary" type="submit">Tekrar Yayına Al</button>
            </form>
          </article>
        ))}
      </section>

      {archivedRestaurants.length === 0 ? (
        <section className="empty-state">
          <span className="pill">Arşiv boş</span>
          <h2>Yayından kaldırılmış restoran yok.</h2>
          <p className="muted">Canlıdan kaldırılan kayıtlar burada listelenecek.</p>
        </section>
      ) : null}
    </main>
  );
}
