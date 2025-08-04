
import { db } from '../db';
import { suppliersTable, productsTable } from '../db/schema';
import { type Supplier, type CreateSupplierInput, type UpdateSupplierInput } from '../schema';
import { eq, count } from 'drizzle-orm';

export async function getSuppliers(): Promise<Supplier[]> {
  try {
    const results = await db.select()
      .from(suppliersTable)
      .execute();

    return results;
  } catch (error) {
    console.error('Failed to fetch suppliers:', error);
    throw error;
  }
}

export async function createSupplier(input: CreateSupplierInput): Promise<Supplier> {
  try {
    const result = await db.insert(suppliersTable)
      .values({
        name: input.name,
        contact_person: input.contact_person,
        phone: input.phone,
        email: input.email,
        address: input.address
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Failed to create supplier:', error);
    throw error;
  }
}

export async function updateSupplier(input: UpdateSupplierInput): Promise<Supplier> {
  try {
    // Build update object with only provided fields
    const updateData: Partial<CreateSupplierInput> = {};
    
    if (input.name !== undefined) updateData.name = input.name;
    if (input.contact_person !== undefined) updateData.contact_person = input.contact_person;
    if (input.phone !== undefined) updateData.phone = input.phone;
    if (input.email !== undefined) updateData.email = input.email;
    if (input.address !== undefined) updateData.address = input.address;

    const result = await db.update(suppliersTable)
      .set({
        ...updateData,
        updated_at: new Date()
      })
      .where(eq(suppliersTable.id, input.id))
      .returning()
      .execute();

    if (result.length === 0) {
      throw new Error(`Supplier with id ${input.id} not found`);
    }

    return result[0];
  } catch (error) {
    console.error('Failed to update supplier:', error);
    throw error;
  }
}

export async function deleteSupplier(id: number): Promise<{ success: boolean }> {
  try {
    // Check if supplier has any products
    const productCount = await db.select({ count: count() })
      .from(productsTable)
      .where(eq(productsTable.supplier_id, id))
      .execute();

    if (productCount[0].count > 0) {
      throw new Error('Cannot delete supplier with associated products');
    }

    const result = await db.delete(suppliersTable)
      .where(eq(suppliersTable.id, id))
      .returning()
      .execute();

    if (result.length === 0) {
      throw new Error(`Supplier with id ${id} not found`);
    }

    return { success: true };
  } catch (error) {
    console.error('Failed to delete supplier:', error);
    throw error;
  }
}
