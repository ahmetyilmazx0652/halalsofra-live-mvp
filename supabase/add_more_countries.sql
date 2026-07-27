insert into public.countries (name, code, flag) values
  ('Almanya', 'DE', '🇩🇪'),
  ('Arnavutluk', 'AL', '🇦🇱'),
  ('Avusturya', 'AT', '🇦🇹'),
  ('Belçika', 'BE', '🇧🇪'),
  ('Bosna-Hersek', 'BA', '🇧🇦'),
  ('Diğer', 'XX', '🌍'),
  ('Fransa', 'FR', '🇫🇷'),
  ('Hollanda', 'NL', '🇳🇱'),
  ('Hırvatistan', 'HR', '🇭🇷'),
  ('Macaristan', 'HU', '🇭🇺'),
  ('Polonya', 'PL', '🇵🇱'),
  ('Portekiz', 'PT', '🇵🇹'),
  ('Slovenya', 'SI', '🇸🇮'),
  ('Yunanistan', 'GR', '🇬🇷'),
  ('Çekya', 'CZ', '🇨🇿'),
  ('İspanya', 'ES', '🇪🇸'),
  ('İsviçre', 'CH', '🇨🇭'),
  ('İtalya', 'IT', '🇮🇹')
on conflict (code) do update
set name = excluded.name,
    flag = excluded.flag;

insert into public.cities (country_id, name, lat, lng)
select c.id, v.name, v.lat, v.lng
from public.countries c
join (values
  ('DE','Berlin',52.5200,13.4050),
  ('DE','Köln',50.9375,6.9603),
  ('DE','Frankfurt',50.1109,8.6821),
  ('DE','Hamburg',53.5511,9.9937),
  ('DE','Düsseldorf',51.2277,6.7735),
  ('AL','Tiran',41.3275,19.8187),
  ('AL','İşkodra',42.0693,19.5033),
  ('AT','Viyana',48.2082,16.3738),
  ('AT','Salzburg',47.8095,13.0550),
  ('BE','Bruksel',50.8503,4.3517),
  ('BE','Antwerp',51.2194,4.4025),
  ('BA','Saraybosna',43.8563,18.4131),
  ('BA','Mostar',43.3438,17.8078),
  ('XX','Bilinmiyor',null,null),
  ('FR','Paris',48.8566,2.3522),
  ('FR','Lyon',45.7640,4.8357),
  ('FR','Marsilya',43.2965,5.3698),
  ('NL','Amsterdam',52.3676,4.9041),
  ('NL','Rotterdam',51.9244,4.4777),
  ('HR','Zagreb',45.8150,15.9819),
  ('HR','Split',43.5081,16.4402),
  ('HU','Budapeşte',47.4979,19.0402),
  ('PL','Varşova',52.2297,21.0122),
  ('PL','Kraków',50.0647,19.9450),
  ('PT','Lizbon',38.7223,-9.1393),
  ('PT','Porto',41.1579,-8.6291),
  ('SI','Ljubljana',46.0569,14.5058),
  ('GR','Atina',37.9838,23.7275),
  ('GR','Selanik',40.6401,22.9444),
  ('CZ','Prag',50.0755,14.4378),
  ('ES','Madrid',40.4168,-3.7038),
  ('ES','Barcelona',41.3874,2.1686),
  ('CH','Zürih',47.3769,8.5417),
  ('CH','Cenevre',46.2044,6.1432),
  ('IT','Roma',41.9028,12.4964),
  ('IT','Milano',45.4642,9.1900)
) as v(code, name, lat, lng) on c.code = v.code
on conflict (country_id, name) do update
set lat = excluded.lat,
    lng = excluded.lng;
