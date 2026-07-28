import { createHash } from "crypto";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cuisineLabel, cuisineOptions } from "@/lib/cuisine";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ADMIN_COOKIE = "halalsofra_admin";

type AdminRestaurant = {
  id: string;
  slug: string;
  name: string;
  countryId: string | null;
  cityId: string | null;
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
  menuItemCount: number;
  certificateBody: string | null;
  certificateNumber: string | null;
  certificateUrl: string | null;
  status: string;
  cityName: string;
  countryName: string;
};

type PublishedQualityFilter = "all" | "missing-location" | "missing-certificate" | "missing-photo" | "missing-menu";

type AdminCityOption = {
  id: string;
  name: string;
  countryName: string;
  countryFlag: string;
};

type AdminCountryOption = {
  id: string;
  name: string;
  flag: string;
};

type AdminReview = {
  id: string;
  authorName: string | null;
  rating: number;
  halalRating: number | null;
  foodRating: number | null;
  body: string | null;
  ownerResponse: string | null;
  createdAt: string;
  restaurantName: string;
  restaurantSlug: string;
};

type AdminMetrics = {
  pendingRestaurants: number;
  publishedRestaurants: number;
  archivedRestaurants: number;
  pendingReviews: number;
  approvedReviews: number;
  missingCoordinates: number;
};

type BulkRestaurantRow = {
  name: string;
  countryName: string;
  cityName: string;
  address: string;
  phone: string;
  grade: string;
  cuisine: string;
  googlePlaceId: string;
  description: string;
};

function mapRestaurant(item: any): AdminRestaurant {
  return {
    id: item.id,
    slug: item.slug,
    name: item.name,
    countryId: item.country_id,
    cityId: item.city_id,
    photoUrl: (item.restaurant_photos ?? [])
      .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))[0]?.storage_path ?? null,
    address: item.address,
    phone: item.phone,
    email: item.email,
    openingHours: item.opening_hours,
    cuisine: cuisineLabel(item.cuisine),
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
    menuItemCount: (item.menu_categories ?? []).reduce(
      (total: number, category: any) =>
        total + (category.menu_items ?? []).filter((menuItem: any) => menuItem.is_available).length,
      0
    ),
    certificateBody: item.certificates?.[0]?.body ?? null,
    certificateNumber: item.certificates?.[0]?.certificate_number ?? null,
    certificateUrl: item.certificates?.[0]?.storage_path ?? null,
    status: item.status,
    cityName: item.cities?.[0]?.name ?? item.cities?.name ?? "Bilinmiyor",
    countryName: item.countries?.[0]?.name ?? item.countries?.name ?? "Bilinmiyor"
  };
}

function mapReview(item: any): AdminReview {
  const restaurant = item.restaurants?.[0] ?? item.restaurants;

  return {
    id: item.id,
    authorName: item.author_name,
    rating: item.rating,
    halalRating: item.halal_rating,
    foodRating: item.food_rating,
    body: item.body,
    ownerResponse: item.owner_response,
    createdAt: item.created_at,
    restaurantName: restaurant?.name ?? "Restoran",
    restaurantSlug: restaurant?.slug ?? ""
  };
}

async function getPendingRestaurants() {
  requireAdmin();
  if (!hasSupabaseAdminConfig || !supabaseAdmin) return [];

  const result = await supabaseAdmin
    .from("restaurants")
    .select("id,slug,name,country_id,city_id,address,phone,email,opening_hours,cuisine,description,halal_grade,subscription_plan,is_featured,alcohol_free,prayer_room,family_friendly,google_place_id,lat,lng,status,cities(name),countries(name),certificates(id,status,body,certificate_number,storage_path),menu_categories(id,menu_items(id,is_available)),restaurant_photos(storage_path,sort_order)")
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (result.error) return [];
  return (result.data ?? []).map(mapRestaurant);
}

async function getAdminCities() {
  requireAdmin();
  if (!hasSupabaseAdminConfig || !supabaseAdmin) return [];

  const result = await supabaseAdmin
    .from("cities")
    .select("id,name,countries(name,flag)")
    .order("name");

  if (result.error) return [];

  return (result.data ?? []).map((city: any): AdminCityOption => ({
    id: city.id,
    name: city.name,
    countryName: city.countries?.[0]?.name ?? city.countries?.name ?? "Bilinmiyor",
    countryFlag: city.countries?.[0]?.flag ?? city.countries?.flag ?? "🌍"
  }));
}

async function getAdminCountries() {
  requireAdmin();
  if (!hasSupabaseAdminConfig || !supabaseAdmin) return [];

  const result = await supabaseAdmin
    .from("countries")
    .select("id,name,flag")
    .order("name");

  if (result.error) return [];

  return (result.data ?? []).map((country: any): AdminCountryOption => ({
    id: country.id,
    name: country.name,
    flag: country.flag ?? "🌍"
  }));
}

async function getPendingReviews() {
  requireAdmin();
  if (!hasSupabaseAdminConfig || !supabaseAdmin) return [];

  const result = await supabaseAdmin
    .from("reviews")
    .select("id,author_name,rating,halal_rating,food_rating,body,created_at,restaurants(name,slug)")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(30);

  if (result.error) return [];
  return (result.data ?? []).map(mapReview);
}

async function getApprovedReviews() {
  requireAdmin();
  if (!hasSupabaseAdminConfig || !supabaseAdmin) return [];

  const result = await supabaseAdmin
    .from("reviews")
    .select("id,author_name,rating,halal_rating,food_rating,body,owner_response,created_at,restaurants(name,slug)")
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(24);

  if (result.error) return [];
  return (result.data ?? []).map(mapReview);
}

