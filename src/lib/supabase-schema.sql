-- ============================================================
-- ChaletProp — Schéma de base de données Supabase
-- Exécutez ce fichier dans : Supabase Dashboard → SQL Editor
-- ============================================================

-- Activer l'extension UUID
create extension if not exists "uuid-ossp";

-- ─── PROFILES ────────────────────────────────────────────────
-- Complète la table auth.users de Supabase
create table public.profiles (
  id          uuid references auth.users(id) on delete cascade primary key,
  role        text not null check (role in ('proprio', 'pro')),
  first_name  text not null,
  last_name   text not null,
  phone       text,
  avatar_url  text,
  bio         text,
  -- Adresse (PRO principalement)
  address     text,
  city        text,
  province    text,
  postal_code text,
  lat         double precision,
  lng         double precision,
  -- Champs spécifiques PRO
  zone        text,
  radius_km   int default 25,
  experience  text,
  languages   text[],
  -- Vérification identité PRO
  id_verified      boolean default false,
  selfie_url       text,
  id_card_url      text,
  verif_status     text default 'pending' check (verif_status in ('pending','submitted','approved','rejected')),
  -- Stripe
  stripe_customer_id text,
  stripe_account_id  text,   -- pour les pros (Connect)
  -- Horodatage
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ─── CHALETS ─────────────────────────────────────────────────
create table public.chalets (
  id          uuid default uuid_generate_v4() primary key,
  owner_id    uuid references public.profiles(id) on delete cascade not null,
  name        text not null,
  address     text not null,
  city        text not null,
  province    text not null,
  postal_code text,
  lat         double precision,
  lng         double precision,
  bedrooms    int default 1,
  bathrooms   int default 1,
  -- Accès sécurisé (chiffré côté client idéalement)
  access_code     text,
  key_box         text,
  parking_info    text,
  wifi_name       text,
  wifi_password   text,
  special_notes   text,
  created_at  timestamptz default now()
);

-- ─── CHECKLIST TEMPLATES ─────────────────────────────────────
create table public.checklist_templates (
  id         uuid default uuid_generate_v4() primary key,
  chalet_id  uuid references public.chalets(id) on delete cascade not null,
  room_name  text not null,
  position   int not null default 0,
  created_at timestamptz default now()
);

-- ─── DEMANDES DE MÉNAGE ──────────────────────────────────────
create table public.cleaning_requests (
  id              uuid default uuid_generate_v4() primary key,
  chalet_id       uuid references public.chalets(id) on delete cascade not null,
  owner_id        uuid references public.profiles(id) not null,
  assigned_pro_id uuid references public.profiles(id),
  -- Planification
  scheduled_date  date not null,
  scheduled_time  time not null,
  deadline_time   time,
  estimated_hours numeric(4,1),
  -- Statut
  status  text not null default 'open'
    check (status in ('open','offers_received','confirmed','in_progress','completed','cancelled')),
  is_urgent boolean default false,
  special_notes       text,
  supplies_on_site    jsonb default '[]',
  laundry_tasks       jsonb default '[]',
  spa_tasks           jsonb default '[]',
  -- Paiement
  agreed_price        numeric(10,2),
  stripe_payment_intent_id text,
  payment_status      text default 'pending'
    check (payment_status in ('pending','held','released','refunded')),
  -- Accès envoyé au pro ?
  access_sent_at  timestamptz,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ─── OFFRES ──────────────────────────────────────────────────
create table public.offers (
  id          uuid default uuid_generate_v4() primary key,
  request_id  uuid references public.cleaning_requests(id) on delete cascade not null,
  pro_id      uuid references public.profiles(id) not null,
  price       numeric(10,2) not null,
  message     text,
  status      text default 'pending' check (status in ('pending','accepted','declined')),
  created_at  timestamptz default now(),
  unique(request_id, pro_id)
);

-- ─── CHECKLIST COMPLETIONS ───────────────────────────────────
create table public.checklist_completions (
  id           uuid default uuid_generate_v4() primary key,
  request_id   uuid references public.cleaning_requests(id) on delete cascade not null,
  template_id  uuid references public.checklist_templates(id) not null,
  is_done      boolean default false,
  photo_url    text,            -- URL Supabase Storage
  completed_at timestamptz,
  unique(request_id, template_id)
);

-- ─── ÉVALUATIONS ─────────────────────────────────────────────
create table public.reviews (
  id          uuid default uuid_generate_v4() primary key,
  request_id  uuid references public.cleaning_requests(id) not null,
  reviewer_id uuid references public.profiles(id) not null,
  reviewee_id uuid references public.profiles(id) not null,
  rating      int not null check (rating between 1 and 5),
  comment     text,
  created_at  timestamptz default now(),
  unique(request_id, reviewer_id)
);

-- ─── MESSAGES / CHAT ─────────────────────────────────────────
create table public.messages (
  id          uuid default uuid_generate_v4() primary key,
  request_id  uuid references public.cleaning_requests(id) on delete cascade not null,
  sender_id   uuid references public.profiles(id) not null,
  content     text not null,
  read_at     timestamptz,
  created_at  timestamptz default now()
);

-- ─── TRIGGERS : updated_at automatique ───────────────────────
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute procedure update_updated_at();

create trigger trg_requests_updated_at
  before update on public.cleaning_requests
  for each row execute procedure update_updated_at();

-- ─── TRIGGER : créer profil après inscription ─────────────────
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, role, first_name, last_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'role', 'proprio'),
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'last_name', '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ─── TRIGGER : libérer paiement quand checklist 100% ──────────
create or replace function maybe_release_payment()
returns trigger language plpgsql security definer as $$
declare
  total_tasks   int;
  done_tasks    int;
  req_id        uuid;
begin
  req_id := new.request_id;

  select count(*) into total_tasks
  from checklist_templates ct
  join cleaning_requests cr on cr.chalet_id = (
    select chalet_id from cleaning_requests where id = req_id
  )
  where cr.id = req_id;

  select count(*) into done_tasks
  from checklist_completions
  where request_id = req_id
    and is_done = true
    and photo_url is not null;

  if total_tasks > 0 and done_tasks >= total_tasks then
    update cleaning_requests
    set status = 'completed', updated_at = now()
    where id = req_id and status = 'in_progress';
    -- NOTE : appelez votre edge function Stripe depuis ici ou via webhook
    -- perform net.http_post('https://VOTRE_PROJET.supabase.co/functions/v1/release-payment', ...);
  end if;

  return new;
end;
$$;

create trigger trg_checklist_auto_payment
  after insert or update on public.checklist_completions
  for each row execute procedure maybe_release_payment();

-- ─── ROW LEVEL SECURITY (RLS) ────────────────────────────────
alter table public.profiles               enable row level security;
alter table public.chalets                enable row level security;
alter table public.checklist_templates    enable row level security;
alter table public.cleaning_requests      enable row level security;
alter table public.offers                 enable row level security;
alter table public.checklist_completions  enable row level security;
alter table public.reviews                enable row level security;
alter table public.messages               enable row level security;
alter table public.notifications          enable row level security;

-- Profils : visible par tous, modifiable seulement par soi-même
create policy "Profiles are public"   on public.profiles for select using (true);
create policy "Users update own profile" on public.profiles for update using (auth.uid() = id);

-- Chalets : le proprio voit et modifie les siens ; les pros voient tout
create policy "Owners manage own chalets" on public.chalets
  for all using (auth.uid() = owner_id);
create policy "Pros can view chalets" on public.chalets
  for select using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'pro')
  );

