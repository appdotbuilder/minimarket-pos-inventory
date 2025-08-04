
import { db } from '../db';
import { categoriesTable, productsTable } from '../db/schema';
import { type Category, type CreateCategoryInput, type UpdateCategoryInput } from '../schema';
import { eq, count } from 'drizzle-orm';

export async function getCategories(): Promise<Category[]> {
  try {
    const results = await db.select()
      .from(categoriesTable)
      .execute();

    return results;
  } catch (error) {
    console.error('Failed to fetch categories:', error);
    throw error;
  }
}

export async function createCategory(input: CreateCategoryInput): Promise<Category> {
  try {
    const result = await db.insert(categoriesTable)
      .values({
        name: input.name,
        description: input.description
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Category creation failed:', error);
    throw error;
  }
}

export async function updateCategory(input: UpdateCategoryInput): Promise<Category> {
  try {
    const updateValues: Partial<typeof categoriesTable.$inferInsert> = {};
    
    if (input.name !== undefined) {
      updateValues.name = input.name;
    }
    if (input.description !== undefined) {
      updateValues.description = input.description;
    }
    
    updateValues.updated_at = new Date();

    const result = await db.update(categoriesTable)
      .set(updateValues)
      .where(eq(categoriesTable.id, input.id))
      .returning()
      .execute();

    if (result.length === 0) {
      throw new Error(`Category with id ${input.id} not found`);
    }

    return result[0];
  } catch (error) {
    console.error('Category update failed:', error);
    throw error;
  }
}

export async function deleteCategory(id: number): Promise<{ success: boolean }> {
  try {
    // Check if category has associated products
    const productCount = await db.select({ count: count() })
      .from(productsTable)
      .where(eq(productsTable.category_id, id))
      .execute();

    if (productCount[0].count > 0) {
      throw new Error('Cannot delete category with associated products');
    }

    const result = await db.delete(categoriesTable)
      .where(eq(categoriesTable.id, id))
      .returning({ id: categoriesTable.id })
      .execute();

    if (result.length === 0) {
      throw new Error(`Category with id ${id} not found`);
    }

    return { success: true };
  } catch (error) {
    console.error('Category deletion failed:', error);
    throw error;
  }
}
