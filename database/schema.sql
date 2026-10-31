-- UnderBarber — esquema PostgreSQL (idempotente: se puede ejecutar muchas veces)

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(120)  NOT NULL,
  email         VARCHAR(160)  NOT NULL,
  phone         VARCHAR(30),
  password_hash VARCHAR(100)  NOT NULL,
  role          VARCHAR(10)   NOT NULL DEFAULT 'client' CHECK (role IN ('client', 'barber', 'admin')),
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT now()
);
-- Correo único sin distinguir mayúsculas
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users (lower(email));

CREATE TABLE IF NOT EXISTS barbers (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER UNIQUE REFERENCES users(id) ON DELETE SET NULL,
  display_name  VARCHAR(120) NOT NULL,
  title         VARCHAR(120) NOT NULL,
  specialty_key VARCHAR(30)  NOT NULL UNIQUE,   -- fade | classic | creative
  bio           TEXT         NOT NULL DEFAULT '',
  specialties   TEXT[]       NOT NULL DEFAULT '{}',
  work_days     SMALLINT[]   NOT NULL DEFAULT '{1,2,3,4,5,6}',  -- ISO: 1 = lunes ... 7 = domingo
  work_start    TIME         NOT NULL DEFAULT '09:00',
  work_end      TIME         NOT NULL DEFAULT '19:00',
  position      SMALLINT     NOT NULL DEFAULT 0,
  active        BOOLEAN      NOT NULL DEFAULT TRUE,
  CHECK (work_end > work_start)
);

CREATE TABLE IF NOT EXISTS services (
  id           SERIAL PRIMARY KEY,
  name         VARCHAR(120) NOT NULL,
  description  TEXT         NOT NULL DEFAULT '',
  price        INTEGER      NOT NULL CHECK (price >= 0),          -- COP, valor entero
  duration_min INTEGER      NOT NULL CHECK (duration_min BETWEEN 15 AND 240),
  position     SMALLINT     NOT NULL DEFAULT 0,
  active       BOOLEAN      NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS appointments (
  id         SERIAL PRIMARY KEY,
  client_id  INTEGER     NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  barber_id  INTEGER     NOT NULL REFERENCES barbers(id)  ON DELETE RESTRICT,
  service_id INTEGER     NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
  starts_at  TIMESTAMPTZ NOT NULL,
  ends_at    TIMESTAMPTZ NOT NULL,
  status     VARCHAR(10) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),
  notes      VARCHAR(300) NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);
CREATE INDEX IF NOT EXISTS appointments_barber_time ON appointments (barber_id, starts_at);
CREATE INDEX IF NOT EXISTS appointments_client      ON appointments (client_id, starts_at);
-- Red de seguridad extra: dos citas activas no pueden empezar a la misma hora con el mismo barbero
CREATE UNIQUE INDEX IF NOT EXISTS appointments_no_same_start
  ON appointments (barber_id, starts_at) WHERE status <> 'cancelled';

-- Cuestionario ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS quiz_questions (
  id       SERIAL PRIMARY KEY,
  position SMALLINT     NOT NULL,
  text     VARCHAR(200) NOT NULL,
  help     VARCHAR(200) NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS quiz_options (
  id          SERIAL PRIMARY KEY,
  question_id INTEGER      NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
  position    SMALLINT     NOT NULL,
  label       VARCHAR(160) NOT NULL
);
CREATE INDEX IF NOT EXISTS quiz_options_question ON quiz_options (question_id);

CREATE TABLE IF NOT EXISTS quiz_option_points (
  option_id INTEGER  NOT NULL REFERENCES quiz_options(id) ON DELETE CASCADE,
  barber_id INTEGER  NOT NULL REFERENCES barbers(id)      ON DELETE CASCADE,
  points    SMALLINT NOT NULL CHECK (points >= 0),
  PRIMARY KEY (option_id, barber_id)
);

CREATE TABLE IF NOT EXISTS quiz_results (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  barber_id  INTEGER NOT NULL REFERENCES barbers(id) ON DELETE CASCADE,
  answers    JSONB   NOT NULL,
  scores     JSONB   NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
