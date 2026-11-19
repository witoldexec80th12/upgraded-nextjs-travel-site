/**
 * PostgreSQL helpers for the Orders pipeline.
 * Uses the shared @workspace/db pool (DATABASE_URL env var).
 * Schema: see docs/pipeline/orders.sql
 */
import { pool } from "@workspace/db";

// ── Types ────────────────────────────────────────────────────────────────────

export interface OrderRow {
  order_id: string;
  stripe_session_id?: string;
  stripe_payment_intent_id?: string;
  charge_id?: string;
  status?: string;
  locale?: string;
  visit_date?: string;
  visit_time?: string;
  shift_id?: string;
  /** { [ticketTypeId]: { adults: number, children: number } } */
  quantities: Record<string, { adults: number; children: number }>;
  total_adults: number;
  total_children: number;
  amount_eur?: number;
  customer_email?: string;
  customer_name?: string;
  backup_email?: string;
  phone?: string;
  buyer_country?: string;
  gclid?: string;
  fbclid?: string;
  gross_usd?: number;
  fee_usd?: number;
  net_usd?: number;
  fx_rate?: number;
}

export interface AbandonmentRow {
  stripe_session_id: string;
  order_id?: string;
  visit_date?: string;
  visit_time?: string;
  shift_id?: string;
  locale?: string;
  quantities?: Record<string, { adults: number; children: number }>;
  intended_amount_eur?: number;
  customer_email?: string;
  gclid?: string;
  fbclid?: string;
}

// ── Writes ────────────────────────────────────────────────────────────────────

export async function saveOrder(row: OrderRow): Promise<void> {
  await pool.query(
    `INSERT INTO orders (
      order_id, stripe_session_id, stripe_payment_intent_id, charge_id,
      status, locale, visit_date, visit_time, shift_id,
      quantities, total_adults, total_children, amount_eur,
      customer_email, customer_name, backup_email, phone, buyer_country,
      gclid, fbclid
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20
    )
    ON CONFLICT (order_id) DO NOTHING`,
    [
      row.order_id,
      row.stripe_session_id ?? null,
      row.stripe_payment_intent_id ?? null,
      row.charge_id ?? null,
      row.status ?? "confirmed",
      row.locale ?? null,
      row.visit_date ?? null,
      row.visit_time ?? null,
      row.shift_id ?? null,
      JSON.stringify(row.quantities),
      row.total_adults,
      row.total_children,
      row.amount_eur ?? null,
      row.customer_email ?? null,
      row.customer_name ?? null,
      row.backup_email ?? null,
      row.phone ?? null,
      row.buyer_country ?? null,
      row.gclid ?? null,
      row.fbclid ?? null,
    ],
  );
}

export async function saveAbandonment(row: AbandonmentRow): Promise<void> {
  await pool.query(
    `INSERT INTO checkout_abandonments (
      stripe_session_id, order_id, visit_date, visit_time, shift_id,
      locale, quantities, intended_amount_eur, customer_email, gclid, fbclid
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
    ON CONFLICT (stripe_session_id) DO NOTHING`,
    [
      row.stripe_session_id,
      row.order_id ?? null,
      row.visit_date ?? null,
      row.visit_time ?? null,
      row.shift_id ?? null,
      row.locale ?? null,
      JSON.stringify(row.quantities ?? {}),
      row.intended_amount_eur ?? null,
      row.customer_email ?? null,
      row.gclid ?? null,
      row.fbclid ?? null,
    ],
  );
}

export async function markOrderRefunded(
  orderId: string,
  fields: {
    refund_status: "partial" | "full";
    refund_amount_eur?: number;
    refund_reason?: string;
  },
): Promise<void> {
  await pool.query(
    `UPDATE orders
     SET status = 'refunded',
         refund_status = $2,
         refund_amount_eur = $3,
         refund_reason = $4,
         refunded_at = NOW()
     WHERE order_id = $1`,
    [
      orderId,
      fields.refund_status,
      fields.refund_amount_eur ?? null,
      fields.refund_reason ?? null,
    ],
  );
}
