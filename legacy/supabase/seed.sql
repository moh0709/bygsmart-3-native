-- ByggeSmart Demo Database Seed
-- This file populates the demo account with comprehensive construction project data

-- ============================================================================
-- PROFILES (Users) - Note: Users are created via auth, this creates demo users
-- ============================================================================

-- Demo Owner (Client)
INSERT INTO profiles (id, username, name, initials, email, subscription_tier) VALUES
('user_demo_owner', 'demo_owner', 'Morten Hansen', 'MH', 'morten.hansen@email.dk', 'PREMIUM')
ON CONFLICT (id) DO NOTHING;

-- Demo Manager
INSERT INTO profiles (id, username, name, initials, email, subscription_tier) VALUES
('user_demo_manager', 'demo_manager', 'Anders Andersen', 'AA', 'anders@bygger.dk', 'PRO')
ON CONFLICT (id) DO NOTHING;

-- Demo Employees
INSERT INTO profiles (id, username, name, initials, email, subscription_tier) VALUES
('user_demo_employee1', 'demo_employee1', 'Bente Bertelsen', 'BB', 'bente@bygger.dk', 'FREE'),
('user_demo_employee2', 'demo_employee2', 'Carl Christiansen', 'CC', 'carl@bygger.dk', 'FREE')
ON CONFLICT (id) DO NOTHING;

-- External Contractor
INSERT INTO profiles (id, username, name, initials, email, subscription_tier) VALUES
('user_demo_external', 'demo_external', 'El-Tech Elservice ApS', 'EE', 'contact@el-tech.dk', 'ENTERPRISE')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- PROJECT
-- ============================================================================

INSERT INTO projects (
  id, owner_id, project_number, name, client_name, status, progress, 
  start_date, end_date, address, description, regulation_count, checklist_count, 
  is_favorite, milestone, team, budget
) VALUES (
  'proj_demo_villa',
  'user_demo_owner',
  '26-001',
  'Villa Renovering - Kildeskovgård 12',
  'Morten og Ida Hansen',
  'I gang',
  45,
  '2026-01-15',
  '2026-05-15',
  'Kildeskovgård 12, 2800 Kongens Lyngby',
  'Omfattende renovering af 150m² villa bygget i 1970. Omfatter ny indvendig opsætning, badeværelser, køkken og facadeopdatering. Projektet kører over 4 måneder med fokus på energioptimering og moderne indretning.',
  8,
  24,
  true,
  '{"title": "Montering af køkken", "dueDateRelative": "2026-04-15"}'::json,
  '[
    {"id": "user_demo_manager", "name": "Anders Andersen", "initials": "AA", "role": "MANAGER", "status": "ACTIVE", "joinedAt": "2026-01-15"},
    {"id": "user_demo_employee1", "name": "Bente Bertelsen", "initials": "BB", "role": "EMPLOYEE", "status": "ACTIVE", "joinedAt": "2026-01-15"},
    {"id": "user_demo_employee2", "name": "Carl Christiansen", "initials": "CC", "role": "EMPLOYEE", "status": "ACTIVE", "joinedAt": "2026-01-15"},
    {"id": "user_demo_external", "name": "El-Tech Elservice ApS", "initials": "EE", "role": "EXTERNAL", "status": "ACTIVE", "joinedAt": "2026-01-20"}
  ]'::json,
  '{"total": 850000, "used": 625000}'::json
) ON CONFLICT (id) DO UPDATE SET updated_at = NOW();

-- ============================================================================
-- TASKS (18 comprehensive tasks across 4 phases)
-- ============================================================================

