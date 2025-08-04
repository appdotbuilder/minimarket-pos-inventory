
import { db } from '../db';
import { stockMovementsTable, productsTable } from '../db/schema';
import { type StockMovement, type CreateStockMovementInput } from '../schema';
import { eq, desc } from 'drizzle-orm';

export async function getStockMovements(productId?: number): Promise<StockMovement[]> {
  try {
    // Use different query patterns based on filter presence
    const results = productId !== undefined 
      ? await db.select()
          .from(stockMovementsTable)
          .where(eq(stockMovementsTable.product_id, productId))
          .orderBy(desc(stockMovementsTable.created_at))
          .execute()
      : await db.select()
          .from(stockMovementsTable)
          .orderBy(desc(stockMovementsTable.created_at))
          .execute();
    
    return results.map(movement => ({
      ...movement,
      created_at: movement.created_at
    }));
  } catch (error) {
    console.error('Failed to fetch stock movements:', error);
    throw error;
  }
}

export async function createStockMovement(input: CreateStockMovementInput): Promise<StockMovement> {
  try {
    // First verify the product exists
    const products = await db.select()
      .from(productsTable)
      .where(eq(productsTable.id, input.product_id))
      .execute();
    
    if (products.length === 0) {
      throw new Error(`Product with id ${input.product_id} not found`);
    }
    
    const currentProduct = products[0];
    
    // Insert the stock movement record
    const movementResult = await db.insert(stockMovementsTable)
      .values({
        product_id: input.product_id,
        movement_type: input.movement_type,
        quantity: input.quantity,
        reference_type: input.reference_type,
        reference_id: input.reference_id,
        notes: input.notes,
        created_by: input.created_by
      })
      .returning()
      .execute();
    
    const movement = movementResult[0];
    
    // Calculate new stock quantity based on movement type
    let newStockQuantity: number;
    if (input.movement_type === 'in') {
      newStockQuantity = currentProduct.stock_quantity + input.quantity;
    } else if (input.movement_type === 'out') {
      newStockQuantity = currentProduct.stock_quantity - input.quantity;
    } else { // adjustment
      // For adjustments, the quantity field represents the adjustment amount (can be positive or negative)
      newStockQuantity = currentProduct.stock_quantity + input.quantity;
    }
    
    // Ensure stock doesn't go negative
    if (newStockQuantity < 0) {
      newStockQuantity = 0;
    }
    
    // Update the product's stock quantity
    await db.update(productsTable)
      .set({ 
        stock_quantity: newStockQuantity,
        updated_at: new Date()
      })
      .where(eq(productsTable.id, input.product_id))
      .execute();
    
    return {
      ...movement,
      created_at: movement.created_at
    };
  } catch (error) {
    console.error('Failed to create stock movement:', error);
    throw error;
  }
}

export async function adjustStock(productId: number, newQuantity: number, userId: number, notes?: string): Promise<StockMovement> {
  try {
    // First get the current product stock
    const products = await db.select()
      .from(productsTable)
      .where(eq(productsTable.id, productId))
      .execute();
    
    if (products.length === 0) {
      throw new Error(`Product with id ${productId} not found`);
    }
    
    const currentProduct = products[0];
    const currentStock = currentProduct.stock_quantity;
    
    // Calculate the adjustment quantity (difference between new and current)
    const adjustmentQuantity = newQuantity - currentStock;
    
    // Create stock movement record with the adjustment
    const stockMovementInput: CreateStockMovementInput = {
      product_id: productId,
      movement_type: 'adjustment',
      quantity: adjustmentQuantity,
      reference_type: 'adjustment',
      reference_id: null,
      notes: notes || null,
      created_by: userId
    };
    
    // Use createStockMovement to handle the database updates
    return await createStockMovement(stockMovementInput);
  } catch (error) {
    console.error('Failed to adjust stock:', error);
    throw error;
  }
}
