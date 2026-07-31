"use client";

import { useState } from "react";

type CityOption = { id: string; name: string };
type CityGroup = { label: string; cities: CityOption[] };
type CountryOption = { id: string; label: string };

export default function OwnerCityPicker({
  cityGroups,
  countryOptions
}: {
  cityGroups: CityGroup[];
  countryOptions: CountryOption[];
}) {
  const [isOther, setIsOther] = useState(false);

  return (
    <>
      <select
        name="city_id"
        required
        onChange={(event) => setIsOther(event.target.value === "__other__")}
      >
        <option value="">Ülke / şehir seç (zorunlu)</option>
        {cityGroups.map((group) => (
          <optgroup key={group.label} label={group.label}>
            {group.cities.map((city) => (
              <option key={city.id} value={city.id}>
                {city.name}
              </option>
            ))}
          </optgroup>
        ))}
        <option value="__other__">Şehrim listede yok</option>
      </select>
      {isOther ? (
        <div id="new-city-fields">
          <select name="requested_country_id" required>
            <option value="">Ülke seç</option>
            {countryOptions.map((country) => (
              <option key={country.id} value={country.id}>
                {country.label}
              </option>
            ))}
          </select>
          <input name="requested_city_name" placeholder="Şehir adı (zorunlu)" required />
          <input name="requested_region" placeholder="Bölge/eyalet (opsiyonel)" />
        </div>
      ) : null}
    </>
  );
}