INSERT INTO tasks (
  id, project_id, title, status, due_date, description, 
  is_milestone, estimated_hours, step, suggested_regulations, checklist, assignees
) VALUES
  -- Phase 1: Opstart & Nedrivning
  ('task_p1_01', 'proj_demo_villa', '1.1.1 Genoptagelse og projektstart', 'Udført', '2026-01-15', 
   'Projektgennemgang med klient, levering af nøgler og sikkerhedstjek af byggeplads', false, 4, '1.1.1',
   '[{"id": "br18-kap2", "title": "BR18 Kap. 2: Byggetilladelse"}]'::json,
   '[]'::json,
   '[{"id": "user_demo_manager", "initials": "AA", "name": "Anders Andersen"}]'::json),

  ('task_p1_02', 'proj_demo_villa', '1.1.2 Nedrivning af gammelt køkken og bad', 'Udført', '2026-01-25', 
   'Fjernelse af flisearbejde, gammelt køkkenhus, WC og vaskemaskine. Miljøansvarlig bortflytning.', false, 24, '1.1.2',
   '[]'::json,
   '[{"id": "c1", "text": "Afmontér gammelt køkken", "ruleRef": "BR18 §388", "ruleId": "br18-kap20", "checked": true},
    {"id": "c2", "text": "Bortflytning gennem autoriseret miljøfirma", "ruleRef": "Miljøstyrelsen", "ruleId": "br18-kap2", "checked": true}]'::json,
   '[{"id": "user_demo_employee1", "initials": "BB", "name": "Bente Bertelsen"}]'::json),

  ('task_p1_03', 'proj_demo_villa', '1.2.1 Installation af midterdæk', 'Udført', '2026-02-01', 
   'Etablering af midterdæk for adskillelse af stue og entré', false, 16, '1.2.1',
   '[{"id": "br18-kap11", "title": "BR18 Kap. 11: Energi"}]'::json,
   '[]'::json,
   '[{"id": "user_demo_employee2", "initials": "CC", "name": "Carl Christiansen"}]'::json),

  ('task_p1_04', 'proj_demo_villa', '1.2.2 Ny vandledning fra køkken til bad', 'Igangværende', '2026-02-12', 
   'Installation af ny rørledning i gulvhus for koldt og varmt vand plus afløb', false, 12, '1.2.2',
   '[{"id": "br18-kap20", "title": "BR18 Kap. 20: Vand"}]'::json,
   '[]'::json,
   '[{"id": "user_demo_external", "initials": "EE", "name": "El-Tech Elservice ApS"}]'::json),

  -- Phase 2: Råhus & Installationer
  ('task_p2_01', 'proj_demo_villa', '2.1.1 Gipsvæg mellem stue og entré', 'Igangværende', '2026-02-20', 
   'Opbygning af 13mm gipsvæg med stålstole, inkl. indblanding af skjult døråbning', false, 20, '2.1.1',
   '[{"id": "br18-kap17", "title": "BR18 Kap. 17: Lyd"}, {"id": "br18-kap5", "title": "BR18 Kap. 5: Brand"}]'::json,
   '[{"id": "c3", "text": "Montering af stålstoler c/c 600mm", "ruleRef": "", "ruleId": "", "checked": true},
    {"id": "c4", "text": "Brandklasse REI 60 dokumentation", "ruleRef": "", "ruleId": "", "checked": false}]'::json,
   '[{"id": "user_demo_employee1", "initials": "BB", "name": "Bente Bertelsen"}]'::json),

  ('task_p2_02', 'proj_demo_villa', '2.1.2 Ny el før køkkenområde', 'To Do', '2026-02-25', 
   'Installation af ny opvurs 3x1,5mm kabel + 3x2,5mm til køkken, inkl. LED spots', false, 8, '2.1.2',
   '[{"id": "br18-kap19", "title": "BR18 Kap. 19: Elektrisk anlæg"}]'::json,
   '[]'::json,
   '[{"id": "user_demo_external", "initials": "EE", "name": "El-Tech Elservice ApS"}]'::json),

  ('task_p2_03', 'proj_demo_villa', '2.2.1 Vådrumsmembran i nyserveret bad', 'To Do', '2026-03-05', 
   'Anbringelse af kjærligergummi membran på alle væge og gulv', false, 16, '2.2.1',
   '[{"id": "br18-kap13", "title": "BR18 Kap. 13: Vådrum"}]'::json,
   '[]'::json,
   '[{"id": "user_demo_employee2", "initials": "CC", "name": "Carl Christiansen"}]'::json),

  ('task_p2_04', 'proj_demo_villa', '2.2.2 Flisearbejde i badeværelser', 'To Do', '2026-03-15', 
   'Flisering af gulv og vægge (30x30cm) med epoxyfug', false, 32, '2.2.2',
   '[]'::json,
   '[]'::json,
   '[{"id": "user_demo_employee1", "initials": "BB", "name": "Bente Bertelsen"}]'::json),

  ('task_p2_05', 'proj_demo_villa', '2.3.1 VVS installation bad', 'To Do', '2026-03-20', 
   'Montering af væghængt toilet, vask og integreret brusebakke', false, 12, '2.3.1',
   '[{"id": "br18-kap20", "title": "BR18 Kap. 20: Vand"}]'::json,
   '[]'::json,
   '[{"id": "user_demo_external", "initials": "EE", "name": "El-Tech Elservice ApS"}]'::json),

  -- Phase 3: Lukning & Overflader
  ('task_p3_01', 'proj_demo_villa', '3.1.1 Malerarbejde stue & entré', 'Forfalden', '2026-03-25', 
   'Pudsning af vægge, spartling af kigne og maling af lofter', false, 24, '3.1.1',
   '[]'::json,
   '[]'::json,
   '[{"id": "user_demo_employee2", "initials": "CC", "name": "Carl Christiansen"}]'::json),

  ('task_p3_02', 'proj_demo_villa', '3.1.2 Indpassning af vinduer fra facade', 'To Do', '2026-04-05', 
   'Montering af 3 nye træ/alu vinduer i stue', false, 16, '3.1.2',
   '[{"id": "br18-kap11-door", "title": "BR18 Kap. 11: Energi"}]'::json,
   '[]'::json,
   '[{"id": "user_demo_employee1", "initials": "BB", "name": "Bente Bertelsen"}]'::json),

  ('task_p3_03', 'proj_demo_villa', '3.2.1 Køkkeninstallation', 'To Do', '2026-04-15', 
   'Montering af indkøbskøkken inklusive hvidevarer', false, 12, '3.2.1',
   '[]'::json,
   '[]'::json,
   '[{"id": "user_demo_employee2", "initials": "CC", "name": "Carl Christiansen"}]'::json),

  ('task_p3_04', 'proj_demo_villa', '3.2.2 Terrassedør og loftsvindue', 'To Do', '2026-04-20', 
   'Montering af 90cm bred terrassedør med glasindblanding', false, 10, '3.2.2',
   '[]'::json,
   '[]'::json,
   '[{"id": "user_demo_employee1", "initials": "BB", "name": "Bente Bertelsen"}]'::json),

  -- Phase 4: Aflevering
  ('task_p4_01', 'proj_demo_villa', '4.1.1 Indvendig malerarbejde', 'To Do', '2026-04-30', 
   'Slutmaling af alle indvendige overflader', false, 20, '4.1.1',
   '[]'::json,
   '[]'::json,
   '[{"id": "user_demo_employee2", "initials": "CC", "name": "Carl Christiansen"}]'::json),

  ('task_p4_02', 'proj_demo_villa', '4.2.1 Facadeopdatering', 'To Do', '2026-05-10', 
   'Pudsning af facade og nye vindueskarm i træ/alu', false, 24, '4.2.1',
   '[{"id": "br18-kap5-escape", "title": "BR18 Kap. 5: Flugtveje"}]'::json,
   '[]'::json,
   '[{"id": "user_demo_employee1", "initials": "BB", "name": "Bente Bertelsen"}]'::json),

  ('task_p4_03', 'proj_demo_villa', '4.3.1 Projektafløsnings kontrol', 'To Do', '2026-05-15', 
   'Endelig kontrol med klient, aflevering af dokumentation', true, 6, '4.3.1',
   '[{"id": "br18-kap2", "title": "BR18 Kap. 2: Byggetilladelse"}]'::json,
   '[]'::json,
   '[{"id": "user_demo_manager", "initials": "AA", "name": "Anders Andersen"}]'::json)
