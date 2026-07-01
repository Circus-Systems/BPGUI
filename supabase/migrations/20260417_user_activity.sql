-- BPGUI — user activity trail
-- Records authenticated requests so andrewjoyce84@hotmail.com can see
-- who is logged in and what they're doing. Rows are written by the
-- Next.js middleware using the service role key, so no RLS policies
-- are needed for inserts.

CREATE TABLE user_activity (
    id          BIGSERIAL PRIMARY KEY,
    user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    user_email  TEXT,
    path        TEXT NOT NULL,
    method      TEXT NOT NULL,
    ip          TEXT,
    user_agent  TEXT,
    referer     TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_activity_created_at ON user_activity(created_at DESC);
CREATE INDEX idx_user_activity_user ON user_activity(user_id, created_at DESC);

ALTER TABLE user_activity ENABLE ROW LEVEL SECURITY;
