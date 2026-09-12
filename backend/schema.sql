-- ============================================================================
--  schema.sql — structura bazei de date Cloudflare D1 (SQLite)
-- ----------------------------------------------------------------------------
--  Trei tabele:
--    cars      — stocul de mașini
--    settings  — textele și datele editabile din panoul de admin
--    sessions  — sesiunile de login ale patronului
--
--  RULARE (o singură dată, la început):
--    wrangler d1 execute autopark_db --local  --file=./schema.sql   (pentru dev)
--    wrangler d1 execute autopark_db --remote --file=./schema.sql   (pentru producție)
--
--  Rescrierea e sigură: totul e „IF NOT EXISTS". Nu șterge date la re-rulare.
-- ============================================================================

-- ── MAȘINI ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cars (
    id                  TEXT PRIMARY KEY,          -- id generat (nanoid/uuid)
    slug                TEXT NOT NULL UNIQUE,       -- 'bmw-2018-a91c4d', pentru URL

    -- Câmpuri de identificare
    title               TEXT NOT NULL,             -- max 80 caractere (validat în cod)
    brand               TEXT NOT NULL,             -- din lista hardcodată
    production_year     INTEGER NOT NULL,

    -- Preț și rulaj
    price               INTEGER NOT NULL,          -- în EUR, număr întreg
    negotiable          INTEGER NOT NULL DEFAULT 0,-- 0/1 (SQLite nu are boolean)
    mileage             INTEGER NOT NULL,          -- km

    -- Motor
    fuel                TEXT NOT NULL,
    engine_capacity     TEXT NOT NULL,             -- '2.0 L' sau 'Fără (Electric)'
    horsepower          INTEGER,                   -- opțional
    pollution_standard  TEXT NOT NULL,

    -- Caroserie și mecanică
    body_type           TEXT NOT NULL,
    color               TEXT NOT NULL,
    transmission        TEXT NOT NULL,
    drivetrain          TEXT NOT NULL,
    steering_wheel      TEXT NOT NULL DEFAULT 'left',   -- 'left' | 'right'
    vin                 TEXT,                      -- opțional

    -- Stare
    registration_status TEXT NOT NULL,             -- 'registered' | 'unregistered'
    for_dismantling     INTEGER NOT NULL DEFAULT 0, -- 0/1

    -- Descriere și contact
    description         TEXT NOT NULL DEFAULT '',  -- max 4000
    phone               TEXT NOT NULL,             -- precompletat cu numărul parcului

    -- Media: JSON cu lista de poze. Vezi forma în Batch 3.
    -- Ex: [{"id":"abc","ext":"jpg","w":1600,"h":1200,"variants":[400,800,1600]}]
    media               TEXT NOT NULL DEFAULT '[]',

    -- Stare de publicare
    status              TEXT NOT NULL DEFAULT 'published', -- 'draft'|'published'|'sold'
    sold_at             TEXT,                      -- ISO, când a fost marcată vândută
    featured            INTEGER NOT NULL DEFAULT 0,-- 0/1, apare prima pe acasă
    position            INTEGER NOT NULL DEFAULT 0,-- ordonare manuală opțională

    views               INTEGER NOT NULL DEFAULT 0,

    created_at          TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indecși pentru motorul de căutare și paginare.
-- Ordinea coloanelor contează: status filtrează, restul ordonează/filtrează.
CREATE INDEX IF NOT EXISTS idx_cars_status_created ON cars(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cars_status_price   ON cars(status, price);
CREATE INDEX IF NOT EXISTS idx_cars_status_year    ON cars(status, production_year DESC);
CREATE INDEX IF NOT EXISTS idx_cars_status_mileage ON cars(status, mileage);
CREATE INDEX IF NOT EXISTS idx_cars_brand          ON cars(status, brand);
CREATE INDEX IF NOT EXISTS idx_cars_featured       ON cars(status, featured DESC, position ASC);

-- ── SETĂRI ──────────────────────────────────────────────────────────────────
-- Un singur rând (id = 1), cu tot ce editează patronul.
-- Textele lungi și listele (servicii) stau ca JSON în coloane TEXT.
CREATE TABLE IF NOT EXISTS settings (
    id                  INTEGER PRIMARY KEY CHECK (id = 1),  -- forțează un singur rând

    -- Identitate editabilă
    display_name        TEXT NOT NULL DEFAULT 'Vanzari Auto Park',
    phone_primary       TEXT NOT NULL DEFAULT '0753637151',  -- Bogdan
    phone_secondary     TEXT NOT NULL DEFAULT '0725644944',  -- Florin
    phone_primary_label TEXT NOT NULL DEFAULT 'Bogdan',
    phone_secondary_label TEXT NOT NULL DEFAULT 'Florin',
    whatsapp            TEXT NOT NULL DEFAULT '0753637151',  -- Bogdan
    email               TEXT NOT NULL DEFAULT 'vanzari_auto_park@yahoo.com',

    -- Hero (acasă)
    hero_title          TEXT NOT NULL DEFAULT '',
    hero_subtitle       TEXT NOT NULL DEFAULT '',

    -- Servicii: JSON cu 3 obiecte {icon, title, text}
    services            TEXT NOT NULL DEFAULT '[]',

    -- Despre noi (poate apărea pe acasă sau contact)
    about_title         TEXT NOT NULL DEFAULT '',
    about_text          TEXT NOT NULL DEFAULT '',

    -- Intro pe pagina de contact
    contact_intro       TEXT NOT NULL DEFAULT '',

    -- Adresă și hartă (editabile din cod, dar în DB ca să fie o singură sursă)
    address             TEXT NOT NULL DEFAULT 'Intrare Botoșani dinspre Suceava, după sensul giratoriu de la Dedeman',
    city                TEXT NOT NULL DEFAULT 'Botoșani',
    county              TEXT NOT NULL DEFAULT 'Botoșani',
    lat                 REAL NOT NULL DEFAULT 47.7358,
    lng                 REAL NOT NULL DEFAULT 26.6345,

    -- Social
    facebook_url        TEXT NOT NULL DEFAULT 'https://www.facebook.com/profile.php?id=100064172163536',
    instagram_url       TEXT NOT NULL DEFAULT '',
    tiktok_url          TEXT NOT NULL DEFAULT '',

    -- SEO
    meta_description    TEXT NOT NULL DEFAULT '',

    updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Inserăm rândul unic dacă nu există. Valorile reale vin în Batch 11 (seed).
INSERT OR IGNORE INTO settings (id) VALUES (1);

-- ── SESIUNI ─────────────────────────────────────────────────────────────────
-- Login-ul patronului. Un token opac, cu expirare.
-- Motivul pentru care ținem sesiuni în D1 și nu doar JWT: se pot invalida.
-- Ștergi rândul → sesiunea moare instant (parolă compromisă, logout forțat).
CREATE TABLE IF NOT EXISTS sessions (
    token       TEXT PRIMARY KEY,        -- opac, generat criptografic
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at  TEXT NOT NULL            -- ISO; verificat la fiecare cerere
);

CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
