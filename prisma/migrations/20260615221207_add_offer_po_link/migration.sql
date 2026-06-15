-- AlterTable
ALTER TABLE "PurchaseOrder" ADD COLUMN     "offerId" TEXT;

-- CreateIndex
CREATE INDEX "PurchaseOrder_offerId_idx" ON "PurchaseOrder"("offerId");

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
