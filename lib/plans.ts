export const plans = [
  {
    id: "free",
    name: "Ücretsiz",
    price: "€0",
    description: "Temel görünürlük",
    features: ["Restoran adı, adres, telefon", "Şehir listesinde görünme", "Admin onay süreci"]
  },
  {
    id: "basic",
    name: "Basic",
    price: "€9",
    description: "Menü ve fotoğraf",
    features: ["Menü ve fiyatlar", "5 fotoğraf", "Çalışma saatleri"]
  },
  {
    id: "pro",
    name: "Pro",
    price: "€19",
    description: "Sertifika ve yönetim",
    features: ["Sertifika/PDF", "QR menü", "Yorum cevaplama", "Basit istatistik"],
    recommended: true
  },
  {
    id: "premium",
    name: "Premium",
    price: "€39",
    description: "Büyüme paketi",
    features: ["Öne çıkarma", "Kampanya", "Çoklu şube", "Gelişmiş analytics"]
  }
] as const;
