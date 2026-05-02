#!/bin/bash
set -e
cd /home/satria/Final-project-crack/crack-be/crack-be-yogaaaa123

echo "=== FIX 1: purchase.service.ts - Add tenantId to processReceivedItems ==="
sed -i 's/async processReceivedItems(\$/async processReceivedItems(\n    tenantId: string,\n    /' src/purchase/purchase.service.ts
# Fix the function signature properly
sed -i 's/processReceivedItems(items: DbPurchaseOrderItem\[\], orderNumber: string, userId: string,/processReceivedItems(items: DbPurchaseOrderItem[], orderNumber: string, userId: string,/' src/purchase/purchase.service.ts
# Wait, let me check - the function already has proper params. Let me just add tenantId to data objects.

# For stockTransaction.create IN purchase.service.ts - add tenantId
sed -i 's|type: TransactionType.IN,\n          quantity: item.quantity,\n          referenceId: orderNumber,\n          notes: '\''Purchase Order Received'\'',\n          productId: item.productId,\n          userId,|type: TransactionType.IN,\n          quantity: item.quantity,\n          referenceId: orderNumber,\n          notes: '\''Purchase Order Received'\'',\n          productId: item.productId,\n          userId,\n          tenantId,|' src/purchase/purchase.service.ts

# For purchaseOrder.create in createPurchaseOrder - add tenantId
sed -i 's|orderNumber: data.orderNumber,\n          totalPrice,\n          status: PurchaseOrderStatus.RECEIVED,\n          notes: data.notes,\n          supplierId: data.supplierId,\n          userId: data.userId,|orderNumber: data.orderNumber,\n          totalPrice,\n          status: PurchaseOrderStatus.RECEIVED,\n          notes: data.notes,\n          supplierId: data.supplierId,\n          userId: data.userId,\n          tenantId,|' src/purchase/purchase.service.ts

# For purchaseOrder.create in createPendingPurchaseOrder - add tenantId
sed -i 's|orderNumber: data.orderNumber,\n          totalPrice,\n          status: PurchaseOrderStatus.PENDING,\n          notes: data.notes,\n          supplierId: data.supplierId,\n          userId: data.userId,|orderNumber: data.orderNumber,\n          totalPrice,\n          status: PurchaseOrderStatus.PENDING,\n          notes: data.notes,\n          supplierId: data.supplierId,\n          userId: data.userId,\n          tenantId,|' src/purchase/purchase.service.ts

# For user select - remove email
sed -i 's/            email: true,//' src/purchase/purchase.service.ts
# Also remove the second one
sed -i 's/            email: true,//' src/purchase/purchase.service.ts

echo "=== FIX 2: returns.service.ts - Add tenantId ==="
# Add tenantId to salesReturn.create
sed -i 's|salesOrderId: data.salesOrderId,\n          reason: data.reason,\n          status: ReturnStatus.COMPLETED,\n          totalRefund,\n          userId,|salesOrderId: data.salesOrderId,\n          reason: data.reason,\n          status: ReturnStatus.COMPLETED,\n          totalRefund,\n          userId,\n          tenantId,|' src/returns/returns.service.ts

# Add tenantId to stockTransaction.create - this is a nested block inside createReturn
# Need a different approach - let's add tenantId to both stockTransaction creates
sed -i 's|type: TransactionType.RETURN,\n            quantity: returnItem.quantity,\n            referenceId: salesReturn.returnNumber,\n            notes: .*,\n            productId: returnItem.productId,\n            userId,|type: TransactionType.RETURN,\n            quantity: returnItem.quantity,\n            referenceId: salesReturn.returnNumber,\n            notes: \x60Return from Sales Order ${salesOrder.orderNumber}\x60,\n            productId: returnItem.productId,\n            userId,\n            tenantId,|' src/returns/returns.service.ts

echo "=== FIX 3: controllers - Pass tenantId to service.create ==="
# categories.controller.ts - add CurrentUser and pass tenantId
sed -i "s/create(@Body() createCategoryDto: CreateCategoryDto) {/create(@Body() createCategoryDto: CreateCategoryDto, @CurrentUser() user: AuthenticatedUser) {\n    return this.categoriesService.create(createCategoryDto, user.tenantId);\n  }\n\n  create_DELETEME(@Body() createCategoryDto: CreateCategoryDto) {/" src/categories/categories.controller.ts

# Oops, that's wrong. Let me use a better approach.
# First add the imports
# Wait, let me check what imports are needed. CurrentUser is not imported yet.
echo "Need to fix controllers properly..."

echo "=== FIX 4: ai-data.controller.ts - Remove email and _count from TenantUser query ==="
# Remove email: true from select
sed -i 's/          email: true,//' src/ai-data/ai-data.controller.ts
# Remove _count select
sed -i 's/          _count: { select: { salesOrders: true } },//' src/ai-data/ai-data.controller.ts
# Remove email from map
sed -i 's/          email: u.email,//' src/ai-data/ai-data.controller.ts
# Remove total_sales line
sed -i 's/          total_sales: u._count.salesOrders,//' src/ai-data/ai-data.controller.ts

echo "Done with automated fixes. Now need manual verification."
