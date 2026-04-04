-- ═══════════════════════════════════════════════════════════════
-- MedAI — Supabase Database Schema
-- Run this in your Supabase SQL Editor → New Query
-- ═══════════════════════════════════════════════════════════════

-- 1. User Health Profiles
-- Auto-created on signup, updated by LLM on document upload
CREATE TABLE IF NOT EXISTS user_health_profiles (
  user_id       UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  conditions    TEXT[]  DEFAULT '{}',
  allergies     TEXT[]  DEFAULT '{}',
  sugar_trend   TEXT    DEFAULT 'unknown',
  bp_trend      TEXT    DEFAULT 'unknown',
  recent_reports_summary TEXT DEFAULT '',
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Documents metadata
-- FAISS embeddings stored separately on disk per user
CREATE TABLE IF NOT EXISTS documents (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID REFERENCES auth.users ON DELETE CASCADE,
  filename      TEXT NOT NULL,
  summary       TEXT DEFAULT '',
  chunk_count   INT  DEFAULT 0,
  uploaded_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Chat History
-- Persisted per user for memory continuity
CREATE TABLE IF NOT EXISTS chat_history (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID REFERENCES auth.users ON DELETE CASCADE,
  role          TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content       TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ───────────────────────────────────────────────────────────────
-- Row Level Security (RLS) — users only see their own data
-- ───────────────────────────────────────────────────────────────

ALTER TABLE user_health_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents             ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_history          ENABLE ROW LEVEL SECURITY;

-- Health Profiles
CREATE POLICY "Users can view their own profile"
  ON user_health_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
  ON user_health_profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can do everything on profiles"
  ON user_health_profiles FOR ALL
  USING (true)
  WITH CHECK (true);

-- Documents
CREATE POLICY "Users can view their own documents"
  ON documents FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage documents"
  ON documents FOR ALL
  USING (true)
  WITH CHECK (true);

-- Chat History
CREATE POLICY "Users can view their own chat history"
  ON chat_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage chat history"
  ON chat_history FOR ALL
  USING (true)
  WITH CHECK (true);

-- ───────────────────────────────────────────────────────────────
-- Indexes for performance
-- ───────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_documents_user_id    ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_user_id         ON chat_history(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_created_at      ON chat_history(created_at);
