
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { 
  usersTable, 
  categoriesTable, 
  productsTable, 
  salesTable,
  saleItemsTable,
  stockMovementsTable
} from '../db/schema';
import { 
  type CreateSaleInput, 
  type CancelSaleInput,
  type CartItem 
} from '../schema';
import { 
  createSale, 
  getSales, 
  getSaleById, 
  cancelSale, 
  getDailySales 
} from '../handlers/sales';
import { eq } from 'drizzle-orm';

describe('Sales Handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Helper function to create test user
  const createTestUser = async () => {
    const result = await db.insert(usersTable)
      .values({
        username: 'testcashier',
        email: 'cashier@test.com',
        password_hash: 'hashedpassword',
        role: 'cashier',
        is_active: true
      })
      .returning()
      .execute();
    return result[0];
  };

  // Helper function to create test category
  const createTestCategory = async () => {
    const result = await db.insert(categoriesTable)
      .values({
        name: 'Test Category',
        description: 'Category for testing'
      })
      .returning()
      .execute();
    return result[0];
  };

  // Helper function to create test product
  const createTestProduct = async (categoryId: number, stock = 50) => {
    const result = await db.insert(productsTable)
      .values({
        barcode: `TEST${Date.now()}`,
        name: 'Test Product',
        description: 'Product for testing',
        category_id: categoryId,
        purchase_price: '10.00',
        selling_price: '15.00',
        stock_quantity: stock,
        minimum_stock: 5,
        is_active: true
      })
      .returning()
      .execute();
    return result[0];
  };

  describe('createSale', () => {
    it('should create a complete sale transaction', async () => {
      const user = await createTestUser();
      const category = await createTestCategory();
      const product = await createTestProduct(category.id, 100);

      const cartItems: CartItem[] = [
        {
          product_id: product.id,
          barcode: product.barcode,
          product_name: product.name,
          quantity: 2,
          unit_price: 15.00
        }
      ];

      const input: CreateSaleInput = {
        cashier_id: user.id,
        items: cartItems,
        discount_amount: 2.00,
        tax_amount: 2.50,
        payment_method: 'cash',
        amount_paid: 31.00 // 30.00 subtotal - 2.00 discount + 2.50 tax = 30.50
      };

      const result = await createSale(input);

      // Verify sale record
      expect(result.sale.cashier_id).toEqual(user.id);
      expect(result.sale.subtotal).toEqual(30.00);
      expect(result.sale.discount_amount).toEqual(2.00);
      expect(result.sale.tax_amount).toEqual(2.50);
      expect(result.sale.total_amount).toEqual(30.50);
      expect(result.sale.amount_paid).toEqual(31.00);
      expect(result.sale.change_amount).toEqual(0.50);
      expect(result.sale.payment_method).toEqual('cash');
      expect(result.sale.status).toEqual('completed');
      expect(result.sale.transaction_number).toMatch(/^TXN-/);

      // Verify sale items
      expect(result.items).toHaveLength(1);
      expect(result.items[0].product_id).toEqual(product.id);
      expect(result.items[0].quantity).toEqual(2);
      expect(result.items[0].unit_price).toEqual(15.00);
      expect(result.items[0].total_price).toEqual(30.00);

      // Verify stock was updated
      const updatedProduct = await db.select()
        .from(productsTable)
        .where(eq(productsTable.id, product.id))
        .execute();
      expect(updatedProduct[0].stock_quantity).toEqual(98);

      // Verify stock movement was created
      const stockMovements = await db.select()
        .from(stockMovementsTable)
        .where(eq(stockMovementsTable.product_id, product.id))
        .execute();
      expect(stockMovements).toHaveLength(1);
      expect(stockMovements[0].movement_type).toEqual('out');
      expect(stockMovements[0].quantity).toEqual(-2);
      expect(stockMovements[0].reference_type).toEqual('sale');
    });

    it('should reject sale with insufficient payment', async () => {
      const user = await createTestUser();
      const category = await createTestCategory();
      const product = await createTestProduct(category.id);

      const input: CreateSaleInput = {
        cashier_id: user.id,
        items: [{
          product_id: product.id,
          barcode: product.barcode,
          product_name: product.name,
          quantity: 1,
          unit_price: 15.00
        }],
        discount_amount: 0,
        tax_amount: 0,
        payment_method: 'cash',
        amount_paid: 10.00 // Less than total of 15.00
      };

      await expect(createSale(input)).rejects.toThrow(/insufficient payment/i);
    });

    it('should reject sale with insufficient stock', async () => {
      const user = await createTestUser();
      const category = await createTestCategory();
      const product = await createTestProduct(category.id, 2); // Only 2 in stock

      const input: CreateSaleInput = {
        cashier_id: user.id,
        items: [{
          product_id: product.id,
          barcode: product.barcode,
          product_name: product.name,
          quantity: 5, // More than available stock of 2
          unit_price: 15.00
        }],
        discount_amount: 0,
        tax_amount: 0,
        payment_method: 'cash',
        amount_paid: 75.00
      };

      await expect(createSale(input)).rejects.toThrow(/insufficient stock/i);
    });

    it('should reject sale with non-existent cashier', async () => {
      const category = await createTestCategory();
      const product = await createTestProduct(category.id);

      const input: CreateSaleInput = {
        cashier_id: 99999, // Non-existent cashier
        items: [{
          product_id: product.id,
          barcode: product.barcode,
          product_name: product.name,
          quantity: 1,
          unit_price: 15.00
        }],
        discount_amount: 0,
        tax_amount: 0,
        payment_method: 'cash',
        amount_paid: 15.00
      };

      await expect(createSale(input)).rejects.toThrow(/cashier not found/i);
    });
  });

  describe('getSales', () => {
    it('should get all sales without filters', async () => {
      const user = await createTestUser();
      const category = await createTestCategory();
      const product = await createTestProduct(category.id);

      // Create a test sale
      await createSale({
        cashier_id: user.id,
        items: [{
          product_id: product.id,
          barcode: product.barcode,
          product_name: product.name,
          quantity: 1,
          unit_price: 15.00
        }],
        discount_amount: 0,
        tax_amount: 0,
        payment_method: 'cash',
        amount_paid: 15.00
      });

      const sales = await getSales();
      expect(sales).toHaveLength(1);
      expect(sales[0].cashier_id).toEqual(user.id);
      expect(typeof sales[0].total_amount).toBe('number');
    });

    it('should filter sales by cashier', async () => {
      const user1 = await createTestUser();
      const user2 = await db.insert(usersTable)
        .values({
          username: 'cashier2',
          email: 'cashier2@test.com',
          password_hash: 'hashedpassword',
          role: 'cashier',
          is_active: true
        })
        .returning()
        .execute();

      const category = await createTestCategory();
      const product = await createTestProduct(category.id);

      // Create sales for both cashiers
      await createSale({
        cashier_id: user1.id,
        items: [{
          product_id: product.id,
          barcode: product.barcode,
          product_name: product.name,
          quantity: 1,
          unit_price: 15.00
        }],
        discount_amount: 0,
        tax_amount: 0,
        payment_method: 'cash',
        amount_paid: 15.00
      });

      await createSale({
        cashier_id: user2[0].id,
        items: [{
          product_id: product.id,
          barcode: product.barcode,
          product_name: product.name,
          quantity: 1,
          unit_price: 15.00
        }],
        discount_amount: 0,
        tax_amount: 0,
        payment_method: 'cash',
        amount_paid: 15.00
      });

      const salesForUser1 = await getSales(user1.id);
      expect(salesForUser1).toHaveLength(1);
      expect(salesForUser1[0].cashier_id).toEqual(user1.id);
    });

    it('should filter sales by date range', async () => {
      const user = await createTestUser();
      const category = await createTestCategory();
      const product = await createTestProduct(category.id);

      await createSale({
        cashier_id: user.id,
        items: [{
          product_id: product.id,
          barcode: product.barcode,
          product_name: product.name,
          quantity: 1,
          unit_price: 15.00
        }],
        discount_amount: 0,
        tax_amount: 0,
        payment_method: 'cash',
        amount_paid: 15.00
      });

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const sales = await getSales(undefined, yesterday, tomorrow);
      expect(sales.length).toBeGreaterThan(0);
    });
  });

  describe('getSaleById', () => {
    it('should get sale with items by ID', async () => {
      const user = await createTestUser();
      const category = await createTestCategory();
      const product = await createTestProduct(category.id);

      const createdSale = await createSale({
        cashier_id: user.id,
        items: [{
          product_id: product.id,
          barcode: product.barcode,
          product_name: product.name,
          quantity: 2,
          unit_price: 15.00
        }],
        discount_amount: 1.00,
        tax_amount: 2.00,
        payment_method: 'card',
        amount_paid: 31.00 // 30.00 - 1.00 + 2.00 = 31.00
      });

      const result = await getSaleById(createdSale.sale.id);
      expect(result).not.toBeNull();
      expect(result!.sale.id).toEqual(createdSale.sale.id);
      expect(result!.sale.total_amount).toEqual(31.00);
      expect(result!.items).toHaveLength(1);
      expect(result!.items[0].quantity).toEqual(2);
      expect(typeof result!.items[0].unit_price).toBe('number');
    });

    it('should return null for non-existent sale', async () => {
      const result = await getSaleById(99999);
      expect(result).toBeNull();
    });
  });

  describe('cancelSale', () => {
    it('should cancel a completed sale and restore stock', async () => {
      const user = await createTestUser();
      const category = await createTestCategory();
      const product = await createTestProduct(category.id, 100);

      const createdSale = await createSale({
        cashier_id: user.id,
        items: [{
          product_id: product.id,
          barcode: product.barcode,
          product_name: product.name,
          quantity: 3,
          unit_price: 15.00
        }],
        discount_amount: 0,
        tax_amount: 0,
        payment_method: 'cash',
        amount_paid: 45.00
      });

      const cancelInput: CancelSaleInput = {
        sale_id: createdSale.sale.id,
        cancelled_by: user.id,
        cancellation_reason: 'Customer requested refund'
      };

      const cancelledSale = await cancelSale(cancelInput);

      expect(cancelledSale.status).toEqual('cancelled');
      expect(cancelledSale.cancelled_by).toEqual(user.id);
      expect(cancelledSale.cancellation_reason).toEqual('Customer requested refund');
      expect(cancelledSale.cancelled_at).toBeInstanceOf(Date);

      // Verify stock was restored
      const updatedProduct = await db.select()
        .from(productsTable)
        .where(eq(productsTable.id, product.id))
        .execute();
      expect(updatedProduct[0].stock_quantity).toEqual(100); // Back to original

      // Verify reverse stock movement was created
      const stockMovements = await db.select()
        .from(stockMovementsTable)
        .where(eq(stockMovementsTable.product_id, product.id))
        .execute();
      expect(stockMovements).toHaveLength(2); // Original out + reverse in
      
      const reverseMovement = stockMovements.find(m => m.quantity > 0);
      expect(reverseMovement).toBeDefined();
      expect(reverseMovement!.movement_type).toEqual('in');
      expect(reverseMovement!.quantity).toEqual(3);
    });

    it('should reject cancellation of non-existent sale', async () => {
      const user = await createTestUser();

      const cancelInput: CancelSaleInput = {
        sale_id: 99999,
        cancelled_by: user.id,
        cancellation_reason: 'Test cancellation'
      };

      await expect(cancelSale(cancelInput)).rejects.toThrow(/sale not found/i);
    });

    it('should reject cancellation by non-existent user', async () => {
      const user = await createTestUser();
      const category = await createTestCategory();
      const product = await createTestProduct(category.id);

      const createdSale = await createSale({
        cashier_id: user.id,
        items: [{
          product_id: product.id,
          barcode: product.barcode,
          product_name: product.name,
          quantity: 1,
          unit_price: 15.00
        }],
        discount_amount: 0,
        tax_amount: 0,
        payment_method: 'cash',
        amount_paid: 15.00
      });

      const cancelInput: CancelSaleInput = {
        sale_id: createdSale.sale.id,
        cancelled_by: 99999, // Non-existent user
        cancellation_reason: 'Test cancellation'
      };

      await expect(cancelSale(cancelInput)).rejects.toThrow(/canceller user not found/i);
    });
  });

  describe('getDailySales', () => {
    it('should get daily sales summary', async () => {
      const user = await createTestUser();
      const category = await createTestCategory();
      const product = await createTestProduct(category.id);

      // Create multiple sales
      await createSale({
        cashier_id: user.id,
        items: [{
          product_id: product.id,
          barcode: product.barcode,
          product_name: product.name,
          quantity: 1,
          unit_price: 10.00
        }],
        discount_amount: 0,
        tax_amount: 0,
        payment_method: 'cash',
        amount_paid: 10.00
      });

      await createSale({
        cashier_id: user.id,
        items: [{
          product_id: product.id,
          barcode: product.barcode,
          product_name: product.name,
          quantity: 1,
          unit_price: 20.00
        }],
        discount_amount: 0,
        tax_amount: 0,
        payment_method: 'card',
        amount_paid: 20.00
      });

      const today = new Date();
      const summary = await getDailySales(today);

      expect(summary.total_sales).toEqual(30.00);
      expect(summary.transaction_count).toEqual(2);
    });

    it('should return zero for days with no sales', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const summary = await getDailySales(yesterday);
      expect(summary.total_sales).toEqual(0);
      expect(summary.transaction_count).toEqual(0);
    });
  });
});
