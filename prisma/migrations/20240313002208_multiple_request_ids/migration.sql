-- AlterTable
ALTER TABLE
    "commercial_sales"
ADD
    COLUMN "zoho_sign_document_request_ids" TEXT [] DEFAULT ARRAY [] :: TEXT [];

UPDATE
    "commercial_sales"
SET
    "zoho_sign_document_request_ids" = COALESCE(ARRAY ["zoho_sign_document_request_id"], '{}')
WHERE
    zoho_sign_document_request_id IS NOT NULL;