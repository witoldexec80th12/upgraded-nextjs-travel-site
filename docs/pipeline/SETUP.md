# Stripe → PostgreSQL → Airtable Pipeline Setup

This guide gets your orders logging to both PostgreSQL and Airtable in about 15 minutes.
When a visitor completes payment, Stripe fires a webhook that the API server handles —
saving the booking to your database and creating a row in Airtable automatically.

---

## Overview

```
Visitor pays via Stripe Checkout
        ↓
Stripe fires webhook → POST /api/stripe-webhook
        ↓               ↓
   PostgreSQL        Airtable
   (orders table)   (Orders table)
```

Three Stripe events are handled:

| Event | What happens |
|---|---|
| `checkout.session.completed` | Order saved + Airtable row created |
| `checkout.session.expired` | Abandonment row saved (PostgreSQL only) |
| `charge.refunded` | Order marked refunded in both |

---

## Step 1 — PostgreSQL

Open your database's **SQL editor** (Replit DB tab, Supabase, Neon, etc.) and paste the contents of `docs/pipeline/orders.sql`. Run it. Two tables are created: `orders` and `checkout_abandonments`.

That's it for PostgreSQL — no further changes needed unless you want the optional analytics queries at the bottom of the SQL file.

---

## Step 2 — Airtable

### 2a. Create a new Base

Create a new Airtable base (name it anything — e.g. "Event Orders").

### 2b. Create the Orders table

Rename the default "Table 1" to **`Orders`** and create the following fields:

> **Tip:** The default first field becomes the primary field. Set it to "Order ID" (Single line text) as shown below.

#### Fixed fields (create these exactly as named)

| Field name | Airtable field type | Notes |
|---|---|---|
| `Order ID` | Single line text | **Primary field.** Set as primary. |
| `Status` | Single select | Options: `Confirmed`, `Refunded` |
| `Customer Email` | Email | |
| `Customer Name` | Single line text | |
| `Backup Email` | Email | Collected in-app before Stripe redirect |
| `Phone` | Phone number | |
| `Visit Date` | Date | Format: ISO (YYYY-MM-DD) |
| `Visit Time` | Single line text | e.g. `09:00` |
| `Total Adults` | Number | Integer |
| `Total Children` | Number | Integer |
| `Amount Charged (€)` | Currency | Currency: EUR, 2 decimal places |
| `Shift ID` | Single line text | |
| `Stripe Session ID` | Single line text | |
| `Confirmed At` | Date | Include time |
| `Buyer Country` | Single line text | ISO-2 code, e.g. `IT` |
| `Charge ID` | Single line text | |
| `Stripe Gross (USD)` | Currency | Currency: USD, 2 decimal places |
| `Stripe Fee (USD)` | Currency | Currency: USD, 2 decimal places |
| `Stripe Net (USD)` | Currency | Currency: USD, 2 decimal places |
| `Stripe FX Rate` | Number | 6 decimal places |
| `Refund Status` | Single select | Options: `None`, `Partial`, `Full` |
| `Refund Amount (€)` | Currency | Currency: EUR, 2 decimal places |
| `Refund Amount (USD)` | Currency | Currency: USD, 2 decimal places |
| `Refund Reason` | Single line text | |
| `Refunded At` | Date | Include time |
| `Notes` | Long text | Free-form operator notes |

#### Per-ticket-type quantity fields

Add one pair of fields **for each ticket type** in your `event.en.ts`:

| Field name | Airtable field type |
|---|---|
| `{Ticket Title} Adults` | Number (Integer) |
| `{Ticket Title} Children` | Number (Integer) |

**Default template (two ticket types):**

| Field name | Type |
|---|---|
| `Full Adults` | Number |
| `Full Children` | Number |
| `Courtyard Adults` | Number |
| `Courtyard Children` | Number |

**Example with five ticket types:**

| Field name | Type |
|---|---|
| `Standard Adults` | Number |
| `Standard Children` | Number |
| `Premium Adults` | Number |
| `Premium Children` | Number |
| `VIP Adults` | Number |
| `VIP Children` | Number |
| `Family Adults` | Number |
| `Family Children` | Number |
| `School Adults` | Number |
| `School Children` | Number |

### 2c. How column names are matched

The webhook maps Airtable column names from ticket type IDs using the `TICKET_TYPE_LABELS` env var (see Step 4). If you don't set it, the webhook capitalises the ticket type ID:

- `full` → `"Full Adults"` / `"Full Children"`
- `courtyard` → `"Courtyard Adults"` / `"Courtyard Children"`
- `vip` → `"Vip Adults"` / `"Vip Children"`

