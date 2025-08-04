
import { db } from '../db';
import { 
  salesTable, 
  saleItemsTable, 
  productsTable, 
  categoriesTable, 
  suppliersTable,
  usersTable 
} from '../db/schema';
import { type SalesReportInput, type StockReportInput, type DashboardData } from '../schema';
import { eq, and, gte, lte, sql, desc, asc } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';

export async function getSalesReport(input: SalesReportInput): Promise<{
  total_sales: number;
  total_transactions: number;
  average_transaction: number;
  top_products: Array<{
    product_id: number;
    product_name: string;
    quantity_sold: number;
    revenue: number;
  }>;
  daily_breakdown: Array<{
    date: string;
    sales: number;
    transactions: number;
  }>;
}> {
  try {
    // Build base conditions - use DATE() function for proper date comparison
    const conditions: SQL<unknown>[] = [
      sql`DATE(${salesTable.created_at}) >= DATE(${input.start_date})`,
      sql`DATE(${salesTable.created_at}) <= DATE(${input.end_date})`,
      eq(salesTable.status, 'completed')
    ];

    if (input.cashier_id !== undefined) {
      conditions.push(eq(salesTable.cashier_id, input.cashier_id));
    }

    // Get total sales and transaction count
    const salesSummary = await db
      .select({
        total_sales: sql<string>`COALESCE(SUM(${salesTable.total_amount}), 0)`,
        total_transactions: sql<string>`COUNT(*)`
      })
      .from(salesTable)
      .where(and(...conditions))
      .execute();

    const totalSales = parseFloat(salesSummary[0].total_sales);
    const totalTransactions = parseInt(salesSummary[0].total_transactions);
    const averageTransaction = totalTransactions > 0 ? totalSales / totalTransactions : 0;

    // Get top products - build conditions for product filtering
    const topProductConditions: SQL<unknown>[] = [...conditions];
    if (input.product_id !== undefined) {
      topProductConditions.push(eq(saleItemsTable.product_id, input.product_id));
    }

    const topProducts = await db
      .select({
        product_id: saleItemsTable.product_id,
        product_name: saleItemsTable.product_name,
        quantity_sold: sql<string>`SUM(${saleItemsTable.quantity})`.as('quantity_sold'),
        revenue: sql<string>`SUM(${saleItemsTable.total_price})`.as('revenue')
      })
      .from(saleItemsTable)
      .innerJoin(salesTable, eq(saleItemsTable.sale_id, salesTable.id))
      .where(and(...topProductConditions))
      .groupBy(saleItemsTable.product_id, saleItemsTable.product_name)
      .orderBy(desc(sql`SUM(${saleItemsTable.total_price})`))
      .limit(10)
      .execute();

    // Get daily breakdown
    const dailyBreakdown = await db
      .select({
        date: sql<string>`DATE(${salesTable.created_at})`.as('date'),
        sales: sql<string>`COALESCE(SUM(${salesTable.total_amount}), 0)`.as('sales'),
        transactions: sql<string>`COUNT(*)`.as('transactions')
      })
      .from(salesTable)
      .where(and(...conditions))
      .groupBy(sql`DATE(${salesTable.created_at})`)
      .orderBy(asc(sql`DATE(${salesTable.created_at})`))
      .execute();

    return {
      total_sales: totalSales,
      total_transactions: totalTransactions,
      average_transaction: averageTransaction,
      top_products: topProducts.map(p => ({
        product_id: p.product_id,
        product_name: p.product_name,
        quantity_sold: parseInt(p.quantity_sold),
        revenue: parseFloat(p.revenue)
      })),
      daily_breakdown: dailyBreakdown.map(d => ({
        date: d.date,
        sales: parseFloat(d.sales),
        transactions: parseInt(d.transactions)
      }))
    };
  } catch (error) {
    console.error('Sales report generation failed:', error);
    throw error;
  }
}

