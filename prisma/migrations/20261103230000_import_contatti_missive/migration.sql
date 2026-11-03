-- Importazione dei contatti dalle rubriche telegrammi (screenshot del 03/11/2026).
-- Accorpamento per codice missiva: se il codice esiste già, il contatto viene aggiornato
-- (nome; attività solo se presente; le note esistenti restano), altrimenti viene creato.
-- Le note troncate nel gioco sono state completate: "Carpentiere Blackw…", "Libero Professionis…",
-- "Carboneria Annesb…".
WITH src(name, code, activity, notes) AS (
  VALUES
  -- Rubrica 1, pagina 1
  ('Tomas Jonson', 'WI327', NULL, NULL),
  ('Derek Woods', 'SJ206', NULL, NULL),
  ('Tony Chesterfield', 'UN936', 'Carpentiere Blackwater', NULL),
  ('Evans Mayson', 'OX880', NULL, NULL),
  ('Phoenix Ford', 'UP637', NULL, NULL),
  ('Frank Murphy', 'KH775', NULL, NULL),
  ('Elizabeth Ford', 'AZ424', NULL, NULL),
  ('Edmund Hardgrave', 'IQ764', 'Sindaco Strawberry', NULL),
  ('Frank McRaffilus Vens', 'ZL503', NULL, 'Nome letto da uno screenshot poco nitido: verificare'),
  ('Ethan Jonson', 'HO944', NULL, NULL),
  -- Rubrica 1, pagina 2
  ('Naomi Bell', 'EL165', 'Manzanita', NULL),
  ('William', 'CP419', 'Manzanita', 'Nell''altra rubrica lo stesso codice è registrato come "Buckland Club"'),
  ('Thomas Monroe', 'ZP847', 'Banco dei Pegni S.D.', NULL),
  ('Vincent Monclair', 'VN297', NULL, NULL),
  ('Bube', 'XJ374', 'Stalla Strawberry', NULL),
  ('Calvin Bennet', 'XV838', NULL, NULL),
  ('Steve Terrence', 'XI345', NULL, NULL),
  ('Sung Lee', 'LF976', 'Fabbro Strawberry', NULL),
  ('Marcus Vexmoor', 'KX837', 'Medico Strawberry', NULL),
  ('Robert Ashford', 'RN784', 'Armeria Strawberry', NULL),
  -- Rubrica 1, pagina 3
  ('Solomon Baine', 'FN893', NULL, 'Gruppo: Lavoro'),
  ('Tom', 'BR232', 'Minatore', NULL),
  ('John Colter', 'EU368', NULL, 'Gruppo: Lavoro'),
  ('Miss Hope', 'LE701', NULL, NULL),
  ('Fabbro Blackwater', 'OX948', NULL, NULL),
  ('Mary Grant', 'HH987', NULL, 'Gruppo: Lavoro'),
  ('Vincent', 'YJ440', 'Libero Professionista', NULL),
  ('James Bucket', 'FV195', NULL, NULL),
  ('Miguel Torres', 'RJ150', NULL, 'Gruppo: Lavoro'),
  ('Kathryn Ashford', 'KD569', 'Luna''s Ranch', 'Nell''altra rubrica scritto "Kathrin Ashford"'),
  -- Rubrica 1, pagina 4
  ('Billy Brown', 'OI266', 'Pawnshop Blackwater', NULL),
  ('Zeff Martines', 'ZF892', NULL, NULL),
  ('Noa Barone', 'JJ970', 'Macfarlane Ranch', NULL),
  ('Fabbro 2 BW', 'NX208', NULL, NULL),
  ('Moore', 'AK933', 'Saloon Strawberry', NULL),
  ('Jesse Blessed', 'UE569', NULL, NULL),
  ('Dr. De Drugher', 'JU506', NULL, NULL),
  ('Jack', 'FM194', NULL, NULL),
  ('Evan Sterling', 'HP107', 'Luna''s Ranch', NULL),
  ('Amelia Clark', 'JD258', NULL, NULL),
  -- Rubrica 1, pagina 5
  ('Nolan Cross', 'DP701', NULL, NULL),
  ('Ros Moor', 'ZF939', NULL, NULL),
  ('Noora Meyer', 'FE530', NULL, NULL),
  -- Rubrica 2, pagina 1
  ('Warren Vance', 'EF285', 'Carpentiere S.D.', NULL),
  ('Jack Donovan', 'SU250', 'Hotel BW', NULL),
  ('Aiden Bishop', 'RY750', 'Mercenario', NULL),
  ('Thomas Parker', 'DX501', 'Ghiacciaio BW', NULL),
  ('Vivian Vauclair', 'AC802', 'Armeria Rhodes', NULL),
  ('Fonderia Saint Denis', 'BC508', 'Fonderia S.D.', NULL),
  ('Silas Thorne', 'MJ710', NULL, NULL),
  -- Rubrica 2, pagina 2
  ('Leonard Beckett', 'JP867', 'Carboneria Annesburg', NULL),
  ('Otis', 'CC523', 'Native Post', NULL),
  ('Jo Stone', 'CI719', 'Manzanita', NULL),
  ('James', 'CC705', 'Armeria Valentine', NULL),
  ('Red', 'GN684', 'Native Post', NULL),
  ('Jaime Jax Withmore', 'LJ969', 'Macfarlane Ranch', NULL),
  -- Rubrica 2, pagina 3
  ('Elijah Finch', 'VS720', NULL, NULL),
  ('Musky', 'YP494', 'Cacciatore', NULL),
  ('Samuel', 'OJ655', NULL, NULL),
  ('Dominic', 'ZB147', NULL, NULL),
  ('Rami', 'YG950', NULL, NULL),
  ('Obediah Cinerius', 'CD388', NULL, NULL),
  ('Marco Valle', 'WC590', NULL, NULL),
  ('Edward Wade Ridge', 'NJ522', NULL, NULL),
  ('Daniel Kenneth', 'XU251', 'Avamposto', NULL)
),
upd AS (
  UPDATE "Contact" c
  SET "name" = s.name,
      "activity" = COALESCE(s.activity, c."activity"),
      "notes" = COALESCE(c."notes", s.notes),
      "updatedAt" = now()
  FROM src s
  WHERE upper(regexp_replace(c."missiveCode", '\s+', '', 'g')) = s.code
  RETURNING c."id"
)
INSERT INTO "Contact" ("id", "name", "missiveCode", "activity", "notes", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s.name, s.code, s.activity, s.notes, now(), now()
FROM src s
WHERE NOT EXISTS (
  SELECT 1 FROM "Contact" c WHERE upper(regexp_replace(c."missiveCode", '\s+', '', 'g')) = s.code
);
