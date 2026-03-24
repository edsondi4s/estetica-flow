-- Marketing: Promotions and Dispatch Log Tables

create table if not exists public.promotions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message_template text not null,
  service_ids uuid[] not null default '{}',
  combo_name text,
  discount_type text check (discount_type in ('percent', 'fixed', null)),
  discount_value numeric(10, 2),
  valid_until date,
  target_type text not null default 'all' check (target_type in ('all', 'selected')),
  target_client_ids uuid[] not null default '{}',
  status text not null default 'draft' check (status in ('draft', 'sent', 'expired', 'scheduled')),
  scheduled_at timestamptz,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create table if not exists public.promotion_dispatches (
  id uuid primary key default gen_random_uuid(),
  promotion_id uuid not null references public.promotions(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  client_name text,
  client_phone text not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  sent_at timestamptz,
  error_message text,
  created_at timestamptz not null default now()
);

-- Indexes for performance
create index if not exists idx_promotion_dispatches_promotion_id on public.promotion_dispatches(promotion_id);
create index if not exists idx_promotion_dispatches_status on public.promotion_dispatches(status);
create index if not exists idx_promotions_status on public.promotions(status);

-- Enable RLS
alter table public.promotions enable row level security;
alter table public.promotion_dispatches enable row level security;

-- RLS Policies (authenticated users can manage everything, same pattern as rest of project)
create policy "Authenticated users can manage promotions"
  on public.promotions for all
  to authenticated
  using (true)
  with check (true);

create policy "Authenticated users can manage dispatches"
  on public.promotion_dispatches for all
  to authenticated
  using (true)
  with check (true);
