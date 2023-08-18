-- CreateTable
CREATE TABLE "commercial_sales" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "zoho_lead_id" TEXT NOT NULL,
    "arc_site_project_id" TEXT NOT NULL,
    "zoho_sign_document_request_id" TEXT NOT NULL,
    "pest_routes_customer_id" INTEGER NOT NULL,

    CONSTRAINT "commercial_sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "global_settings" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "global_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "commercial_sales_arc_site_project_id_key" ON "commercial_sales"("arc_site_project_id");

-- CreateIndex
CREATE UNIQUE INDEX "commercial_sales_zoho_sign_document_request_id_key" ON "commercial_sales"("zoho_sign_document_request_id");

-- CreateIndex
CREATE UNIQUE INDEX "commercial_sales_pest_routes_customer_id_key" ON "commercial_sales"("pest_routes_customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "global_settings_key_key" ON "global_settings"("key");