ON CONFLICT (id) DO UPDATE SET updated_at = NOW();

-- ============================================================================
-- PURCHASES (8 items at different stages)
-- ============================================================================

INSERT INTO purchases (
  id, project_id, name, details, quantity, price, status, supplier, item_number
) VALUES
  ('purch_01', 'proj_demo_villa', 'Gipsplade 13mm', 'Lagsorteret, 1200x2500mm', 120, 89, 'Modtaget', 'Silvan', '321001'),
  ('purch_02', 'proj_demo_villa', 'Træbjælke 45×95', 'Fyrretværsgruppe C24, 4,8m', 48, 38, 'Modtaget', 'Bauhaus', '663840'),
  ('purch_03', 'proj_demo_villa', 'Vådrumsmembran 20m²', 'Kjærligergummi type, 2 lags', 3, 895, 'Bestilt', 'Stark', 'VR-20M2'),
  ('purch_04', 'proj_demo_villa', 'Fliser 30x30cm hvid', 'Keramisk glat flise, 1,5m²/pk', 12, 189, 'Afventer', 'XL-Byg', 'FL-30X30-HV'),
  ('purch_05', 'proj_demo_villa', 'LED spots 12V 3W', 'Kantrærs spots, inkl. fjernstyring', 16, 129, 'Afventer', 'El-Tech', NULL),
  ('purch_06', 'proj_demo_villa', 'Tagpap Base', '30m² rulle, undertag', 1, 499, 'Modtaget', 'Stark', '448899'),
  ('purch_07', 'proj_demo_villa', 'Spartelmasse 10L', 'Fugtig spartel til fliser', 6, 249, 'Bestilt', 'Silvan', '990345'),
  ('purch_08', 'proj_demo_villa', 'Træskrue 5×60 mm', 'Skruer til gipsvæg', 10, 149, 'Modtaget', 'Silvan', '874200')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- DOCUMENTS (6 documents including drawings)
