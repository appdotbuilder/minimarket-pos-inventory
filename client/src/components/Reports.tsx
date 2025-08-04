
import { useState, useEffect, useCallback } from 'react';
import { trpc } from '@/utils/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  BarChart3, 
  Download, 
  Calendar,
  DollarSign,
  ShoppingCart,
  Package,
  TrendingUp,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import type { SalesReportInput, StockReportInput } from '../../../server/src/schema';

interface SalesReportData {
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
}

interface StockReportData {
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
}

export function Reports() {
  const [salesReport, setSalesReport] = useState<SalesReportData | null>(null);
  const [stockReport, setStockReport] = useState<StockReportData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [activeTab, setActiveTab] = useState('sales');

  const [salesFilters, setSalesFilters] = useState<SalesReportInput>({
    start_date: new Date(new Date().setDate(new Date().getDate() - 30)),
    end_date: new Date(),
    cashier_id: undefined,
    product_id: undefined
  });

  const [stockFilters, setStockFilters] = useState<StockReportInput>({
    category_id: undefined,
    low_stock_only: false,
    supplier_id: undefined
  });

  const showNotification = useCallback((type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  }, []);

  const generateSalesReport = useCallback(async () => {
    setIsLoading(true);
    try {
      const report = await trpc.getSalesReport.query(salesFilters);
      setSalesReport(report);
      showNotification('success', 'Sales report generated successfully');
    } catch (error) {
      console.error('Failed to generate sales report:', error);
      showNotification('error', 'Failed to generate sales report');
    } finally {
      setIsLoading(false);
    }
  }, [salesFilters, showNotification]);

  const generateStockReport = useCallback(async () => {
    setIsLoading(true);
    try {
      const report = await trpc.getStockReport.query(stockFilters);
      setStockReport(report);
      showNotification('success', 'Stock report generated successfully');
    } catch (error) {
      console.error('Failed to generate stock report:', error);
      showNotification('error', 'Failed to generate stock report');
    } finally {
      setIsLoading(false);
    }
  }, [stockFilters, showNotification]);

  const exportSalesData = async () => {
    try {
      const csvData = await trpc.exportSalesData.query(salesFilters);
      
      // Create and download CSV file
      const blob = new Blob([csvData.csv_data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sales-report-${salesFilters.start_date.toISOString().split('T')[0]}-to-${salesFilters.end_date.toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      showNotification('success', 'Sales data exported successfully');
    } catch (error) {
      console.error('Failed to export sales data:', error);
      showNotification('error', 'Failed to export sales data');
    }
  };

  useEffect(() => {
    if (activeTab === 'sales') {
      generateSalesReport();
    } else if (activeTab === 'stock') {
      generateStockReport();
    }
  }, [activeTab, generateSalesReport, generateStockReport]);

  return (
    <div className="space-y-6">
      {/* Notification */}
      {notification && (
        <Alert className={notification.type === 'success' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
          {notification.type === 'success' ? (
            <CheckCircle className="h-4 w-4 text-green-600" />
          ) : (
            <AlertCircle className="h-4 w-4 text-red-600" />
          )}
          <AlertDescription className={notification.type === 'success' ? 'text-green-800' : 'text-red-800'}>
            {notification.message}
          </AlertDescription>
        </Alert>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center">
          <BarChart3 className="w-8 h-8 mr-3 text-blue-600" />
          Reports & Analytics
        </h1>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="sales">Sales Reports</TabsTrigger>
          <TabsTrigger value="stock">Stock Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="sales" className="space-y-6">
          {/* Sales Filters */}
          <Card>
            <CardHeader>
              <CardTitle>Sales Report Filters</CardTitle>
              <CardDescription>Configure your sales report parameters</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Start Date</label>
                  <Input
                    type="date"
                    value={salesFilters.start_date.toISOString().split('T')[0]}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setSalesFilters((prev: SalesReportInput) => ({ 
                        ...prev, 
                        start_date: new Date(e.target.value) 
                      }))
                    }
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium mb-2 block">End Date</label>
                  <Input
                    type="date"
                    value={salesFilters.end_date.toISOString().split('T')[0]}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setSalesFilters((prev: SalesReportInput) => ({ 
                        ...prev, 
                        end_date: new Date(e.target.value) 
                      }))
                    }
                  />
                </div>
                
                <div className="flex items-end">
                  <Button onClick={generateSalesReport} disabled={isLoading} className="w-full">
                    {isLoading ? 'Generating...' : 'Generate Report'}
                  </Button>
                </div>
                
                <div className="flex items-end">
                  <Button 
                    variant="outline" 
                    onClick={exportSalesData} 
                    disabled={!salesReport} 
                    className="w-full"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export CSV
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sales Report Results */}
          {salesReport && (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">Total Sales</p>
                        <p className="text-2xl font-bold text-green-600">
                          ${salesReport.total_sales?.toFixed(2) || '0.00'}
                        </p>
                      </div>
                      <DollarSign className="w-8 h-8 text-green-600" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">Transactions</p>
                        <p className="text-2xl font-bold text-blue-600">
                          {salesReport.total_transactions || 0}
                        </p>
                      </div>
                      <ShoppingCart className="w-8 h-8 text-blue-600" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">Average Sale</p>
                        <p className="text-2xl font-bold text-purple-600">
                          ${salesReport.average_transaction?.toFixed(2) || '0.00'}
                        </p>
                      </div>
                      <TrendingUp className="w-8 h-8 text-purple-600" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">Period</p>
                        <p className="text-sm font-bold text-gray-800">
                          {salesFilters.start_date.toLocaleDateString()} -
                        </p>
                        <p className="text-sm font-bold text-gray-800">
                          {salesFilters.end_date.toLocaleDateString()}
                        </p>
                      </div>
                      <Calendar className="w-8 h-8 text-gray-600" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Top Products */}
              <Card>
                <CardHeader>
                  <CardTitle>Top Selling Products</CardTitle>
                  <CardDescription>Best performing products in the selected period</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Rank</TableHead>
                        <TableHead>Product Name</TableHead>
                        <TableHead>Quantity Sold</TableHead>
                        <TableHead>Revenue</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {salesReport.top_products?.map((product, index: number) => (
                        <TableRow key={product.product_id}>
                          <TableCell>
                            <Badge variant="outline">#{index + 1}</Badge>
                          </TableCell>
                          <TableCell className="font-medium">{product.product_name}</TableCell>
                          <TableCell>{product.quantity_sold} units</TableCell>
                          <TableCell className="font-medium text-green-600">
                            ${product.revenue.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      )) || []}
                    </TableBody>
                  </Table>
                  
                  {(!salesReport.top_products || salesReport.top_products.length === 0) && (
                    <div className="text-center py-8 text-gray-500">
                      <Package className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                      <p>No product sales data available for the selected period</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Daily Breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle>Daily Sales Breakdown</CardTitle>
                  <CardDescription>Day-by-day sales performance</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Sales Amount</TableHead>
                        <TableHead>Transactions</TableHead>
                        <TableHead>Average Sale</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {salesReport.daily_breakdown?.map((day) => (
                        <TableRow key={day.date}>
                          <TableCell>{new Date(day.date).toLocaleDateString()}</TableCell>
                          <TableCell className="font-medium text-green-600">
                            ${day.sales.toFixed(2)}
                          </TableCell>
                          <TableCell>{day.transactions}</TableCell>
                          <TableCell>
                            ${day.transactions > 0 ? (day.sales / day.transactions).toFixed(2) : '0.00'}
                          </TableCell>
                        </TableRow>
                      )) || []}
                    </TableBody>
                  </Table>
                  
                  {(!salesReport.daily_breakdown || salesReport.daily_breakdown.length === 0) && (
                    <div className="text-center py-8 text-gray-500">
                      <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                      <p>No daily sales data available for the selected period</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="stock" className="space-y-6">
          {/* Stock Filters */}
          <Card>
            <CardHeader>
              <CardTitle>Stock Report Filters</CardTitle>
              <CardDescription>Configure your stock report parameters</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="low-stock"
                    checked={stockFilters.low_stock_only}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setStockFilters((prev: StockReportInput) => ({ 
                        ...prev, 
                        low_stock_only: e.target.checked 
                      }))
                    }
                    className="rounded"
                  />
                  <label htmlFor="low-stock" className="text-sm font-medium">
                    Show only low stock items
                  </label>
                </div>
                
                <div className="flex items-end">
                  <Button onClick={generateStockReport} disabled={isLoading} className="w-full">
                    {isLoading ? 'Generating...' : 'Generate Report'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Stock Report Results */}
          {stockReport && (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">Total Products</p>
                        <p className="text-2xl font-bold text-blue-600">
                          {stockReport.total_products || 0}
                        </p>
                      </div>
                      <Package className="w-8 h-8 text-blue-600" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">Low Stock Items</p>
                        <p className="text-2xl font-bold text-orange-600">
                          {stockReport.low_stock_count || 0}
                        </p>
                      </div>
                      <AlertCircle className="w-8 h-8 text-orange-600" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">Stock Value</p>
                        <p className="text-2xl font-bold text-green-600">
                          ${stockReport.total_stock_value?.toFixed(2) || '0.00'}
                        </p>
                      </div>
                      <DollarSign className="w-8 h-8 text-green-600" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">Stock Health</p>
                        <p className="text-2xl font-bold text-purple-600">
                          {stockReport.total_products > 0 
                            ? Math.round(((stockReport.total_products - stockReport.low_stock_count) / stockReport.total_products) * 100)
                            : 0
                          }%
                        </p>
                      </div>
                      <TrendingUp className="w-8 h-8 text-purple-600" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Products Table */}
              <Card>
                <CardHeader>
                  <CardTitle>Product Stock Details</CardTitle>
                  <CardDescription>Detailed stock information for all products</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Product</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>Current Stock</TableHead>
                          <TableHead>Minimum Stock</TableHead>
                          <TableHead>Stock Value</TableHead>
                          <TableHead>Supplier</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {stockReport.products?.map((product) => (
                          <TableRow key={product.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{product.name}</p>
                                <p className="text-sm text-gray-500">#{product.barcode}</p>
                              </div>
                            </TableCell>
                            <TableCell>{product.category}</TableCell>
                            <TableCell className={`font-medium ${
                              product.current_stock === 0 
                                ? 'text-red-600' 
                                : product.current_stock <= product.minimum_stock 
                                  ? 'text-orange-600' 
                                  : 'text-green-600'
                            }`}>
                              {product.current_stock}
                            </TableCell>
                            <TableCell>{product.minimum_stock}</TableCell>
                            <TableCell className="font-medium">
                              ${product.stock_value?.toFixed(2) || '0.00'}
                            </TableCell>
                            <TableCell>{product.supplier || 'N/A'}</TableCell>
                            <TableCell>
                              {product.current_stock === 0 ? (
                                <Badge variant="destructive">Out of Stock</Badge>
                              ) : product.current_stock <= product.minimum_stock ? (
                                <Badge className="bg-orange-100 text-orange-800">Low Stock</Badge>
                              ) : (
                                <Badge className="bg-green-100 text-green-800">In Stock</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        )) || []}
                      </TableBody>
                    </Table>
                  </div>
                  
                  {(!stockReport.products || stockReport.products.length === 0) && (
                    <div className="text-center py-8 text-gray-500">
                      <Package className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                      <p>No products found matching the selected criteria</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
