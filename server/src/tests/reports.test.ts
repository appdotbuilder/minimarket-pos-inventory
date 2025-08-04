
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { 
  usersTable, 
  categoriesTable, 
  suppliersTable, 
  productsTable, 
  salesTable, 
  saleItemsTable 
} from '../db/schema';
import { 
  getSalesReport, 
  getStockReport, 
  getDashboardData, 
  exportSalesData 
} from '../handlers/reports';
import type { SalesReportInput, StockReportInput } from '../schema';

describe('Reports Handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let testUserId: number;
  let testCategoryId: number;
  let testSupplierId: number;
  let testProductId: number;
  let testSaleId: number;

  beforeEach(async () => {
    // Create test user
    const user = await db.insert(usersTable)
      .values({
        username: 'testcashier',
        email: 'cashier@test.com',
        password_hash: 'hashedpassword',
        role: 'cashier'
      })
      .returning()
      .execute();
    testUserId = user[0].id;

    // Create test category
    const category = await db.insert(categoriesTable)
      .values({
        name: 'Test Category',
        description: 'A test category'
      })
      .returning()
      .execute();
    testCategoryId = category[0].id;

    // Create test supplier
    const supplier = await db.insert(suppliersTable)
      .values({
        name: 'Test Supplier',
        contact_person: 'John Doe',
        phone: '1234567890'
      })
      .returning()
      .execute();
    testSupplierId = supplier[0].id;

    // Create test product
    const product = await db.insert(productsTable)
      .values({
        barcode: 'TEST123',
        name: 'Test Product',
        description: 'A test product',
        category_id: testCategoryId,
        supplier_id: testSupplierId,
        purchase_price: '10.00',
        selling_price: '15.99',
        stock_quantity: 50,
        minimum_stock: 10
      })
      .returning()
      .execute();
    testProductId = product[0].id;

    // Create test sale
    const sale = await db.insert(salesTable)
      .values({
        transaction_number: 'TXN001',
        cashier_id: testUserId,
        subtotal: '31.98',
        discount_amount: '0.00',
        tax_amount: '2.56',
        total_amount: '34.54',
        payment_method: 'cash',
        amount_paid: '35.00',
        change_amount: '0.46',
        status: 'completed'
      })
      .returning()
      .execute();
    testSaleId = sale[0].id;

    // Create test sale item
    await db.insert(saleItemsTable)
      .values({
        sale_id: testSaleId,
        product_id: testProductId,
        barcode: 'TEST123',
        product_name: 'Test Product',
        quantity: 2,
        unit_price: '15.99',
        total_price: '31.98'
      })
      .execute();
  });

  describe('getSalesReport', () => {
    it('should generate sales report with totals', async () => {
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const input: SalesReportInput = {
        start_date: today,
        end_date: tomorrow
      };

      const result = await getSalesReport(input);

      expect(result.total_sales).toBe(34.54);
      expect(result.total_transactions).toBe(1);
      expect(result.average_transaction).toBe(34.54);
      expect(result.top_products).toHaveLength(1);
      expect(result.top_products[0].product_id).toBe(testProductId);
      expect(result.top_products[0].product_name).toBe('Test Product');
      expect(result.top_products[0].quantity_sold).toBe(2);
      expect(result.top_products[0].revenue).toBe(31.98);
      expect(result.daily_breakdown).toHaveLength(1);
      expect(result.daily_breakdown[0].sales).toBe(34.54);
      expect(result.daily_breakdown[0].transactions).toBe(1);
    });

    it('should filter by cashier_id', async () => {
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const input: SalesReportInput = {
        start_date: today,
        end_date: tomorrow,
        cashier_id: testUserId
      };

      const result = await getSalesReport(input);

      expect(result.total_sales).toBe(34.54);
      expect(result.total_transactions).toBe(1);
    });

    it('should return empty report for date range with no sales', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 2);
      const dayBefore = new Date(yesterday);
      dayBefore.setDate(dayBefore.getDate() - 1);

      const input: SalesReportInput = {
        start_date: dayBefore,
        end_date: yesterday
      };

      const result = await getSalesReport(input);

      expect(result.total_sales).toBe(0);
      expect(result.total_transactions).toBe(0);
      expect(result.average_transaction).toBe(0);
      expect(result.top_products).toHaveLength(0);
      expect(result.daily_breakdown).toHaveLength(0);
    });
  });

  describe('getStockReport', () => {
    it('should generate stock report with all products', async () => {
      const input: StockReportInput = {};

      const result = await getStockReport(input);

      expect(result.total_products).toBe(1);
      expect(result.low_stock_count).toBe(0);
      expect(result.total_stock_value).toBe(50 * 15.99);
      expect(result.products).toHaveLength(1);
      expect(result.products[0].id).toBe(testProductId);
      expect(result.products[0].name).toBe('Test Product');
      expect(result.products[0].barcode).toBe('TEST123');
      expect(result.products[0].category).toBe('Test Category');
      expect(result.products[0].current_stock).toBe(50);
      expect(result.products[0].minimum_stock).toBe(10);
      expect(result.products[0].stock_value).toBe(50 * 15.99);
      expect(result.products[0].supplier).toBe('Test Supplier');
    });

    it('should filter by category_id', async () => {
      const input: StockReportInput = {
        category_id: testCategoryId
      };

      const result = await getStockReport(input);

      expect(result.total_products).toBe(1);
      expect(result.products[0].category).toBe('Test Category');
    });

    it('should filter by supplier_id', async () => {
      const input: StockReportInput = {
        supplier_id: testSupplierId
      };

      const result = await getStockReport(input);

      expect(result.total_products).toBe(1);
      expect(result.products[0].supplier).toBe('Test Supplier');
    });

    it('should filter low stock products only', async () => {
      // Create a low stock product
      await db.insert(productsTable)
        .values({
          barcode: 'LOW123',
          name: 'Low Stock Product',
          description: 'A low stock product',
          category_id: testCategoryId,
          supplier_id: testSupplierId,
          purchase_price: '5.00',
          selling_price: '8.99',
          stock_quantity: 5,
          minimum_stock: 10
        })
        .execute();

      const input: StockReportInput = {
        low_stock_only: true
      };

      const result = await getStockReport(input);

      expect(result.total_products).toBe(1);
      expect(result.low_stock_count).toBe(1);
      expect(result.products[0].name).toBe('Low Stock Product');
      expect(result.products[0].current_stock).toBeLessThanOrEqual(result.products[0].minimum_stock);
    });
  });

  describe('getDashboardData', () => {
    it('should return dashboard summary data', async () => {
      const result = await getDashboardData();

      expect(typeof result.daily_sales).toBe('number');
      expect(typeof result.weekly_sales).toBe('number');
      expect(typeof result.monthly_sales).toBe('number');
      expect(typeof result.total_transactions).toBe('number');
      expect(typeof result.low_stock_products).toBe('number');
      expect(Array.isArray(result.top_selling_products)).toBe(true);
      expect(Array.isArray(result.recent_transactions)).toBe(true);

      // Should include our test sale in recent transactions
      expect(result.recent_transactions.length).toBeGreaterThan(0);
      expect(result.recent_transactions[0].transaction_number).toBe('TXN001');
      expect(result.recent_transactions[0].total_amount).toBe(34.54);
    });

    it('should include top selling products', async () => {
      const result = await getDashboardData();

      if (result.top_selling_products.length > 0) {
        const topProduct = result.top_selling_products[0];
        expect(topProduct.product_id).toBe(testProductId);
        expect(topProduct.product_name).toBe('Test Product');
        expect(topProduct.total_sold).toBe(2);
        expect(topProduct.revenue).toBe(31.98);
      }
    });
  });

  describe('exportSalesData', () => {
    it('should export sales data as CSV', async () => {
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const input: SalesReportInput = {
        start_date: today,
        end_date: tomorrow
      };

      const result = await exportSalesData(input);

      expect(result.csv_data).toContain('Transaction Number,Cashier,Date,Subtotal,Discount,Tax,Total,Payment Method,Amount Paid,Change');
      expect(result.csv_data).toContain('TXN001');
      expect(result.csv_data).toContain('testcashier');
      expect(result.csv_data).toContain('31.98');
      expect(result.csv_data).toContain('34.54');
      expect(result.csv_data).toContain('cash');
    });

    it('should filter CSV export by cashier_id', async () => {
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const input: SalesReportInput = {
        start_date: today,
        end_date: tomorrow,
        cashier_id: testUserId
      };

      const result = await exportSalesData(input);

      expect(result.csv_data).toContain('TXN001');
      expect(result.csv_data).toContain('testcashier');
    });

    it('should return empty CSV data for date range with no sales', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 2);
      const dayBefore = new Date(yesterday);
      dayBefore.setDate(dayBefore.getDate() - 1);

      const input: SalesReportInput = {
        start_date: dayBefore,
        end_date: yesterday
      };

      const result = await exportSalesData(input);

      expect(result.csv_data).toContain('Transaction Number,Cashier,Date,Subtotal,Discount,Tax,Total,Payment Method,Amount Paid,Change');
      // Should only contain header, no data rows
      expect(result.csv_data.split('\n')).toHaveLength(2); // Header + empty line
    });
  });
});
