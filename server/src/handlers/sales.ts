
import { db } from '../db';
import { 
  salesTable, 
  saleItemsTable, 
  productsTable, 
  stockMovementsTable,
  usersTable 
} from '../db/schema';
import { 
  type Sale, 
  type SaleItem, 
  type CreateSaleInput, 
  type CancelSaleInput 
} from '../schema';
import { eq, and, gte, lte, desc, sql, type SQL } from 'drizzle-orm';

export async function createSale(input: CreateSaleInput): Promise<{ sale: Sale; items: SaleItem[] }> {
  try {
    return await db.transaction(async (tx) => {
      // Generate unique transaction number
      const transactionNumber = `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Calculate totals
      const subtotal = input.items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
      const totalAmount = subtotal - input.discount_amount + input.tax_amount;
      const changeAmount = input.amount_paid - totalAmount;
      
      // Verify sufficient payment
      if (input.amount_paid < totalAmount) {
        throw new Error('Insufficient payment amount');
      }
      
      // Verify cashier exists
      const cashierExists = await tx.select()
        .from(usersTable)
        .where(eq(usersTable.id, input.cashier_id))
        .limit(1)
        .execute();
        
      if (cashierExists.length === 0) {
        throw new Error('Cashier not found');
      }
      
      // Verify products exist and have sufficient stock
      for (const item of input.items) {
        const product = await tx.select()
          .from(productsTable)
          .where(eq(productsTable.id, item.product_id))
          .limit(1)
          .execute();
          
        if (product.length === 0) {
          throw new Error(`Product with ID ${item.product_id} not found`);
        }
        
        if (product[0].stock_quantity < item.quantity) {
          throw new Error(`Insufficient stock for product ${product[0].name}`);
        }
        
        if (!product[0].is_active) {
          throw new Error(`Product ${product[0].name} is not active`);
        }
      }
      
      // Create sale record
      const saleResult = await tx.insert(salesTable)
        .values({
          transaction_number: transactionNumber,
          cashier_id: input.cashier_id,
          subtotal: subtotal.toString(),
          discount_amount: input.discount_amount.toString(),
          tax_amount: input.tax_amount.toString(),
          total_amount: totalAmount.toString(),
          payment_method: input.payment_method,
          amount_paid: input.amount_paid.toString(),
          change_amount: changeAmount.toString(),
          status: 'completed'
        })
        .returning()
        .execute();
        
      const sale = saleResult[0];
      
      // Create sale items and update stock
      const items: SaleItem[] = [];
      
      for (const item of input.items) {
        // Create sale item
        const saleItemResult = await tx.insert(saleItemsTable)
          .values({
            sale_id: sale.id,
            product_id: item.product_id,
            barcode: item.barcode,
            product_name: item.product_name,
            quantity: item.quantity,
            unit_price: item.unit_price.toString(),
            total_price: (item.quantity * item.unit_price).toString()
          })
          .returning()
          .execute();
          
        items.push({
          ...saleItemResult[0],
          unit_price: parseFloat(saleItemResult[0].unit_price),
          total_price: parseFloat(saleItemResult[0].total_price)
        });
        
        // Update product stock
        await tx.update(productsTable)
          .set({
            stock_quantity: sql`${productsTable.stock_quantity} - ${item.quantity}`,
            updated_at: new Date()
          })
          .where(eq(productsTable.id, item.product_id))
          .execute();
          
        // Create stock movement record
        await tx.insert(stockMovementsTable)
          .values({
            product_id: item.product_id,
            movement_type: 'out',
            quantity: -item.quantity, // Negative for outgoing stock
            reference_type: 'sale',
            reference_id: sale.id,
            notes: `Sale transaction: ${transactionNumber}`,
            created_by: input.cashier_id
          })
          .execute();
      }
      
      return {
        sale: {
          ...sale,
          subtotal: parseFloat(sale.subtotal),
          discount_amount: parseFloat(sale.discount_amount),
          tax_amount: parseFloat(sale.tax_amount),
          total_amount: parseFloat(sale.total_amount),
          amount_paid: parseFloat(sale.amount_paid),
          change_amount: parseFloat(sale.change_amount)
        },
        items
      };
    });
  } catch (error) {
    console.error('Sale creation failed:', error);
    throw error;
  }
}

export async function getSales(cashierId?: number, startDate?: Date, endDate?: Date): Promise<Sale[]> {
  try {
    // Build conditions array
    const conditions: SQL<unknown>[] = [];
    
    if (cashierId !== undefined) {
      conditions.push(eq(salesTable.cashier_id, cashierId));
    }
    
    if (startDate) {
      conditions.push(gte(salesTable.created_at, startDate));
    }
    
    if (endDate) {
      conditions.push(lte(salesTable.created_at, endDate));
    }
    
    // Execute query with or without conditions
    const results = conditions.length === 0
      ? await db.select()
          .from(salesTable)
          .orderBy(desc(salesTable.created_at))
          .execute()
      : await db.select()
          .from(salesTable)
          .where(conditions.length === 1 ? conditions[0] : and(...conditions))
          .orderBy(desc(salesTable.created_at))
          .execute();
    
    return results.map(sale => ({
      ...sale,
      subtotal: parseFloat(sale.subtotal),
      discount_amount: parseFloat(sale.discount_amount),
      tax_amount: parseFloat(sale.tax_amount),
      total_amount: parseFloat(sale.total_amount),
      amount_paid: parseFloat(sale.amount_paid),
      change_amount: parseFloat(sale.change_amount)
    }));
  } catch (error) {
    console.error('Failed to get sales:', error);
    throw error;
  }
}

export async function getSaleById(id: number): Promise<{ sale: Sale; items: SaleItem[] } | null> {
  try {
    // Get sale record
    const saleResults = await db.select()
      .from(salesTable)
      .where(eq(salesTable.id, id))
      .limit(1)
      .execute();
      
    if (saleResults.length === 0) {
      return null;
    }
    
    const saleRecord = saleResults[0];
    
    // Get sale items
    const itemResults = await db.select()
      .from(saleItemsTable)
      .where(eq(saleItemsTable.sale_id, id))
      .execute();
    
    const sale: Sale = {
      ...saleRecord,
      subtotal: parseFloat(saleRecord.subtotal),
      discount_amount: parseFloat(saleRecord.discount_amount),
      tax_amount: parseFloat(saleRecord.tax_amount),
      total_amount: parseFloat(saleRecord.total_amount),
      amount_paid: parseFloat(saleRecord.amount_paid),
      change_amount: parseFloat(saleRecord.change_amount)
    };
    
    const items: SaleItem[] = itemResults.map(item => ({
      ...item,
      unit_price: parseFloat(item.unit_price),
      total_price: parseFloat(item.total_price)
    }));
    
    return { sale, items };
  } catch (error) {
    console.error('Failed to get sale by ID:', error);
    throw error;
  }
}

export async function cancelSale(input: CancelSaleInput): Promise<Sale> {
  try {
    return await db.transaction(async (tx) => {
      // Verify canceller exists
      const cancellerExists = await tx.select()
        .from(usersTable)
        .where(eq(usersTable.id, input.cancelled_by))
        .limit(1)
        .execute();
        
      if (cancellerExists.length === 0) {
        throw new Error('Canceller user not found');
      }
      
      // Get existing sale
      const existingSale = await tx.select()
        .from(salesTable)
        .where(eq(salesTable.id, input.sale_id))
        .limit(1)
        .execute();
        
      if (existingSale.length === 0) {
        throw new Error('Sale not found');
      }
      
      if (existingSale[0].status !== 'completed') {
        throw new Error('Only completed sales can be cancelled');
      }
      
      // Get sale items to restore stock
      const saleItems = await tx.select()
        .from(saleItemsTable)
        .where(eq(saleItemsTable.sale_id, input.sale_id))
        .execute();
      
      // Restore stock for each item
      for (const item of saleItems) {
        await tx.update(productsTable)
          .set({
            stock_quantity: sql`${productsTable.stock_quantity} + ${item.quantity}`,
            updated_at: new Date()
          })
          .where(eq(productsTable.id, item.product_id))
          .execute();
          
        // Create reverse stock movement
        await tx.insert(stockMovementsTable)
          .values({
            product_id: item.product_id,
            movement_type: 'in',
            quantity: item.quantity, // Positive for incoming stock
            reference_type: 'sale',
            reference_id: input.sale_id,
            notes: `Sale cancellation: ${existingSale[0].transaction_number} - ${input.cancellation_reason}`,
            created_by: input.cancelled_by
          })
          .execute();
      }
      
      // Update sale status
      const cancelledSaleResult = await tx.update(salesTable)
        .set({
          status: 'cancelled',
          cancelled_by: input.cancelled_by,
          cancelled_at: new Date(),
          cancellation_reason: input.cancellation_reason,
          updated_at: new Date()
        })
        .where(eq(salesTable.id, input.sale_id))
        .returning()
        .execute();
        
      const cancelledSale = cancelledSaleResult[0];
      
      return {
        ...cancelledSale,
        subtotal: parseFloat(cancelledSale.subtotal),
        discount_amount: parseFloat(cancelledSale.discount_amount),
        tax_amount: parseFloat(cancelledSale.tax_amount),
        total_amount: parseFloat(cancelledSale.total_amount),
        amount_paid: parseFloat(cancelledSale.amount_paid),
        change_amount: parseFloat(cancelledSale.change_amount)
      };
    });
  } catch (error) {
    console.error('Sale cancellation failed:', error);
    throw error;
  }
}

export async function getDailySales(date: Date): Promise<{ total_sales: number; transaction_count: number }> {
  try {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    const results = await db.select({
      total_sales: sql<string>`COALESCE(SUM(${salesTable.total_amount}), 0)`,
      transaction_count: sql<string>`COUNT(*)`
    })
    .from(salesTable)
    .where(
      and(
        gte(salesTable.created_at, startOfDay),
        lte(salesTable.created_at, endOfDay),
        eq(salesTable.status, 'completed')
      )
    )
    .execute();
    
    const result = results[0];
    
    return {
      total_sales: parseFloat(result.total_sales),
      transaction_count: parseInt(result.transaction_count)
    };
  } catch (error) {
    console.error('Failed to get daily sales:', error);
    throw error;
  }
}
