const pendingRestaurants = [
  { name: "Mangal Restaurant", city: "Köln", owner: "Demo İşletme", status: "pending" },
  { name: "Le Kebab Parisien", city: "Paris", owner: "Demo Owner", status: "pending" }
];

export default function AdminPage() {
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
          <article className="card" key={item.name}>
            <span className="pill">{item.status}</span>
            <h3>{item.name}</h3>
            <p className="muted">{item.city} · {item.owner}</p>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="button primary">Onayla</button>
              <button className="button">Reddet</button>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