-- Checklist templates : le proprio du chalet gère, les pros voient
create policy "Owner manages checklist templates" on public.checklist_templates
  for all using (
    exists (
      select 1 from public.chalets c
      where c.id = chalet_id and c.owner_id = auth.uid()
    )
  );
create policy "Pros can view checklist templates" on public.checklist_templates
  for select using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'pro')
  );

-- Demandes : le proprio les gère, les pros les voient si 'open'
create policy "Owner manages requests" on public.cleaning_requests
  for all using (auth.uid() = owner_id);
create policy "Pro sees open requests" on public.cleaning_requests
  for select using (
    status = 'open'
    or assigned_pro_id = auth.uid()
  );

-- Offres
create policy "Pro manages own offers" on public.offers
  for all using (auth.uid() = pro_id);
create policy "Owner sees offers on own requests" on public.offers
  for select using (
    exists (
      select 1 from public.cleaning_requests cr
      where cr.id = request_id and cr.owner_id = auth.uid()
    )
  );

-- Checklist completions : le pro assigné peut tout faire (select, insert, update, delete)
create policy "Assigned pro manages checklist" on public.checklist_completions
  for all using (
    exists (
      select 1 from public.cleaning_requests cr
      where cr.id = request_id and cr.assigned_pro_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.cleaning_requests cr
      where cr.id = request_id and cr.assigned_pro_id = auth.uid()
    )
  );
