-- Fix RLS on horarios_gps table to allow authenticated users to insert
-- Run this in Supabase SQL Editor

-- Check if RLS is enabled
SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'horarios_gps';

-- Disable RLS on horarios_gps (if enabled)
-- This allows authenticated users to perform operations
ALTER TABLE horarios_gps DISABLE ROW LEVEL SECURITY;

-- Alternative: If you want to keep RLS enabled, add these policies instead:
/*
-- Enable RLS if not already
ALTER TABLE horarios_gps ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to SELECT
CREATE POLICY "Allow authenticated users to select horarios_gps"
ON horarios_gps
FOR SELECT
USING (auth.role() = 'authenticated');

-- Allow authenticated users to INSERT
CREATE POLICY "Allow authenticated users to insert horarios_gps"
ON horarios_gps
FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

-- Allow authenticated users to UPDATE
CREATE POLICY "Allow authenticated users to update horarios_gps"
ON horarios_gps
FOR UPDATE
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');
*/

-- Verify RLS is now disabled
SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'horarios_gps';
