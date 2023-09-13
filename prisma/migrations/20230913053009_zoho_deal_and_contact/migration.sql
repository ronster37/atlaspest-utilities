/*
  Warnings:

  - You are about to drop the column `zoho_lead_id` on the `commercial_sales` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "commercial_sales" DROP COLUMN "zoho_lead_id",
ADD COLUMN     "zoho_contact_id" TEXT,
ADD COLUMN     "zoho_deal_id" TEXT;
