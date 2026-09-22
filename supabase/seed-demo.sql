-- ============================================================================
-- Demo data for the OptiSource back office.
--
-- Paste into the Supabase SQL Editor and run. Safe to run more than once:
-- every insert is keyed on a natural unique column and does nothing on
-- conflict, so it will not create duplicates.
--
-- To remove it afterwards, see the DELETE block at the bottom.
-- ============================================================================

-- ---------------------------------------------------------------- customers
insert into public.customers
  (customer_name, shop_name, area, address, phone, default_discount_pct,
   opening_balance, opening_balance_date)
values
  ('Imran Shah',    'Devartson Optics',  'F-7',      'Shop 14, Jinnah Super Market, F-7 Markaz',  '0300-1234567', 10, 18500.00, current_date - 45),
  ('Bilal Ahmed',   'Al-Noor Opticians', 'Saddar',   'Shop 3, Bank Road, Saddar',                 '0321-9876543',  5,  6200.00, current_date - 30),
  ('Sana Tariq',    'Vision Care Optics','G-11',     'Plot 27, G-11 Markaz',                      '0333-4455667', 12,     0.00, current_date - 20),
  ('Kamran Iqbal',  'City Optics',       'Rawalpindi','Commercial Market, Satellite Town',        '0345-1122334',  8, 32400.00, current_date - 60)
on conflict do nothing;

-- ----------------------------------------------------------------- products
-- Lenses are power-tracked. Coatings and tints are services: billed per job,
-- never held, so they get no stock bin at all.
insert into public.products
  (sku, name, category, unit, list_price, tracks_power, tracks_stock)
values
  ('SV-156-HC',   'Single Vision 1.56 Hard-Coated',  'lenses',      'pairs', 450.00, true,  true),
  ('SV-156-AR',   'Single Vision 1.56 Anti-Reflective','lenses',    'pairs', 700.00, true,  true),
  ('PROG-150-CL', 'E-Series Progressive Clear 1.50', 'lenses',      'pairs', 700.00, true,  true),
  ('SV-160-AR',   'Single Vision 1.60 Anti-Reflective','lenses',    'pairs', 1250.00, true, true),
  ('FRM-ACE-01',  'Acetate Frame — Classic',         'frames',      'pcs',   850.00, false, true),
  ('FRM-TR90-02', 'TR90 Flexible Frame',             'frames',      'pcs',   650.00, false, true),
  ('CASE-CLAM',   'Clamshell Spectacle Case',        'accessories', 'pcs',    90.00, false, true),
  ('UNCOAT',      'UNCOAT',                          'services',    'pcs',     0.00, false, false),
  ('TINT-GG',     'GRADIAL GREY',                    'services',    'pcs',   500.00, false, false)
on conflict (sku) do nothing;

-- --------------------------------------------------------------- stock bins
-- Lens powers from -4.00 to +2.00 in quarter steps, with a plausible curve:
-- mid powers are the fast movers and are held deepest. A couple of powers are
-- left at or below their reorder level so the low-stock screen has something
-- real to show.
do $$
declare
  p record;
  s numeric;
  qty integer;
begin
  for p in select id from public.products where tracks_power and deleted_at is null
  loop
    s := -4.00;
    while s <= 2.00 loop
      qty := greatest(0, 30 - (abs(s) * 6)::int);
      -- leave a few genuinely short
      if s in (-3.75, -3.50, 1.75) then qty := 2; end if;

      insert into public.stock_bins (product_id, tracks_power, sph, qty_on_hand, reorder_level)
      values (p.id, true, s, qty, 5)
      on conflict on constraint stock_bins_product_sph_uq do nothing;

      s := s + 0.25;
    end loop;
  end loop;

  -- Non-power goods get their single NULL-sph bin.
  for p in select id from public.products
            where tracks_stock and not tracks_power and deleted_at is null
  loop
    insert into public.stock_bins (product_id, tracks_power, sph, qty_on_hand, reorder_level)
    values (p.id, false, null, 40, 10)
    on conflict on constraint stock_bins_product_sph_uq do nothing;
  end loop;
end $$;

-- Record the opening stock as movements so the history is not empty.
insert into public.stock_movements (bin_id, delta, reason, note)
select b.id, b.qty_on_hand, 'purchase', 'Opening stock'
  from public.stock_bins b
 where b.qty_on_hand > 0
   and not exists (select 1 from public.stock_movements m where m.bin_id = b.id);

-- ============================================================================
-- Verify
-- ============================================================================
select 'customers' as table, count(*) from public.customers where deleted_at is null
union all select 'products',   count(*) from public.products where deleted_at is null
union all select 'stock bins', count(*) from public.stock_bins
union all select 'movements',  count(*) from public.stock_movements;

-- ============================================================================
-- To remove the demo data later, run this instead. Order matters: lines and
-- ledger entries reference orders, and orders reference customers.
-- ============================================================================
-- delete from public.ledger_entries;
-- delete from public.order_lines;
-- delete from public.stock_movements;
-- delete from public.orders;
-- delete from public.stock_bins;
-- delete from public.products;
-- delete from public.customers;
-- update public.counters set next_value = 1 where name = 'invoice_no';
-- alter sequence public.order_no_seq restart with 1001;
