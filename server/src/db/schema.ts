
import { 
  serial, 
  text, 
  pgTable, 
  timestamp, 
  numeric, 
  integer, 
  boolean, 
  pgEnum,
  varchar,
  uniqueIndex
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const userRoleEnum = pgEnum('user_role', ['admin', 'cashier']);
export const movementTypeEnum = pgEnum('movement_type', ['in', 'out', 'adjustment']);
export const referenceTypeEnum = pgEnum('reference_type', ['sale', 'purchase', 'adjustment']);
export const paymentMethodEnum = pgEnum('payment_method', ['cash', 'card', 'mixed']);
export const saleStatusEnum = pgEnum('sale_status', ['completed', 'cancelled', 'refunded']);
export const purchaseStatusEnum = pgEnum('purchase_status', ['pending', 'completed', 'cancelled']);

// Users table
export const usersTable = pgTable('users', {
  id: serial('id').primaryKey(),
  username: varchar('username', { length: 50 }).notNull().unique(),
  email: varchar('email', { length: 100 }).notNull().unique(),
  password_hash: text('password_hash').notNull(),
  role: userRoleEnum('role').notNull(),
  is_active: boolean('is_active').notNull().default(true),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Categories table
export const categoriesTable = pgTable('categories', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Suppliers table
export const suppliersTable = pgTable('suppliers', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  contact_person: varchar('contact_person', { length: 100 }),
  phone: varchar('phone', { length: 20 }),
  email: varchar('email', { length: 100 }),
  address: text('address'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Products table
export const productsTable = pgTable('products', {
  id: serial('id').primaryKey(),
  barcode: varchar('barcode', { length: 50 }).notNull(),
  name: varchar('name', { length: 200 }).notNull(),
  description: text('description'),
  category_id: integer('category_id').notNull().references(() => categoriesTable.id),
  supplier_id: integer('supplier_id').references(() => suppliersTable.id),
  purchase_price: numeric('purchase_price', { precision: 10, scale: 2 }).notNull(),
  selling_price: numeric('selling_price', { precision: 10, scale: 2 }).notNull(),
  stock_quantity: integer('stock_quantity').notNull().default(0),
  minimum_stock: integer('minimum_stock').notNull().default(0),
  is_active: boolean('is_active').notNull().default(true),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  barcodeIdx: uniqueIndex('barcode_idx').on(table.barcode),
}));

// Stock movements table
export const stockMovementsTable = pgTable('stock_movements', {
  id: serial('id').primaryKey(),
  product_id: integer('product_id').notNull().references(() => productsTable.id),
  movement_type: movementTypeEnum('movement_type').notNull(),
  quantity: integer('quantity').notNull(),
  reference_type: referenceTypeEnum('reference_type'),
  reference_id: integer('reference_id'),
  notes: text('notes'),
  created_by: integer('created_by').notNull().references(() => usersTable.id),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// Sales table
export const salesTable = pgTable('sales', {
  id: serial('id').primaryKey(),
  transaction_number: varchar('transaction_number', { length: 50 }).notNull().unique(),
  cashier_id: integer('cashier_id').notNull().references(() => usersTable.id),
  subtotal: numeric('subtotal', { precision: 10, scale: 2 }).notNull(),
  discount_amount: numeric('discount_amount', { precision: 10, scale: 2 }).notNull().default('0'),
  tax_amount: numeric('tax_amount', { precision: 10, scale: 2 }).notNull().default('0'),
  total_amount: numeric('total_amount', { precision: 10, scale: 2 }).notNull(),
  payment_method: paymentMethodEnum('payment_method').notNull(),
  amount_paid: numeric('amount_paid', { precision: 10, scale: 2 }).notNull(),
  change_amount: numeric('change_amount', { precision: 10, scale: 2 }).notNull().default('0'),
  status: saleStatusEnum('status').notNull().default('completed'),
  cancelled_by: integer('cancelled_by').references(() => usersTable.id),
  cancelled_at: timestamp('cancelled_at'),
  cancellation_reason: text('cancellation_reason'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Sale items table
export const saleItemsTable = pgTable('sale_items', {
  id: serial('id').primaryKey(),
  sale_id: integer('sale_id').notNull().references(() => salesTable.id),
  product_id: integer('product_id').notNull().references(() => productsTable.id),
  barcode: varchar('barcode', { length: 50 }).notNull(),
  product_name: varchar('product_name', { length: 200 }).notNull(),
  quantity: integer('quantity').notNull(),
  unit_price: numeric('unit_price', { precision: 10, scale: 2 }).notNull(),
  total_price: numeric('total_price', { precision: 10, scale: 2 }).notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// Purchases table
export const purchasesTable = pgTable('purchases', {
  id: serial('id').primaryKey(),
  supplier_id: integer('supplier_id').notNull().references(() => suppliersTable.id),
  purchase_number: varchar('purchase_number', { length: 50 }).notNull().unique(),
  total_amount: numeric('total_amount', { precision: 10, scale: 2 }).notNull(),
  status: purchaseStatusEnum('status').notNull().default('pending'),
  created_by: integer('created_by').notNull().references(() => usersTable.id),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Purchase items table
export const purchaseItemsTable = pgTable('purchase_items', {
  id: serial('id').primaryKey(),
  purchase_id: integer('purchase_id').notNull().references(() => purchasesTable.id),
  product_id: integer('product_id').notNull().references(() => productsTable.id),
  quantity: integer('quantity').notNull(),
  unit_cost: numeric('unit_cost', { precision: 10, scale: 2 }).notNull(),
  total_cost: numeric('total_cost', { precision: 10, scale: 2 }).notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(usersTable, ({ many }) => ({
  sales: many(salesTable, { relationName: 'cashier_sales' }),
  cancelledSales: many(salesTable, { relationName: 'cancelled_sales' }),
  stockMovements: many(stockMovementsTable),
  purchases: many(purchasesTable),
}));

export const categoriesRelations = relations(categoriesTable, ({ many }) => ({
  products: many(productsTable),
}));

export const suppliersRelations = relations(suppliersTable, ({ many }) => ({
  products: many(productsTable),
  purchases: many(purchasesTable),
}));

export const productsRelations = relations(productsTable, ({ one, many }) => ({
  category: one(categoriesTable, {
    fields: [productsTable.category_id],
    references: [categoriesTable.id],
  }),
  supplier: one(suppliersTable, {
    fields: [productsTable.supplier_id],
    references: [suppliersTable.id],
  }),
  stockMovements: many(stockMovementsTable),
  saleItems: many(saleItemsTable),
  purchaseItems: many(purchaseItemsTable),
}));

export const stockMovementsRelations = relations(stockMovementsTable, ({ one }) => ({
  product: one(productsTable, {
    fields: [stockMovementsTable.product_id],
    references: [productsTable.id],
  }),
  createdBy: one(usersTable, {
    fields: [stockMovementsTable.created_by],
    references: [usersTable.id],
  }),
}));

export const salesRelations = relations(salesTable, ({ one, many }) => ({
  cashier: one(usersTable, {
    fields: [salesTable.cashier_id],
    references: [usersTable.id],
    relationName: 'cashier_sales',
  }),
  cancelledBy: one(usersTable, {
    fields: [salesTable.cancelled_by],
    references: [usersTable.id],
    relationName: 'cancelled_sales',
  }),
  items: many(saleItemsTable),
}));

export const saleItemsRelations = relations(saleItemsTable, ({ one }) => ({
  sale: one(salesTable, {
    fields: [saleItemsTable.sale_id],
    references: [salesTable.id],
  }),
  product: one(productsTable, {
    fields: [saleItemsTable.product_id],
    references: [productsTable.id],
  }),
}));

export const purchasesRelations = relations(purchasesTable, ({ one, many }) => ({
  supplier: one(suppliersTable, {
    fields: [purchasesTable.supplier_id],
    references: [suppliersTable.id],
  }),
  createdBy: one(usersTable, {
    fields: [purchasesTable.created_by],
    references: [usersTable.id],
  }),
  items: many(purchaseItemsTable),
}));

export const purchaseItemsRelations = relations(purchaseItemsTable, ({ one }) => ({
  purchase: one(purchasesTable, {
    fields: [purchaseItemsTable.purchase_id],
    references: [purchasesTable.id],
  }),
  product: one(productsTable, {
    fields: [purchaseItemsTable.product_id],
    references: [productsTable.id],
  }),
}));

// Export all tables for drizzle
export const tables = {
  users: usersTable,
  categories: categoriesTable,
  suppliers: suppliersTable,
  products: productsTable,
  stockMovements: stockMovementsTable,
  sales: salesTable,
  saleItems: saleItemsTable,
  purchases: purchasesTable,
  purchaseItems: purchaseItemsTable,
};
