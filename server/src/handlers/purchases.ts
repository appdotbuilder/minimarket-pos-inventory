
import { db } from '../db';
import { 
  purchasesTable, 
  purchaseItemsTable, 
  productsTable, 
  stockMovementsTable,
  suppliersTable 
} from '../db/schema';
import { type Purchase, type PurchaseItem, type CreatePurchaseInput } from '../schema';
import { eq, desc } from 'drizzle-orm';

export const createPurchase = async (input: CreatePurchaseInput): Promise<{ purchase: Purchase; items: PurchaseItem[] }> => {
  try {
    // Verify supplier exists
    const supplier = await db.select()
      .from(suppliersTable)
      .where(eq(suppliersTable.id, input.supplier_id))
      .execute();

    if (supplier.length === 0) {
      throw new Error(`Supplier with id ${input.supplier_id} not found`);
    }

    // Verify all products exist
    for (const item of input.items) {
      const product = await db.select()
        .from(productsTable)
        .where(eq(productsTable.id, item.product_id))
        .execute();

      if (product.length === 0) {
        throw new Error(`Product with id ${item.product_id} not found`);
      }
    }

    // Calculate total amount
    const totalAmount = input.items.reduce((sum, item) => sum + (item.quantity * item.unit_cost), 0);

    // Generate purchase number
    const purchaseNumber = `PO-${Date.now()}`;

    // Create purchase record
    const purchaseResult = await db.insert(purchasesTable)
      .values({
        supplier_id: input.supplier_id,
        purchase_number: purchaseNumber,
        total_amount: totalAmount.toString(),
        status: 'completed',
        created_by: input.created_by
      })
      .returning()
      .execute();

    const createdPurchase = purchaseResult[0];

    // Create purchase items
    const purchaseItemsData = input.items.map(item => ({
      purchase_id: createdPurchase.id,
      product_id: item.product_id,
      quantity: item.quantity,
      unit_cost: item.unit_cost.toString(),
      total_cost: (item.quantity * item.unit_cost).toString()
    }));

    const itemsResult = await db.insert(purchaseItemsTable)
      .values(purchaseItemsData)
      .returning()
      .execute();

    // Update stock quantities and create stock movements
    for (const item of input.items) {
      // Update product stock
      const currentProduct = await db.select()
        .from(productsTable)
        .where(eq(productsTable.id, item.product_id))
        .execute();

      const newStockQuantity = currentProduct[0].stock_quantity + item.quantity;

      await db.update(productsTable)
        .set({ stock_quantity: newStockQuantity })
        .where(eq(productsTable.id, item.product_id))
        .execute();

      // Create stock movement record
      await db.insert(stockMovementsTable)
        .values({
          product_id: item.product_id,
          movement_type: 'in',
          quantity: item.quantity,
          reference_type: 'purchase',
          reference_id: createdPurchase.id,
          notes: `Purchase ${purchaseNumber}`,
          created_by: input.created_by
        })
        .execute();
    }

    // Convert numeric fields for return
    const purchase: Purchase = {
      ...createdPurchase,
      total_amount: parseFloat(createdPurchase.total_amount)
    };

    const items: PurchaseItem[] = itemsResult.map(item => ({
      ...item,
      unit_cost: parseFloat(item.unit_cost),
      total_cost: parseFloat(item.total_cost)
    }));

    return { purchase, items };
  } catch (error) {
    console.error('Purchase creation failed:', error);
    throw error;
  }
};

export const getPurchases = async (supplierId?: number): Promise<Purchase[]> => {
  try {
    // Build query conditionally to avoid TypeScript issues
    const results = supplierId !== undefined
      ? await db.select()
          .from(purchasesTable)
          .where(eq(purchasesTable.supplier_id, supplierId))
          .orderBy(desc(purchasesTable.created_at))
          .execute()
      : await db.select()
          .from(purchasesTable)
          .orderBy(desc(purchasesTable.created_at))
          .execute();

    return results.map(purchase => ({
      ...purchase,
      total_amount: parseFloat(purchase.total_amount)
    }));
  } catch (error) {
    console.error('Failed to get purchases:', error);
    throw error;
  }
};

export const getPurchaseById = async (id: number): Promise<{ purchase: Purchase; items: PurchaseItem[] } | null> => {
  try {
    // Get purchase
    const purchaseResults = await db.select()
      .from(purchasesTable)
      .where(eq(purchasesTable.id, id))
      .execute();

    if (purchaseResults.length === 0) {
      return null;
    }

    // Get purchase items
    const itemsResults = await db.select()
      .from(purchaseItemsTable)
      .where(eq(purchaseItemsTable.purchase_id, id))
      .execute();

    const purchase: Purchase = {
      ...purchaseResults[0],
      total_amount: parseFloat(purchaseResults[0].total_amount)
    };

    const items: PurchaseItem[] = itemsResults.map(item => ({
      ...item,
      unit_cost: parseFloat(item.unit_cost),
      total_cost: parseFloat(item.total_cost)
    }));

    return { purchase, items };
  } catch (error) {
    console.error('Failed to get purchase by id:', error);
    throw error;
  }
};
