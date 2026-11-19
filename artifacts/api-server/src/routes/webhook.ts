/**
 * POST /api/stripe-webhook
 *
 * Handles three Stripe events:
 *   checkout.session.completed  → save order to PostgreSQL + Airtable
 *   checkout.session.expired    → save abandonment to PostgreSQL
 *   charge.refunded             → mark order refunded in PostgreSQL + Airtable
 *
 * The route must receive the raw request body (Buffer) for signature
 * verification — see app.ts where express.raw() is mounted before express.json().
 *
 * Required env vars:
 *   STRIPE_SECRET_KEY
 *   STRIPE_WEBHOOK_SECRET
 *   DATABASE_URL
 *   AIRTABLE_ORDERS_API_KEY
 *   AIRTABLE_ORDERS_BASE_ID
 *   AIRTABLE_TABLE_NAME   (optional, defaults to "Orders")
 *
 * See docs/pipeline/SETUP.md for full setup instructions.
 */
import { Router, type Request, type Response } from "express";
import Stripe from "stripe";
import { saveOrder, saveAbandonment, markOrderRefunded } from "../lib/pipeline-db.js";
import { createAirtableOrder, updateAirtableOrder } from "../lib/airtable.js";

const router = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

function stripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY not set");
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

/** Compute total adults + children across all ticket types. */
function totals(quantities: Record<string, { adults: number; children: number }>) {
  let adults = 0;
  let children = 0;
  for (const q of Object.values(quantities)) {
    adults += q.adults ?? 0;
    children += q.children ?? 0;
  }
  return { adults, children };
}

/**
 * Parse the quantities that were encoded into Stripe session metadata.
 *
 * The /pay route sets metadata keys like:
 *   full_adults=2, full_children=0, courtyard_adults=1, courtyard_children=0
 *
 * This function reconstructs:
 *   { full: { adults: 2, children: 0 }, courtyard: { adults: 1, children: 0 } }
 *
 * It works for any number of ticket types — no hardcoding needed.
 */
function parseQuantities(
  meta: Stripe.Metadata,
): Record<string, { adults: number; children: number }> {
  const result: Record<string, { adults: number; children: number }> = {};
  for (const [key, val] of Object.entries(meta)) {
    const adultMatch = key.match(/^(.+)_adults$/);
    const childMatch = key.match(/^(.+)_children$/);
    if (adultMatch) {
      const id = adultMatch[1];
      if (!result[id]) result[id] = { adults: 0, children: 0 };
      result[id].adults = Number(val) || 0;
    }
    if (childMatch) {
      const id = childMatch[1];
      if (!result[id]) result[id] = { adults: 0, children: 0 };
      result[id].children = Number(val) || 0;
    }
  }
  return result;
}

/**
 * Build the per-ticket-type Airtable column fields.
 *
 * Given quantities = { full: { adults: 2, children: 0 }, courtyard: { adults: 1, children: 0 } }
 * and ticketLabels = { full: "Full", courtyard: "Courtyard" }
 *
 * Returns: { "Full Adults": 2, "Full Children": 0, "Courtyard Adults": 1, "Courtyard Children": 0 }
 *
 * ticketLabels comes from TICKET_TYPE_LABELS env var (JSON) or falls back to
 * capitalising the ticket type ID. Set it to match your Airtable column names.
 */
function buildQuantityColumns(
  quantities: Record<string, { adults: number; children: number }>,
): Record<string, number> {
  let labels: Record<string, string> = {};
  try {
    if (process.env.TICKET_TYPE_LABELS) labels = JSON.parse(process.env.TICKET_TYPE_LABELS);
  } catch {
    // ignore — fall back to capitalised ID
  }

  const cols: Record<string, number> = {};
  for (const [id, q] of Object.entries(quantities)) {
    const label = labels[id] ?? id.charAt(0).toUpperCase() + id.slice(1);
    cols[`${label} Adults`] = q.adults ?? 0;
    cols[`${label} Children`] = q.children ?? 0;
  }
  return cols;
}

/**
 * Retrieve settlement-currency (USD) details from the balance transaction
 * attached to the PaymentIntent's latest charge.
 */
async function getSettlement(
  s: Stripe,
  paymentIntentId: string,
): Promise<{
  grossUsd?: number;
  feeUsd?: number;
  netUsd?: number;
  fxRate?: number;
  cardCountry?: string;
  chargeId?: string;
}> {
  try {
    const pi = await s.paymentIntents.retrieve(paymentIntentId, {
      expand: ["latest_charge.balance_transaction"],
    });
    const charge = pi.latest_charge;
    if (charge && typeof charge !== "string") {
      const cardCountry = charge.payment_method_details?.card?.country ?? undefined;
      const bt = charge.balance_transaction;
      if (bt && typeof bt !== "string") {
        return {
          grossUsd: bt.amount / 100,
          feeUsd: bt.fee / 100,
          netUsd: bt.net / 100,
          fxRate: bt.exchange_rate ?? undefined,
          cardCountry: cardCountry as string | undefined,
          chargeId: charge.id,
        };
      }
      return { cardCountry: cardCountry as string | undefined, chargeId: charge.id };
    }
  } catch (err) {
    console.error("[webhook] Settlement lookup failed for PI", paymentIntentId, err);
  }
  return {};
}

// ── Event handlers ────────────────────────────────────────────────────────────

