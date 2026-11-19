-- ============================================================
-- Event Ticket Template — Orders Pipeline SQL
-- Run this once in your PostgreSQL SQL editor to create the
-- two tables this pipeline writes to.
--
-- HOW TO CUSTOMISE FOR YOUR TICKET TYPES
-- ----------------------------------------
-- The `quantities` column is JSONB and stores all ticket-type
-- quantities in one flexible field, e.g.:
--   { "full":      { "adults": 2, "children": 0 },
--     "courtyard": { "adults": 1, "children": 0 } }
-- The keys match `ticketTypes[].id` in event.en.ts.
-- No SQL change is needed when you rename or add ticket types —
-- just update event.en.ts and the Airtable columns (see SETUP.md).
-- ============================================================


-- ── 1. Orders ───────────────────────────────────────────────
-- One row per completed (or refunded) booking.

CREATE TABLE IF NOT EXISTS orders (
  id                       SERIAL          PRIMARY KEY,

  -- Identifiers
  order_id                 TEXT            UNIQUE NOT NULL,
  stripe_session_id        TEXT,
  stripe_payment_intent_id TEXT,
  charge_id                TEXT,

  -- Booking details
  status                   TEXT            NOT NULL DEFAULT 'confirmed',
  -- 'confirmed' | 'refunded'

  locale                   TEXT,
  visit_date               TEXT,           -- YYYY-MM-DD
  visit_time               TEXT,           -- e.g. "09:00"
  shift_id                 TEXT,

  -- Ticket quantities (flexible — keys = ticketTypes[].id)
  quantities               JSONB           NOT NULL DEFAULT '{}',
  total_adults             INTEGER         NOT NULL DEFAULT 0,
  total_children           INTEGER         NOT NULL DEFAULT 0,
  amount_eur               NUMERIC(10, 2),

  -- Customer
  customer_email           TEXT,
  customer_name            TEXT,
  backup_email             TEXT,           -- collected in-app before Stripe redirect
  phone                    TEXT,
  buyer_country            TEXT,           -- ISO-3166-1 alpha-2, e.g. "IT"

  -- Attribution
  gclid                    TEXT,
  fbclid                   TEXT,

  -- Stripe settlement (USD — populated by admin payout-sync job)
  gross_usd                NUMERIC(10, 2),
  fee_usd                  NUMERIC(10, 2),
  net_usd                  NUMERIC(10, 2),
  fx_rate                  NUMERIC(10, 6), -- EUR→USD exchange rate Stripe applied

  -- Refund (populated when charge.refunded webhook fires)
  refund_status            TEXT,           -- 'none' | 'partial' | 'full'
  refund_amount_eur        NUMERIC(10, 2),
  refund_amount_usd        NUMERIC(10, 2),
  refund_reason            TEXT,
  refunded_at              TIMESTAMPTZ,

  -- Timestamps
  confirmed_at             TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  created_at               TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- Useful indexes
CREATE INDEX IF NOT EXISTS orders_visit_date_idx    ON orders (visit_date);
CREATE INDEX IF NOT EXISTS orders_customer_email_idx ON orders (customer_email);
CREATE INDEX IF NOT EXISTS orders_status_idx         ON orders (status);


-- ── 2. Checkout Abandonments ────────────────────────────────
-- One row per Stripe session that expired without payment.
-- Stripe fires checkout.session.expired ~24 h after session creation.

CREATE TABLE IF NOT EXISTS checkout_abandonments (
  id                   SERIAL       PRIMARY KEY,
  stripe_session_id    TEXT         UNIQUE NOT NULL,
  order_id             TEXT,
  visit_date           TEXT,
  visit_time           TEXT,
  shift_id             TEXT,
  locale               TEXT,

  -- Ticket quantities at the time of abandonment
  quantities           JSONB        NOT NULL DEFAULT '{}',
  intended_amount_eur  NUMERIC(10, 2),

  -- Email is captured by Stripe even if the customer never paid
  customer_email       TEXT,

  -- Attribution
  gclid                TEXT,
  fbclid               TEXT,

  created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS abandonments_visit_date_idx ON checkout_abandonments (visit_date);


-- ── 3. Handy queries ────────────────────────────────────────
-- Paste these into your SQL editor any time you need a quick check.

-- Revenue by ticket type today:
-- SELECT
--   key                              AS ticket_type,
--   SUM((value->>'adults')::int)     AS adults_sold,
--   SUM((value->>'children')::int)   AS children_sold
-- FROM orders, jsonb_each(quantities) AS t(key, value)
-- WHERE visit_date = CURRENT_DATE::text
--   AND status = 'confirmed'
-- GROUP BY key;

-- Daily order count + revenue:
-- SELECT visit_date, COUNT(*) AS bookings, SUM(amount_eur) AS revenue_eur
-- FROM orders WHERE status = 'confirmed'
-- GROUP BY visit_date ORDER BY visit_date DESC;
