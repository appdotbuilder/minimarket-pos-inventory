
import { z } from 'zod';

// User schema
export const userSchema = z.object({
  id: z.number(),
  username: z.string(),
  email: z.string().email(),
  password_hash: z.string(),
  role: z.enum(['admin', 'cashier']),
  is_active: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type User = z.infer<typeof userSchema>;

// Category schema
export const categorySchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Category = z.infer<typeof categorySchema>;

// Supplier schema
export const supplierSchema = z.object({
  id: z.number(),
  name: z.string(),
  contact_person: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().email().nullable(),
  address: z.string().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Supplier = z.infer<typeof supplierSchema>;

// Product schema
export const productSchema = z.object({
  id: z.number(),
  barcode: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  category_id: z.number(),
  supplier_id: z.number().nullable(),
  purchase_price: z.number(),
  selling_price: z.number(),
  stock_quantity: z.number().int(),
  minimum_stock: z.number().int(),
  is_active: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Product = z.infer<typeof productSchema>;

// Stock movement schema
export const stockMovementSchema = z.object({
  id: z.number(),
  product_id: z.number(),
  movement_type: z.enum(['in', 'out', 'adjustment']),
  quantity: z.number().int(),
  reference_type: z.enum(['sale', 'purchase', 'adjustment']).nullable(),
  reference_id: z.number().nullable(),
  notes: z.string().nullable(),
  created_by: z.number(),
  created_at: z.coerce.date()
});

export type StockMovement = z.infer<typeof stockMovementSchema>;

// Sale schema
export const saleSchema = z.object({
  id: z.number(),
  transaction_number: z.string(),
  cashier_id: z.number(),
  subtotal: z.number(),
  discount_amount: z.number(),
  tax_amount: z.number(),
  total_amount: z.number(),
  payment_method: z.enum(['cash', 'card', 'mixed']),
  amount_paid: z.number(),
  change_amount: z.number(),
  status: z.enum(['completed', 'cancelled', 'refunded']),
  cancelled_by: z.number().nullable(),
  cancelled_at: z.coerce.date().nullable(),
  cancellation_reason: z.string().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Sale = z.infer<typeof saleSchema>;

// Sale item schema
export const saleItemSchema = z.object({
  id: z.number(),
  sale_id: z.number(),
  product_id: z.number(),
  barcode: z.string(),
  product_name: z.string(),
  quantity: z.number().int(),
  unit_price: z.number(),
  total_price: z.number(),
  created_at: z.coerce.date()
});

export type SaleItem = z.infer<typeof saleItemSchema>;

// Purchase schema
export const purchaseSchema = z.object({
  id: z.number(),
  supplier_id: z.number(),
  purchase_number: z.string(),
  total_amount: z.number(),
  status: z.enum(['pending', 'completed', 'cancelled']),
  created_by: z.number(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Purchase = z.infer<typeof purchaseSchema>;

// Purchase item schema
export const purchaseItemSchema = z.object({
  id: z.number(),
  purchase_id: z.number(),
  product_id: z.number(),
  quantity: z.number().int(),
  unit_cost: z.number(),
  total_cost: z.number(),
  created_at: z.coerce.date()
});

export type PurchaseItem = z.infer<typeof purchaseItemSchema>;

// Input schemas for authentication
export const loginInputSchema = z.object({
  username: z.string(),
  password: z.string()
});

export type LoginInput = z.infer<typeof loginInputSchema>;

export const createUserInputSchema = z.object({
  username: z.string().min(3),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['admin', 'cashier'])
});

export type CreateUserInput = z.infer<typeof createUserInputSchema>;

// Input schemas for categories
export const createCategoryInputSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable()
});

export type CreateCategoryInput = z.infer<typeof createCategoryInputSchema>;

export const updateCategoryInputSchema = z.object({
  id: z.number(),
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional()
});

export type UpdateCategoryInput = z.infer<typeof updateCategoryInputSchema>;

// Input schemas for suppliers
export const createSupplierInputSchema = z.object({
  name: z.string().min(1),
  contact_person: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().email().nullable(),
  address: z.string().nullable()
});

export type CreateSupplierInput = z.infer<typeof createSupplierInputSchema>;

export const updateSupplierInputSchema = z.object({
  id: z.number(),
  name: z.string().min(1).optional(),
  contact_person: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  address: z.string().nullable().optional()
});

export type UpdateSupplierInput = z.infer<typeof updateSupplierInputSchema>;

// Input schemas for products
export const createProductInputSchema = z.object({
  barcode: z.string().min(1),
  name: z.string().min(1),
  description: z.string().nullable(),
  category_id: z.number(),
  supplier_id: z.number().nullable(),
  purchase_price: z.number().positive(),
  selling_price: z.number().positive(),
  stock_quantity: z.number().int().nonnegative(),
  minimum_stock: z.number().int().nonnegative()
});

export type CreateProductInput = z.infer<typeof createProductInputSchema>;

export const updateProductInputSchema = z.object({
  id: z.number(),
  barcode: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  category_id: z.number().optional(),
  supplier_id: z.number().nullable().optional(),
  purchase_price: z.number().positive().optional(),
  selling_price: z.number().positive().optional(),
  stock_quantity: z.number().int().nonnegative().optional(),
  minimum_stock: z.number().int().nonnegative().optional(),
  is_active: z.boolean().optional()
});

export type UpdateProductInput = z.infer<typeof updateProductInputSchema>;

// Input schemas for stock movements
export const createStockMovementInputSchema = z.object({
  product_id: z.number(),
  movement_type: z.enum(['in', 'out', 'adjustment']),
  quantity: z.number().int(),
  reference_type: z.enum(['sale', 'purchase', 'adjustment']).nullable(),
  reference_id: z.number().nullable(),
  notes: z.string().nullable(),
  created_by: z.number()
});

export type CreateStockMovementInput = z.infer<typeof createStockMovementInputSchema>;

// Input schemas for sales
export const cartItemSchema = z.object({
  product_id: z.number(),
  barcode: z.string(),
  product_name: z.string(),
  quantity: z.number().int().positive(),
  unit_price: z.number().positive()
});

export type CartItem = z.infer<typeof cartItemSchema>;

export const createSaleInputSchema = z.object({
  cashier_id: z.number(),
  items: z.array(cartItemSchema).min(1),
  discount_amount: z.number().nonnegative(),
  tax_amount: z.number().nonnegative(),
  payment_method: z.enum(['cash', 'card', 'mixed']),
  amount_paid: z.number().positive()
});

export type CreateSaleInput = z.infer<typeof createSaleInputSchema>;

export const cancelSaleInputSchema = z.object({
  sale_id: z.number(),
  cancelled_by: z.number(),
  cancellation_reason: z.string()
});

export type CancelSaleInput = z.infer<typeof cancelSaleInputSchema>;

// Input schemas for purchases
export const purchaseItemInputSchema = z.object({
  product_id: z.number(),
  quantity: z.number().int().positive(),
  unit_cost: z.number().positive()
});

export type PurchaseItemInput = z.infer<typeof purchaseItemInputSchema>;

export const createPurchaseInputSchema = z.object({
  supplier_id: z.number(),
  items: z.array(purchaseItemInputSchema).min(1),
  created_by: z.number()
});

export type CreatePurchaseInput = z.infer<typeof createPurchaseInputSchema>;

// Search and filter schemas
export const productSearchInputSchema = z.object({
  query: z.string().optional(),
  category_id: z.number().optional(),
  barcode: z.string().optional(),
  is_active: z.boolean().optional(),
  low_stock_only: z.boolean().optional()
});

export type ProductSearchInput = z.infer<typeof productSearchInputSchema>;

export const salesReportInputSchema = z.object({
  start_date: z.coerce.date(),
  end_date: z.coerce.date(),
  cashier_id: z.number().optional(),
  product_id: z.number().optional()
});

export type SalesReportInput = z.infer<typeof salesReportInputSchema>;

export const stockReportInputSchema = z.object({
  category_id: z.number().optional(),
  low_stock_only: z.boolean().optional(),
  supplier_id: z.number().optional()
});

export type StockReportInput = z.infer<typeof stockReportInputSchema>;

// Dashboard data schema
export const dashboardDataSchema = z.object({
  daily_sales: z.number(),
  weekly_sales: z.number(),
  monthly_sales: z.number(),
  total_transactions: z.number(),
  low_stock_products: z.number(),
  top_selling_products: z.array(z.object({
    product_id: z.number(),
    product_name: z.string(),
    total_sold: z.number(),
    revenue: z.number()
  })),
  recent_transactions: z.array(saleSchema)
});

export type DashboardData = z.infer<typeof dashboardDataSchema>;
