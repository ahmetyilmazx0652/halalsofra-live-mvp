import { revalidatePath } from "next/cache";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PendingRestaurant = {
  id: string;
  name: string;
  address: string;
  phone: string | null;
  status: string;
  cityName: string;
  countryName: string;
};

async function getPendingRestaurants() {
  if (!hasSupabaseConfig || !supabase) return [];

  const result = await supabase
    .from("restaurants")
    .select("id,name,address,phone,status,cities(name),countries(name)")
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (result.error) return [];
  return (result.data ?? []).map((item: any) => ({
    id: item.id,
    name: item.name,
    address: item.address,
    phone: item.phone,
    status: item.status,
    cityName: item.cities?.[0]?.name ?? item.cities?.name ?? "Bilinmiyor",
    countryName: item.countries?.[0]?.name ?? item.countries?.name ?? "Bilinmiyor"
  }));
}

async function updateRestaurantStatus(formData: FormData) {
  "use server";

  if (!hasSupabaseConfig || !supabase) return;

  const id = formData.get("id");
  const status = formData.get("status");

  if (typeof id !== "string" || typeof status !== "string") return;
  if (!["published", "rejected"].includes(status)) return;

  await supabase
    .from("restaurants")
    .update({ status })
    .eq("id", id)
    .eq("status", "pending");

  revalidatePath("/");
  revalidatePath("/admin");
}

export default async function AdminPage() {
  const pendingRestaurants = await getPendingRestaurants();

  return (
    <main className="page">
      <section className="panel">
        <span className="pill">Admin</span>
        <h1>Restoran ve sertifika onay kuyruğu.</h1>
        <p className="muted">
          Canlı sürümde bu ekran sadece admin rolüne açık olacak.
        </p>
      </section>

      <section className="grid">
        {pendingRestaurants.map((item) => (
          <article className="card" key={item.id}>
            <span className="pill">{item.status}</span>
            <h3>{item.name}</h3>
            <p className="muted">{item.countryName} · {item.cityName}</p>
            <p>{item.address}</p>
            {item.phone ? <p>{item.phone}</p> : null}
            <div style={{ display: "flex", gap: 8 }}>
              <form action={updateRestaurantStatus}>
                <input type="hidden" name="id" value={item.id} />
                <input type="hidden" name="status" value="published" />
                <button className="button primary">Onayla</button>
              </form>
              <form action={updateRestaurantStatus}>
                <input type="hidden" name="id" value={item.id} />
                <input type="hidden" name="status" value="rejected" />
                <button className="button">Reddet</button>
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
    </main>
  );
}
