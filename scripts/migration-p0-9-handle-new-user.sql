-- ══════════════════════════════════════════════════════════════
-- MIGRATION P0-9 · Trigger on auth.users → profiles
-- ══════════════════════════════════════════════════════════════
-- Standalone (idempotent) : peut être ré-exécutée sans risque.
-- Copie miroir de la section correspondante de src/lib/supabase-schema.sql
-- pour permettre son application sur une base déjà en prod sans
-- rejouer tout le schéma.
--
-- Objectif : éviter les "profils fantômes" quand `auth.signUp` réussit
-- mais que la row `public.profiles` n'a jamais été créée (ex: `update`
-- silencieux, réseau coupé, RLS qui bloque). Le trigger AFTER INSERT
-- sur `auth.users` garantit qu'une row profile existe TOUJOURS pour
-- chaque compte auth (signup email + OAuth P0-8 compris).
--
-- Le trigger utilise :
--   • `security definer` + `set search_path = public` : contourne RLS
--     sans exposer le search_path à une injection.
--   • `on conflict (id) do nothing` : idempotent — si le client fait
--     un upsert concurrent, on ne double-insère pas.
--
-- Côté client, `useAuth.signUp` a été migré `update` → `upsert` pour
-- que la row créée par le trigger soit ensuite enrichie des champs
-- supplémentaires (adresse pro, bio, etc.).
--
-- À exécuter dans Supabase → SQL Editor.
-- ══════════════════════════════════════════════════════════════

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, first_name, last_name, phone)
  values (
    new.id,
    new.raw_user_meta_data->>'role',
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'last_name', ''),
    new.raw_user_meta_data->>'phone'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ══════════════════════════════════════════════════════════════
-- TESTS DANS SQL EDITOR
-- ══════════════════════════════════════════════════════════════
-- 1. Nouveau signUp email (avec role en metadata) :
--      Après auth.signUp, `select * from public.profiles where id = <new_uid>`
--      doit retourner exactement 1 row avec role/first_name/last_name/phone.
--
-- 2. Nouveau signUp OAuth (P0-8) sans role encore choisi :
--      L'insert échoue car `profiles.role` est NOT NULL + CHECK. C'est le
--      signal attendu : le flow P0-8 doit inclure le role dans
--      `raw_user_meta_data` AVANT `signInWithOAuth` (ou pousser un rôle
--      par défaut dans le hook post-auth). Aucun profil fantôme n'apparaît.
--
-- 3. Client-side upsert après signUp :
--      `upsert(..., { onConflict: 'id' })` sur profiles ne doit pas
--      échouer, la row existe déjà (créée par le trigger), l'upsert
--      la met à jour avec les champs supplémentaires.
-- ══════════════════════════════════════════════════════════════
