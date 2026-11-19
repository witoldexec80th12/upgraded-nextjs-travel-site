/**
 * Generic Airtable client for the Orders pipeline.
 *
 * Env vars (set in your deployment environment):
 *   AIRTABLE_ORDERS_API_KEY  — Airtable Personal Access Token for the Orders base
 *   AIRTABLE_ORDERS_BASE_ID  — Base ID (starts with "app…")
 *   AIRTABLE_TABLE_NAME      — defaults to "Orders"
 *
 * See docs/pipeline/SETUP.md for the full column schema.
 */

// ── Types ────────────────────────────────────────────────────────────────────

/**
 * Fields written to the Airtable Orders table.
 * Per-ticket-type quantity fields use the pattern:
 *   "<TicketTypeLabel> Adults"  /  "<TicketTypeLabel> Children"
 * where TicketTypeLabel is the human-readable title from event.en.ts.
 *
 * Use an index signature so the webhook can write dynamic ticket-type columns
 * without casting.
 */
export interface AirtableOrderFields {
  "Order ID": string;
  "Status": string;                        // Confirmed | Refunded
  "Customer Email"?: string;
  "Customer Name"?: string;
  "Backup Email"?: string;
  "Phone"?: string;
  "Visit Date"?: string;                   // YYYY-MM-DD
  "Visit Time"?: string;
  "Total Adults": number;
  "Total Children": number;
  "Amount Charged (€)"?: number;
  "Shift ID"?: string;
  "Stripe Session ID"?: string;
  "Confirmed At"?: string;                 // ISO timestamp
  "Buyer Country"?: string;               // ISO-2, e.g. "IT"
  "Charge ID"?: string;
  "Stripe Gross (USD)"?: number;
  "Stripe Fee (USD)"?: number;
  "Stripe Net (USD)"?: number;
  "Stripe FX Rate"?: number;
  "Refund Status"?: "None" | "Partial" | "Full";
  "Refund Amount (€)"?: number;
  "Refund Amount (USD)"?: number;
  "Refund Reason"?: string;
  "Refunded At"?: string;
  "Notes"?: string;
  // Dynamic per-ticket-type quantity fields, e.g.:
  //   "Full Adults", "Full Children", "Courtyard Adults", "Courtyard Children"
  [key: string]: string | number | undefined;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function getConfig() {
  const apiKey = process.env.AIRTABLE_ORDERS_API_KEY ?? process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_ORDERS_BASE_ID ?? process.env.AIRTABLE_BASE_ID;
  const tableName = process.env.AIRTABLE_TABLE_NAME ?? "Orders";

  if (!apiKey || !baseId) return null;
  const cleanBaseId = baseId.match(/(app\w+)/)?.[1] ?? baseId;
  return { apiKey, baseId: cleanBaseId, tableName };
}

function baseUrl(cfg: NonNullable<ReturnType<typeof getConfig>>) {
  return `https://api.airtable.com/v0/${cfg.baseId}/${encodeURIComponent(cfg.tableName)}`;
}

async function airtableFetch(
  url: string,
  options: RequestInit,
  apiKey: string,
): Promise<Response> {
  return fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Create a new row in the Orders table.
 * Silently no-ops (with a warning) if env vars are missing.
 */
export async function createAirtableOrder(fields: AirtableOrderFields): Promise<void> {
  const cfg = getConfig();
  if (!cfg) {
    console.warn("[airtable:orders] Credentials not set — skipping order create");
    return;
  }
  console.log(`[airtable:orders] Creating record for order=${fields["Order ID"]} base=${cfg.baseId}`);

  const res = await airtableFetch(
    baseUrl(cfg),
    { method: "POST", body: JSON.stringify({ fields }) },
    cfg.apiKey,
  );

  if (!res.ok) {
    const body = await res.text();
    console.error(`[airtable:orders] Create failed ${res.status}:`, body);
  }
}

/**
 * Patch an existing Orders row, looked up by Order ID.
 * No-ops if the record isn't found (better than throwing, since refund
 * webhooks must always 200 back to Stripe to avoid retry storms).
 */
export async function updateAirtableOrder(
  orderId: string,
  fields: Partial<AirtableOrderFields>,
): Promise<void> {
  const cfg = getConfig();
  if (!cfg) {
    console.warn("[airtable:orders] Credentials not set — skipping order update");
    return;
  }

  const escapedId = orderId.replace(/'/g, "\\'");
  const lookupUrl =
    `${baseUrl(cfg)}?fields[]=Order+ID` +
    `&filterByFormula=${encodeURIComponent(`{Order ID}='${escapedId}'`)}` +
    `&maxRecords=1`;

  const lookupRes = await airtableFetch(lookupUrl, { method: "GET" }, cfg.apiKey);
  if (!lookupRes.ok) {
    console.error(`[airtable:orders] Lookup failed for order=${orderId}:`, await lookupRes.text());
    return;
  }

  const data = (await lookupRes.json()) as { records: { id: string }[] };
  const recordId = data.records[0]?.id;
  if (!recordId) {
    console.warn(`[airtable:orders] Record not found for order=${orderId} — skipping update`);
    return;
  }

  const patchRes = await airtableFetch(
    `${baseUrl(cfg)}/${recordId}`,
    { method: "PATCH", body: JSON.stringify({ fields }) },
    cfg.apiKey,
  );

  if (!patchRes.ok) {
    console.error(`[airtable:orders] Patch failed for order=${orderId}:`, await patchRes.text());
  }
}
