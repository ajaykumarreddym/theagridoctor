-- ============================================================
-- TheAgriDoctor - Complete Database Migration
-- Run this entire script in Supabase SQL Editor
-- Project: jgjbqptzwumwapjooumb.supabase.co
-- Date: May 15, 2026
-- ============================================================

-- ============================================================
-- 1. USERS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.users (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  phone TEXT,
  state TEXT,
  district TEXT,
  preferred_language TEXT,
  alert_preferences JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- 2. FARMS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.farms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  total_area_acres NUMERIC,
  lat NUMERIC,
  lng NUMERIC,
  soil_type TEXT,
  water_source TEXT,
  agro_polygon_id TEXT,
  polygon_geojson JSONB,
  polygon_area_ha NUMERIC,
  polygon_radius_m INTEGER DEFAULT 300,
  last_scan_at TIMESTAMP WITH TIME ZONE,
  latest_monitor_snapshot JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- 3. CROP CYCLES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.crop_cycles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  farm_id UUID REFERENCES public.farms(id) ON DELETE CASCADE NOT NULL,
  crop_name TEXT NOT NULL,
  variety TEXT,
  sown_date DATE,
  expected_harvest_date DATE,
  growth_stage TEXT DEFAULT 'seedling' CHECK (growth_stage IN ('seedling', 'vegetative', 'flowering', 'fruiting', 'harvest', 'harvested')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'harvested', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- 4. DIAGNOSES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.diagnoses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  crop_type TEXT NOT NULL,
  image_urls TEXT[] NOT NULL DEFAULT '{}',
  disease_name TEXT,
  confidence_pct NUMERIC,
  severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  full_report_json JSONB,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- 5. CHAT SESSIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.chat_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL DEFAULT 'New Conversation',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- 6. CHAT MESSAGES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES public.chat_sessions(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- 7. COMMUNITY POSTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.community_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  crop_tag TEXT,
  tags TEXT[] DEFAULT '{}',
  image_urls TEXT[] DEFAULT '{}',
  upvotes INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 8. COMMUNITY REPLIES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.community_replies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID REFERENCES public.community_posts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  is_ai BOOLEAN NOT NULL DEFAULT FALSE,
  content TEXT NOT NULL,
  upvotes INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 9. NOTIFICATIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('info', 'warning', 'alert', 'success')),
  read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- 10. CROP TASKS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.crop_tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  crop_cycle_id UUID REFERENCES public.crop_cycles(id) ON DELETE CASCADE NOT NULL,
  task_name TEXT NOT NULL,
  description TEXT,
  due_date DATE,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  completed_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_farms_user_id ON public.farms(user_id);
CREATE INDEX IF NOT EXISTS idx_diagnoses_user_id ON public.diagnoses(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON public.chat_sessions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON public.chat_messages(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_community_posts_created ON public.community_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_replies_post ON public.community_replies(post_id, created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crop_tasks_crop_cycle ON public.crop_tasks(crop_cycle_id, due_date);

-- ============================================================
-- DISABLE ROW LEVEL SECURITY (FOR DEVELOPMENT)
-- ============================================================
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.farms DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.crop_cycles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.diagnoses DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_posts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_replies DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.crop_tasks DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- DATABASE TRIGGER FOR USER CREATION
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, full_name, created_at)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', now())
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ============================================================
-- STORAGE BUCKET FOR DIAGNOSIS IMAGES
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'diagnosis-images', 
  'diagnosis-images', 
  false,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- STORAGE POLICIES
-- ============================================================
-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Authenticated users can upload diagnosis images" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own diagnosis images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own diagnosis images" ON storage.objects;

-- Create storage policies
CREATE POLICY "Authenticated users can upload diagnosis images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'diagnosis-images' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view own diagnosis images"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'diagnosis-images' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete own diagnosis images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'diagnosis-images' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- ============================================================
-- VERIFICATION QUERY
-- ============================================================
-- Run this to verify all tables were created
SELECT 
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns 
   WHERE columns.table_schema = 'public' 
   AND columns.table_name = tables.table_name) as column_count
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- ============================================================
-- SUCCESS MESSAGE
-- ============================================================
DO $$
BEGIN
  RAISE NOTICE '✅ Migration completed successfully!';
  RAISE NOTICE '✅ 10 tables created';
  RAISE NOTICE '✅ Indexes added for performance';
  RAISE NOTICE '✅ User trigger configured';
  RAISE NOTICE '✅ Storage bucket created';
  RAISE NOTICE 'Now refresh your Supabase Table Editor to see all tables!';
END $$;
