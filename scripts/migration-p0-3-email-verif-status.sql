-- ══════════════════════════════════════════════════════════════
-- MIGRATION P0-3 · Email automatique à l'approbation / au refus
-- ══════════════════════════════════════════════════════════════
-- Standalone (idempotent) : peut être ré-exécutée sans risque.
-- Copie miroir de la section correspondante de src/lib/supabase-schema.sql
-- pour permettre son application sur une base déjà en prod sans
-- rejouer tout le schéma.
--
-- ÉTAPE 1 — Configurer une seule fois par projet Supabase :
--   alter database postgres set app.settings.supabase_url     = 'https://<PROJECT_REF>.supabase.co';
--   alter database postgres set app.settings.service_role_key = '<SERVICE_ROLE_KEY>';
--   -- La session doit être rouverte pour que les nouveaux settings soient lus.
--
-- ÉTAPE 2 — Exécuter tout ce script dans Supabase → SQL Editor.
-- ══════════════════════════════════════════════════════════════

create extension if not exists pg_net;

alter table public.profiles
  add column if not exists verif_rejection_reason text;

create or replace function notify_verif_status_changed()
returns trigger
language plpgsql
security definer
as $$
declare
  supabase_url text;
  service_key  text;
  edge_url     text;
  notif_type   text;
  notif_title  text;
  notif_body   text;
  payload      jsonb;
begin
  if new.verif_status is not distinct from old.verif_status then
    return new;
  end if;

  if new.verif_status not in ('approved', 'rejected') then
    return new;
  end if;

  supabase_url := current_setting('app.settings.supabase_url', true);
  service_key  := current_setting('app.settings.service_role_key', true);

  if supabase_url is null or service_key is null then
    raise notice 'notify_verif_status_changed: app.settings.supabase_url / service_role_key non configuré';
    return new;
  end if;

  edge_url := supabase_url || '/functions/v1/send-notification-email';

  if new.verif_status = 'approved' then
    notif_type  := 'account_approved';
    notif_title := 'Bienvenue sur ChaletProp !';
    notif_body  := 'Votre compte a été approuvé. Vous pouvez maintenant utiliser ChaletProp.';
  else
    notif_type  := 'account_rejected';
    notif_title := 'Votre compte n''a pas été approuvé';
    notif_body  := coalesce(new.verif_rejection_reason, 'Votre demande de vérification n''a pas été acceptée.');
  end if;

  payload := jsonb_build_object(
    'userId', new.id::text,
    'type',   notif_type,
    'title',  notif_title,
    'body',   notif_body,
    'role',   new.role,
    'reason', new.verif_rejection_reason
  );

  perform net.http_post(
    url     := edge_url,
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body    := payload,
    timeout_milliseconds := 5000
  );

  return new;
end;
$$;

drop trigger if exists trg_notify_verif_status_changed on public.profiles;
create trigger trg_notify_verif_status_changed
  after update of verif_status on public.profiles
  for each row
  when (old.verif_status is distinct from new.verif_status)
  execute function notify_verif_status_changed();

-- ══════════════════════════════════════════════════════════════
-- PROCÉDURE DE TEST MANUEL
-- ══════════════════════════════════════════════════════════════
-- 1. Créer un compte de test via /inscription (rôle pro ou proprio),
--    puis vérifier dans profiles que verif_status = 'pending'.
--
-- 2. Se connecter avec le compte admin (ouellet.david@outlook.com),
--    aller sur /admin, cliquer sur « Approuver ».
--    → Le trigger appelle send-notification-email et l'utilisateur
--      doit recevoir un email « Bienvenue sur ChaletProp ! » en < 30s.
--
-- 3. Refuser un autre compte de test après avoir renseigné
--    profiles.verif_rejection_reason (P0-4).
--    → Email « Votre compte n'a pas été approuvé » + motif affiché.
--
-- 4. Cliquer à nouveau « Approuver » sur le même compte déjà approuvé.
--    → AUCUN email ne doit partir (idempotence assurée par la clause
--      WHEN et le is distinct from dans la fonction).
--
-- 5. Vérifier l'état des requêtes pg_net :
--      select * from net.http_response_collect() order by created desc limit 5;
--    Un status_code 200 confirme la livraison à l'edge function.
-- ══════════════════════════════════════════════════════════════