If your Airtable column name doesn't match the auto-capitalised version, set `TICKET_TYPE_LABELS` explicitly.

### 2d. Get your Airtable credentials

1. Go to [airtable.com/create/tokens](https://airtable.com/create/tokens)
2. Create a Personal Access Token with **data.records:write** and **schema.bases:read** scopes on your new base
3. Copy the Base ID from the base URL: `https://airtable.com/appXXXXXXXX/...` → `appXXXXXXXX`

---

## Step 3 — Register the Stripe Webhook

1. In your Stripe Dashboard, go to **Developers → Webhooks → Add endpoint**
2. Endpoint URL: `https://your-deployed-domain.com/api/stripe-webhook`
   (During development, use [Stripe CLI](https://stripe.com/docs/stripe-cli): `stripe listen --forward-to localhost:PORT/api/stripe-webhook`)
3. Select these events:
   - `checkout.session.completed`
   - `checkout.session.expired`
   - `charge.refunded`
4. Copy the **Signing secret** (starts with `whsec_`)

---

## Step 4 — Set Environment Variables

Add these to your deployment environment (Replit Secrets, Vercel env vars, etc.):

```
# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# PostgreSQL (Replit DB provides this automatically)
DATABASE_URL=postgresql://...

# Airtable — Orders base
AIRTABLE_ORDERS_API_KEY=pat...
AIRTABLE_ORDERS_BASE_ID=appXXXXXXXX
AIRTABLE_TABLE_NAME=Orders          # optional, defaults to "Orders"

# Ticket type labels — only needed if your Airtable column names
# don't match the auto-capitalised ticket type IDs.
# JSON object: { "ticketTypeId": "Airtable Column Prefix" }
# Example for the default two types (this is what the webhook uses if not set):
TICKET_TYPE_LABELS={"full":"Full","courtyard":"Courtyard"}

# Example for five types:
# TICKET_TYPE_LABELS={"standard":"Standard","premium":"Premium","vip":"VIP","family":"Family","school":"School"}
```

---

## Step 5 — Wire your /pay route

Your `/pay` route (the one that creates the Stripe Checkout Session) must embed quantities in the session `metadata` using this key pattern:

```
{ticketTypeId}_adults={count}
{ticketTypeId}_children={count}
```

**Example for two ticket types:**
```ts
metadata: {
  order_id: orderId,
  visit_date: "2026-08-15",
  visit_time: "09:00",
  shift_id: "shift_abc",
  full_adults: "2",
  full_children: "0",
  courtyard_adults: "1",
  courtyard_children: "0",
}
```

The webhook automatically detects all `_adults` / `_children` keys regardless of how many ticket types there are. Adding a new ticket type requires only:
1. Adding the Airtable column pair
2. Passing the new metadata key from `/pay`
3. Updating `TICKET_TYPE_LABELS` if needed

No webhook code changes required.

---

## Verifying the setup

1. Use **Stripe CLI** to replay a test event:
   ```
   stripe trigger checkout.session.completed
   ```
2. Check your API server logs — you should see:
   ```
   [webhook] Order confirmed: order_xxx €25.00 adults=2 children=0
   [airtable:orders] Creating record for order=order_xxx base=appXXXXXXXX
   ```
3. Check your Airtable base — a new row should appear in the Orders table
4. Check your PostgreSQL `orders` table — a new row should appear

---

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Webhook returns 400 | `STRIPE_WEBHOOK_SECRET` is wrong or not set |
| Orders not appearing in Airtable | `AIRTABLE_ORDERS_API_KEY` / `AIRTABLE_ORDERS_BASE_ID` missing or wrong workspace |
| Column name mismatch in Airtable | Ticket type labels don't match — set `TICKET_TYPE_LABELS` |
| Orders table doesn't exist | Run `docs/pipeline/orders.sql` in your PostgreSQL SQL editor |
| Settlement fields blank (Gross/Fee/Net USD) | Balance transaction not yet settled — normal, populates within minutes |

---

## Adding or renaming ticket types

1. **event.en.ts** — add/rename entries in `ticketTypes` array
2. **Airtable** — add/rename the `{Label} Adults` / `{Label} Children` column pair
3. **TICKET_TYPE_LABELS** env var — add the new `id → label` mapping
4. **PostgreSQL** — no change needed (quantities stored as JSONB)
5. **Stripe /pay metadata** — pass the new `{id}_adults` / `{id}_children` keys
