
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { categoriesTable, productsTable } from '../db/schema';
import { type CreateCategoryInput, type UpdateCategoryInput } from '../schema';
import { getCategories, createCategory, updateCategory, deleteCategory } from '../handlers/categories';
import { eq } from 'drizzle-orm';

// Test inputs
const testCategoryInput: CreateCategoryInput = {
  name: 'Electronics',
  description: 'Electronic devices and accessories'
};

const testCategoryWithNullDescription: CreateCategoryInput = {
  name: 'Books',
  description: null
};

describe('getCategories', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no categories exist', async () => {
    const result = await getCategories();
    expect(result).toEqual([]);
  });

  it('should return all categories', async () => {
    // Create test categories
    await db.insert(categoriesTable)
      .values([
        { name: 'Electronics', description: 'Electronic devices' },
        { name: 'Books', description: null }
      ])
      .execute();

    const result = await getCategories();

    expect(result).toHaveLength(2);
    expect(result[0].name).toEqual('Electronics');
    expect(result[0].description).toEqual('Electronic devices');
    expect(result[1].name).toEqual('Books');
    expect(result[1].description).toBeNull();
    expect(result[0].created_at).toBeInstanceOf(Date);
    expect(result[0].updated_at).toBeInstanceOf(Date);
  });
});

describe('createCategory', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a category with description', async () => {
    const result = await createCategory(testCategoryInput);

    expect(result.name).toEqual('Electronics');
    expect(result.description).toEqual('Electronic devices and accessories');
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should create a category with null description', async () => {
    const result = await createCategory(testCategoryWithNullDescription);

    expect(result.name).toEqual('Books');
    expect(result.description).toBeNull();
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should save category to database', async () => {
    const result = await createCategory(testCategoryInput);

    const categories = await db.select()
      .from(categoriesTable)
      .where(eq(categoriesTable.id, result.id))
      .execute();

    expect(categories).toHaveLength(1);
    expect(categories[0].name).toEqual('Electronics');
    expect(categories[0].description).toEqual('Electronic devices and accessories');
  });
});

describe('updateCategory', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should update category name only', async () => {
    // Create a category first
    const created = await createCategory(testCategoryInput);

    const updateInput: UpdateCategoryInput = {
      id: created.id,
      name: 'Updated Electronics'
    };

    const result = await updateCategory(updateInput);

    expect(result.id).toEqual(created.id);
    expect(result.name).toEqual('Updated Electronics');
    expect(result.description).toEqual('Electronic devices and accessories'); // Should remain unchanged
    expect(result.updated_at.getTime()).toBeGreaterThan(result.created_at.getTime());
  });

  it('should update category description only', async () => {
    const created = await createCategory(testCategoryInput);

    const updateInput: UpdateCategoryInput = {
      id: created.id,
      description: 'Updated description'
    };

    const result = await updateCategory(updateInput);

    expect(result.id).toEqual(created.id);
    expect(result.name).toEqual('Electronics'); // Should remain unchanged
    expect(result.description).toEqual('Updated description');
  });

  it('should update both name and description', async () => {
    const created = await createCategory(testCategoryInput);

    const updateInput: UpdateCategoryInput = {
      id: created.id,
      name: 'Home Electronics',
      description: 'Home electronic devices'
    };

    const result = await updateCategory(updateInput);

    expect(result.id).toEqual(created.id);
    expect(result.name).toEqual('Home Electronics');
    expect(result.description).toEqual('Home electronic devices');
  });

  it('should update description to null', async () => {
    const created = await createCategory(testCategoryInput);

    const updateInput: UpdateCategoryInput = {
      id: created.id,
      description: null
    };

    const result = await updateCategory(updateInput);

    expect(result.description).toBeNull();
  });

  it('should throw error for non-existent category', async () => {
    const updateInput: UpdateCategoryInput = {
      id: 999,
      name: 'Non-existent'
    };

    await expect(updateCategory(updateInput)).rejects.toThrow(/not found/i);
  });

  it('should save updates to database', async () => {
    const created = await createCategory(testCategoryInput);

    const updateInput: UpdateCategoryInput = {
      id: created.id,
      name: 'Updated Name'
    };

    await updateCategory(updateInput);

    const categories = await db.select()
      .from(categoriesTable)
      .where(eq(categoriesTable.id, created.id))
      .execute();

    expect(categories[0].name).toEqual('Updated Name');
  });
});

describe('deleteCategory', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should delete category successfully', async () => {
    const created = await createCategory(testCategoryInput);

    const result = await deleteCategory(created.id);

    expect(result.success).toBe(true);

    // Verify category is deleted
    const categories = await db.select()
      .from(categoriesTable)
      .where(eq(categoriesTable.id, created.id))
      .execute();

    expect(categories).toHaveLength(0);
  });

  it('should throw error for non-existent category', async () => {
    await expect(deleteCategory(999)).rejects.toThrow(/not found/i);
  });

  it('should throw error when category has associated products', async () => {
    // Create category first
    const category = await createCategory(testCategoryInput);

    // Create a product with this category
    await db.insert(productsTable)
      .values({
        barcode: '123456789',
        name: 'Test Product',
        description: 'A test product',
        category_id: category.id,
        supplier_id: null,
        purchase_price: '10.00',
        selling_price: '15.00',
        stock_quantity: 100,
        minimum_stock: 10,
        is_active: true
      })
      .execute();

    await expect(deleteCategory(category.id)).rejects.toThrow(/cannot delete category with associated products/i);
  });
});
