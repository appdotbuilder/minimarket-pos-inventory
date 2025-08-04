
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { productsTable, categoriesTable, suppliersTable } from '../db/schema';
import { type CreateProductInput, type UpdateProductInput, type ProductSearchInput } from '../schema';
import { getProducts, searchProducts, getProductByBarcode, createProduct, updateProduct, getLowStockProducts } from '../handlers/products';
import { eq } from 'drizzle-orm';

// Test data
const testCategory = {
  name: 'Electronics',
  description: 'Electronic devices and components'
};

const testSupplier = {
  name: 'Tech Supply Co',
  contact_person: 'John Doe',
  phone: '555-0123',
  email: 'john@techsupply.com',
  address: '123 Tech Street'
};

const testProductInput: CreateProductInput = {
  barcode: '1234567890',
  name: 'Test Product',
  description: 'A product for testing',
  category_id: 1,
  supplier_id: 1,
  purchase_price: 10.50,
  selling_price: 19.99,
  stock_quantity: 100,
  minimum_stock: 10
};

const testProductInput2: CreateProductInput = {
  barcode: '0987654321',
  name: 'Another Product',
  description: 'Another test product',
  category_id: 1,
  supplier_id: 1,
  purchase_price: 5.25,
  selling_price: 9.99,
  stock_quantity: 5,
  minimum_stock: 20
};

