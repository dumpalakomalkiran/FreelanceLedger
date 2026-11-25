# FreelanceLedger plan

A pnpm workspace with an Angular web client, a TypeScript Express API and PostgreSQL 16.

## Layout

```text
api/migrations/
api/src/{db,domain,repositories,routes,services}/
api/test/
web/src/app/{api,pages,shared}/
scripts/setup-db.sh
```

## API

| Path | Methods |
|---|---|
| /api/clients | GET, POST |
| /api/clients/:id | GET, PATCH |
| /api/projects | GET, POST |
| /api/projects/:id | GET, PATCH (including archive) |
| /api/time-entries | GET, POST |
| /api/time-entries/:id | GET, PATCH, DELETE |
| /api/invoices | GET |
| /api/invoices/from-unbilled-time | POST |
| /api/invoices/:id | GET, DELETE (draft) |
| /api/invoices/:id/status | PATCH |

Creation groups eligible time by effective rate, rounds each line half up, and computes tax once on the subtotal. Entry selection, yearly numbering, invoice lines and attachments share one transaction. Only draft → sent and sent → paid are valid transitions.

## Planned schema

```sql
CREATE TABLE clients (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 200),
  email text NOT NULL CHECK (length(btrim(email)) BETWEEN 1 AND 254),
  currency text NOT NULL CHECK (currency IN ('INR','USD')),
  payment_terms_days integer NOT NULL DEFAULT 14 CHECK (payment_terms_days BETWEEN 0 AND 3650)
);

CREATE TABLE projects (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  client_id integer NOT NULL REFERENCES clients,
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 200),
  default_hourly_rate_minor bigint NOT NULL CHECK (default_hourly_rate_minor >= 0),
  archived boolean NOT NULL DEFAULT false
);
CREATE INDEX projects_client_id_idx ON projects (client_id, id);

CREATE TABLE invoice_counters (
  calendar_year integer PRIMARY KEY CHECK (calendar_year BETWEEN 1 AND 9999),
  last_number bigint NOT NULL CHECK (last_number > 0)
);

CREATE TABLE invoices (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  number text NOT NULL UNIQUE CHECK (number ~ '^INV-[0-9]{4}-[0-9]{4,}$'),
  client_id integer NOT NULL REFERENCES clients,
  currency text NOT NULL CHECK (currency IN ('INR','USD')),
  issue_date date NOT NULL,
  due_date date NOT NULL CHECK (due_date >= issue_date),
  tax_rate_bps integer NOT NULL DEFAULT 0 CHECK (tax_rate_bps BETWEEN 0 AND 10000),
  subtotal_minor bigint NOT NULL CHECK (subtotal_minor >= 0),
  tax_minor bigint NOT NULL CHECK (tax_minor >= 0),
  total_minor bigint NOT NULL CHECK (total_minor >= 0),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','paid')),
  paid_on date,
  created_at timestamptz NOT NULL,
  CHECK ((status = 'paid') = (paid_on IS NOT NULL)),
  CHECK (total_minor::numeric = subtotal_minor::numeric + tax_minor),
  CHECK (substring(number FROM 5 FOR 4)::integer = extract(year FROM issue_date))
);
CREATE INDEX invoices_client_date_idx ON invoices (client_id, issue_date DESC, id DESC);
CREATE INDEX invoices_status_date_idx ON invoices (status, issue_date DESC, id DESC);

CREATE TABLE time_entries (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project_id integer NOT NULL REFERENCES projects,
  entry_date date NOT NULL,
  minutes integer NOT NULL CHECK (minutes > 0),
  description text NOT NULL CHECK (length(btrim(description)) BETWEEN 1 AND 2000),
  billable boolean NOT NULL DEFAULT true,
  hourly_rate_override_minor bigint CHECK (hourly_rate_override_minor >= 0),
  invoice_id integer REFERENCES invoices ON DELETE SET NULL,
  CHECK (invoice_id IS NULL OR billable)
);
CREATE INDEX time_entries_project_date_idx ON time_entries (project_id, entry_date, id);
CREATE INDEX time_entries_unbilled_idx ON time_entries (project_id, entry_date, id)
  WHERE billable AND invoice_id IS NULL;
CREATE INDEX time_entries_invoice_idx ON time_entries (invoice_id) WHERE invoice_id IS NOT NULL;

CREATE TABLE invoice_lines (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  invoice_id integer NOT NULL REFERENCES invoices ON DELETE CASCADE,
  description text NOT NULL CHECK (length(btrim(description)) BETWEEN 1 AND 2000),
  quantity_minutes bigint NOT NULL CHECK (quantity_minutes > 0),
  unit_rate_minor bigint NOT NULL CHECK (unit_rate_minor >= 0),
  amount_minor bigint NOT NULL CHECK (amount_minor >= 0),
  UNIQUE (invoice_id, unit_rate_minor)
);
```