export async function getStockReport(input: StockReportInput): Promise<{
  total_products: number;
  low_stock_count: number;
  total_stock_value: number;
  products: Array<{
    id: number;
    name: string;
    barcode: string;
    category: string;
    current_stock: number;
    minimum_stock: number;
    stock_value: number;
    supplier: string | null;
  }>;
}> {
  try {
    // Build conditions for product filtering
    const conditions: SQL<unknown>[] = [
      eq(productsTable.is_active, true)
    ];

    if (input.category_id !== undefined) {
      conditions.push(eq(productsTable.category_id, input.category_id));
    }

    if (input.supplier_id !== undefined) {
      conditions.push(eq(productsTable.supplier_id, input.supplier_id));
    }

    if (input.low_stock_only === true) {
      conditions.push(sql`${productsTable.stock_quantity} <= ${productsTable.minimum_stock}`);
    }

    // Get products with category and supplier info
    const products = await db
      .select({
        id: productsTable.id,
        name: productsTable.name,
        barcode: productsTable.barcode,
        category_name: categoriesTable.name,
        current_stock: productsTable.stock_quantity,
        minimum_stock: productsTable.minimum_stock,
        selling_price: productsTable.selling_price,
        supplier_name: suppliersTable.name
      })
      .from(productsTable)
      .innerJoin(categoriesTable, eq(productsTable.category_id, categoriesTable.id))
      .leftJoin(suppliersTable, eq(productsTable.supplier_id, suppliersTable.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(productsTable.name))
      .execute();

    // Calculate totals
    const totalProducts = products.length;
    const lowStockCount = products.filter(p => p.current_stock <= p.minimum_stock).length;
    const totalStockValue = products.reduce((sum, p) => {
      return sum + (p.current_stock * parseFloat(p.selling_price));
    }, 0);

    return {
      total_products: totalProducts,
      low_stock_count: lowStockCount,
      total_stock_value: totalStockValue,
      products: products.map(p => ({
        id: p.id,
        name: p.name,
        barcode: p.barcode,
        category: p.category_name,
        current_stock: p.current_stock,
        minimum_stock: p.minimum_stock,
        stock_value: p.current_stock * parseFloat(p.selling_price),
        supplier: p.supplier_name
      }))
    };
  } catch (error) {
    console.error('Stock report generation failed:', error);
    throw error;
  }
}

export async function getDashboardData(): Promise<DashboardData> {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Get daily sales
    const dailySales = await db
      .select({
        total: sql<string>`COALESCE(SUM(${salesTable.total_amount}), 0)`.as('total')
      })
      .from(salesTable)
      .where(and(
        gte(salesTable.created_at, todayStart),
        eq(salesTable.status, 'completed')
      ))
      .execute();

    // Get weekly sales
    const weeklySales = await db
      .select({
        total: sql<string>`COALESCE(SUM(${salesTable.total_amount}), 0)`.as('total')
      })
      .from(salesTable)
      .where(and(
        gte(salesTable.created_at, weekStart),
        eq(salesTable.status, 'completed')
      ))
      .execute();

    // Get monthly sales
    const monthlySales = await db
      .select({
        total: sql<string>`COALESCE(SUM(${salesTable.total_amount}), 0)`.as('total')
      })
      .from(salesTable)
      .where(and(
        gte(salesTable.created_at, monthStart),
        eq(salesTable.status, 'completed')
      ))
      .execute();

    // Get total transactions today
    const totalTransactions = await db
      .select({
        count: sql<string>`COUNT(*)`.as('count')
      })
      .from(salesTable)
      .where(and(
        gte(salesTable.created_at, todayStart),
        eq(salesTable.status, 'completed')
      ))
      .execute();

    // Get low stock products count
    const lowStockProducts = await db
      .select({
        count: sql<string>`COUNT(*)`.as('count')
      })
      .from(productsTable)
      .where(and(
        sql`${productsTable.stock_quantity} <= ${productsTable.minimum_stock}`,
        eq(productsTable.is_active, true)
      ))
      .execute();

    // Get top selling products (this month)
    const topSellingProducts = await db
      .select({
        product_id: saleItemsTable.product_id,
        product_name: saleItemsTable.product_name,
        total_sold: sql<string>`SUM(${saleItemsTable.quantity})`.as('total_sold'),
        revenue: sql<string>`SUM(${saleItemsTable.total_price})`.as('revenue')
      })
      .from(saleItemsTable)
      .innerJoin(salesTable, eq(saleItemsTable.sale_id, salesTable.id))
      .where(and(
        gte(salesTable.created_at, monthStart),
        eq(salesTable.status, 'completed')
      ))
      .groupBy(saleItemsTable.product_id, saleItemsTable.product_name)
      .orderBy(desc(sql`SUM(${saleItemsTable.quantity})`))
      .limit(5)
      .execute();

    // Get recent transactions
    const recentTransactions = await db
      .select({
        id: salesTable.id,
        transaction_number: salesTable.transaction_number,
        cashier_id: salesTable.cashier_id,
        subtotal: salesTable.subtotal,
        discount_amount: salesTable.discount_amount,
        tax_amount: salesTable.tax_amount,
        total_amount: salesTable.total_amount,
        payment_method: salesTable.payment_method,
        amount_paid: salesTable.amount_paid,
        change_amount: salesTable.change_amount,
        status: salesTable.status,
        cancelled_by: salesTable.cancelled_by,
        cancelled_at: salesTable.cancelled_at,
        cancellation_reason: salesTable.cancellation_reason,
        created_at: salesTable.created_at,
        updated_at: salesTable.updated_at
      })
      .from(salesTable)
      .where(eq(salesTable.status, 'completed'))
      .orderBy(desc(salesTable.created_at))
      .limit(10)
      .execute();

    return {
      daily_sales: parseFloat(dailySales[0].total),
      weekly_sales: parseFloat(weeklySales[0].total),
      monthly_sales: parseFloat(monthlySales[0].total),
      total_transactions: parseInt(totalTransactions[0].count),
      low_stock_products: parseInt(lowStockProducts[0].count),
      top_selling_products: topSellingProducts.map(p => ({
        product_id: p.product_id,
        product_name: p.product_name,
        total_sold: parseInt(p.total_sold),
        revenue: parseFloat(p.revenue)
      })),
      recent_transactions: recentTransactions.map(t => ({
        id: t.id,
        transaction_number: t.transaction_number,
        cashier_id: t.cashier_id,
        subtotal: parseFloat(t.subtotal),
        discount_amount: parseFloat(t.discount_amount),
        tax_amount: parseFloat(t.tax_amount),
        total_amount: parseFloat(t.total_amount),
        payment_method: t.payment_method,
        amount_paid: parseFloat(t.amount_paid),
        change_amount: parseFloat(t.change_amount),
        status: t.status,
        cancelled_by: t.cancelled_by,
        cancelled_at: t.cancelled_at,
        cancellation_reason: t.cancellation_reason,
        created_at: t.created_at,
        updated_at: t.updated_at
      }))
    };
  } catch (error) {
    console.error('Dashboard data retrieval failed:', error);
    throw error;
  }
}

