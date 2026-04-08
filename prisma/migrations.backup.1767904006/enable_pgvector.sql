-- Enable pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Create index for vector similarity search on episodic memories
-- This will be created after the migration