describe('Products Handlers', () => {
  beforeEach(async () => {
    await createDB();
    
    // Create test category
    await db.insert(categoriesTable)
      .values(testCategory)
      .execute();

    // Create test supplier
    await db.insert(suppliersTable)
      .values(testSupplier)
      .execute();
  });

  afterEach(resetDB);

  describe('getProducts', () => {
    it('should return empty array when no products exist', async () => {
      const result = await getProducts();
      expect(result).toEqual([]);
    });

    it('should return all products', async () => {
      await createProduct(testProductInput);
      await createProduct(testProductInput2);

      const result = await getProducts();

      expect(result).toHaveLength(2);
      expect(result[0].name).toEqual('Test Product');
      expect(result[1].name).toEqual('Another Product');
      expect(typeof result[0].purchase_price).toBe('number');
      expect(typeof result[0].selling_price).toBe('number');
    });
  });

  describe('searchProducts', () => {
    beforeEach(async () => {
      await createProduct(testProductInput);
      await createProduct(testProductInput2);
    });

    it('should search by product name', async () => {
      const input: ProductSearchInput = {
        query: 'Test Product'
      };

      const result = await searchProducts(input);

      expect(result).toHaveLength(1);
      expect(result[0].name).toEqual('Test Product');
    });

    it('should search by barcode', async () => {
      const input: ProductSearchInput = {
        barcode: '1234567890'
      };

      const result = await searchProducts(input);

      expect(result).toHaveLength(1);
      expect(result[0].barcode).toEqual('1234567890');
    });

    it('should search by category_id', async () => {
      const input: ProductSearchInput = {
        category_id: 1
      };

      const result = await searchProducts(input);

      expect(result).toHaveLength(2);
    });

    it('should filter by is_active', async () => {
      // Deactivate one product
      await db.update(productsTable)
        .set({ is_active: false })
        .where(eq(productsTable.barcode, '1234567890'))
        .execute();

      const input: ProductSearchInput = {
        is_active: true
      };

      const result = await searchProducts(input);

      expect(result).toHaveLength(1);
      expect(result[0].barcode).toEqual('0987654321');
    });

    it('should filter low stock products', async () => {
      const input: ProductSearchInput = {
        low_stock_only: true
      };

      const result = await searchProducts(input);

      expect(result).toHaveLength(1);
      expect(result[0].barcode).toEqual('0987654321');
      expect(result[0].stock_quantity).toBeLessThanOrEqual(result[0].minimum_stock);
    });

    it('should search with multiple filters', async () => {
      const input: ProductSearchInput = {
        query: 'Product',
        category_id: 1,
        is_active: true
      };

      const result = await searchProducts(input);

      expect(result).toHaveLength(2);
    });

    it('should return empty array when no matches found', async () => {
      const input: ProductSearchInput = {
        query: 'Nonexistent Product'
      };

      const result = await searchProducts(input);

      expect(result).toEqual([]);
    });
  });

  describe('getProductByBarcode', () => {
    beforeEach(async () => {
      await createProduct(testProductInput);
    });

    it('should return product by barcode', async () => {
      const result = await getProductByBarcode('1234567890');

      expect(result).not.toBeNull();
      expect(result!.barcode).toEqual('1234567890');
      expect(result!.name).toEqual('Test Product');
      expect(typeof result!.purchase_price).toBe('number');
      expect(typeof result!.selling_price).toBe('number');
    });

    it('should return null when product not found', async () => {
      const result = await getProductByBarcode('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('createProduct', () => {
    it('should create a new product', async () => {
      const result = await createProduct(testProductInput);

      expect(result.barcode).toEqual('1234567890');
      expect(result.name).toEqual('Test Product');
      expect(result.description).toEqual('A product for testing');
      expect(result.category_id).toEqual(1);
      expect(result.supplier_id).toEqual(1);
      expect(result.purchase_price).toEqual(10.50);
      expect(result.selling_price).toEqual(19.99);
      expect(result.stock_quantity).toEqual(100);
      expect(result.minimum_stock).toEqual(10);
      expect(result.is_active).toBe(true);
      expect(result.id).toBeDefined();
      expect(result.created_at).toBeInstanceOf(Date);
    });

    it('should save product to database', async () => {
      const result = await createProduct(testProductInput);

      const products = await db.select()
        .from(productsTable)
        .where(eq(productsTable.id, result.id))
        .execute();

      expect(products).toHaveLength(1);
      expect(products[0].name).toEqual('Test Product');
      expect(parseFloat(products[0].purchase_price)).toEqual(10.50);
      expect(parseFloat(products[0].selling_price)).toEqual(19.99);
    });

    it('should create product with null supplier', async () => {
      const input: CreateProductInput = {
        ...testProductInput,
        supplier_id: null
      };

      const result = await createProduct(input);

      expect(result.supplier_id).toBeNull();
    });

    it('should throw error for invalid category', async () => {
      const input: CreateProductInput = {
        ...testProductInput,
        category_id: 999
      };

      expect(createProduct(input)).rejects.toThrow(/category not found/i);
    });

    it('should throw error for invalid supplier', async () => {
      const input: CreateProductInput = {
        ...testProductInput,
        supplier_id: 999
      };

      expect(createProduct(input)).rejects.toThrow(/supplier not found/i);
    });
  });

  describe('updateProduct', () => {
    let productId: number;

    beforeEach(async () => {
      const product = await createProduct(testProductInput);
      productId = product.id;
    });

    it('should update product fields', async () => {
      const input: UpdateProductInput = {
        id: productId,
        name: 'Updated Product',
        selling_price: 29.99,
        stock_quantity: 150
      };

      const result = await updateProduct(input);

      expect(result.name).toEqual('Updated Product');
      expect(result.selling_price).toEqual(29.99);
      expect(result.stock_quantity).toEqual(150);
      expect(result.barcode).toEqual('1234567890'); // Unchanged
    });

    it('should update product in database', async () => {
      const input: UpdateProductInput = {
        id: productId,
        name: 'Updated Product',
        is_active: false
      };

      await updateProduct(input);

      const products = await db.select()
        .from(productsTable)
        .where(eq(productsTable.id, productId))
        .execute();

      expect(products[0].name).toEqual('Updated Product');
      expect(products[0].is_active).toBe(false);
    });

    it('should update supplier to null', async () => {
      const input: UpdateProductInput = {
        id: productId,
        supplier_id: null
      };

      const result = await updateProduct(input);

      expect(result.supplier_id).toBeNull();
    });

    it('should throw error for nonexistent product', async () => {
      const input: UpdateProductInput = {
        id: 999,
        name: 'Updated Product'
      };

      expect(updateProduct(input)).rejects.toThrow(/product not found/i);
    });

    it('should throw error for invalid category', async () => {
      const input: UpdateProductInput = {
        id: productId,
        category_id: 999
      };

      expect(updateProduct(input)).rejects.toThrow(/category not found/i);
    });

    it('should throw error for invalid supplier', async () => {
      const input: UpdateProductInput = {
        id: productId,
        supplier_id: 999
      };

      expect(updateProduct(input)).rejects.toThrow(/supplier not found/i);
    });
  });

  describe('getLowStockProducts', () => {
    beforeEach(async () => {
      await createProduct(testProductInput); // stock: 100, min: 10 (not low stock)
      await createProduct(testProductInput2); // stock: 5, min: 20 (low stock)
    });

    it('should return products with low stock', async () => {
      const result = await getLowStockProducts();

      expect(result).toHaveLength(1);
      expect(result[0].barcode).toEqual('0987654321');
      expect(result[0].stock_quantity).toBeLessThanOrEqual(result[0].minimum_stock);
    });

    it('should only return active products', async () => {
      // Deactivate the low stock product
      await db.update(productsTable)
        .set({ is_active: false })
        .where(eq(productsTable.barcode, '0987654321'))
        .execute();

      const result = await getLowStockProducts();

      expect(result).toHaveLength(0);
    });

    it('should return empty array when no low stock products', async () => {
      // Update the low stock product to have sufficient stock
      await db.update(productsTable)
        .set({ stock_quantity: 50 })
        .where(eq(productsTable.barcode, '0987654321'))
        .execute();

      const result = await getLowStockProducts();

      expect(result).toEqual([]);
    });
  });
});