export async function exportSalesData(input: SalesReportInput): Promise<{ csv_data: string }> {
  try {
    // Build conditions - use DATE() function for proper date comparison
    const conditions: SQL<unknown>[] = [
      sql`DATE(${salesTable.created_at}) >= DATE(${input.start_date})`,
      sql`DATE(${salesTable.created_at}) <= DATE(${input.end_date})`,
      eq(salesTable.status, 'completed')
    ];

    if (input.cashier_id !== undefined) {
      conditions.push(eq(salesTable.cashier_id, input.cashier_id));
    }

    // Get detailed sales data with cashier info
    const salesData = await db
      .select({
        transaction_number: salesTable.transaction_number,
        cashier_username: usersTable.username,
        subtotal: salesTable.subtotal,
        discount_amount: salesTable.discount_amount,
        tax_amount: salesTable.tax_amount,
        total_amount: salesTable.total_amount,
        payment_method: salesTable.payment_method,
        amount_paid: salesTable.amount_paid,
        change_amount: salesTable.change_amount,
        created_at: salesTable.created_at
      })
      .from(salesTable)
      .innerJoin(usersTable, eq(salesTable.cashier_id, usersTable.id))
      .where(and(...conditions))
      .orderBy(desc(salesTable.created_at))
      .execute();

    // Generate CSV header
    const csvHeader = 'Transaction Number,Cashier,Date,Subtotal,Discount,Tax,Total,Payment Method,Amount Paid,Change\n';

    // Generate CSV rows
    const csvRows = salesData.map(sale => {
      const date = sale.created_at.toISOString().split('T')[0];
      return [
        sale.transaction_number,
        sale.cashier_username,
        date,
        parseFloat(sale.subtotal).toFixed(2),
        parseFloat(sale.discount_amount).toFixed(2),
        parseFloat(sale.tax_amount).toFixed(2),
        parseFloat(sale.total_amount).toFixed(2),
        sale.payment_method,
        parseFloat(sale.amount_paid).toFixed(2),
        parseFloat(sale.change_amount).toFixed(2)
      ].join(',');
    }).join('\n');

    const csvData = csvHeader + csvRows;

    return { csv_data: csvData };
  } catch (error) {
    console.error('Sales data export failed:', error);
    throw error;
  }
}
