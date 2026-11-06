-- Fix the empleados table auto-increment sequence
-- This resets the sequence to be higher than the current max id

-- First, check what IDs exist
SELECT id FROM empleados ORDER BY id DESC LIMIT 1;

-- Reset the sequence (replace MAX_ID with the highest id + 1)
-- For example, if max id is 5, run: SELECT setval('empleados_id_seq', 6);
SELECT setval('empleados_id_seq', (SELECT COALESCE(MAX(id), 0) + 1 FROM empleados));

-- Verify the sequence is fixed
SELECT nextval('empleados_id_seq');
