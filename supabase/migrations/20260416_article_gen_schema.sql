-- BPG Article Generator — Schema
-- Adds tables for AI article generation pipeline.
-- Depends on existing: publications table

CREATE TABLE style_guides (
    id              BIGSERIAL PRIMARY KEY,
    publication_id  INTEGER NOT NULL REFERENCES publications(id),
    slug            TEXT NOT NULL UNIQUE,
    content_md      TEXT NOT NULL,
    sample_count    INTEGER,
    avg_word_count  INTEGER,
    version         INTEGER NOT NULL DEFAULT 1,
    generated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    edited_at       TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_style_guides_pub ON style_guides(publication_id);

CREATE TYPE article_gen_status AS ENUM (
    'researching', 'writing', 'draft', 'pending', 'published', 'failed'
);

CREATE TABLE generated_articles (
    id                      BIGSERIAL PRIMARY KEY,
    publication_id          INTEGER NOT NULL REFERENCES publications(id),
    style_guide_id          BIGINT REFERENCES style_guides(id),
    topic                   TEXT NOT NULL,
    topic_notes             TEXT,
    status                  article_gen_status NOT NULL DEFAULT 'researching',
    error_message           TEXT,
    research_notes          JSONB,
    research_sources        JSONB,
    research_completed_at   TIMESTAMPTZ,
    original_title          TEXT,
    original_excerpt        TEXT,
    original_body_html      TEXT,
    original_categories     TEXT[],
    original_tags           TEXT[],
    generation_completed_at TIMESTAMPTZ,
    edited_title            TEXT,
    edited_excerpt          TEXT,
    edited_body_html        TEXT,
    edited_categories       TEXT[],
    edited_tags             TEXT[],
    word_count              INTEGER,
    author_name             TEXT DEFAULT 'Editorial',
    finalised_at            TIMESTAMPTZ,
    finalised_by            UUID,
    published_at            TIMESTAMPTZ,
    published_by            UUID,
    model_used              TEXT DEFAULT 'claude-opus-4-20250514',
    research_tokens         INTEGER,
    generation_tokens       INTEGER,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by              UUID
);

CREATE INDEX idx_gen_articles_status ON generated_articles(status);
CREATE INDEX idx_gen_articles_pub_status ON generated_articles(publication_id, status);
CREATE INDEX idx_gen_articles_created ON generated_articles(created_at DESC);

CREATE TABLE generation_log (
    id              BIGSERIAL PRIMARY KEY,
    article_id      BIGINT REFERENCES generated_articles(id),
    step            TEXT NOT NULL,
    model           TEXT NOT NULL,
    input_tokens    INTEGER,
    output_tokens   INTEGER,
    duration_ms     INTEGER,
    error           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_gen_log_article ON generation_log(article_id);

ALTER TABLE style_guides ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE generation_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read style_guides" ON style_guides FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated write style_guides" ON style_guides FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated read generated_articles" ON generated_articles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated write generated_articles" ON generated_articles FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated read generation_log" ON generation_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role write generation_log" ON generation_log FOR INSERT TO service_role WITH CHECK (true);
