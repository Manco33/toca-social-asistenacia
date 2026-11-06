-- Ejecuta esto en el Editor SQL de tu panel de Supabase:

ALTER TABLE users
ADD COLUMN facial_descriptor text,
ADD COLUMN facial_enrolled_at timestamptz;
