-- ══════════════════════════════════════════════════════════════
-- MIGRATION P0-6 · Fiabiliser admin_update_verif_status
-- ══════════════════════════════════════════════════════════════
-- Standalone (idempotent) : peut être ré-exécutée sans risque.
-- Copie miroir de la section correspondante de src/lib/supabase-schema.sql
-- pour permettre son application sur une base déjà en prod sans
-- rejouer tout le schéma.
--
-- Objectifs :
--   1. Créer la table `admins` (whitelist par email) — source de vérité
--      unique pour les droits admin, remplace la constante hardcodée.
--   2. Réécrire `admin_update_verif_status` avec le check
--      `auth.email() in (select email from admins)` et ajouter le param
--      `reason` (utilisé pour P0-4 : motif de refus).
--   3. Aligner la policy RLS "Admin can update all profiles" sur la
--      même whitelist pour rester cohérent.
--
-- À exécuter dans Supabase → SQL Editor.
-- ══════════════════════════════════════════════════════════════

-- ─── TABLE admins ────────────────────────────────────────────
-- Source de vérité unique pour les droits admin. Ajouter/retirer un
-- admin = insert/delete dans cette table (aucun déploiement requis).
create table if not exists public.admins (
  email       text primary key,
  created_at  timestamptz not null default now()
);

-- RLS activée + aucune policy publique : seule la service_role
-- (bypass RLS) peut lire/écrire depuis le dashboard Supabase.
alter table public.admins enable row level security;

-- Seed l'admin initial (idempotent grâce à `on conflict do nothing`)
insert into public.admins (email) values ('ouellet.david@outlook.com')
  on conflict (email) do nothing;

-- ─── FONCTION admin_update_verif_status ──────────────────────
-- Nouvelle signature avec `reason` (P0-4). Drop de toutes les
-- signatures antérieures pour éviter la coexistence de plusieurs
-- overloads (create or replace ne remplace pas si la signature
-- change).
drop function if exists public.admin_update_verif_status(uuid, text);
drop function if exists public.admin_update_verif_status(uuid, text, text);

create or replace function public.admin_update_verif_status(
  target_user_id uuid,
  new_status     text,
  reason         text default null
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  caller_email text;
  rows_updated int;
begin
  -- 1. Récupérer l'email de l'appelant depuis le JWT
  caller_email := auth.email();

  -- 2. Vérifier que l'appelant est admin (via la table admins)
  if caller_email is null
     or not exists (select 1 from public.admins where email = caller_email) then
    raise exception 'permission_denied: caller is not an admin'
      using errcode = '42501';
  end if;

  -- 3. Valider le statut
  if new_status not in ('pending', 'submitted', 'approved', 'rejected') then
    raise exception 'invalid_status: %', new_status
      using errcode = '22023';
  end if;

  -- 4. Mise à jour atomique :
  --    - verif_status = new_status
  --    - verif_rejection_reason = reason si rejected, sinon effacé pour
  --      éviter qu'un vieux motif traîne quand on approuve/repending.
  update public.profiles
  set
    verif_status           = new_status,
    verif_rejection_reason = case when new_status = 'rejected' then reason else null end,
    updated_at             = now()
  where id = target_user_id;

  get diagnostics rows_updated = row_count;
  if rows_updated = 0 then
    raise exception 'profile_not_found: %', target_user_id
      using errcode = 'P0002';
  end if;
end;
$$;

-- Autoriser l'appel depuis les clients authentifiés (le check admin
-- est fait à l'intérieur). Anon = pas d'accès.
revoke all on function public.admin_update_verif_status(uuid, text, text) from public;
grant execute on function public.admin_update_verif_status(uuid, text, text) to authenticated;

-- ─── POLICY RLS "Admin can update all profiles" ──────────────
-- Aligner sur la table admins. Recréation idempotente.
drop policy if exists "Admin can update all profiles" on public.profiles;
create policy "Admin can update all profiles" on public.profiles
  for update using (
    auth.email() in (select email from public.admins)
  );

-- ══════════════════════════════════════════════════════════════
-- TESTS DANS SQL EDITOR
-- ══════════════════════════════════════════════════════════════
-- 1. Appel en tant qu'admin (JWT admin dans la session éditeur) :
--      select public.admin_update_verif_status(
--        '<profile_uuid>'::uuid, 'approved', null
--      );
--    → succès, verif_status = 'approved', reason = null.
--
-- 2. Appel avec reason lors d'un refus :
--      select public.admin_update_verif_status(
--        '<profile_uuid>'::uuid, 'rejected', 'Photo illisible'
--      );
--    → verif_status = 'rejected', verif_rejection_reason = 'Photo illisible'.
--
-- 3. Cible inexistante :
--      select public.admin_update_verif_status(
--        gen_random_uuid(), 'approved'
--      );
--    → exception profile_not_found.
--
-- 4. Statut invalide :
--      select public.admin_update_verif_status(
--        '<profile_uuid>'::uuid, 'not_a_status'
--      );
--    → exception invalid_status.
--
-- 5. Appel non-admin (JWT d'un utilisateur normal) :
--      select public.admin_update_verif_status(
--        '<profile_uuid>'::uuid, 'approved'
--      );
--    → exception permission_denied.
-- ══════════════════════════════════════════════════════════════
