import { plans } from "@/lib/plans";

export default function OwnerPage() {
  return (
    <main className="page">
      <section className="panel">
        <span className="pill">İşletme Paneli</span>
        <h1>Restoranını ekle, menünü ve sertifikanı yönet.</h1>
        <p className="muted">
          Canlı sürümde bu form Supabase Auth, Storage ve Stripe Checkout ile bağlanacak.
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
        <div className="form-grid">
          <input placeholder="Restoran adı" />
          <input placeholder="Telefon" />
          <input placeholder="Ülke" />
          <input placeholder="Şehir" />
          <input placeholder="Tam adres" />
          <input placeholder="Google Place ID" />
          <input placeholder="Sertifika kurumu" />
          <input placeholder="Sertifika numarası" />
        </div>
        <textarea style={{ marginTop: 12 }} placeholder="Kısa açıklama" />
        <button className="button primary" style={{ marginTop: 12 }}>Başvuruyu Gönder</button>
      </section>
    </main>
  );
}