function matchesQualityFilter(item: AdminRestaurant, quality: PublishedQualityFilter) {
  if (quality === "missing-location") return !item.googlePlaceId && (item.lat === null || item.lng === null);
  if (quality === "missing-certificate") return !item.hasCertificate;
  if (quality === "missing-photo") return !item.photoUrl;
  if (quality === "missing-menu") return item.menuItemCount === 0;
  return true;
}

async function getPublishedRestaurants(query?: string, quality: PublishedQualityFilter = "all") {
  requireAdmin();
  if (!hasSupabaseAdminConfig || !supabaseAdmin) return [];

  let request = supabaseAdmin
    .from("restaurants")
    .select("id,slug,name,country_id,city_id,address,phone,email,opening_hours,cuisine,description,halal_grade,subscription_plan,is_featured,alcohol_free,prayer_room,family_friendly,google_place_id,lat,lng,status,cities(name),countries(name),certificates(id,status,body,certificate_number,storage_path),menu_categories(id,menu_items(id,is_available)),restaurant_photos(storage_path,sort_order)")
    .eq("status", "published");

  if (query) {
    request = request.or(`name.ilike.%${query}%,address.ilike.%${query}%,cuisine.ilike.%${query}%`);
  }

  const result = await request
    .order("updated_at", { ascending: false })
    .limit(query || quality !== "all" ? 100 : 24);

  if (result.error) return [];
  return (result.data ?? [])
    .map(mapRestaurant)
    .filter((item) => matchesQualityFilter(item, quality));
}

async function getArchivedRestaurants() {
  requireAdmin();
  if (!hasSupabaseAdminConfig || !supabaseAdmin) return [];

  const result = await supabaseAdmin
    .from("restaurants")
    .select("id,slug,name,country_id,city_id,address,phone,email,opening_hours,cuisine,description,halal_grade,subscription_plan,is_featured,alcohol_free,prayer_room,family_friendly,google_place_id,lat,lng,status,cities(name),countries(name),certificates(id,status,body,certificate_number,storage_path),menu_categories(id,menu_items(id,is_available)),restaurant_photos(storage_path,sort_order)")
    .eq("status", "suspended")
    .order("updated_at", { ascending: false })
    .limit(24);

  if (result.error) return [];
  return (result.data ?? []).map(mapRestaurant);
}

async function countRows(
  table: "restaurants" | "reviews",
  buildQuery: (request: any) => any
) {
  requireAdmin();
  if (!hasSupabaseAdminConfig || !supabaseAdmin) return 0;

  const result = await buildQuery(
    supabaseAdmin.from(table).select("id", { count: "exact", head: true })
  );

  if (result.error) return 0;
  return result.count ?? 0;
}

async function getAdminMetrics(): Promise<AdminMetrics> {
  requireAdmin();
  if (!hasSupabaseAdminConfig || !supabaseAdmin) {
    return {
      pendingRestaurants: 0,
      publishedRestaurants: 0,
      archivedRestaurants: 0,
      pendingReviews: 0,
      approvedReviews: 0,
      missingCoordinates: 0
    };
  }

  const [
    pendingRestaurants,
    publishedRestaurants,
    archivedRestaurants,
    pendingReviews,
    approvedReviews,
    missingCoordinates
  ] = await Promise.all([
    countRows("restaurants", (request) => request.eq("status", "pending")),
    countRows("restaurants", (request) => request.eq("status", "published")),
    countRows("restaurants", (request) => request.eq("status", "suspended")),
    countRows("reviews", (request) => request.eq("status", "pending")),
    countRows("reviews", (request) => request.eq("status", "approved")),
    countRows("restaurants", (request) =>
      request
        .eq("status", "published")
        .is("google_place_id", null)
        .or("lat.is.null,lng.is.null")
    )
  ]);

  return {
    pendingRestaurants,
    publishedRestaurants,
    archivedRestaurants,
    pendingReviews,
    approvedReviews,
    missingCoordinates
  };
}

