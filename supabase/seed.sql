insert into public.products (id, name, description, price_pence, stock, image, active)
values
  ('volt-energy', 'Volt Energy', 'Citrus energy drink for teams pushing through the midnight sprint.', 280, 14, './assets/volt-energy.svg', true),
  ('pixel-popcorn', 'Pixel Popcorn', 'Sweet and salty popcorn tub that is easy to share around a laptop.', 220, 11, './assets/pixel-popcorn.svg', true),
  ('debug-chips', 'Debug Chips', 'Sea salt crisps for fast snack refuelling between demos.', 175, 6, './assets/debug-chips.svg', true),
  ('focus-bar', 'Focus Bar', 'Oat and peanut protein bar for calmer, steadier energy.', 195, 9, './assets/focus-bar.svg', true),
  ('fruit-boost', 'Fruit Boost Cup', 'Fresh fruit cup when the team wants something lighter.', 250, 4, './assets/fruit-boost.svg', true),
  ('hydrate-water', 'Hydrate+ Water', 'Cold bottled water to offset the caffeine curve.', 150, 20, './assets/hydrate-water.svg', true)
on conflict (id) do update
set
  name = excluded.name,
  description = excluded.description,
  price_pence = excluded.price_pence,
  stock = excluded.stock,
  image = excluded.image,
  active = excluded.active;
