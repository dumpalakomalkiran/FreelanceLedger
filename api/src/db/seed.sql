DO $seed$
DECLARE
  client_ids integer[] := '{}';
  client_names text[] := ARRAY['Loom Studio','Cedar Press','Harbor Works'];
  project_names text[] := ARRAY['Studio catalogue','Spring journal','Workshop site','Type library','Field guide'];
  owners integer[] := ARRAY[1,2,3,1,2];
  rates bigint[] := ARRAY[120000,6500,9000,80000,7200];
  subtotals bigint[] := ARRAY[240000,13000,18000,160000];
  taxes bigint[] := ARRAY[43200,0,900,28800];
  basis_points integer[] := ARRAY[1800,0,500,1800];
  statuses text[] := ARRAY['paid','sent','paid','draft'];
  activities text[] := ARRAY['Discovery','Research','First draft','Review','Revisions','Layout','Planning','Delivery'];
  client_key integer;
  project_key integer;
  invoice_key integer;
  issue_day date;
BEGIN
  LOCK TABLE clients, projects, invoices, invoice_counters, time_entries, invoice_lines
    IN SHARE ROW EXCLUSIVE MODE;
  IF EXISTS (SELECT FROM clients) OR EXISTS (SELECT FROM invoice_counters) THEN
    RAISE NOTICE 'Existing ledger preserved. Seed requires an empty ledger.';
    RETURN;
  END IF;
  FOR i IN 1..3 LOOP
    INSERT INTO clients (name, email, currency)
    VALUES (client_names[i], 'studio' || i || '@example.com', 'INR')
    RETURNING id INTO client_key;
    client_ids := array_append(client_ids, client_key);
  END LOOP;
  FOR p IN 1..5 LOOP
    INSERT INTO projects (client_id, name, default_hourly_rate_minor)
    VALUES (client_ids[owners[p]], project_names[p], rates[p])
    RETURNING id INTO project_key;
    invoice_key := NULL;
    IF p <= 4 THEN
      issue_day := date '2026-01-20' + p;
      INSERT INTO invoices (number, client_id, currency, issue_date, due_date,
        tax_rate_bps, subtotal_minor, tax_minor, total_minor, status, paid_on, created_at)
      VALUES ('INV-2026-' || lpad(p::text, 4, '0'), client_ids[owners[p]], 'INR',
        issue_day, issue_day + 14, basis_points[p], subtotals[p], taxes[p],
        subtotals[p] + taxes[p], statuses[p],
        CASE WHEN statuses[p] = 'paid' THEN issue_day + 7 END,
        issue_day::timestamp AT TIME ZONE 'UTC')
      RETURNING id INTO invoice_key;
      INSERT INTO invoice_lines (invoice_id, description, quantity_minutes, unit_rate_minor, amount_minor)
      VALUES (invoice_key, project_names[p], 120, rates[p], subtotals[p]);
    END IF;
    FOR n IN 1..8 LOOP
      INSERT INTO time_entries (project_id, entry_date, minutes, description, billable,
        hourly_rate_override_minor, invoice_id)
      VALUES (project_key, date '2026-01-01' + p + (n-1)*7,
        CASE WHEN n <= 2 THEN 60 ELSE 15*n END, activities[n], n <> 7,
        CASE WHEN n = 5 THEN rates[p] + 500 END,
        CASE WHEN n <= 2 THEN invoice_key END);
    END LOOP;
  END LOOP;
  INSERT INTO invoice_counters VALUES (2026, 4);
END;
$seed$;
