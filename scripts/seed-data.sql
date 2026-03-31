-- ══════════════════════════════════════════════════════════════
-- DONNÉES DE TEST : 10 chalets + 10 demandes au Saguenay-Lac-Saint-Jean
-- ══════════════════════════════════════════════════════════════
-- ÉTAPE 1 : Remplacez OWNER_ID_HERE par votre UUID
--   SELECT id FROM auth.users WHERE email = 'ouellet.david@outlook.com';
-- ÉTAPE 2 : Collez tout dans Supabase SQL Editor et exécutez
-- ══════════════════════════════════════════════════════════════

DO $$
DECLARE
  owner_id uuid;
  chalet_id uuid;
BEGIN
  -- Récupérer l'ID du proprio
  SELECT id INTO owner_id FROM auth.users WHERE email = 'ouellet.david@outlook.com';
  IF owner_id IS NULL THEN
    RAISE EXCEPTION 'Utilisateur ouellet.david@outlook.com introuvable';
  END IF;

  -- ═══ 1. Chalet du Fjord ═══
  INSERT INTO chalets (id, owner_id, name, address, city, province, postal_code, lat, lng, bedrooms, bathrooms, access_code, wifi_name, wifi_password)
  VALUES (uuid_generate_v4(), owner_id, 'Chalet du Fjord', '125 Rue du Quai', 'La Baie', 'Québec', 'G7B 3P1', 48.3324, -70.8816, 3, 2, '4521', 'Fjord-WiFi', 'fjord2024')
  RETURNING id INTO chalet_id;

  INSERT INTO checklist_templates (chalet_id, room_name, position) VALUES
    (chalet_id, 'Cuisine', 0), (chalet_id, 'Salon', 1), (chalet_id, 'Salle de bain', 2),
    (chalet_id, 'Chambre principale', 3), (chalet_id, 'Chambre 2', 4);

  INSERT INTO cleaning_requests (chalet_id, owner_id, scheduled_date, scheduled_time, estimated_hours, suggested_budget, status, is_urgent, special_notes, supplies_on_site, laundry_tasks, spa_tasks)
  VALUES (chalet_id, owner_id, CURRENT_DATE + 1, '09:00', 3.0, 105, 'open', true,
    'Invités arrivent le lendemain, bien vérifier la literie',
    '[{"name":"Balai","available":true},{"name":"Aspirateur","available":true},{"name":"Produits salle de bain","available":false}]',
    '[{"name":"Draps lit queen"},{"name":"Serviettes"}]',
    '[{"name":"Nettoyage spa"},{"name":"Vérifier pH"}]');

  -- ═══ 2. Refuge du Lac Kénogami ═══
  INSERT INTO chalets (id, owner_id, name, address, city, province, postal_code, lat, lng, bedrooms, bathrooms, access_code, wifi_name, wifi_password)
  VALUES (uuid_generate_v4(), owner_id, 'Refuge du Lac Kénogami', '88 Chemin des Pins', 'Lac-Kénogami', 'Québec', 'G7X 7V1', 48.3842, -71.2567, 4, 2, '1234', 'Kenogami-Net', 'lac1234')
  RETURNING id INTO chalet_id;

  INSERT INTO checklist_templates (chalet_id, room_name, position) VALUES
    (chalet_id, 'Cuisine', 0), (chalet_id, 'Salon', 1), (chalet_id, 'Salle de bain', 2),
    (chalet_id, 'Chambre principale', 3), (chalet_id, 'Chambre 2', 4), (chalet_id, 'Chambre 3', 5);

  INSERT INTO cleaning_requests (chalet_id, owner_id, scheduled_date, scheduled_time, estimated_hours, suggested_budget, status, supplies_on_site, laundry_tasks, spa_tasks)
  VALUES (chalet_id, owner_id, CURRENT_DATE + 2, '10:00', 3.5, 120, 'open',
    '[{"name":"Aspirateur","available":true},{"name":"Serpillère","available":true}]',
    '[{"name":"Draps lit queen"},{"name":"Serviettes"}]',
    '[{"name":"Nettoyage spa"},{"name":"Vérifier pH"}]');

  -- ═══ 3. Chalet Boréal ═══
  INSERT INTO chalets (id, owner_id, name, address, city, province, postal_code, lat, lng, bedrooms, bathrooms, access_code, wifi_name, wifi_password)
  VALUES (uuid_generate_v4(), owner_id, 'Chalet Boréal', '342 Boulevard du Royaume', 'Jonquière', 'Québec', 'G7S 4J5', 48.4153, -71.2484, 2, 1, '7890', 'Boreal-WiFi', 'boreal7890')
  RETURNING id INTO chalet_id;

  INSERT INTO checklist_templates (chalet_id, room_name, position) VALUES
    (chalet_id, 'Cuisine', 0), (chalet_id, 'Salon', 1), (chalet_id, 'Salle de bain', 2), (chalet_id, 'Chambre principale', 3);

  INSERT INTO cleaning_requests (chalet_id, owner_id, scheduled_date, scheduled_time, estimated_hours, suggested_budget, status, supplies_on_site)
  VALUES (chalet_id, owner_id, CURRENT_DATE + 3, '11:00', 2.5, 80, 'open',
    '[{"name":"Balai","available":true},{"name":"Aspirateur","available":true},{"name":"Produits salle de bain","available":false}]');

  -- ═══ 4. Domaine des Monts-Valin ═══
  INSERT INTO chalets (id, owner_id, name, address, city, province, postal_code, lat, lng, bedrooms, bathrooms, access_code, wifi_name, wifi_password)
  VALUES (uuid_generate_v4(), owner_id, 'Domaine des Monts-Valin', '15 Chemin du Sommet', 'Saint-Fulgence', 'Québec', 'G0V 1S0', 48.4571, -70.6498, 5, 3, '5555', 'Valin-Peak', 'montvalin55')
  RETURNING id INTO chalet_id;

  INSERT INTO checklist_templates (chalet_id, room_name, position) VALUES
    (chalet_id, 'Cuisine', 0), (chalet_id, 'Salon', 1), (chalet_id, 'Salle de bain principale', 2),
    (chalet_id, 'Salle de bain 2', 3), (chalet_id, 'Chambre principale', 4),
    (chalet_id, 'Chambre 2', 5), (chalet_id, 'Chambre 3', 6);

  INSERT INTO cleaning_requests (chalet_id, owner_id, scheduled_date, scheduled_time, estimated_hours, suggested_budget, status, special_notes, supplies_on_site, laundry_tasks, spa_tasks)
  VALUES (chalet_id, owner_id, CURRENT_DATE + 4, '09:00', 4.0, 150, 'open',
    'Invités arrivent le lendemain, bien vérifier la literie',
    '[{"name":"Aspirateur","available":true},{"name":"Serpillère","available":true}]',
    '[{"name":"Draps lit queen"},{"name":"Draps lit simple"},{"name":"Serviettes"}]',
    '[{"name":"Nettoyage spa"},{"name":"Vérifier pH"},{"name":"Remplir chlore"}]');

  -- ═══ 5. La Cabane à sucre du Nord ═══
  INSERT INTO chalets (id, owner_id, name, address, city, province, postal_code, lat, lng, bedrooms, bathrooms, access_code, wifi_name, wifi_password)
  VALUES (uuid_generate_v4(), owner_id, 'La Cabane à sucre du Nord', '200 Rang Saint-Joseph', 'Hébertville', 'Québec', 'G8N 1M8', 48.3928, -71.6803, 3, 1, '3030', 'Cabane-Nord', 'sucre3030')
  RETURNING id INTO chalet_id;

  INSERT INTO checklist_templates (chalet_id, room_name, position) VALUES
    (chalet_id, 'Cuisine', 0), (chalet_id, 'Salon', 1), (chalet_id, 'Salle de bain', 2),
    (chalet_id, 'Chambre principale', 3), (chalet_id, 'Chambre 2', 4);

  INSERT INTO cleaning_requests (chalet_id, owner_id, scheduled_date, scheduled_time, estimated_hours, suggested_budget, status, supplies_on_site, laundry_tasks)
  VALUES (chalet_id, owner_id, CURRENT_DATE + 5, '10:00', 3.0, 95, 'open',
    '[{"name":"Balai","available":true},{"name":"Aspirateur","available":true},{"name":"Produits salle de bain","available":false}]',
    '[{"name":"Draps lit queen"},{"name":"Serviettes"}]');

  -- ═══ 6. Chalet Lac-Bouchette ═══
  INSERT INTO chalets (id, owner_id, name, address, city, province, postal_code, lat, lng, bedrooms, bathrooms, access_code, wifi_name, wifi_password)
  VALUES (uuid_generate_v4(), owner_id, 'Chalet Lac-Bouchette', '66 Rue Principale', 'Lac-Bouchette', 'Québec', 'G0W 1V0', 48.2302, -72.1810, 2, 1, '8080', 'LacB-WiFi', 'bouchette8080')
  RETURNING id INTO chalet_id;

  INSERT INTO checklist_templates (chalet_id, room_name, position) VALUES
    (chalet_id, 'Cuisine', 0), (chalet_id, 'Salon', 1), (chalet_id, 'Salle de bain', 2), (chalet_id, 'Chambre principale', 3);

  INSERT INTO cleaning_requests (chalet_id, owner_id, scheduled_date, scheduled_time, estimated_hours, suggested_budget, status, supplies_on_site)
  VALUES (chalet_id, owner_id, CURRENT_DATE + 8, '11:00', 2.5, 70, 'open',
    '[{"name":"Aspirateur","available":true},{"name":"Serpillère","available":true}]');

  -- ═══ 7. Auberge du Lac-Saint-Jean ═══
  INSERT INTO chalets (id, owner_id, name, address, city, province, postal_code, lat, lng, bedrooms, bathrooms, access_code, wifi_name, wifi_password)
  VALUES (uuid_generate_v4(), owner_id, 'Auberge du Lac-Saint-Jean', '410 Rue Scott', 'Roberval', 'Québec', 'G8H 1S8', 48.5190, -72.2282, 4, 2, '1111', 'Auberge-LSJ', 'roberval11')
  RETURNING id INTO chalet_id;

  INSERT INTO checklist_templates (chalet_id, room_name, position) VALUES
    (chalet_id, 'Cuisine', 0), (chalet_id, 'Salon', 1), (chalet_id, 'Salle de bain principale', 2),
    (chalet_id, 'Salle de bain 2', 3), (chalet_id, 'Chambre principale', 4), (chalet_id, 'Chambre 2', 5);

  INSERT INTO cleaning_requests (chalet_id, owner_id, scheduled_date, scheduled_time, estimated_hours, suggested_budget, status, special_notes, supplies_on_site, laundry_tasks, spa_tasks)
  VALUES (chalet_id, owner_id, CURRENT_DATE + 9, '09:00', 3.5, 120, 'open',
    'Invités arrivent le lendemain, bien vérifier la literie',
    '[{"name":"Balai","available":true},{"name":"Aspirateur","available":true},{"name":"Produits salle de bain","available":false}]',
    '[{"name":"Draps lit queen"},{"name":"Serviettes"}]',
    '[{"name":"Nettoyage spa"},{"name":"Vérifier pH"}]');

  -- ═══ 8. Chalet des Chutes ═══
  INSERT INTO chalets (id, owner_id, name, address, city, province, postal_code, lat, lng, bedrooms, bathrooms, access_code, wifi_name, wifi_password)
  VALUES (uuid_generate_v4(), owner_id, 'Chalet des Chutes', '55 Rue de Val-Jalbert', 'Chambord', 'Québec', 'G0W 1G0', 48.4469, -72.0676, 3, 2, '9999', 'Chutes-Net', 'jalbert99')
  RETURNING id INTO chalet_id;

  INSERT INTO checklist_templates (chalet_id, room_name, position) VALUES
    (chalet_id, 'Cuisine', 0), (chalet_id, 'Salon', 1), (chalet_id, 'Salle de bain', 2),
    (chalet_id, 'Chambre principale', 3), (chalet_id, 'Chambre 2', 4);

  INSERT INTO cleaning_requests (chalet_id, owner_id, scheduled_date, scheduled_time, estimated_hours, suggested_budget, status, supplies_on_site, laundry_tasks, spa_tasks)
  VALUES (chalet_id, owner_id, CURRENT_DATE + 10, '10:00', 3.0, 105, 'open',
    '[{"name":"Aspirateur","available":true},{"name":"Serpillère","available":true}]',
    '[{"name":"Draps lit queen"},{"name":"Serviettes"}]',
    '[{"name":"Nettoyage spa"},{"name":"Vérifier pH"}]');

  -- ═══ 9. Villégiature Alma ═══
  INSERT INTO chalets (id, owner_id, name, address, city, province, postal_code, lat, lng, bedrooms, bathrooms, access_code, wifi_name, wifi_password)
  VALUES (uuid_generate_v4(), owner_id, 'Villégiature Alma', '790 Rue Sacré-Coeur Ouest', 'Alma', 'Québec', 'G8B 1M4', 48.5508, -71.6497, 3, 2, '2468', 'Alma-Villa', 'alma2468')
  RETURNING id INTO chalet_id;

  INSERT INTO checklist_templates (chalet_id, room_name, position) VALUES
    (chalet_id, 'Cuisine', 0), (chalet_id, 'Salon', 1), (chalet_id, 'Salle de bain', 2),
    (chalet_id, 'Chambre principale', 3), (chalet_id, 'Chambre 2', 4);

  INSERT INTO cleaning_requests (chalet_id, owner_id, scheduled_date, scheduled_time, estimated_hours, suggested_budget, status, supplies_on_site, laundry_tasks, spa_tasks)
  VALUES (chalet_id, owner_id, CURRENT_DATE + 11, '12:00', 3.0, 105, 'open',
    '[{"name":"Balai","available":true},{"name":"Aspirateur","available":true},{"name":"Produits salle de bain","available":false}]',
    '[{"name":"Draps lit queen"},{"name":"Serviettes"}]',
    '[{"name":"Nettoyage spa"},{"name":"Vérifier pH"}]');

  -- ═══ 10. Chalet Petit-Saguenay ═══
  INSERT INTO chalets (id, owner_id, name, address, city, province, postal_code, lat, lng, bedrooms, bathrooms, access_code, wifi_name, wifi_password)
  VALUES (uuid_generate_v4(), owner_id, 'Chalet Petit-Saguenay', '22 Rue Dumas', 'Petit-Saguenay', 'Québec', 'G0V 1N0', 48.2340, -70.0850, 2, 1, '6767', 'PtSag-WiFi', 'saguenay67')
  RETURNING id INTO chalet_id;

  INSERT INTO checklist_templates (chalet_id, room_name, position) VALUES
    (chalet_id, 'Cuisine', 0), (chalet_id, 'Salon', 1), (chalet_id, 'Salle de bain', 2), (chalet_id, 'Chambre principale', 3);

  INSERT INTO cleaning_requests (chalet_id, owner_id, scheduled_date, scheduled_time, estimated_hours, suggested_budget, status, supplies_on_site)
  VALUES (chalet_id, owner_id, CURRENT_DATE + 12, '09:00', 2.5, 70, 'open',
    '[{"name":"Aspirateur","available":true},{"name":"Serpillère","available":true}]');

  RAISE NOTICE '✅ 10 chalets + 10 demandes créés avec succès !';
END $$;
