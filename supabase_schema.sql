-- Create users table (Extends auth.users)
CREATE TABLE public.users (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  phone TEXT,
  state TEXT,
  district TEXT,
  preferred_language TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Users: only own row visible
CREATE POLICY "Users can view own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- Create farms table
CREATE TABLE public.farms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  total_area_acres NUMERIC,
  lat NUMERIC,
  lng NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.farms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own farms" ON public.farms
  USING (auth.uid() = user_id);

-- Create diagnoses table
CREATE TABLE public.diagnoses (
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

-- Enable RLS
ALTER TABLE public.diagnoses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own diagnoses" ON public.diagnoses
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own diagnoses" ON public.diagnoses
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own diagnoses" ON public.diagnoses
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own diagnoses" ON public.diagnoses
  FOR DELETE USING (auth.uid() = user_id);

-- Setup Database Triggers for automatic user profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, full_name, created_at)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', now());
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Storage: Create diagnosis-images bucket (run this in Supabase dashboard Storage tab OR via SQL)
-- The bucket must be created via Dashboard > Storage > New Bucket: "diagnosis-images" (private)
-- Then add these storage policies:

INSERT INTO storage.buckets (id, name, public)
  VALUES ('diagnosis-images', 'diagnosis-images', false)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload diagnosis images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'diagnosis-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view own diagnosis images"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'diagnosis-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ============================================================
-- PHASE 3: AI Advisor Chat + Farm Management
-- ============================================================

-- Update farms table to add soil/water fields (if farms already created, use ALTER)
ALTER TABLE public.farms
  ADD COLUMN IF NOT EXISTS soil_type TEXT,
  ADD COLUMN IF NOT EXISTS water_source TEXT;

-- Create crop_cycles table
CREATE TABLE public.crop_cycles (
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

ALTER TABLE public.crop_cycles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own crop cycles" ON public.crop_cycles
  USING (farm_id IN (SELECT id FROM public.farms WHERE user_id = auth.uid()))
  WITH CHECK (farm_id IN (SELECT id FROM public.farms WHERE user_id = auth.uid()));

-- Create chat_sessions table
CREATE TABLE public.chat_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL DEFAULT 'New Conversation',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own chat sessions" ON public.chat_sessions
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create chat_messages table
CREATE TABLE public.chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES public.chat_sessions(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own chat messages" ON public.chat_messages
  USING (session_id IN (SELECT id FROM public.chat_sessions WHERE user_id = auth.uid()))
  WITH CHECK (session_id IN (SELECT id FROM public.chat_sessions WHERE user_id = auth.uid()));



-- =========================================================
-- OPEN SOURCE NATIVE UNLOCK (DISABLE ROW LEVEL SECURITY)
-- =========================================================
-- If you are running this app entirely without authentication,
-- you must disable Row Level Security (RLS) on all tables so 
-- that anonymous visitors can read from and write to the database.

ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE farms DISABLE ROW LEVEL SECURITY;
ALTER TABLE diagnoses DISABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE crop_cycles DISABLE ROW LEVEL SECURITY;

-- Notice: If you deploy this to production without Auth, 
-- anyone can edit your data. This is intended for a public sandbox demo.


-- =========================================================
-- COMMUNITY MODULE
-- =========================================================
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
ALTER TABLE public.community_posts DISABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.community_replies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID REFERENCES public.community_posts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  is_ai BOOLEAN NOT NULL DEFAULT FALSE,
  content TEXT NOT NULL,
  upvotes INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.community_replies DISABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_community_posts_created ON public.community_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_replies_post ON public.community_replies(post_id, created_at);
