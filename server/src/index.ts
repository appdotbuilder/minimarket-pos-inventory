
import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';
import { z } from 'zod';

// Import schemas
import {
  loginInputSchema,
  createUserInputSchema,
  createCategoryInputSchema,
  updateCategoryInputSchema,
  createSupplierInputSchema,
  updateSupplierInputSchema,
  createProductInputSchema,
  updateProductInputSchema,
  productSearchInputSchema,
  createStockMovementInputSchema,
  createSaleInputSchema,
  cancelSaleInputSchema,
  createPurchaseInputSchema,
  salesReportInputSchema,
  stockReportInputSchema
} from './schema';

// Import handlers
import { login, createUser, getCurrentUser } from './handlers/auth';
import { getCategories, createCategory, updateCategory, deleteCategory } from './handlers/categories';
import { getSuppliers, createSupplier, updateSupplier, deleteSupplier } from './handlers/suppliers';
import { 
  getProducts, 
  searchProducts, 
  getProductByBarcode, 
  createProduct, 
  updateProduct, 
  getLowStockProducts 
} from './handlers/products';
import { getStockMovements, createStockMovement, adjustStock } from './handlers/stock';
import { createSale, getSales, getSaleById, cancelSale, getDailySales } from './handlers/sales';
import { createPurchase, getPurchases, getPurchaseById } from './handlers/purchases';
import { getSalesReport, getStockReport, getDashboardData, exportSalesData } from './handlers/reports';

const t = initTRPC.create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

const appRouter = router({
  // Health check
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  // Authentication routes
  login: publicProcedure
    .input(loginInputSchema)
    .mutation(({ input }) => login(input)),
  
  createUser: publicProcedure
    .input(createUserInputSchema)
    .mutation(({ input }) => createUser(input)),
  
  getCurrentUser: publicProcedure
    .input(z.number())
    .query(({ input }) => getCurrentUser(input)),

  // Category routes
  getCategories: publicProcedure
    .query(() => getCategories()),

  createCategory: publicProcedure
    .input(createCategoryInputSchema)
    .mutation(({ input }) => createCategory(input)),

  updateCategory: publicProcedure
    .input(updateCategoryInputSchema)
    .mutation(({ input }) => updateCategory(input)),

  deleteCategory: publicProcedure
    .input(z.number())
    .mutation(({ input }) => deleteCategory(input)),

  // Supplier routes
  getSuppliers: publicProcedure
    .query(() => getSuppliers()),

  createSupplier: publicProcedure
    .input(createSupplierInputSchema)
    .mutation(({ input }) => createSupplier(input)),

  updateSupplier: publicProcedure
    .input(updateSupplierInputSchema)
    .mutation(({ input }) => updateSupplier(input)),

  deleteSupplier: publicProcedure
    .input(z.number())
    .mutation(({ input }) => deleteSupplier(input)),

  // Product routes
  getProducts: publicProcedure
    .query(() => getProducts()),

  searchProducts: publicProcedure
    .input(productSearchInputSchema)
    .query(({ input }) => searchProducts(input)),

  getProductByBarcode: publicProcedure
    .input(z.string())
    .query(({ input }) => getProductByBarcode(input)),

  createProduct: publicProcedure
    .input(createProductInputSchema)
    .mutation(({ input }) => createProduct(input)),

  updateProduct: publicProcedure
    .input(updateProductInputSchema)
    .mutation(({ input }) => updateProduct(input)),

  getLowStockProducts: publicProcedure
    .query(() => getLowStockProducts()),

  // Stock routes
  getStockMovements: publicProcedure
    .input(z.number().optional())
    .query(({ input }) => getStockMovements(input)),

  createStockMovement: publicProcedure
    .input(createStockMovementInputSchema)
    .mutation(({ input }) => createStockMovement(input)),

  adjustStock: publicProcedure
    .input(z.object({
      productId: z.number(),
      newQuantity: z.number(),
      userId: z.number(),
      notes: z.string().optional()
    }))
    .mutation(({ input }) => adjustStock(input.productId, input.newQuantity, input.userId, input.notes)),

  // Sales routes
  createSale: publicProcedure
    .input(createSaleInputSchema)
    .mutation(({ input }) => createSale(input)),

  getSales: publicProcedure
    .input(z.object({
      cashierId: z.number().optional(),
      startDate: z.coerce.date().optional(),
      endDate: z.coerce.date().optional()
    }).optional())
    .query(({ input }) => getSales(input?.cashierId, input?.startDate, input?.endDate)),

  getSaleById: publicProcedure
    .input(z.number())
    .query(({ input }) => getSaleById(input)),

  cancelSale: publicProcedure
    .input(cancelSaleInputSchema)
    .mutation(({ input }) => cancelSale(input)),

  getDailySales: publicProcedure
    .input(z.coerce.date())
    .query(({ input }) => getDailySales(input)),

  // Purchase routes
  createPurchase: publicProcedure
    .input(createPurchaseInputSchema)
    .mutation(({ input }) => createPurchase(input)),

  getPurchases: publicProcedure
    .input(z.number().optional())
    .query(({ input }) => getPurchases(input)),

  getPurchaseById: publicProcedure
    .input(z.number())
    .query(({ input }) => getPurchaseById(input)),

  // Report routes
  getSalesReport: publicProcedure
    .input(salesReportInputSchema)
    .query(({ input }) => getSalesReport(input)),

  getStockReport: publicProcedure
    .input(stockReportInputSchema)
    .query(({ input }) => getStockReport(input)),

  getDashboardData: publicProcedure
    .query(() => getDashboardData()),

  exportSalesData: publicProcedure
    .input(salesReportInputSchema)
    .query(({ input }) => exportSalesData(input)),
});

export type AppRouter = typeof appRouter;

async function start() {
  const port = process.env['SERVER_PORT'] || 2022;
  const server = createHTTPServer({
    middleware: (req, res, next) => {
      cors()(req, res, next);
    },
    router: appRouter,
    createContext() {
      return {};
    },
  });
  server.listen(port);
  console.log(`POS System TRPC server listening at port: ${port}`);
}

start();