async function handleSessionCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const meta = session.metadata ?? {};
  const orderId = meta.order_id ?? session.id;
  const quantities = parseQuantities(meta);
  const { adults, children } = totals(quantities);
  const amountEur = session.amount_total != null ? session.amount_total / 100 : undefined;

  // Retrieve settlement details (best-effort — order is still saved if this fails)
  const s = stripe();
  const piId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
  const settlement = piId ? await getSettlement(s, piId) : {};

  // 1. PostgreSQL
  await saveOrder({
    order_id: orderId,
    stripe_session_id: session.id,
    stripe_payment_intent_id: piId,
    charge_id: settlement.chargeId,
    status: "confirmed",
    locale: session.locale ?? undefined,
    visit_date: meta.visit_date,
    visit_time: meta.visit_time,
    shift_id: meta.shift_id,
    quantities,
    total_adults: adults,
    total_children: children,
    amount_eur: amountEur,
    customer_email: session.customer_details?.email ?? undefined,
    customer_name: session.customer_details?.name ?? undefined,
    backup_email: meta.backup_email,
    phone: meta.phone ?? session.customer_details?.phone ?? undefined,
    buyer_country: settlement.cardCountry,
    gclid: meta.gclid,
    fbclid: meta.fbclid,
    gross_usd: settlement.grossUsd,
    fee_usd: settlement.feeUsd,
    net_usd: settlement.netUsd,
    fx_rate: settlement.fxRate,
  });

  // 2. Airtable
  await createAirtableOrder({
    "Order ID": orderId,
    "Status": "Confirmed",
    "Customer Email": session.customer_details?.email ?? undefined,
    "Customer Name": session.customer_details?.name ?? undefined,
    "Backup Email": meta.backup_email,
    "Phone": meta.phone ?? session.customer_details?.phone ?? undefined,
    "Visit Date": meta.visit_date,
    "Visit Time": meta.visit_time,
    "Total Adults": adults,
    "Total Children": children,
    "Amount Charged (€)": amountEur,
    "Shift ID": meta.shift_id,
    "Stripe Session ID": session.id,
    "Confirmed At": new Date().toISOString(),
    "Buyer Country": settlement.cardCountry,
    "Charge ID": settlement.chargeId,
    "Stripe Gross (USD)": settlement.grossUsd,
    "Stripe Fee (USD)": settlement.feeUsd,
    "Stripe Net (USD)": settlement.netUsd,
    "Stripe FX Rate": settlement.fxRate,
    "Refund Status": "None",
    ...buildQuantityColumns(quantities),
  });

  console.log(`[webhook] Order confirmed: ${orderId} €${amountEur} adults=${adults} children=${children}`);
}

async function handleSessionExpired(session: Stripe.Checkout.Session): Promise<void> {
  const meta = session.metadata ?? {};
  const quantities = parseQuantities(meta);

  await saveAbandonment({
    stripe_session_id: session.id,
    order_id: meta.order_id,
    visit_date: meta.visit_date,
    visit_time: meta.visit_time,
    shift_id: meta.shift_id,
    locale: session.locale ?? undefined,
    quantities,
    intended_amount_eur: session.amount_total != null ? session.amount_total / 100 : undefined,
    customer_email: session.customer_details?.email ?? undefined,
    gclid: meta.gclid,
    fbclid: meta.fbclid,
  });

  console.log(`[webhook] Abandonment saved: session=${session.id}`);
}

async function handleChargeRefunded(charge: Stripe.Charge): Promise<void> {
  const orderId = charge.metadata?.order_id ?? charge.payment_intent?.toString();
  if (!orderId) {
    console.warn("[webhook] charge.refunded has no order_id in metadata — skipping");
    return;
  }

  const refundedAmount = charge.amount_refunded / 100;
  const totalAmount = charge.amount / 100;
  const isFullRefund = charge.amount_refunded >= charge.amount;
  const refundStatus = isFullRefund ? "full" : "partial";
  const refundReason = charge.refunds?.data?.[0]?.reason ?? undefined;

  await markOrderRefunded(orderId, {
    refund_status: refundStatus,
    refund_amount_eur: refundedAmount,
    refund_reason: refundReason ?? undefined,
  });

  await updateAirtableOrder(orderId, {
    "Status": "Refunded",
    "Refund Status": isFullRefund ? "Full" : "Partial",
    "Refund Amount (€)": refundedAmount,
    "Refund Reason": refundReason ?? undefined,
    "Refunded At": new Date().toISOString(),
  });

  console.log(`[webhook] Refund processed: order=${orderId} amount=€${refundedAmount} status=${refundStatus}`);
}

// ── Route ─────────────────────────────────────────────────────────────────────

router.post("/stripe-webhook", async (req: Request, res: Response) => {
  const sig = req.headers["stripe-signature"];
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secret) {
    console.error("[webhook] STRIPE_WEBHOOK_SECRET not set");
    res.status(500).json({ error: "Webhook secret not configured" });
    return;
  }

  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(req.body as Buffer, sig as string, secret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Signature verification failed";
    console.error("[webhook] Signature error:", message);
    res.status(400).json({ error: message });
    return;
  }

  // Always 200 immediately — handle async so Stripe doesn't retry on slow ops
  res.json({ received: true });

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleSessionCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case "checkout.session.expired":
        await handleSessionExpired(event.data.object as Stripe.Checkout.Session);
        break;
      case "charge.refunded":
        await handleChargeRefunded(event.data.object as Stripe.Charge);
        break;
      default:
        // Ignore all other events
        break;
    }
  } catch (err) {
    // Log but don't re-throw — Stripe already got its 200
    console.error(`[webhook] Handler error for ${event.type}:`, err);
  }
});

export default router;
