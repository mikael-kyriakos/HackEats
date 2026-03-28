create extension if not exists pgcrypto;

create table if not exists public.products (
  id text primary key,
  name text not null,
  description text not null,
  price_pence integer not null check (price_pence > 0),
  stock integer not null check (stock >= 0),
  image text not null,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.orders (
  id uuid primary key,
  product_id text not null references public.products(id),
  quantity integer not null check (quantity > 0),
  room text not null,
  customer_name text,
  phone text,
  status text not null check (status in ('pending', 'paid', 'fulfilled', 'cancelled')),
  unit_amount integer not null check (unit_amount > 0),
  total_amount integer not null check (total_amount > 0),
  checkout_session_id text unique,
  stripe_payment_intent_id text,
  created_at timestamptz not null default timezone('utc', now()),
  paid_at timestamptz,
  fulfilled_at timestamptz,
  fulfilled_by text
);

create or replace function public.create_pending_order(
  p_order_id uuid,
  p_product_id text,
  p_quantity integer,
  p_room text,
  p_customer_name text,
  p_phone text
)
returns table (
  order_id uuid,
  product_name text,
  quantity integer,
  unit_amount integer,
  total_amount integer
)
language plpgsql
security definer
as $$
declare
  v_product public.products%rowtype;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Quantity must be at least 1';
  end if;

  select *
  into v_product
  from public.products
  where id = p_product_id
    and active = true
  for update;

  if not found then
    raise exception 'Product not found';
  end if;

  if v_product.stock < p_quantity then
    raise exception 'Not enough stock available';
  end if;

  update public.products
  set stock = stock - p_quantity
  where id = p_product_id;

  insert into public.orders (
    id,
    product_id,
    quantity,
    room,
    customer_name,
    phone,
    status,
    unit_amount,
    total_amount
  ) values (
    p_order_id,
    p_product_id,
    p_quantity,
    p_room,
    nullif(p_customer_name, ''),
    nullif(p_phone, ''),
    'pending',
    v_product.price_pence,
    v_product.price_pence * p_quantity
  );

  return query
  select
    p_order_id,
    v_product.name,
    p_quantity,
    v_product.price_pence,
    v_product.price_pence * p_quantity;
end;
$$;

create or replace function public.mark_order_paid(
  p_order_id uuid,
  p_checkout_session_id text,
  p_payment_intent_id text default null
)
returns void
language plpgsql
security definer
as $$
begin
  update public.orders
  set status = 'paid',
      checkout_session_id = coalesce(p_checkout_session_id, checkout_session_id),
      stripe_payment_intent_id = coalesce(p_payment_intent_id, stripe_payment_intent_id),
      paid_at = timezone('utc', now())
  where id = p_order_id
    and status = 'pending';
end;
$$;

create or replace function public.cancel_pending_order(
  p_order_id uuid
)
returns void
language plpgsql
security definer
as $$
declare
  v_order public.orders%rowtype;
begin
  select *
  into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    return;
  end if;

  if v_order.status <> 'pending' then
    return;
  end if;

  update public.products
  set stock = stock + v_order.quantity
  where id = v_order.product_id;

  update public.orders
  set status = 'cancelled'
  where id = p_order_id;
end;
$$;

create or replace function public.fulfill_order(
  p_order_id uuid,
  p_fulfilled_by text default null
)
returns void
language plpgsql
security definer
as $$
begin
  update public.orders
  set status = 'fulfilled',
      fulfilled_at = timezone('utc', now()),
      fulfilled_by = nullif(p_fulfilled_by, '')
  where id = p_order_id
    and status = 'paid';
end;
$$;

alter table public.products enable row level security;
alter table public.orders enable row level security;

drop policy if exists "Public can read active products" on public.products;
create policy "Public can read active products"
on public.products
for select
using (active = true);
