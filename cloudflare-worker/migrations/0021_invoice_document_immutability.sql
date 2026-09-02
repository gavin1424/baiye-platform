-- An issued invoice is a documentary record. Refunds must create a void or
-- allowance trail instead of replacing the original provider reference.
CREATE TRIGGER IF NOT EXISTS trg_invoices_document_immutable_update
BEFORE UPDATE OF merchant_id, order_id, invoice_request_id, provider, provider_invoice_id, invoice_number, invoice_date, random_number ON invoices
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'issued invoice document fields are immutable');
END;
CREATE TRIGGER IF NOT EXISTS trg_invoices_document_immutable_delete
BEFORE DELETE ON invoices
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'issued invoices cannot be deleted');
END;