-- ============================================================================

INSERT INTO documents (
  id, project_id, name, storage_path, size_bytes, mime_type, category, 
  is_drawing, discipline, drawing_no, revision, created_by
) VALUES
  ('doc_01', 'proj_demo_villa', 'Tegning_01_Planskift.png', '/demo/tegning_01.png', 2450000, 'image/png', 'PLANNING_EXECUTION', 
   true, 'ARCHITECTURE', 'A-101', 'Rev. 2', 'user_demo_manager'),
  ('doc_02', 'proj_demo_villa', 'Tegning_02_Elplan.png', '/demo/tegning_02.png', 1850000, 'image/png', 'TECHNICAL_DRAWINGS',
   true, 'ELECTRICAL', 'E-102', 'Rev. 1', 'user_demo_external'),
  ('doc_03', 'proj_demo_villa', 'BR18_Kapitel_11_Energi.pdf', '/demo/br18_energi.pdf', 560000, 'application/pdf', 'GENERAL',
   false, NULL, NULL, NULL, 'user_demo_manager'),
  ('doc_04', 'proj_demo_villa', 'Byggetilladelse_Sag_2026-045.pdf', '/demo/tilladelse.pdf', 320000, 'application/pdf', 'CONTRACT_LEGAL',
   false, NULL, NULL, NULL, 'user_demo_owner'),
  ('doc_05', 'proj_demo_villa', 'Kontrakt_Med_Klient.pdf', '/demo/kontrakt.pdf', 280000, 'application/pdf', 'CONTRACT_LEGAL',
   false, NULL, NULL, NULL, 'user_demo_manager'),
  ('doc_06', 'proj_demo_villa', 'Fotos_Nedrivning_01.jpg', '/demo/foto_nedrivning.jpg', 3100000, 'image/jpeg', 'GENERAL',
   false, NULL, NULL, NULL, 'user_demo_employee1')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- REMINDERS
-- ============================================================================

INSERT INTO reminders (
  id, project_id, title, date_time, context, is_completed
) VALUES
  ('rem_01', 'proj_demo_villa', 'Levering af fliser', '2026-03-10T08:00:00', 'Kontakt XL-Byg ved levering af fliser til bad', false),
  ('rem_02', 'proj_demo_villa', 'Kontrol af vådrumsmembran', '2026-03-06T14:00:00', 'Udført tryksøgning før flisering', false)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- ACTIVITY LOG
-- ============================================================================

INSERT INTO activity_log (
  id, project_id, type, user_name, description, timestamp
) VALUES
  ('log_01', 'proj_demo_villa', 'completed', 'Bente Bertelsen', 'Fuldførte nedrivning af gammelt køkken', '2026-01-20T14:30:00'),
  ('log_02', 'proj_demo_villa', 'upload', 'Anders Andersen', 'Uploadet tegning A-101', '2026-01-18T09:15:00'),
  ('log_03', 'proj_demo_villa', 'addUser', 'Anders Andersen', 'Inviterede El-Tech Elservice ApS som ekstern entreprenør', '2026-01-20T10:00:00')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- TIME ENTRIES
-- ============================================================================

INSERT INTO time_entries (
  id, project_id, user_id, user_name, hours, date, description
) VALUES
  ('time_01', 'proj_demo_villa', 'user_demo_employee1', 'Bente Bertelsen', 8, '2026-02-10', 'Gipsvæg og stålstole'),
  ('time_02', 'proj_demo_villa', 'user_demo_employee2', 'Carl Christiansen', 6, '2026-02-09', 'Midterdæk og væglængde'),
  ('time_03', 'proj_demo_villa', 'user_demo_manager', 'Anders Andersen', 4, '2026-02-08', 'Projektstyring og klientmøde')
ON CONFLICT (id) DO NOTHING;