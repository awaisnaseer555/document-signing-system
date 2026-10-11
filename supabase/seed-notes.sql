-- After creating auth users in the Supabase dashboard (or via Management invite):

-- Promote first manager
-- update public.profiles set role = 'MANAGEMENT' where email = 'manager@example.com';

-- Verify
-- select id, email, role from public.profiles;
