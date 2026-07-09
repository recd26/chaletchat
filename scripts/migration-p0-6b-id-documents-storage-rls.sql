-- ══════════════════════════════════════════════════════════════
-- MIGRATION P0-6b · RLS storage.objects pour le bucket `id-documents`
-- ══════════════════════════════════════════════════════════════
-- Standalone (idempotent) : peut être ré-exécutée sans risque.
--
-- Contexte : depuis P0-2, les selfies et pièces d'identité sont
-- stockés sous `id-documents/{userId}/…` (bucket privé). Le tableau
-- de bord admin (`/admin`) doit pouvoir régénérer une URL signée
-- de 60 s pour visualiser ces documents (P0-6 côté API +
-- src/pages/AdminDashboard.jsx). Sans policy `SELECT` sur les
-- fichiers des autres utilisateurs, `createSignedUrl` retourne une
-- erreur et le composant `SignedDocImage` affiche « Erreur ».
--
-- Ce script pose les policies minimales :
--   1. Le propriétaire (`storage.foldername(name)[1] = auth.uid()`)
--      peut faire SELECT / INSERT / UPDATE / DELETE sur ses propres
--      fichiers `{uid}/…`.
--   2. L'admin (via la table `admins` seeded en P0-6) peut faire
--      SELECT sur tout le bucket pour signer les URLs de n'importe
--      quel utilisateur.
--
-- À exécuter dans Supabase → SQL Editor. Ne remplace pas les
-- policies existantes ajoutées via le dashboard : `drop policy if
-- exists` garantit l'idempotence même après une réexécution.
-- ══════════════════════════════════════════════════════════════

-- ─── Pré-requis : bucket existe (créé dans supabase-schema.sql) ──
insert into storage.buckets (id, name, public)
values ('id-documents', 'id-documents', false)
on conflict (id) do nothing;

-- ─── Nettoyage : anciennes policies éventuelles ─────────────────
drop policy if exists "id-docs owner read"    on storage.objects;
drop policy if exists "id-docs owner insert"  on storage.objects;
drop policy if exists "id-docs owner update"  on storage.objects;
drop policy if exists "id-docs owner delete"  on storage.objects;
drop policy if exists "id-docs admin read"    on storage.objects;

-- ─── Owner (propriétaire du dossier {uid}/…) ────────────────────
-- storage.foldername(name) renvoie les segments du path — segment
-- [1] est le userId (premier dossier). Cf. src/lib/idDocs.js.
create policy "id-docs owner read" on storage.objects
  for select using (
    bucket_id = 'id-documents'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "id-docs owner insert" on storage.objects
  for insert with check (
    bucket_id = 'id-documents'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "id-docs owner update" on storage.objects
  for update using (
    bucket_id = 'id-documents'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "id-docs owner delete" on storage.objects
  for delete using (
    bucket_id = 'id-documents'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- ─── Admin (whitelist P0-6 via public.admins) ───────────────────
-- Nécessaire pour que /admin puisse afficher les selfies / pièces
-- d'identité de n'importe quel utilisateur en attente d'approbation.
create policy "id-docs admin read" on storage.objects
  for select using (
    bucket_id = 'id-documents'
    and auth.email() in (select email from public.admins)
  );

-- ══════════════════════════════════════════════════════════════
-- TESTS DANS SQL EDITOR
-- ══════════════════════════════════════════════════════════════
-- 1. En tant qu'utilisateur non-admin, tentative de list sur le
--    dossier d'un autre user → 0 lignes (bloqué par RLS).
--
-- 2. En tant qu'admin :
--      select name from storage.objects
--      where bucket_id = 'id-documents' limit 5;
--    → doit renvoyer les objets uploadés.
--
-- 3. En tant qu'admin depuis le client :
--      supabase.storage
--        .from('id-documents')
--        .createSignedUrl('<uid>/selfie-<uuid>.jpg', 60)
--    → data.signedUrl doit être renvoyé sans erreur.
-- ══════════════════════════════════════════════════════════════
