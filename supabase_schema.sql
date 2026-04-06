-- Enable UUID function
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE public.chat_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  role text NOT NULL CHECK (role = ANY (ARRAY['user'::text, 'assistant'::text])),
  content text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT chat_history_pkey PRIMARY KEY (id),
  CONSTRAINT chat_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

CREATE TABLE public.chat_threads (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text DEFAULT 'New conversation'::text,
  updated_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT chat_threads_pkey PRIMARY KEY (id),
  CONSTRAINT chat_threads_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

CREATE TABLE public.chat_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL,
  role text NOT NULL CHECK (role = ANY (ARRAY['user'::text, 'assistant'::text])),
  content text NOT NULL,
  location_used boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT chat_messages_pkey PRIMARY KEY (id),
  CONSTRAINT chat_messages_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.chat_threads(id)
);

CREATE TABLE public.documents (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  filename text NOT NULL,
  summary text DEFAULT ''::text,
  chunk_count integer DEFAULT 0,
  uploaded_at timestamp with time zone DEFAULT now(),
  CONSTRAINT documents_pkey PRIMARY KEY (id),
  CONSTRAINT documents_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

CREATE TABLE public.gmail_tokens (
  user_id uuid NOT NULL,
  gmail_email text NOT NULL,
  access_token text NOT NULL,
  refresh_token text,
  expires_at timestamp with time zone,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT gmail_tokens_pkey PRIMARY KEY (user_id),
  CONSTRAINT gmail_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

CREATE TABLE public.medications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  dosage text DEFAULT ''::text,
  type text DEFAULT 'Tablet'::text,
  frequency text DEFAULT 'Once daily'::text,
  meal_time text DEFAULT 'After meal'::text,
  start_date date,
  end_date date,
  status text DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'completed'::text, 'stopped'::text, 'as_needed'::text])),
  prescribed_by text DEFAULT ''::text,
  notes text DEFAULT ''::text,
  reminder boolean DEFAULT false,
  reminder_time text DEFAULT '08:00'::text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  gmail_reminder boolean DEFAULT false,
  CONSTRAINT medications_pkey PRIMARY KEY (id),
  CONSTRAINT medications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

CREATE TABLE public.user_documents (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  category text DEFAULT 'Other'::text,
  type text NOT NULL CHECK (type = ANY (ARRAY['file'::text, 'note'::text])),
  file_path text,
  file_name text,
  file_size bigint DEFAULT 0,
  file_type text,
  note_content text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_documents_pkey PRIMARY KEY (id),
  CONSTRAINT user_documents_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

CREATE TABLE public.user_health_profiles (
  user_id uuid NOT NULL,
  conditions text[] DEFAULT '{}'::text[],
  allergies text[] DEFAULT '{}'::text[],
  sugar_trend text DEFAULT 'unknown'::text,
  bp_trend text DEFAULT 'unknown'::text,
  recent_reports_summary text DEFAULT ''::text,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_health_profiles_pkey PRIMARY KEY (user_id),
  CONSTRAINT user_health_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

CREATE TABLE public.user_long_term_memory (
  user_id uuid NOT NULL,
  memory_text text DEFAULT ''::text,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_long_term_memory_pkey PRIMARY KEY (user_id),
  CONSTRAINT user_long_term_memory_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
