
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, categoriesTable, productsTable, stockMovementsTable } from '../db/schema';
import { type CreateStockMovementInput } from '../schema';
import { getStockMovements, createStockMovement, adjustStock } from '../handlers/stock';
import { eq } from 'drizzle-orm';

describe('Stock handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let testUserId: number;
  let testCategoryId: number;
  let testProductId: number;

  beforeEach(async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        username: 'testuser',
        email: 'test@example.com',
        password_hash: 'hashedpassword',
        role: 'admin'
      })
      .returning()
      .execute();
    testUserId = userResult[0].id;

    // Create test category
    const categoryResult = await db.insert(categoriesTable)
      .values({
        name: 'Test Category',
        description: 'A category for testing'
      })
      .returning()
      .execute();
    testCategoryId = categoryResult[0].id;

    // Create test product
    const productResult = await db.insert(productsTable)
      .values({
        barcode: 'TEST123',
        name: 'Test Product',
        description: 'A product for testing',
        category_id: testCategoryId,
        purchase_price: '10.00',
        selling_price: '15.00',
        stock_quantity: 100,
        minimum_stock: 10
      })
      .returning()
      .execute();
    testProductId = productResult[0].id;
  });

  describe('getStockMovements', () => {
    it('should return empty array when no movements exist', async () => {
      const result = await getStockMovements();
      expect(result).toEqual([]);
    });

    it('should return all stock movements when no filter applied', async () => {
      // Create test stock movements
      const movement1Input: CreateStockMovementInput = {
        product_id: testProductId,
        movement_type: 'in',
        quantity: 50,
        reference_type: 'purchase',
        reference_id: 1,
        notes: 'Purchase delivery',
        created_by: testUserId
      };

      const movement2Input: CreateStockMovementInput = {
        product_id: testProductId,
        movement_type: 'out',
        quantity: 25,
        reference_type: 'sale',
        reference_id: 1,
        notes: 'Sale transaction',
        created_by: testUserId
      };

      await createStockMovement(movement1Input);
      await createStockMovement(movement2Input);

      const result = await getStockMovements();
      
      expect(result).toHaveLength(2);
      // Should be ordered by created_at desc (most recent first)
      expect(result[0].movement_type).toEqual('out');
      expect(result[0].quantity).toEqual(25);
      expect(result[1].movement_type).toEqual('in');
      expect(result[1].quantity).toEqual(50);
    });

    it('should filter movements by product_id when provided', async () => {
      // Create second product
      const product2Result = await db.insert(productsTable)
        .values({
          barcode: 'TEST456',
          name: 'Test Product 2',
          description: 'Another test product',
          category_id: testCategoryId,
          purchase_price: '5.00',
          selling_price: '8.00',
          stock_quantity: 50,
          minimum_stock: 5
        })
        .returning()
        .execute();
      const testProduct2Id = product2Result[0].id;

      // Create movements for both products
      await createStockMovement({
        product_id: testProductId,
        movement_type: 'in',
        quantity: 30,
        reference_type: 'purchase',
        reference_id: null,
        notes: null,
        created_by: testUserId
      });

      await createStockMovement({
        product_id: testProduct2Id,
        movement_type: 'out',
        quantity: 10,
        reference_type: 'sale',
        reference_id: null,
        notes: null,
        created_by: testUserId
      });

      // Filter by first product
      const result = await getStockMovements(testProductId);
      
      expect(result).toHaveLength(1);
      expect(result[0].product_id).toEqual(testProductId);
      expect(result[0].movement_type).toEqual('in');
      expect(result[0].quantity).toEqual(30);
    });
  });

  describe('createStockMovement', () => {
    it('should create stock movement and update product stock for "in" movement', async () => {
      const input: CreateStockMovementInput = {
        product_id: testProductId,
        movement_type: 'in',
        quantity: 50,
        reference_type: 'purchase',
        reference_id: 123,
        notes: 'Received new inventory',
        created_by: testUserId
      };

      const result = await createStockMovement(input);

      // Check movement record
      expect(result.id).toBeDefined();
      expect(result.product_id).toEqual(testProductId);
      expect(result.movement_type).toEqual('in');
      expect(result.quantity).toEqual(50);
      expect(result.reference_type).toEqual('purchase');
      expect(result.reference_id).toEqual(123);
      expect(result.notes).toEqual('Received new inventory');
      expect(result.created_by).toEqual(testUserId);
      expect(result.created_at).toBeInstanceOf(Date);

      // Check product stock was updated (100 + 50 = 150)
      const products = await db.select()
        .from(productsTable)
        .where(eq(productsTable.id, testProductId))
        .execute();
      
      expect(products[0].stock_quantity).toEqual(150);
    });

    it('should create stock movement and update product stock for "out" movement', async () => {
      const input: CreateStockMovementInput = {
        product_id: testProductId,
        movement_type: 'out',
        quantity: 30,
        reference_type: 'sale',
        reference_id: 456,
        notes: 'Product sold',
        created_by: testUserId
      };

      const result = await createStockMovement(input);

      // Check movement record
      expect(result.movement_type).toEqual('out');
      expect(result.quantity).toEqual(30);

      // Check product stock was updated (100 - 30 = 70)
      const products = await db.select()
        .from(productsTable)
        .where(eq(productsTable.id, testProductId))
        .execute();
      
      expect(products[0].stock_quantity).toEqual(70);
    });

    it('should create stock movement and update product stock for "adjustment" movement', async () => {
      const input: CreateStockMovementInput = {
        product_id: testProductId,
        movement_type: 'adjustment',
        quantity: -20, // Negative adjustment (stock loss)
        reference_type: 'adjustment',
        reference_id: null,
        notes: 'Damaged goods removed',
        created_by: testUserId
      };

      const result = await createStockMovement(input);

      // Check movement record
      expect(result.movement_type).toEqual('adjustment');
      expect(result.quantity).toEqual(-20);

      // Check product stock was updated (100 + (-20) = 80)
      const products = await db.select()
        .from(productsTable)
        .where(eq(productsTable.id, testProductId))
        .execute();
      
      expect(products[0].stock_quantity).toEqual(80);
    });

    it('should not allow stock to go negative', async () => {
      const input: CreateStockMovementInput = {
        product_id: testProductId,
        movement_type: 'out',
        quantity: 150, // More than current stock (100)
        reference_type: 'sale',
        reference_id: null,
        notes: 'Large sale',
        created_by: testUserId
      };

      await createStockMovement(input);

      // Check product stock was set to 0 (not negative)
      const products = await db.select()
        .from(productsTable)
        .where(eq(productsTable.id, testProductId))
        .execute();
      
      expect(products[0].stock_quantity).toEqual(0);
    });

    it('should throw error for non-existent product', async () => {
      const input: CreateStockMovementInput = {
        product_id: 99999, // Non-existent product
        movement_type: 'in',
        quantity: 10,
        reference_type: null,
        reference_id: null,
        notes: null,
        created_by: testUserId
      };

      await expect(createStockMovement(input)).rejects.toThrow(/Product with id 99999 not found/);
    });

    it('should save movement to database', async () => {
      const input: CreateStockMovementInput = {
        product_id: testProductId,
        movement_type: 'in',
        quantity: 25,
        reference_type: 'purchase',
        reference_id: null,
        notes: null,
        created_by: testUserId
      };

      const result = await createStockMovement(input);

      // Verify movement was saved to database
      const movements = await db.select()
        .from(stockMovementsTable)
        .where(eq(stockMovementsTable.id, result.id))
        .execute();

      expect(movements).toHaveLength(1);
      expect(movements[0].product_id).toEqual(testProductId);
      expect(movements[0].movement_type).toEqual('in');
      expect(movements[0].quantity).toEqual(25);
      expect(movements[0].created_by).toEqual(testUserId);
    });
  });

  describe('adjustStock', () => {
    it('should adjust stock to higher quantity', async () => {
      const result = await adjustStock(testProductId, 150, testUserId, 'Inventory adjustment');

      // Check movement record
      expect(result.product_id).toEqual(testProductId);
      expect(result.movement_type).toEqual('adjustment');
      expect(result.quantity).toEqual(50); // 150 - 100 = 50
      expect(result.reference_type).toEqual('adjustment');
      expect(result.notes).toEqual('Inventory adjustment');
      expect(result.created_by).toEqual(testUserId);

      // Check product stock was updated
      const products = await db.select()
        .from(productsTable)
        .where(eq(productsTable.id, testProductId))
        .execute();
      
      expect(products[0].stock_quantity).toEqual(150);
    });

    it('should adjust stock to lower quantity', async () => {
      const result = await adjustStock(testProductId, 75, testUserId, 'Stock correction');

      // Check movement record shows negative adjustment
      expect(result.quantity).toEqual(-25); // 75 - 100 = -25

      // Check product stock was updated
      const products = await db.select()
        .from(productsTable)
        .where(eq(productsTable.id, testProductId))
        .execute();
      
      expect(products[0].stock_quantity).toEqual(75);
    });

    it('should adjust stock to zero', async () => {
      const result = await adjustStock(testProductId, 0, testUserId);

      // Check movement record
      expect(result.quantity).toEqual(-100); // 0 - 100 = -100
      expect(result.notes).toBeNull();

      // Check product stock was updated
      const products = await db.select()
        .from(productsTable)
        .where(eq(productsTable.id, testProductId))
        .execute();
      
      expect(products[0].stock_quantity).toEqual(0);
    });

    it('should handle no change in stock quantity', async () => {
      const result = await adjustStock(testProductId, 100, testUserId, 'No change needed');

      // Check movement record shows zero adjustment
      expect(result.quantity).toEqual(0); // 100 - 100 = 0

      // Check product stock remains the same
      const products = await db.select()
        .from(productsTable)
        .where(eq(productsTable.id, testProductId))
        .execute();
      
      expect(products[0].stock_quantity).toEqual(100);
    });

    it('should throw error for non-existent product', async () => {
      await expect(adjustStock(99999, 50, testUserId)).rejects.toThrow(/Product with id 99999 not found/);
    });
  });
});
