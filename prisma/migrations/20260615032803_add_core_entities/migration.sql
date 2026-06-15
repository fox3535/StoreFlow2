-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "shopifyProductId" TEXT NOT NULL,
    "shopifyVariantId" TEXT NOT NULL,
    "sku" TEXT,
    "barcode" TEXT,
    "title" TEXT NOT NULL,
    "currentPrice" REAL NOT NULL DEFAULT 0,
    "currentQuantity" INTEGER NOT NULL DEFAULT 0,
    "avgCost" REAL NOT NULL DEFAULT 0,
    "avgLandedCost" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "leadTimeDays" INTEGER NOT NULL DEFAULT 0,
    "contactInfo" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SupplierSkuMapping" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "supplierSku" TEXT NOT NULL,
    "unitCost" REAL NOT NULL DEFAULT 0,
    "packSize" INTEGER NOT NULL DEFAULT 1,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "lastUsedCost" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SupplierSkuMapping_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SupplierSkuMapping_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Offer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "totalEstimatedCost" REAL NOT NULL DEFAULT 0,
    "eta" DATETIME,
    "endDate" DATETIME,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Offer_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OfferItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "offerId" TEXT NOT NULL,
    "productId" TEXT,
    "supplierSku" TEXT,
    "description" TEXT,
    "qtyReserved" INTEGER NOT NULL DEFAULT 0,
    "qtyFulfilled" INTEGER NOT NULL DEFAULT 0,
    "unitCost" REAL NOT NULL DEFAULT 0,
    CONSTRAINT "OfferItem_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "poNumber" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "exchangeRate" REAL NOT NULL DEFAULT 1,
    "subtotal" REAL NOT NULL DEFAULT 0,
    "freightCost" REAL NOT NULL DEFAULT 0,
    "tax" REAL NOT NULL DEFAULT 0,
    "discounts" REAL NOT NULL DEFAULT 0,
    "otherCosts" REAL NOT NULL DEFAULT 0,
    "adjustment" REAL NOT NULL DEFAULT 0,
    "totalLandedCost" REAL NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PurchaseOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PurchaseOrderLineItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "poId" TEXT NOT NULL,
    "productId" TEXT,
    "supplierSku" TEXT,
    "description" TEXT,
    "qtyOrdered" INTEGER NOT NULL DEFAULT 0,
    "qtyReceived" INTEGER NOT NULL DEFAULT 0,
    "qtyRejected" INTEGER NOT NULL DEFAULT 0,
    "qtyBackordered" INTEGER NOT NULL DEFAULT 0,
    "unitCost" REAL NOT NULL DEFAULT 0,
    "landedCostPerUnit" REAL NOT NULL DEFAULT 0,
    "action" TEXT NOT NULL DEFAULT 'restock',
    CONSTRAINT "PurchaseOrderLineItem_poId_fkey" FOREIGN KEY ("poId") REFERENCES "PurchaseOrder" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PurchaseOrderLineItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReceivingRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "poId" TEXT NOT NULL,
    "lineItemId" TEXT,
    "productId" TEXT,
    "qtyReceived" INTEGER NOT NULL DEFAULT 0,
    "qtyRejected" INTEGER NOT NULL DEFAULT 0,
    "qtyBackordered" INTEGER NOT NULL DEFAULT 0,
    "action" TEXT NOT NULL DEFAULT 'restock',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReceivingRecord_poId_fkey" FOREIGN KEY ("poId") REFERENCES "PurchaseOrder" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ReceivingRecord_lineItemId_fkey" FOREIGN KEY ("lineItemId") REFERENCES "PurchaseOrderLineItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ReceivingRecord_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Product_shop_sku_idx" ON "Product"("shop", "sku");

-- CreateIndex
CREATE INDEX "Product_shop_barcode_idx" ON "Product"("shop", "barcode");

-- CreateIndex
CREATE UNIQUE INDEX "Product_shop_shopifyVariantId_key" ON "Product"("shop", "shopifyVariantId");

-- CreateIndex
CREATE INDEX "Supplier_shop_idx" ON "Supplier"("shop");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_shop_name_key" ON "Supplier"("shop", "name");

-- CreateIndex
CREATE INDEX "SupplierSkuMapping_shop_idx" ON "SupplierSkuMapping"("shop");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierSkuMapping_shop_supplierId_supplierSku_key" ON "SupplierSkuMapping"("shop", "supplierId", "supplierSku");

-- CreateIndex
CREATE INDEX "Offer_shop_idx" ON "Offer"("shop");

-- CreateIndex
CREATE INDEX "Offer_shop_status_idx" ON "Offer"("shop", "status");

-- CreateIndex
CREATE INDEX "PurchaseOrder_shop_idx" ON "PurchaseOrder"("shop");

-- CreateIndex
CREATE INDEX "PurchaseOrder_shop_status_idx" ON "PurchaseOrder"("shop", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_shop_poNumber_key" ON "PurchaseOrder"("shop", "poNumber");

-- CreateIndex
CREATE INDEX "ReceivingRecord_shop_idx" ON "ReceivingRecord"("shop");

-- CreateIndex
CREATE INDEX "ReceivingRecord_poId_idx" ON "ReceivingRecord"("poId");
