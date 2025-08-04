
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { 
  usersTable, 
  categoriesTable, 
  suppliersTable, 
  productsTable,
  purchasesTable,
  purchaseItemsTable,
  stockMovementsTable
} from '../db/schema';
import { type CreatePurchaseInput } from '../schema';
import { createPurchase, getPurchases, getPurchaseById } from '../handlers/purchases';
import { eq } from 'drizzle-orm';

describe('Purchase Handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let testUserId: number;
  let testSupplierId: number;
  let testCategoryId: number;
  let testProduct1Id: number;
  let testProduct2Id: number;

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

    // Create test supplier
    const supplierResult = await db.insert(suppliersTable)
      .values({
        name: 'Test Supplier',
        contact_person: 'John Doe',
        phone: '123-456-7890',
        email: 'supplier@example.com'
      })
      .returning()
      .execute();
    testSupplierId = supplierResult[0].id;

    // Create test category
    const categoryResult = await db.insert(categoriesTable)
      .values({
        name: 'Test Category',
        description: 'A test category'
      })
      .returning()
      .execute();
    testCategoryId = categoryResult[0].id;

    // Create test products
    const product1Result = await db.insert(productsTable)
      .values({
        barcode: 'TEST001',
        name: 'Test Product 1',
        description: 'First test product',
        category_id: testCategoryId,
        supplier_id: testSupplierId,
        purchase_price: '10.00',
        selling_price: '15.00',
        stock_quantity: 50,
        minimum_stock: 10
      })
      .returning()
      .execute();
    testProduct1Id = product1Result[0].id;

    const product2Result = await db.insert(productsTable)
      .values({
        barcode: 'TEST002',
        name: 'Test Product 2',
        description: 'Second test product',
        category_id: testCategoryId,
        supplier_id: testSupplierId,
        purchase_price: '20.00',
        selling_price: '30.00',
        stock_quantity: 25,
        minimum_stock: 5
      })
      .returning()
      .execute();
    testProduct2Id = product2Result[0].id;
  });

  describe('createPurchase', () => {
    const testInput: CreatePurchaseInput = {
      supplier_id: 0, // Will be set in test
      items: [
        {
          product_id: 0, // Will be set in test
          quantity: 10,
          unit_cost: 8.50
        },
        {
          product_id: 0, // Will be set in test
          quantity: 5,
          unit_cost: 18.00
        }
      ],
      created_by: 0 // Will be set in test
    };

    it('should create a purchase with items', async () => {
      const input = {
        ...testInput,
        supplier_id: testSupplierId,
        created_by: testUserId,
        items: [
          { ...testInput.items[0], product_id: testProduct1Id },
          { ...testInput.items[1], product_id: testProduct2Id }
        ]
      };

      const result = await createPurchase(input);

      // Verify purchase
      expect(result.purchase.supplier_id).toEqual(testSupplierId);
      expect(result.purchase.total_amount).toEqual(175.00); // (10 * 8.50) + (5 * 18.00)
      expect(result.purchase.status).toEqual('completed');
      expect(result.purchase.created_by).toEqual(testUserId);
      expect(result.purchase.purchase_number).toMatch(/^PO-\d+$/);
      expect(result.purchase.id).toBeDefined();
      expect(result.purchase.created_at).toBeInstanceOf(Date);

      // Verify items
      expect(result.items).toHaveLength(2);
      expect(result.items[0].product_id).toEqual(testProduct1Id);
      expect(result.items[0].quantity).toEqual(10);
      expect(result.items[0].unit_cost).toEqual(8.50);
      expect(result.items[0].total_cost).toEqual(85.00);
      expect(result.items[1].product_id).toEqual(testProduct2Id);
      expect(result.items[1].quantity).toEqual(5);
      expect(result.items[1].unit_cost).toEqual(18.00);
      expect(result.items[1].total_cost).toEqual(90.00);
    });

    it('should update product stock quantities', async () => {
      const input = {
        ...testInput,
        supplier_id: testSupplierId,
        created_by: testUserId,
        items: [
          { ...testInput.items[0], product_id: testProduct1Id }
        ]
      };

      await createPurchase(input);

      // Check updated stock
      const updatedProduct = await db.select()
        .from(productsTable)
        .where(eq(productsTable.id, testProduct1Id))
        .execute();

      expect(updatedProduct[0].stock_quantity).toEqual(60); // 50 + 10
    });

    it('should create stock movement records', async () => {
      const input = {
        ...testInput,
        supplier_id: testSupplierId,
        created_by: testUserId,
        items: [
          { ...testInput.items[0], product_id: testProduct1Id }
        ]
      };

      const result = await createPurchase(input);

      // Check stock movement
      const movements = await db.select()
        .from(stockMovementsTable)
        .where(eq(stockMovementsTable.reference_id, result.purchase.id))
        .execute();

      expect(movements).toHaveLength(1);
      expect(movements[0].product_id).toEqual(testProduct1Id);
      expect(movements[0].movement_type).toEqual('in');
      expect(movements[0].quantity).toEqual(10);
      expect(movements[0].reference_type).toEqual('purchase');
      expect(movements[0].created_by).toEqual(testUserId);
    });

    it('should save purchase to database', async () => {
      const input = {
        ...testInput,
        supplier_id: testSupplierId,
        created_by: testUserId,
        items: [
          { ...testInput.items[0], product_id: testProduct1Id }
        ]
      };

      const result = await createPurchase(input);

      // Verify purchase in database
      const purchases = await db.select()
        .from(purchasesTable)
        .where(eq(purchasesTable.id, result.purchase.id))
        .execute();

      expect(purchases).toHaveLength(1);
      expect(purchases[0].supplier_id).toEqual(testSupplierId);
      expect(parseFloat(purchases[0].total_amount)).toEqual(85.00);

      // Verify items in database
      const items = await db.select()
        .from(purchaseItemsTable)
        .where(eq(purchaseItemsTable.purchase_id, result.purchase.id))
        .execute();

      expect(items).toHaveLength(1);
      expect(items[0].product_id).toEqual(testProduct1Id);
      expect(parseFloat(items[0].unit_cost)).toEqual(8.50);
    });

    it('should throw error for non-existent supplier', async () => {
      const input = {
        ...testInput,
        supplier_id: 99999,
        created_by: testUserId,
        items: [
          { ...testInput.items[0], product_id: testProduct1Id }
        ]
      };

      await expect(createPurchase(input)).rejects.toThrow(/supplier.*not found/i);
    });

    it('should throw error for non-existent product', async () => {
      const input = {
        ...testInput,
        supplier_id: testSupplierId,
        created_by: testUserId,
        items: [
          { ...testInput.items[0], product_id: 99999 }
        ]
      };

      await expect(createPurchase(input)).rejects.toThrow(/product.*not found/i);
    });
  });

  describe('getPurchases', () => {
    beforeEach(async () => {
      // Create test purchases with slight time difference
      const firstPurchase = await db.insert(purchasesTable)
        .values({
          supplier_id: testSupplierId,
          purchase_number: 'PO-001',
          total_amount: '100.00',
          status: 'completed',
          created_by: testUserId
        })
        .returning()
        .execute();

      // Add a small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));

      await db.insert(purchasesTable)
        .values({
          supplier_id: testSupplierId,
          purchase_number: 'PO-002',
          total_amount: '200.00',
          status: 'pending',
          created_by: testUserId
        })
        .execute();
    });

    it('should return all purchases when no supplier filter', async () => {
      const purchases = await getPurchases();

      expect(purchases).toHaveLength(2);
      // Check that results are ordered by created_at desc
      expect(purchases[0].purchase_number).toEqual('PO-002'); // Most recent
      expect(purchases[1].purchase_number).toEqual('PO-001'); // Older
      expect(purchases[0].total_amount).toEqual(200.00);
      expect(purchases[1].total_amount).toEqual(100.00);
      expect(typeof purchases[0].total_amount).toBe('number');
    });

    it('should filter purchases by supplier', async () => {
      // Create another supplier and purchase
      const supplier2Result = await db.insert(suppliersTable)
        .values({
          name: 'Another Supplier',
          contact_person: 'Jane Doe'
        })
        .returning()
        .execute();

      await db.insert(purchasesTable)
        .values({
          supplier_id: supplier2Result[0].id,
          purchase_number: 'PO-003',
          total_amount: '300.00',
          status: 'completed',
          created_by: testUserId
        })
        .execute();

      const purchases = await getPurchases(testSupplierId);

      expect(purchases).toHaveLength(2);
      purchases.forEach(purchase => {
        expect(purchase.supplier_id).toEqual(testSupplierId);
      });
    });

    it('should return empty array for non-existent supplier', async () => {
      const purchases = await getPurchases(99999);
      expect(purchases).toHaveLength(0);
    });
  });

  describe('getPurchaseById', () => {
    let testPurchaseId: number;

    beforeEach(async () => {
      // Create test purchase
      const purchaseResult = await db.insert(purchasesTable)
        .values({
          supplier_id: testSupplierId,
          purchase_number: 'PO-TEST',
          total_amount: '150.00',
          status: 'completed',
          created_by: testUserId
        })
        .returning()
        .execute();
      testPurchaseId = purchaseResult[0].id;

      // Create test purchase items
      await db.insert(purchaseItemsTable)
        .values([
          {
            purchase_id: testPurchaseId,
            product_id: testProduct1Id,
            quantity: 5,
            unit_cost: '10.00',
            total_cost: '50.00'
          },
          {
            purchase_id: testPurchaseId,
            product_id: testProduct2Id,
            quantity: 5,
            unit_cost: '20.00',
            total_cost: '100.00'
          }
        ])
        .execute();
    });

    it('should return purchase with items', async () => {
      const result = await getPurchaseById(testPurchaseId);

      expect(result).not.toBeNull();
      expect(result!.purchase.id).toEqual(testPurchaseId);
      expect(result!.purchase.supplier_id).toEqual(testSupplierId);
      expect(result!.purchase.total_amount).toEqual(150.00);
      expect(typeof result!.purchase.total_amount).toBe('number');

      expect(result!.items).toHaveLength(2);
      expect(result!.items[0].product_id).toEqual(testProduct1Id);
      expect(result!.items[0].unit_cost).toEqual(10.00);
      expect(result!.items[0].total_cost).toEqual(50.00);
      expect(typeof result!.items[0].unit_cost).toBe('number');
      expect(typeof result!.items[0].total_cost).toBe('number');
    });

    it('should return null for non-existent purchase', async () => {
      const result = await getPurchaseById(99999);
      expect(result).toBeNull();
    });
  });
});
