ALTER TABLE links ADD COLUMN placement TEXT NOT NULL DEFAULT '';

CREATE TABLE link_redirect_days (
  slug TEXT NOT NULL REFERENCES links(slug) ON DELETE CASCADE,
  day TEXT NOT NULL,
  redirect_count INTEGER NOT NULL CHECK (redirect_count > 0),
  last_redirect_at TEXT NOT NULL,
  PRIMARY KEY (slug, day)
) WITHOUT ROWID;
