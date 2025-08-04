
import { db } from '../db';
import { productsTable, categoriesTable, suppliersTable } from '../db/schema';
import { type Product, type CreateProductInput, type UpdateProductInput, type ProductSearchInput } from '../schema';
import { eq, and, or, like, lte, SQL } from 'drizzle-orm';

export async function getProducts(): Promise<Product[]> {
  try {
    const results = await db.select()
      .from(productsTable)
      .execute();

    return results.map(product => ({
      ...product,
      purchase_price: parseFloat(product.purchase_price),
      selling_price: parseFloat(product.selling_price)
    }));
  } catch (error) {
    console.error('Failed to fetch products:', error);
    throw error;
  }
}

export async function searchProducts(input: ProductSearchInput): Promise<Product[]> {
  try {
    const conditions: SQL<unknown>[] = [];

    if (input.query) {
      conditions.push(
        or(
          like(productsTable.name, `%${input.query}%`),
          like(productsTable.barcode, `%${input.query}%`),
          like(productsTable.description, `%${input.query}%`)
        )!
      );
    }

    if (input.category_id !== undefined) {
      conditions.push(eq(productsTable.category_id, input.category_id));
    }

    if (input.barcode) {
      conditions.push(eq(productsTable.barcode, input.barcode));
    }

    if (input.is_active !== undefined) {
      conditions.push(eq(productsTable.is_active, input.is_active));
    }

    if (input.low_stock_only === true) {
      conditions.push(lte(productsTable.stock_quantity, productsTable.minimum_stock));
    }

    const results = conditions.length > 0
      ? await db.select()
          .from(productsTable)
          .where(conditions.length === 1 ? conditions[0] : and(...conditions))
          .execute()
      : await db.select()
          .from(productsTable)
          .execute();

    return results.map(product => ({
      ...product,
      purchase_price: parseFloat(product.purchase_price),
      selling_price: parseFloat(product.selling_price)
    }));
  } catch (error) {
    console.error('Product search failed:', error);
    throw error;
  }
}

export async function getProductByBarcode(barcode: string): Promise<Product | null> {
  try {
    const results = await db.select()
      .from(productsTable)
      .where(eq(productsTable.barcode, barcode))
      .execute();

    if (results.length === 0) {
      return null;
    }

    const product = results[0];
    return {
      ...product,
      purchase_price: parseFloat(product.purchase_price),
      selling_price: parseFloat(product.selling_price)
    };
  } catch (error) {
    console.error('Failed to fetch product by barcode:', error);
    throw error;
  }
}

export async function createProduct(input: CreateProductInput): Promise<Product> {
  try {
    // Verify category exists
    const categoryExists = await db.select()
      .from(categoriesTable)
      .where(eq(categoriesTable.id, input.category_id))
      .execute();

    if (categoryExists.length === 0) {
      throw new Error('Category not found');
    }

    // Verify supplier exists if provided
    if (input.supplier_id !== null) {
      const supplierExists = await db.select()
        .from(suppliersTable)
        .where(eq(suppliersTable.id, input.supplier_id))
        .execute();

      if (supplierExists.length === 0) {
        throw new Error('Supplier not found');
      }
    }

    const result = await db.insert(productsTable)
      .values({
        barcode: input.barcode,
        name: input.name,
        description: input.description,
        category_id: input.category_id,
        supplier_id: input.supplier_id,
        purchase_price: input.purchase_price.toString(),
        selling_price: input.selling_price.toString(),
        stock_quantity: input.stock_quantity,
        minimum_stock: input.minimum_stock
      })
      .returning()
      .execute();

    const product = result[0];
    return {
      ...product,
      purchase_price: parseFloat(product.purchase_price),
      selling_price: parseFloat(product.selling_price)
    };
  } catch (error) {
    console.error('Product creation failed:', error);
    throw error;
  }
}

export async function updateProduct(input: UpdateProductInput): Promise<Product> {
  try {
    // Check if product exists
    const existingProduct = await db.select()
      .from(productsTable)
      .where(eq(productsTable.id, input.id))
      .execute();

    if (existingProduct.length === 0) {
      throw new Error('Product not found');
    }

    // Verify category exists if provided
    if (input.category_id !== undefined) {
      const categoryExists = await db.select()
        .from(categoriesTable)
        .where(eq(categoriesTable.id, input.category_id))
        .execute();

      if (categoryExists.length === 0) {
        throw new Error('Category not found');
      }
    }

    // Verify supplier exists if provided
    if (input.supplier_id !== undefined && input.supplier_id !== null) {
      const supplierExists = await db.select()
        .from(suppliersTable)
        .where(eq(suppliersTable.id, input.supplier_id))
        .execute();

      if (supplierExists.length === 0) {
        throw new Error('Supplier not found');
      }
    }

    // Build update values, converting numeric fields to strings
    const updateValues: any = {};
    
    if (input.barcode !== undefined) updateValues.barcode = input.barcode;
    if (input.name !== undefined) updateValues.name = input.name;
    if (input.description !== undefined) updateValues.description = input.description;
    if (input.category_id !== undefined) updateValues.category_id = input.category_id;
    if (input.supplier_id !== undefined) updateValues.supplier_id = input.supplier_id;
    if (input.purchase_price !== undefined) updateValues.purchase_price = input.purchase_price.toString();
    if (input.selling_price !== undefined) updateValues.selling_price = input.selling_price.toString();
    if (input.stock_quantity !== undefined) updateValues.stock_quantity = input.stock_quantity;
    if (input.minimum_stock !== undefined) updateValues.minimum_stock = input.minimum_stock;
    if (input.is_active !== undefined) updateValues.is_active = input.is_active;

    updateValues.updated_at = new Date();

    const result = await db.update(productsTable)
      .set(updateValues)
      .where(eq(productsTable.id, input.id))
      .returning()
      .execute();

    const product = result[0];
    return {
      ...product,
      purchase_price: parseFloat(product.purchase_price),
      selling_price: parseFloat(product.selling_price)
    };
  } catch (error) {
    console.error('Product update failed:', error);
    throw error;
  }
}

export async function getLowStockProducts(): Promise<Product[]> {
  try {
    const results = await db.select()
      .from(productsTable)
      .where(
        and(
          lte(productsTable.stock_quantity, productsTable.minimum_stock),
          eq(productsTable.is_active, true)
        )
      )
      .execute();

    return results.map(product => ({
      ...product,
      purchase_price: parseFloat(product.purchase_price),
      selling_price: parseFloat(product.selling_price)
    }));
  } catch (error) {
    console.error('Failed to fetch low stock products:', error);
    throw error;
  }
}
