-- ══════════════════════════════════════════════════════════════
-- MIGRATION : Fix des foreign keys pour permettre la suppression de profils
-- ══════════════════════════════════════════════════════════════
-- Problème résolu :
--   Quand on essaie de supprimer un profil (dans Supabase ou depuis l'app),
--   Postgres refuse si le profil est référencé par cleaning_requests,
--   offers, reviews, messages, etc.
--
-- Solution :
--   - assigned_pro_id → ON DELETE SET NULL (garder la demande, retirer le pro)
--   - owner_id → ON DELETE CASCADE (une demande sans proprio n'a plus de sens)
--   - pro_id dans offers → ON DELETE CASCADE (offre d'un pro qui n'existe plus)
--   - reviewer_id/reviewee_id → ON DELETE CASCADE
--   - sender_id dans messages → ON DELETE CASCADE
-- ══════════════════════════════════════════════════════════════

-- ─── cleaning_requests.assigned_pro_id → ON DELETE SET NULL ──
ALTER TABLE public.cleaning_requests
  DROP CONSTRAINT IF EXISTS cleaning_requests_assigned_pro_id_fkey;

ALTER TABLE public.cleaning_requests
  ADD CONSTRAINT cleaning_requests_assigned_pro_id_fkey
  FOREIGN KEY (assigned_pro_id)
  REFERENCES public.profiles(id)
  ON DELETE SET NULL;

-- ─── cleaning_requests.owner_id → ON DELETE CASCADE ──
ALTER TABLE public.cleaning_requests
  DROP CONSTRAINT IF EXISTS cleaning_requests_owner_id_fkey;

ALTER TABLE public.cleaning_requests
  ADD CONSTRAINT cleaning_requests_owner_id_fkey
  FOREIGN KEY (owner_id)
  REFERENCES public.profiles(id)
  ON DELETE CASCADE;

-- ─── offers.pro_id → ON DELETE CASCADE ──
ALTER TABLE public.offers
  DROP CONSTRAINT IF EXISTS offers_pro_id_fkey;

ALTER TABLE public.offers
  ADD CONSTRAINT offers_pro_id_fkey
  FOREIGN KEY (pro_id)
  REFERENCES public.profiles(id)
  ON DELETE CASCADE;

-- ─── reviews.reviewer_id → ON DELETE CASCADE ──
ALTER TABLE public.reviews
  DROP CONSTRAINT IF EXISTS reviews_reviewer_id_fkey;

ALTER TABLE public.reviews
  ADD CONSTRAINT reviews_reviewer_id_fkey
  FOREIGN KEY (reviewer_id)
  REFERENCES public.profiles(id)
  ON DELETE CASCADE;

-- ─── reviews.reviewee_id → ON DELETE CASCADE ──
ALTER TABLE public.reviews
  DROP CONSTRAINT IF EXISTS reviews_reviewee_id_fkey;

ALTER TABLE public.reviews
  ADD CONSTRAINT reviews_reviewee_id_fkey
  FOREIGN KEY (reviewee_id)
  REFERENCES public.profiles(id)
  ON DELETE CASCADE;

-- ─── messages.sender_id → ON DELETE CASCADE ──
ALTER TABLE public.messages
  DROP CONSTRAINT IF EXISTS messages_sender_id_fkey;

ALTER TABLE public.messages
  ADD CONSTRAINT messages_sender_id_fkey
  FOREIGN KEY (sender_id)
  REFERENCES public.profiles(id)
  ON DELETE CASCADE;

-- ─── notifications.user_id est déjà ON DELETE CASCADE dans le schema ──
-- ─── notifications.sender_id doit devenir ON DELETE SET NULL ──
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_sender_id_fkey;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_sender_id_fkey
  FOREIGN KEY (sender_id)
  REFERENCES public.profiles(id)
  ON DELETE SET NULL;

-- ══════════════════════════════════════════════════════════════
-- Après cette migration :
--   - Supprimer un profil → dé-assigne ses missions en cours (SET NULL)
--   - Supprimer un profil → supprime ses demandes, offres, reviews, messages
--   - Supprimer un profil → garde ses notifications envoyées mais anonymise sender
-- ══════════════════════════════════════════════════════════════
