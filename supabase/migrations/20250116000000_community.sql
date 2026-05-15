-- Migration: Community module (posts + replies)
-- Idempotent: safe to re-run.

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
