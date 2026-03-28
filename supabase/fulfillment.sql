alter table public.orders
  drop constraint if exists orders_status_check;

alter table public.orders
  add constraint orders_status_check
  check (status in ('pending', 'paid', 'fulfilled', 'cancelled'));

alter table public.orders
  add column if not exists fulfilled_at timestamptz,
  add column if not exists fulfilled_by text;

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
