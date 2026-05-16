-- Bảo vệ ledger: Transaction là sổ cái bất biến, chỉ được INSERT.
-- Nếu cần sửa sai, ghi một bút toán ADMIN_ADJUSTMENT mới thay vì UPDATE/DELETE dòng cũ.

CREATE OR REPLACE FUNCTION prevent_transaction_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Transaction ledger is immutable. Insert an ADMIN_ADJUSTMENT entry instead of updating or deleting existing rows.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "Transaction_prevent_update" ON "Transaction";
CREATE TRIGGER "Transaction_prevent_update"
BEFORE UPDATE ON "Transaction"
FOR EACH ROW
EXECUTE FUNCTION prevent_transaction_mutation();

DROP TRIGGER IF EXISTS "Transaction_prevent_delete" ON "Transaction";
CREATE TRIGGER "Transaction_prevent_delete"
BEFORE DELETE ON "Transaction"
FOR EACH ROW
EXECUTE FUNCTION prevent_transaction_mutation();
