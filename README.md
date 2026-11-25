# FreelanceLedger

FreelanceLedger is a local, single-user workspace for a freelancer. Create a client, add a project with an hourly rate, and record time against it. From **Invoices**, select a project and date range to turn its unbilled work into a draft. Review its lines, print it, and mark it sent and then paid.

## Prerequisites

Use Ubuntu 24.04, Node.js **22.22.3 or later within 22.x**, pnpm **10.x** and PostgreSQL **16**, including its local service and `psql` client. Run the commands as your regular Ubuntu user with sudo access. The setup script starts PostgreSQL and creates a role matching your Ubuntu username, plus separate development and test databases. Connections use the local Unix socket.

## Clean-machine setup and verification

From the repository root, run these commands in order. If you downloaded the source archive, enter the extracted `FreelanceLedger` directory first.

```bash
node --version
pnpm --version
psql --version
pnpm install --frozen-lockfile
pnpm db:setup
pnpm db:migrate
pnpm db:seed
pnpm typecheck:api
pnpm build:web
pnpm test
pnpm dev
```

Open **http://localhost:4200**. The development server forwards `/api` requests to **http://127.0.0.1:3000**. Keep the terminal open while using the app. Press Ctrl+C to stop both servers.

On a fresh development database, the January–February 2026 seed gives you **3 clients, 5 projects, 40 time entries and 4 invoices**. Repeating setup, migration and seed preserves your data. To check the proxy from a second terminal while the app is running:

```bash
node --input-type=module -e "const r = await fetch('http://localhost:4200/api/invoices'); if (!r.ok) throw Error(String(r.status)); console.table((await r.json()).map(({number,status,total_minor,currency}) => ({number,status,total_minor,currency})))"
```

## Local configuration

The default settings work as supplied. To customize them, copy the example once, edit your copy, and export the values in each terminal that runs project commands.

```bash
cp -n .env.example .env
set -a
. ./.env
set +a
```

| Variable | Default | Used for |
| --- | --- | --- |
| `LEDGER_DB` | `freelanceledger` | Development data |
| `LEDGER_TEST_DB` | `freelanceledger_test` | Integration tests. Choose a different name from the development database. |
| `PGPORT` | `5432` | Local PostgreSQL cluster port |
| `PORT` | `3000` | API listener. If changed, update the target in `web/proxy.conf.json` to match. |

## Tests and project layout

`pnpm test:api` runs the money, status, HTTP and PostgreSQL integration tests. Each integration run uses a separate schema in the test database and removes it afterward. The tests exercise concurrent invoice creation, draft deletion, time-entry locking and rollback. `pnpm test:web` runs Angular's headless Vitest suite. `pnpm test` runs both suites.

| Path | Contents |
| --- | --- |
| `api/src/routes/` | Express endpoints and Zod request validation |
| `api/src/services/`, `api/src/repositories/` | Business operations, transactions and parameterized SQL |
| `api/src/domain/`, `api/src/clock.ts` | Integer arithmetic, status transitions and injectable clock |
| `api/migrations/`, `api/src/db/` | SQL migrations, runner, connection configuration and deterministic seed |
| `api/test/` | API unit and integration tests |
| `web/src/app/` | Standalone Angular shell, lazy-loaded pages, typed forms, HTTP services, money pipe and component tests |
| `scripts/setup-db.sh` | Local PostgreSQL role and database setup |

## Money, dates and invoice rules

FreelanceLedger uses INR exclusively. Rates and amounts use integer paise. The API accepts and returns monetary fields as decimal integer **strings**. For example, `"6500"` represents ₹65.00. Enter **65.00** in the project's hourly-rate field. The browser converts it to minor units before submitting.

For each eligible time entry, the API takes its rate override if present, including zero. Otherwise it takes the project's current default rate. It groups entries by rate and sums each group's minutes before rounding. For nonnegative values, the following formulas use integer division:

- **Line amount:** `(group_minutes × hourly_rate_minor + 30) / 60`
- **Subtotal:** Sum of the rounded line amounts.
- **Tax:** `(subtotal_minor × tax_rate_bps + 5000) / 10000`
- **Total:** Subtotal plus tax. One hundred basis points equals one percent.

For example, two one-minute entries at 15 minor units per hour form one two-minute line. Its exact amount is half a minor unit, which rounds up to **1**. The API calculates tax once on the invoice subtotal. It stores the resulting amounts so that later rate edits leave the issued figures intact.

Dates use `YYYY-MM-DD`. Both ends of a billing range are inclusive. An omitted issue date uses the clock's UTC calendar date. The due date adds the client's payment terms in calendar days. Draft creation assigns a number within the issue year's sequence, inserts the lines and attaches the time entries in one transaction. Only a draft can be deleted, which makes its entries available again. Marking a sent invoice paid records the payment date.

## HTTP API

Paths below include the `/api` prefix. List endpoints return JSON arrays. Creates return 201, reads and edits return 200, and successful deletes return 204.

| Method | Path | Operation |
| --- | --- | --- |
| GET, POST | `/api/clients` | List clients or create one with name, email and optional payment terms. The only supported currency is INR. |
| GET, PATCH | `/api/clients/:id` | Read or edit a client |
| GET, POST | `/api/projects` | Filter by `client_id` and `archived`, or create a project |
| GET, PATCH | `/api/projects/:id` | Read, edit, archive or restore a project |
| GET, POST | `/api/time-entries` | List filtered entries or record time. Filters include `client_id`, `project_id`, `from`, `to`, `billable` and `invoiced`. |
| GET, PATCH, DELETE | `/api/time-entries/:id` | Read an entry. Edits and deletes require an unattached entry. |
| GET | `/api/invoices` | List summaries, optionally filtered by `client_id` and `status` |
| POST | `/api/invoices/from-unbilled-time` | Create a draft with `project_id`, `from`, `to`, optional `issue_date` and optional `tax_rate_bps` |
| GET, DELETE | `/api/invoices/:id` | Read invoice detail with lines and totals, or delete a draft |
| PATCH | `/api/invoices/:id/status` | Submit `{"status":"sent"}` for a draft or `{"status":"paid"}` for a sent invoice |

Errors use `{"error":{"code":"…","message":"…"}}` and may include a `details` field inside `error`. Invalid inputs return 400, missing records return 404, and conflicts with record state return 409. A billing range containing no eligible entries returns 422 with code `NOTHING_TO_BILL`.
