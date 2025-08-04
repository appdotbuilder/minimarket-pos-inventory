
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { suppliersTable, categoriesTable, productsTable } from '../db/schema';
import { type CreateSupplierInput, type UpdateSupplierInput } from '../schema';
import { getSuppliers, createSupplier, updateSupplier, deleteSupplier } from '../handlers/suppliers';
import { eq } from 'drizzle-orm';

// Test data
const testSupplier: CreateSupplierInput = {
  name: 'Test Supplier',
  contact_person: 'John Doe',
  phone: '+1234567890',
  email: 'john@testsupplier.com',
  address: '123 Test Street, Test City'
};

const minimalSupplier: CreateSupplierInput = {
  name: 'Minimal Supplier',
  contact_person: null,
  phone: null,
  email: null,
  address: null
};

describe('getSuppliers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no suppliers exist', async () => {
    const result = await getSuppliers();
    expect(result).toEqual([]);
  });

  it('should return all suppliers', async () => {
    // Create test suppliers
    await createSupplier(testSupplier);
    await createSupplier(minimalSupplier);

    const result = await getSuppliers();

    expect(result).toHaveLength(2);
    expect(result[0].name).toEqual('Test Supplier');
    expect(result[0].contact_person).toEqual('John Doe');
    expect(result[0].phone).toEqual('+1234567890');
    expect(result[0].email).toEqual('john@testsupplier.com');
    expect(result[0].address).toEqual('123 Test Street, Test City');
    expect(result[0].created_at).toBeInstanceOf(Date);
    expect(result[0].updated_at).toBeInstanceOf(Date);

    expect(result[1].name).toEqual('Minimal Supplier');
    expect(result[1].contact_person).toBeNull();
    expect(result[1].phone).toBeNull();
    expect(result[1].email).toBeNull();
    expect(result[1].address).toBeNull();
  });
});

describe('createSupplier', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create supplier with all fields', async () => {
    const result = await createSupplier(testSupplier);

    expect(result.name).toEqual('Test Supplier');
    expect(result.contact_person).toEqual('John Doe');
    expect(result.phone).toEqual('+1234567890');
    expect(result.email).toEqual('john@testsupplier.com');
    expect(result.address).toEqual('123 Test Street, Test City');
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should create supplier with minimal fields', async () => {
    const result = await createSupplier(minimalSupplier);

    expect(result.name).toEqual('Minimal Supplier');
    expect(result.contact_person).toBeNull();
    expect(result.phone).toBeNull();
    expect(result.email).toBeNull();
    expect(result.address).toBeNull();
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should save supplier to database', async () => {
    const result = await createSupplier(testSupplier);

    const suppliers = await db.select()
      .from(suppliersTable)
      .where(eq(suppliersTable.id, result.id))
      .execute();

    expect(suppliers).toHaveLength(1);
    expect(suppliers[0].name).toEqual('Test Supplier');
    expect(suppliers[0].contact_person).toEqual('John Doe');
    expect(suppliers[0].phone).toEqual('+1234567890');
    expect(suppliers[0].email).toEqual('john@testsupplier.com');
    expect(suppliers[0].address).toEqual('123 Test Street, Test City');
  });
});

describe('updateSupplier', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should update all supplier fields', async () => {
    const supplier = await createSupplier(testSupplier);

    const updateInput: UpdateSupplierInput = {
      id: supplier.id,
      name: 'Updated Supplier',
      contact_person: 'Jane Smith',
      phone: '+9876543210',
      email: 'jane@updated.com',
      address: '456 Updated Ave'
    };

    const result = await updateSupplier(updateInput);

    expect(result.id).toEqual(supplier.id);
    expect(result.name).toEqual('Updated Supplier');
    expect(result.contact_person).toEqual('Jane Smith');
    expect(result.phone).toEqual('+9876543210');
    expect(result.email).toEqual('jane@updated.com');
    expect(result.address).toEqual('456 Updated Ave');
    expect(result.updated_at.getTime()).toBeGreaterThan(supplier.updated_at.getTime());
  });

  it('should update only provided fields', async () => {
    const supplier = await createSupplier(testSupplier);

    const updateInput: UpdateSupplierInput = {
      id: supplier.id,
      name: 'Partially Updated'
    };

    const result = await updateSupplier(updateInput);

    expect(result.name).toEqual('Partially Updated');
    expect(result.contact_person).toEqual('John Doe');
    expect(result.phone).toEqual('+1234567890');
    expect(result.email).toEqual('john@testsupplier.com');
    expect(result.address).toEqual('123 Test Street, Test City');
  });

  it('should update nullable fields to null', async () => {
    const supplier = await createSupplier(testSupplier);

    const updateInput: UpdateSupplierInput = {
      id: supplier.id,
      contact_person: null,
      phone: null,
      email: null,
      address: null
    };

    const result = await updateSupplier(updateInput);

    expect(result.contact_person).toBeNull();
    expect(result.phone).toBeNull();
    expect(result.email).toBeNull();
    expect(result.address).toBeNull();
    expect(result.name).toEqual('Test Supplier'); // Should remain unchanged
  });

  it('should throw error for non-existent supplier', async () => {
    const updateInput: UpdateSupplierInput = {
      id: 999,
      name: 'Non-existent'
    };

    await expect(updateSupplier(updateInput)).rejects.toThrow(/not found/i);
  });

  it('should save changes to database', async () => {
    const supplier = await createSupplier(testSupplier);

    const updateInput: UpdateSupplierInput = {
      id: supplier.id,
      name: 'Database Updated'
    };

    await updateSupplier(updateInput);

    const dbSupplier = await db.select()
      .from(suppliersTable)
      .where(eq(suppliersTable.id, supplier.id))
      .execute();

    expect(dbSupplier[0].name).toEqual('Database Updated');
  });
});

describe('deleteSupplier', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should delete supplier successfully', async () => {
    const supplier = await createSupplier(testSupplier);

    const result = await deleteSupplier(supplier.id);

    expect(result.success).toBe(true);

    // Verify supplier is deleted from database
    const suppliers = await db.select()
      .from(suppliersTable)
      .where(eq(suppliersTable.id, supplier.id))
      .execute();

    expect(suppliers).toHaveLength(0);
  });

  it('should throw error for non-existent supplier', async () => {
    await expect(deleteSupplier(999)).rejects.toThrow(/not found/i);
  });

  it('should throw error when supplier has associated products', async () => {
    // Create prerequisite data
    const supplier = await createSupplier(testSupplier);
    
    const category = await db.insert(categoriesTable)
      .values({
        name: 'Test Category',
        description: 'Test description'
      })
      .returning()
      .execute();

    // Create product with this supplier
    await db.insert(productsTable)
      .values({
        barcode: 'TEST123',
        name: 'Test Product',
        description: 'Test product',
        category_id: category[0].id,
        supplier_id: supplier.id,
        purchase_price: '10.00',
        selling_price: '15.00',
        stock_quantity: 100,
        minimum_stock: 10
      })
      .execute();

    await expect(deleteSupplier(supplier.id)).rejects.toThrow(/cannot delete supplier with associated products/i);
  });
});