create policy "Owner views checklist" on public.checklist_completions
  for select using (
    exists (
      select 1 from public.cleaning_requests cr
      join public.chalets c on c.id = cr.chalet_id
      where cr.id = request_id and c.owner_id = auth.uid()
    )
  );

-- Évaluations
create policy "Anyone can read reviews" on public.reviews for select using (true);
create policy "Users write own reviews" on public.reviews
  for insert with check (auth.uid() = reviewer_id);

-- Messages
create policy "Participants see messages" on public.messages
  for select using (
    auth.uid() = sender_id or
    exists (
      select 1 from public.cleaning_requests cr
      where cr.id = request_id
        and (cr.owner_id = auth.uid() or cr.assigned_pro_id = auth.uid())
    )
  );
create policy "Participants send messages" on public.messages
  for insert with check (auth.uid() = sender_id);
create policy "Participants update messages" on public.messages
  for update using (
    exists (
      select 1 from public.cleaning_requests cr
      where cr.id = request_id
        and (cr.owner_id = auth.uid() or cr.assigned_pro_id = auth.uid())
    )
  );

-- Notifications
create policy "Users see own notifications" on public.notifications
  for select using (auth.uid() = user_id);
create policy "Users update own notifications" on public.notifications
  for update using (auth.uid() = user_id);
create policy "Authenticated users create notifications" on public.notifications
  for insert with check (true);

-- ─── NOTIFICATIONS ──────────────────────────────────────────
create table public.notifications (
  id          uuid default uuid_generate_v4() primary key,
  user_id     uuid references public.profiles(id) on delete cascade not null,
  type        text not null check (type in ('new_offer','offer_accepted','offer_declined','new_message','new_request_nearby','cleaning_completed')),
  title       text not null,
  body        text,
  request_id  uuid references public.cleaning_requests(id) on delete cascade,
  sender_id   uuid references public.profiles(id),
  read_at     timestamptz,
  created_at  timestamptz default now()
);

-- ─── STORAGE BUCKETS ─────────────────────────────────────────
-- Créez ces buckets dans : Supabase Dashboard → Storage
-- 1. "cleaning-photos"  (public)   → photos des pièces après ménage
-- 2. "id-documents"     (private)  → selfies et pièces d'identité
-- 3. "avatars"          (public)   → photos de profil

-- ─── MIGRATION : Ajout adresse et coordonnées ──────────────────
-- Exécutez ces ALTER TABLE sur une base existante pour ajouter les nouvelles colonnes.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS address     text,
  ADD COLUMN IF NOT EXISTS city        text,
  ADD COLUMN IF NOT EXISTS province    text,
  ADD COLUMN IF NOT EXISTS postal_code text,
  ADD COLUMN IF NOT EXISTS lat         double precision,
  ADD COLUMN IF NOT EXISTS lng         double precision;

ALTER TABLE public.chalets
  ADD COLUMN IF NOT EXISTS postal_code text,
  ADD COLUMN IF NOT EXISTS lat         double precision,
  ADD COLUMN IF NOT EXISTS lng         double precision;

ALTER TABLE public.cleaning_requests
  ADD COLUMN IF NOT EXISTS special_notes    text,
  ADD COLUMN IF NOT EXISTS supplies_on_site jsonb default '[]',
  ADD COLUMN IF NOT EXISTS laundry_tasks    jsonb default '[]',
  ADD COLUMN IF NOT EXISTS spa_tasks        jsonb default '[]';

-- Migration: ajouter types de notification
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('new_offer','offer_accepted','offer_declined','new_message','new_request_nearby','cleaning_completed'));

-- Migration: policies RLS pour checklist_templates
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'checklist_templates' AND policyname = 'Owner manages checklist templates'
  ) THEN
    CREATE POLICY "Owner manages checklist templates" ON public.checklist_templates
      FOR ALL USING (
        EXISTS (SELECT 1 FROM public.chalets c WHERE c.id = chalet_id AND c.owner_id = auth.uid())
      );
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'checklist_templates' AND policyname = 'Pros can view checklist templates'
  ) THEN
    CREATE POLICY "Pros can view checklist templates" ON public.checklist_templates
      FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'pro')
      );
  END IF;
END $$;

-- ─── FIN DU SCHÉMA ───────────────────────────────────────────
