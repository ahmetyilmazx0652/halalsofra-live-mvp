export const cuisineOptions = [
  { value: "restaurant", label: "Restoran" },
  { value: "turkish", label: "Türk" },
  { value: "arabic", label: "Arap" },
  { value: "kebab", label: "Kebap / Döner" },
  { value: "pide", label: "Pide / Lahmacun" },
  { value: "dessert", label: "Pastane / Tatlı" },
  { value: "ice_cream", label: "Dondurmacı" },
  { value: "bakery", label: "Fırın" },
  { value: "cafe", label: "Kafe" },
  { value: "breakfast", label: "Kahvaltı" },
  { value: "burger", label: "Burger" },
  { value: "fast_food", label: "Fast food" },
  { value: "steakhouse", label: "Steakhouse" },
  { value: "seafood", label: "Balıkçı" },
  { value: "market", label: "Market" },
  { value: "butcher", label: "Kasap" },
  { value: "other", label: "Diğer" }
];

export function cuisineLabel(value: string | null | undefined) {
  if (!value) return "Restoran";
  return cuisineOptions.find((option) => option.value === value)?.label ?? value;
}
