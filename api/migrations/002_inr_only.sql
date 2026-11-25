-- Preserve the demo ledger's numeric amounts when switching to rupees.
UPDATE clients SET currency = 'INR' WHERE currency <> 'INR';
UPDATE invoices SET currency = 'INR' WHERE currency <> 'INR';

ALTER TABLE clients
    DROP CONSTRAINT clients_currency_check,
    ALTER COLUMN currency SET DEFAULT 'INR',
    ADD CONSTRAINT clients_currency_check CHECK (currency = 'INR');

ALTER TABLE invoices
    DROP CONSTRAINT invoices_currency_check,
    ALTER COLUMN currency SET DEFAULT 'INR',
    ADD CONSTRAINT invoices_currency_check CHECK (currency = 'INR');