function cleanText(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanPriceLevel(value: FormDataEntryValue | null) {
  const priceLevel = Number(cleanText(value));
  return Number.isInteger(priceLevel) && priceLevel >= 1 && priceLevel <= 4 ? priceLevel : null;
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

function normalizeLookup(value: string) {
  const normalized = value
    .toLocaleLowerCase("tr")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  const aliases: Record<string, string> = {
    belgium: "belcika",
    belgique: "belcika",
    belgie: "belcika",
    belcika: "belcika",
    netherlands: "hollanda",
    nederland: "hollanda",
    nederlands: "hollanda",
    holland: "hollanda",
    deutschland: "almanya",
    germany: "almanya",
    allemagne: "almanya",
    france: "fransa",
    austria: "avusturya",
    osterreich: "avusturya",
    brussels: "bruksel",
    bruxelles: "bruksel",
    brussel: "bruksel",
    antwerpen: "antwerp",
    anvers: "antwerp",
    cologne: "koln",
    koeln: "koln",
    munich: "munih",
    muenchen: "munchen"
  };

  return aliases[normalized] ?? normalized;
}

function splitBulkRestaurantLine(line: string) {
  if (line.includes("|")) return line.split("|");
  if (line.includes("\t")) return line.split("\t");
  if (line.includes(";")) return line.split(";");
  return line.split("|");
}

function parseBulkRestaurantLine(line: string): BulkRestaurantRow | null {
  const parts = splitBulkRestaurantLine(line).map((part) => part.trim());
  if (parts.length < 3 || parts.every((part) => part.length === 0)) return null;

  const [name, location, address, phone = "", rawGrade = "B", cuisine = "restaurant", googlePlaceId = "", description = ""] = parts;
  if (!name || !location || !address) return null;

  const locationParts = location.split("/").map((part) => part.trim()).filter(Boolean);
  const countryName = locationParts.length > 1 ? locationParts[0] : "";
  const cityName = locationParts.length > 1 ? locationParts.slice(1).join("/") : locationParts[0] ?? "";
  const grade = rawGrade.toUpperCase();

  return {
    name,
    countryName,
    cityName,
    address,
    phone,
    grade: ["A", "B", "C"].includes(grade) ? grade : "B",
    cuisine: cuisine || "restaurant",
    googlePlaceId,
    description
  };
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

function cleanPublishedQualityFilter(value: string | undefined): PublishedQualityFilter {
  if (
    value === "missing-location" ||
    value === "missing-certificate" ||
    value === "missing-photo" ||
    value === "missing-menu"
  ) {
    return value;
  }

  return "all";
}

function mapsSearchUrl(item: AdminRestaurant) {
  const query = item.lat !== null && item.lng !== null
    ? `${item.lat},${item.lng}`
    : [item.name, item.address, item.cityName, item.countryName].filter(Boolean).join(", ");

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function placeIdFinderUrl() {
  return "https://developers.google.com/maps/documentation/javascript/examples/places-placeid-finder";
}

function telUrl(phone: string | null) {
  if (!phone) return null;
  const cleaned = phone.replace(/[^\d+]/g, "");
  return cleaned ? `tel:${cleaned}` : null;
}

function mailUrl(email: string | null) {
  if (!email) return null;
  return `mailto:${email}`;
}

function missingChecks(item: AdminRestaurant) {
  return [
    item.phone ? null : "Telefon eksik",
    item.photoUrl ? null : "Fotoğraf eksik",
    item.hasCertificate ? null : "Sertifika eksik",
    item.menuItemCount > 0 ? null : "Menü eksik",
    item.googlePlaceId || (item.lat !== null && item.lng !== null) ? null : "Konum net değil"
  ].filter(Boolean) as string[];
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

async function createPublishedRestaurant(formData: FormData) {
  "use server";

  requireAdmin();

  if (!hasSupabaseAdminConfig || !supabaseAdmin) {
    redirect("/admin?error=config");
  }

  const name = cleanText(formData.get("name"));
  const cityId = cleanText(formData.get("city_id"));
  const address = cleanText(formData.get("address"));
  const halalGrade = cleanText(formData.get("halal_grade")) || "B";
  const priceLevel = cleanPriceLevel(formData.get("price_level"));

  if (!name || !cityId || !address) {
    redirect("/admin?error=quick-add-missing");
  }
  if (!["A", "B", "C"].includes(halalGrade)) {
    redirect("/admin?error=grade");
  }

  const result = await supabaseAdmin.rpc("admin_create_published_restaurant", {
    next_name: name,
    next_slug: `${slugify(name)}-${Date.now()}`,
    next_city_id: cityId,
    next_address: address,
    next_phone: cleanText(formData.get("phone")),
    next_email: cleanText(formData.get("email")),
    next_opening_hours: cleanText(formData.get("opening_hours")),
    next_description: cleanText(formData.get("description")),
    next_cuisine: cleanText(formData.get("cuisine")) || "restaurant",
    next_halal_grade: halalGrade,
    next_price_level: priceLevel,
    next_google_place_id: cleanText(formData.get("google_place_id")),
    next_alcohol_free: formData.get("alcohol_free") === "on",
    next_prayer_room: formData.get("prayer_room") === "on",
    next_family_friendly: formData.get("family_friendly") === "on",
    next_is_featured: formData.get("is_featured") === "on"
  });

  if (result.error) {
    redirect(`/admin?error=${encodeURIComponent(result.error.message)}`);
  }

  revalidatePath("/");
  revalidatePath("/admin");
  redirect("/admin?created=1#published-restaurants");
}

async function createCity(formData: FormData) {
  "use server";

  requireAdmin();

  if (!hasSupabaseAdminConfig || !supabaseAdmin) {
    redirect("/admin?error=config#city-add");
  }

  const countryId = cleanText(formData.get("country_id"));
  const cityName = cleanText(formData.get("city_name"));
  const lat = cleanCoordinate(formData.get("lat"));
  const lng = cleanCoordinate(formData.get("lng"));

  if (!countryId || !cityName) {
    redirect("/admin?error=city-missing#city-add");
  }

  const result = await supabaseAdmin.rpc("admin_create_city", {
    target_country_id: countryId,
    next_name: cityName,
    next_lat: lat,
    next_lng: lng
  });

  if (result.error) {
    redirect(`/admin?error=${encodeURIComponent(result.error.message)}#city-add`);
  }

  revalidatePath("/");
  revalidatePath("/admin");
  redirect("/admin?cityCreated=1#city-add");
}

async function bulkCreatePublishedRestaurants(formData: FormData) {
  "use server";

  requireAdmin();

  if (!hasSupabaseAdminConfig || !supabaseAdmin) {
    redirect("/admin?error=config");
  }

  const rawRows = cleanText(formData.get("bulk_restaurants"));
  const rows = rawRows
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map(parseBulkRestaurantLine)
    .filter(Boolean) as BulkRestaurantRow[];

  if (rows.length === 0) {
    redirect("/admin?error=bulk-empty#bulk-add");
  }
  if (rows.length > 80) {
    redirect("/admin?error=bulk-too-many#bulk-add");
  }

  const cityResult = await supabaseAdmin
    .from("cities")
    .select("id,name,countries(name)")
    .order("name");

  if (cityResult.error) {
    redirect(`/admin?error=${encodeURIComponent(cityResult.error.message)}#bulk-add`);
  }

  const cityByCountryAndName = new Map<string, string>();
  const cityByName = new Map<string, string>();
  const ambiguousCities = new Set<string>();

  for (const city of cityResult.data ?? []) {
    const country = city.countries?.[0] ?? city.countries;
    const cityKey = normalizeLookup(city.name);
    const countryCityKey = `${normalizeLookup(country?.name ?? "")}/${cityKey}`;
    cityByCountryAndName.set(countryCityKey, city.id);

    if (cityByName.has(cityKey)) {
      ambiguousCities.add(cityKey);
    } else {
      cityByName.set(cityKey, city.id);
    }
  }

  let savedCount = 0;

  for (const [index, row] of rows.entries()) {
    const cityKey = normalizeLookup(row.cityName);
    const cityId = row.countryName
      ? cityByCountryAndName.get(`${normalizeLookup(row.countryName)}/${cityKey}`) ??
        (ambiguousCities.has(cityKey) ? null : cityByName.get(cityKey))
      : ambiguousCities.has(cityKey)
        ? null
        : cityByName.get(cityKey);

    if (!cityId) {
      redirect(`/admin?error=${encodeURIComponent(`${index + 1}. satırda şehir bulunamadı: ${row.countryName ? `${row.countryName} / ` : ""}${row.cityName}`)}#bulk-add`);
    }

    const result = await supabaseAdmin.rpc("admin_create_published_restaurant", {
      next_name: row.name,
      next_slug: `${slugify(row.name)}-${Date.now()}-${index + 1}`,
      next_city_id: cityId,
      next_address: row.address,
      next_phone: row.phone,
      next_email: "",
      next_opening_hours: "",
      next_description: row.description,
      next_cuisine: row.cuisine || "restaurant",
      next_halal_grade: row.grade,
      next_price_level: null,
      next_google_place_id: row.googlePlaceId,
      next_alcohol_free: formData.get("bulk_alcohol_free") === "on",
      next_prayer_room: false,
      next_family_friendly: false,
      next_is_featured: false
    });

    if (result.error) {
      redirect(`/admin?error=${encodeURIComponent(`${index + 1}. satır kaydedilemedi: ${result.error.message}`)}#bulk-add`);
    }

    savedCount += 1;
  }

  revalidatePath("/");
  revalidatePath("/admin");
  redirect(`/admin?bulkCreated=${savedCount}#published-restaurants`);
}

async function updatePendingRestaurant(formData: FormData) {
  "use server";

  requireAdmin();

  if (!hasSupabaseAdminConfig || !supabaseAdmin) {
    redirect("/admin?error=config");
  }

  const id = cleanText(formData.get("id"));
  const halalGrade = cleanText(formData.get("halal_grade")) || "B";
  const cityId = cleanText(formData.get("city_id")) || null;
  const lat = cleanCoordinate(formData.get("lat"));
  const lng = cleanCoordinate(formData.get("lng"));

  if (!id) {
    redirect("/admin?error=missing");
  }
  if (!["A", "B", "C"].includes(halalGrade)) {
    redirect("/admin?error=grade");
  }

  const result = await supabaseAdmin.rpc("update_pending_restaurant", {
    target_restaurant_id: id,
    next_name: cleanText(formData.get("name")),
    next_address: cleanText(formData.get("address")),
    next_phone: cleanText(formData.get("phone")),
    next_email: cleanText(formData.get("email")),
    next_opening_hours: cleanText(formData.get("opening_hours")),
    next_description: cleanText(formData.get("description")),
    next_halal_grade: halalGrade,
    next_city_id: cityId,
    next_certificate_body: cleanText(formData.get("certificate_body")),
    next_certificate_number: cleanText(formData.get("certificate_number")),
    next_certificate_url: cleanText(formData.get("certificate_url")),
    next_google_place_id: cleanText(formData.get("google_place_id")),
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

  if (!hasSupabaseAdminConfig || !supabaseAdmin) {
    redirect("/admin?error=config");
  }

  const id = cleanText(formData.get("id"));
  const halalGrade = cleanText(formData.get("halal_grade")) || "B";
  const cityId = cleanText(formData.get("city_id")) || null;
  const lat = cleanCoordinate(formData.get("lat"));
  const lng = cleanCoordinate(formData.get("lng"));

  if (!id) {
    redirect("/admin?error=missing");
  }
  if (!["A", "B", "C"].includes(halalGrade)) {
    redirect("/admin?error=grade");
  }

  const result = await supabaseAdmin.rpc("update_published_restaurant", {
    target_restaurant_id: id,
    next_name: cleanText(formData.get("name")),
    next_address: cleanText(formData.get("address")),
    next_phone: cleanText(formData.get("phone")),
    next_email: cleanText(formData.get("email")),
    next_opening_hours: cleanText(formData.get("opening_hours")),
    next_description: cleanText(formData.get("description")),
    next_halal_grade: halalGrade,
    next_city_id: cityId,
    next_is_featured: formData.get("is_featured") === "on",
    next_alcohol_free: formData.get("alcohol_free") === "on",
    next_prayer_room: formData.get("prayer_room") === "on",
    next_family_friendly: formData.get("family_friendly") === "on",
    next_certificate_body: cleanText(formData.get("certificate_body")),
    next_certificate_number: cleanText(formData.get("certificate_number")),
    next_certificate_url: cleanText(formData.get("certificate_url")),
    next_google_place_id: cleanText(formData.get("google_place_id")),
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

  if (!hasSupabaseAdminConfig || !supabaseAdmin) {
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

  const result = await supabaseAdmin.rpc("review_restaurant", {
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

  if (!hasSupabaseAdminConfig || !supabaseAdmin) {
    redirect("/admin?error=config");
  }

  const id = cleanText(formData.get("id"));

  if (!id) {
    redirect("/admin?error=missing");
  }

  const result = await supabaseAdmin.rpc("archive_published_restaurant", {
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

  if (!hasSupabaseAdminConfig || !supabaseAdmin) {
    redirect("/admin?error=config");
  }

  const id = cleanText(formData.get("id"));

  if (!id) {
    redirect("/admin?error=missing");
  }

  const result = await supabaseAdmin.rpc("restore_archived_restaurant", {
    target_restaurant_id: id
  });

  if (result.error) {
    redirect(`/admin?error=${encodeURIComponent(result.error.message)}`);
  }

  revalidatePath("/");
  revalidatePath("/admin");
  redirect("/admin?restored=1");
}

async function moderateReview(formData: FormData) {
  "use server";

  requireAdmin();

  if (!hasSupabaseAdminConfig || !supabaseAdmin) {
    redirect("/admin?error=config");
  }

  const id = cleanText(formData.get("id"));
  const status = cleanText(formData.get("status"));
  const restaurantSlug = cleanText(formData.get("restaurant_slug"));

  if (!id || !["approved", "rejected"].includes(status)) {
    redirect("/admin?error=review-status");
  }

  const result = await supabaseAdmin.rpc("review_user_review", {
    target_review_id: id,
    next_status: status
  });

  if (result.error) {
    redirect(`/admin?error=${encodeURIComponent(result.error.message)}`);
  }

  revalidatePath("/admin");
  if (restaurantSlug) {
    revalidatePath(`/restaurants/${restaurantSlug}`);
  }
  redirect(`/admin?reviewModerated=${status}`);
}

async function respondToReview(formData: FormData) {
  "use server";

  requireAdmin();

  if (!hasSupabaseAdminConfig || !supabaseAdmin) {
    redirect("/admin?error=config");
  }

  const id = cleanText(formData.get("id"));
  const restaurantSlug = cleanText(formData.get("restaurant_slug"));
  const response = cleanText(formData.get("owner_response"));

  if (!id) {
    redirect("/admin?error=review-response");
  }

  const result = await supabaseAdmin.rpc("respond_to_review", {
    target_review_id: id,
    next_owner_response: response
  });

  if (result.error) {
    redirect(`/admin?error=${encodeURIComponent(result.error.message)}`);
  }

  revalidatePath("/admin");
  if (restaurantSlug) {
    revalidatePath(`/restaurants/${restaurantSlug}`);
  }
  redirect("/admin?reviewResponse=1");
}

export default async function AdminPage({
  searchParams
}: {
  searchParams?: { reviewed?: string; reviewModerated?: string; reviewResponse?: string; saved?: string; publishedSaved?: string; archived?: string; restored?: string; loggedIn?: string; created?: string; cityCreated?: string; bulkCreated?: string; error?: string; q?: string; quality?: string };
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
  const publishedQuality = cleanPublishedQualityFilter(searchParams?.quality);
  const [pendingRestaurants, pendingReviews, approvedReviews, publishedRestaurants, archivedRestaurants, adminCities, adminCountries, adminMetrics] = await Promise.all([
    getPendingRestaurants(),
    getPendingReviews(),
    getApprovedReviews(),
    getPublishedRestaurants(publishedQuery, publishedQuality),
    getArchivedRestaurants(),
    getAdminCities(),
    getAdminCountries(),
    getAdminMetrics()
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
        {searchParams?.created ? (
          <div className="notice success">Restoran yayına eklendi veya mevcut kayıt güncellendi.</div>
        ) : null}
        {searchParams?.cityCreated ? (
          <div className="notice success">Şehir eklendi veya mevcut şehir güncellendi.</div>
        ) : null}
        {searchParams?.bulkCreated ? (
          <div className="notice success">{searchParams.bulkCreated} satır işlendi; yeni kayıtlar eklendi, aynı kayıtlar güncellendi.</div>
        ) : null}
        {searchParams?.reviewed ? (
          <div className="notice success">İşlem tamamlandı: {searchParams.reviewed}</div>
        ) : null}
        {searchParams?.reviewModerated ? (
          <div className="notice success">Yorum işlemi tamamlandı: {searchParams.reviewModerated}</div>
        ) : null}
        {searchParams?.reviewResponse ? (
          <div className="notice success">Yorum yanıtı güncellendi.</div>
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

      <section className="admin-metrics" aria-label="Admin özet metrikleri">
        <a className="metric-card" href="#pending-restaurants">
          <strong>{adminMetrics.pendingRestaurants}</strong>
          <span>bekleyen restoran</span>
        </a>
        <a className="metric-card" href="#published-restaurants">
          <strong>{adminMetrics.publishedRestaurants}</strong>
          <span>canlı restoran</span>
        </a>
        <a className="metric-card" href="#pending-reviews">
          <strong>{adminMetrics.pendingReviews}</strong>
          <span>bekleyen yorum</span>
        </a>
        <a className="metric-card" href="#approved-reviews">
          <strong>{adminMetrics.approvedReviews}</strong>
          <span>yayındaki yorum</span>
        </a>
        <a className="metric-card" href="/admin?quality=missing-location#published-restaurants">
          <strong>{adminMetrics.missingCoordinates}</strong>
          <span>koordinat eksik</span>
        </a>
        <a className="metric-card" href="#archived-restaurants">
          <strong>{adminMetrics.archivedRestaurants}</strong>
          <span>arşivlenen kayıt</span>
        </a>
      </section>

      <section className="panel" id="city-add" style={{ marginTop: 16 }}>
        <span className="pill">Şehir Yönetimi</span>
        <h2>Listede olmayan şehri ekle.</h2>
        <p className="muted">
          Restoran eklemeden önce şehir yoksa buradan ekle. Aynı ülke içinde aynı şehir varsa tekrar kayıt açılmaz, varsa koordinatı güncellenir.
        </p>
        <form action={createCity} className="owner-form" style={{ marginTop: 16 }}>
          <div className="form-grid">
            <select name="country_id" required>
              <option value="">Ülke seç</option>
              {adminCountries.map((country) => (
                <option key={country.id} value={country.id}>
                  {country.flag} {country.name}
                </option>
              ))}
            </select>
            <input name="city_name" placeholder="Şehir adı, örn. Utrecht" required />
            <input name="lat" inputMode="decimal" placeholder="Enlem opsiyonel" />
            <input name="lng" inputMode="decimal" placeholder="Boylam opsiyonel" />
          </div>
          <button className="button primary" type="submit">Şehri Ekle</button>
        </form>
      </section>

      <section className="admin-command" aria-label="Yayın hazırlık kontrolü">
        <div>
          <span className="pill">Yayın Hazırlığı</span>
          <h2>Bugün önce bunları tamamla.</h2>
          <p className="muted">
            Canlıya çıkış için en kritik sıra: başvuruları kontrol et, konumu netleştir, menü ve sertifika eksiklerini kapat.
          </p>
        </div>
        <div className="command-actions">
          <a className="button primary" href="#pending-restaurants">Başvuruları İncele</a>
          <a className="button" href="/admin?quality=missing-location#published-restaurants">Konum Eksikleri</a>
          <a className="button" href="/admin?quality=missing-menu#published-restaurants">Menü Eksikleri</a>
          <a className="button" href="/admin?quality=missing-certificate#published-restaurants">Sertifika Eksikleri</a>
          <a className="button" href="#pending-reviews">Yorum Kuyruğu</a>
        </div>
      </section>

      <section className="panel" id="quick-add" style={{ marginTop: 16 }}>
        <span className="pill">Hızlı Yayın</span>
        <h2>Gerçek restoranı doğrudan yayına ekle.</h2>
        <p className="muted">
          Toplu veri girerken en hızlı yol bu formdur. Menü, fotoğraf ve sertifika sonradan canlı kayıt düzenleme alanından tamamlanabilir.
        </p>
        <form action={createPublishedRestaurant} className="owner-form" style={{ marginTop: 16 }}>
          <div className="form-grid">
            <input name="name" placeholder="Restoran adı" required />
            <select name="city_id" required>
              <option value="">Ülke / şehir seç</option>
              {adminCities.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.countryFlag} {city.countryName} / {city.name}
                </option>
              ))}
            </select>
            <input name="address" placeholder="Tam adres" required />
            <input name="phone" placeholder="Telefon" />
            <input name="email" type="email" placeholder="E-posta" />
            <input name="opening_hours" placeholder="Çalışma saatleri" />
            <input name="google_place_id" placeholder="Google Place ID" />
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
          </div>
          <textarea name="description" placeholder="Kısa açıklama" />
          <div className="checks">
            <label><input name="is_featured" type="checkbox" /> Öne çıkar</label>
            <label><input name="alcohol_free" type="checkbox" /> Alkolsüz</label>
            <label><input name="prayer_room" type="checkbox" /> Mescid var</label>
            <label><input name="family_friendly" type="checkbox" /> Aile dostu</label>
          </div>
          <button className="button primary" type="submit">Restoranı Yayına Ekle</button>
        </form>
      </section>

      <section className="panel" id="bulk-add" style={{ marginTop: 16 }}>
        <span className="pill">Toplu Yayın</span>
        <h2>Restoran listesini yapıştır, tek seferde ekle.</h2>
        <p className="muted">
          Aşağıdaki büyük kutuya gerçek listeyi yapıştır. Şehir eşleşirse kayıtlar direkt canlıya alınır; menü, fotoğraf, sertifika ve çalışma saatleri sonradan tamamlanabilir.
        </p>
        <div className="required-summary" style={{ marginTop: 14 }}>
          <strong>Format</strong>
          <p>Ad | Ülke/Şehir | Adres | Telefon | Grade | Mutfak | Google Place ID | Kısa açıklama</p>
          <p className="muted">Örnek: Lale Pide | Belçika/Bruksel | Chau. de Haecht 129, 1030 Schaerbeek | +32 2 217 47 82 | B | pide | | Alkolsüz pide ve kebap</p>
        </div>
        <form action={bulkCreatePublishedRestaurants} className="owner-form" style={{ marginTop: 16 }}>
          <textarea
            name="bulk_restaurants"
            placeholder={"Lale Pide | Belçika/Bruksel | Chau. de Haecht 129, 1030 Schaerbeek | +32 2 217 47 82 | B | pide | | Alkolsüz pide ve kebap\nPastane 2 | Hollanda/Amsterdam | Adres | Telefon | A | dessert | Place ID | Not"}
            rows={8}
          />
          <div className="checks">
            <label><input name="bulk_alcohol_free" type="checkbox" /> Bu listedeki restoranları varsayılan alkolsüz işaretle</label>
          </div>
          <button className="button primary" type="submit">Kutudaki Listeyi Toplu Yayına Al</button>
        </form>
      </section>

      <section className="grid" id="pending-restaurants">
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
            <div className="feature-row">
              {missingChecks(item).map((label) => (
                <span className="pill warning" key={label}>{label}</span>
              ))}
            </div>
            {item.description ? <p className="muted">{item.description}</p> : null}
            <div className="feature-row">
              {item.alcoholFree ? <span className="pill">Alkolsüz</span> : null}
              {item.prayerRoom ? <span className="pill">Mescid</span> : null}
              {item.familyFriendly ? <span className="pill">Aile dostu</span> : null}
            </div>
            <div className="detail-actions">
              <a className="button" href={mapsSearchUrl(item)} target="_blank" rel="noreferrer">Haritada Kontrol Et</a>
              <a className="button" href={placeIdFinderUrl()} target="_blank" rel="noreferrer">Place ID Bul</a>
              {telUrl(item.phone) ? <a className="button" href={telUrl(item.phone) ?? undefined}>Ara</a> : null}
              {mailUrl(item.email) ? <a className="button" href={mailUrl(item.email) ?? undefined}>E-posta</a> : null}
              {item.certificateUrl ? <a className="button" href={item.certificateUrl} target="_blank" rel="noreferrer">Sertifika Aç</a> : null}
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
                  <select name="city_id" defaultValue={item.cityId ?? ""}>
                    <option value="">Şehir değiştirme</option>
                    {adminCities.map((city) => (
                      <option key={city.id} value={city.id}>
                        {city.countryFlag} {city.countryName} / {city.name}
                      </option>
                    ))}
                  </select>
                  <select name="halal_grade" defaultValue={item.halalGrade}>
                    <option value="A">Grade A</option>
                    <option value="B">Grade B</option>
                    <option value="C">Grade C</option>
                  </select>
                  <input name="certificate_body" defaultValue={item.certificateBody ?? ""} placeholder="Sertifika kurumu" />
                  <input name="certificate_number" defaultValue={item.certificateNumber ?? ""} placeholder="Sertifika numarası" />
                  <input name="certificate_url" defaultValue={item.certificateUrl ?? ""} placeholder="Sertifika PDF/resim linki" />
                  <input name="google_place_id" defaultValue={item.googlePlaceId ?? ""} placeholder="Google Place ID" />
                  <input name="lat" defaultValue={item.lat ?? ""} inputMode="decimal" placeholder="Enlem, örn. 52.5200" />
                  <input name="lng" defaultValue={item.lng ?? ""} inputMode="decimal" placeholder="Boylam, örn. 13.4050" />
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

      <section className="panel" id="pending-reviews" style={{ marginTop: 24 }}>
        <span className="pill">Yorum Onayı</span>
        <h2>Bekleyen kullanıcı yorumları.</h2>
        <p className="muted">
          Yorumları kontrol edip yayına alabilir veya reddedebilirsin.
        </p>
      </section>

      <section className="grid">
        {pendingReviews.map((review) => (
          <article className="card admin-card" key={review.id}>
            <div className="card-top">
              <span className="pill">pending</span>
              <span className="pill">{review.rating}/5</span>
              {review.halalRating ? <span className="pill">Helal {review.halalRating}/5</span> : null}
              {review.foodRating ? <span className="pill">Yemek {review.foodRating}/5</span> : null}
            </div>
            <h3>{review.restaurantName}</h3>
            <p className="muted">{review.authorName || "Misafir"} · {new Date(review.createdAt).toLocaleDateString("tr-TR")}</p>
            <p>{review.body}</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <form action={moderateReview}>
                <input type="hidden" name="id" value={review.id} />
                <input type="hidden" name="restaurant_slug" value={review.restaurantSlug} />
                <input type="hidden" name="status" value="approved" />
                <button className="button primary" type="submit">Yorumu Onayla</button>
              </form>
              <form action={moderateReview}>
                <input type="hidden" name="id" value={review.id} />
                <input type="hidden" name="restaurant_slug" value={review.restaurantSlug} />
                <input type="hidden" name="status" value="rejected" />
                <button className="button danger" type="submit">Reddet</button>
              </form>
            </div>
          </article>
        ))}
      </section>

      {pendingReviews.length === 0 ? (
        <section className="empty-state">
          <span className="pill">Yorum kuyruğu boş</span>
          <h2>Bekleyen yorum yok.</h2>
          <p className="muted">Kullanıcı yorumları gönderildiğinde burada görünecek.</p>
        </section>
      ) : null}

      <section className="panel" id="approved-reviews" style={{ marginTop: 24 }}>
        <span className="pill">Yorum Yanıtları</span>
        <h2>Yayındaki yorumlara cevap ver.</h2>
        <p className="muted">
          Yazılan yanıt restoran detayında “İşletme yanıtı” olarak görünür. Boş kaydedersen mevcut yanıt kaldırılır.
        </p>
      </section>

      <section className="grid">
        {approvedReviews.map((review) => (
          <article className="card admin-card" key={review.id}>
            <div className="card-top">
              <span className="pill">approved</span>
              <span className="pill">{review.rating}/5</span>
              {review.ownerResponse ? <span className="pill">Yanıtlandı</span> : <span className="pill warning">Yanıt yok</span>}
            </div>
            <h3>{review.restaurantName}</h3>
            <p className="muted">{review.authorName || "Misafir"} · {new Date(review.createdAt).toLocaleDateString("tr-TR")}</p>
            <p>{review.body}</p>
            <form action={respondToReview} className="response-form">
              <input type="hidden" name="id" value={review.id} />
              <input type="hidden" name="restaurant_slug" value={review.restaurantSlug} />
              <textarea
                name="owner_response"
                defaultValue={review.ownerResponse ?? ""}
                placeholder="İşletme yanıtı yaz..."
              />
              <div className="detail-actions">
                <button className="button primary" type="submit">Yanıtı Kaydet</button>
                {review.restaurantSlug ? <a className="button" href={`/restaurants/${review.restaurantSlug}`}>Detayı Aç</a> : null}
              </div>
            </form>
          </article>
        ))}
      </section>

      {approvedReviews.length === 0 ? (
        <section className="empty-state">
          <span className="pill">Yayın yorumu yok</span>
          <h2>Cevaplanacak onaylı yorum yok.</h2>
          <p className="muted">Yorumlar onaylandıktan sonra işletme yanıtı için burada listelenecek.</p>
        </section>
      ) : null}

      <section className="panel" id="published-restaurants" style={{ marginTop: 24 }}>
        <span className="pill">Yayındaki Restoranlar</span>
        <h2>Canlı kayıtları düzenle.</h2>
        <p className="muted">
          Onaylanmış restoranlarda adres, açıklama, Grade, özellik ve sertifika bilgilerini sonradan düzeltebilirsin.
        </p>
        <form className="form-grid" style={{ marginTop: 14 }}>
          <input name="q" defaultValue={publishedQuery} placeholder="Yayındaki restoranlarda ara" />
          <select name="quality" defaultValue={publishedQuality} aria-label="Kayıt kalitesi filtresi">
            <option value="all">Tüm canlı kayıtlar</option>
            <option value="missing-location">Konumu net olmayanlar</option>
            <option value="missing-certificate">Sertifikası eksik olanlar</option>
            <option value="missing-menu">Menüsü eksik olanlar</option>
            <option value="missing-photo">Fotoğrafı eksik olanlar</option>
          </select>
          <button className="button primary" type="submit">Ara</button>
        </form>
        {publishedQuery || publishedQuality !== "all" ? (
          <div className="detail-actions">
            <span className="pill">{publishedRestaurants.length} sonuç</span>
            {publishedQuality !== "all" ? <span className="pill">Kalite filtresi aktif</span> : null}
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
              {item.menuItemCount > 0 ? <span>{item.menuItemCount} menü ürünü</span> : null}
            </div>
            <div className="feature-row">
              {missingChecks(item).map((label) => (
                <span className="pill warning" key={label}>{label}</span>
              ))}
            </div>
            <div className="feature-row">
              {item.alcoholFree ? <span className="pill">Alkolsüz</span> : null}
              {item.prayerRoom ? <span className="pill">Mescid</span> : null}
              {item.familyFriendly ? <span className="pill">Aile dostu</span> : null}
            </div>
            <div className="detail-actions">
              <a className="button" href={mapsSearchUrl(item)} target="_blank" rel="noreferrer">Haritada Kontrol Et</a>
              <a className="button" href={placeIdFinderUrl()} target="_blank" rel="noreferrer">Place ID Bul</a>
              <a className="button" href={`/restaurants/${item.slug}`}>Detayı Aç</a>
              {telUrl(item.phone) ? <a className="button" href={telUrl(item.phone) ?? undefined}>Ara</a> : null}
              {mailUrl(item.email) ? <a className="button" href={mailUrl(item.email) ?? undefined}>E-posta</a> : null}
              {item.certificateUrl ? <a className="button" href={item.certificateUrl} target="_blank" rel="noreferrer">Sertifika Aç</a> : null}
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
                  <select name="city_id" defaultValue={item.cityId ?? ""}>
                    <option value="">Şehir değiştirme</option>
                    {adminCities.map((city) => (
                      <option key={city.id} value={city.id}>
                        {city.countryFlag} {city.countryName} / {city.name}
                      </option>
                    ))}
                  </select>
                  <select name="halal_grade" defaultValue={item.halalGrade}>
                    <option value="A">Grade A</option>
                    <option value="B">Grade B</option>
                    <option value="C">Grade C</option>
                  </select>
                  <input name="certificate_body" defaultValue={item.certificateBody ?? ""} placeholder="Sertifika kurumu" />
                  <input name="certificate_number" defaultValue={item.certificateNumber ?? ""} placeholder="Sertifika numarası" />
                  <input name="certificate_url" defaultValue={item.certificateUrl ?? ""} placeholder="Sertifika PDF/resim linki" />
                  <input name="google_place_id" defaultValue={item.googlePlaceId ?? ""} placeholder="Google Place ID" />
                  <input name="lat" defaultValue={item.lat ?? ""} inputMode="decimal" placeholder="Enlem, örn. 52.5200" />
                  <input name="lng" defaultValue={item.lng ?? ""} inputMode="decimal" placeholder="Boylam, örn. 13.4050" />
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

      <section className="panel" id="archived-restaurants" style={{ marginTop: 24 }}>
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
