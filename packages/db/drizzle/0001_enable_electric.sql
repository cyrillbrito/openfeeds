-- Enable Electric SQL with Manual Mode (ELECTRIC_MANUAL_TABLE_PUBLISHING=true)
-- Following: https://electric-sql.com/docs/guides/postgres-permissions#manual-mode-setup

-- Create the Electric user with REPLICATION
-- Password is a placeholder — change it in production environments.
CREATE ROLE electric_user WITH LOGIN PASSWORD 'electric_password' REPLICATION;

-- Grant connection and schema privileges
DO $$ BEGIN EXECUTE format('GRANT CONNECT ON DATABASE %I TO electric_user', current_database()); END $$;
GRANT USAGE ON SCHEMA public TO electric_user;

-- Grant SELECT only on Electric-synced tables
GRANT SELECT ON
  feeds,
  articles,
  tags,
  feed_tags,
  article_tags,
  settings,
  filter_rules
TO electric_user;

-- Create the publication for Electric-synced tables
CREATE PUBLICATION electric_publication_default FOR TABLE
  feeds,
  articles,
  tags,
  feed_tags,
  article_tags,
  settings,
  filter_rules;

-- Set REPLICA IDENTITY FULL on all synced tables (required for Electric change tracking)
ALTER TABLE feeds REPLICA IDENTITY FULL;
ALTER TABLE articles REPLICA IDENTITY FULL;
ALTER TABLE tags REPLICA IDENTITY FULL;
ALTER TABLE feed_tags REPLICA IDENTITY FULL;
ALTER TABLE article_tags REPLICA IDENTITY FULL;
ALTER TABLE settings REPLICA IDENTITY FULL;
ALTER TABLE filter_rules REPLICA IDENTITY FULL;

-- Transfer publication ownership to electric_user
ALTER PUBLICATION electric_publication_default OWNER TO electric_user;
