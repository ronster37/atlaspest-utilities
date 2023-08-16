-- CreateTable
CREATE TABLE "commercial_sales" (
    "id" SERIAL NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "zoho_lead_id" TEXT NOT NULL,
    "arc_site_project_id" TEXT NOT NULL,
    "zoho_sign_document_request_id" TEXT NOT NULL,
    "pest_routes_customer_id" TEXT NOT NULL,

    CONSTRAINT "commercial_sales_pkey" PRIMARY KEY ("id")
);
