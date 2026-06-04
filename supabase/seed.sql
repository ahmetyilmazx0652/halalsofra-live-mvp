insert into public.countries (name, code, flag) values
  ('Almanya', 'DE', '🇩🇪'),
  ('Fransa', 'FR', '🇫🇷'),
  ('Birleşik Krallık', 'GB', '🇬🇧'),
  ('Hollanda', 'NL', '🇳🇱'),
  ('Belçika', 'BE', '🇧🇪'),
  ('Avusturya', 'AT', '🇦🇹'),
  ('İsveç', 'SE', '🇸🇪'),
  ('İsviçre', 'CH', '🇨🇭')
on conflict (code) do nothing;

insert into public.cities (country_id, name, lat, lng)
select c.id, v.name, v.lat, v.lng
from public.countries c
join (values
  ('DE','Berlin',52.5200,13.4050),
  ('DE','Köln',50.9375,6.9603),
  ('DE','Frankfurt',50.1109,8.6821),
  ('DE','Hamburg',53.5511,9.9937),
  ('DE','Düsseldorf',51.2277,6.7735),
  ('FR','Paris',48.8566,2.3522),
  ('GB','London',51.5072,-0.1276),
  ('NL','Amsterdam',52.3676,4.9041),
  ('NL','Rotterdam',51.9244,4.4777),
  ('BE','Brussels',50.8503,4.3517),
  ('AT','Vienna',48.2082,16.3738),
  ('SE','Stockholm',59.3293,18.0686),
  ('CH','Zürich',47.3769,8.5417)
) as v(code, name, lat, lng) on c.code = v.code
on conflict (country_id, name) do nothing;
