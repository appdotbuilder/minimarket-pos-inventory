
import { useState, useEffect, useCallback } from 'react';
import { trpc } from '@/utils/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  History, 
  Eye, 
  Printer, 
  Search,
  Calendar,
  DollarSign,
  ShoppingCart,
  AlertCircle,
  CheckCircle,
  XCircle
} from 'lucide-react';
import type { User, Sale, SaleItem } from '../../../server/src/schema';

interface SalesHistoryProps {
  user: User;
}

export function SalesHistory({ user }: SalesHistoryProps) {
  const [sales, setSales] = useState<Sale[]>([]);
  const [selectedSale, setSelectedSale] = useState<{ sale: Sale; items: SaleItem[] } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  const showNotification = useCallback((type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  }, []);

  const loadSales = useCallback(async () => {
    try {
      const salesData = await trpc.getSales.query({
        cashierId: user.role === 'cashier' ? user.id : undefined,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined
      });
      setSales(salesData);
    } catch (error) {
      console.error('Failed to load sales:', error);
      showNotification('error', 'Failed to load sales history');
    } finally {
      setIsLoading(false);
    }
  }, [user.id, user.role, startDate, endDate, showNotification]);

  useEffect(() => {
    loadSales();
  }, [loadSales]);

  const viewSaleDetails = async (sale: Sale) => {
    try {
      const saleDetails = await trpc.getSaleById.query(sale.id);
      if (saleDetails) {
        setSelectedSale(saleDetails);
        setIsDialogOpen(true);
      }
    } catch (error) {
      console.error('Failed to load sale details:', error);
      showNotification('error', 'Failed to load sale details');
    }
  };

  const printReceipt = (sale: Sale, items: SaleItem[]) => {
    const receiptWindow = window.open('', '_blank');
    if (receiptWindow) {
      receiptWindow.document.write(`
        <html>
          <head><title>Receipt #${sale.transaction_number}</title></head>
          <body style="font-family: monospace; width: 300px; margin: 20px;">
            <div style="text-align: center;">
              <h2>MiniMarket POS</h2>
              <p>Receipt #${sale.transaction_number}</p>
              <p>${sale.created_at.toLocaleString()}</p>
              <hr>
            </div>
            ${items.map(item => `
              <div style="display: flex; justify-content: space-between;">
                <span>${item.product_name} x${item.quantity}</span>
                <span>$${item.total_price.toFixed(2)}</span>
              </div>
            `).join('')}
            <hr>
            <div style="display: flex; justify-content: space-between;">
              <span>Subtotal:</span>
              <span>$${sale.subtotal.toFixed(2)}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span>Discount:</span>
              <span>-$${sale.discount_amount.toFixed(2)}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span>Tax:</span>
              <span>$${sale.tax_amount.toFixed(2)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-weight: bold;">
              <span>Total:</span>
              <span>$${sale.total_amount.toFixed(2)}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span>Paid:</span>
              <span>$${sale.amount_paid.toFixed(2)}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span>Change:</span>
              <span>$${sale.change_amount.toFixed(2)}</span>
            </div>
            <hr>
            <div style="text-align: center;">
              <p>Thank you for shopping!</p>
              <p>Status: ${sale.status.toUpperCase()}</p>
            </div>
          </body>
        </html>
      `);
      receiptWindow.document.close();
      receiptWindow.print();
    }
  };

  const filteredSales = sales.filter((sale: Sale) => 
    sale.transaction_number.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalRevenue = filteredSales.reduce((sum, sale) => 
    sale.status === 'completed' ? sum + sale.total_amount : sum, 0
  );

  const completedSales = filteredSales.filter(sale => sale.status === 'completed').length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading sales history...</p>
        </div>
      </div>
    );
  }

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
          <History className="w-8 h-8 mr-3 text-blue-600" />
          Sales History
        </h1>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Revenue</p>
                <p className="text-2xl font-bold text-green-600">${totalRevenue.toFixed(2)}</p>
              </div>
              <DollarSign className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Completed Sales</p>
                <p className="text-2xl font-bold text-blue-600">{completedSales}</p>
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
                  ${completedSales > 0 ? (totalRevenue / completedSales).toFixed(2) : '0.00'}
                </p>
              </div>
              <Calendar className="w-8 h-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                type="text"
                placeholder="Search by transaction number..."
                value={searchQuery}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Input
              type="date"
              value={startDate}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStartDate(e.target.value)}
              placeholder="Start date"
            />
            
            <Input
              type="date"
              value={endDate}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEndDate(e.target.value)}
              placeholder="End date"
            />
            
            <Button onClick={loadSales} variant="outline">
              <Search className="w-4 h-4 mr-2" />
              Filter
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Sales Table */}
      <Card>
        <CardHeader>
          <CardTitle>Transaction History ({filteredSales.length})</CardTitle>
          <CardDescription>
            {user.role === 'cashier' ? 'Your sales transactions' : 'All sales transactions'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Transaction #</TableHead>
                  <TableHead>Date & Time</TableHead>
                  <TableHead>Cashier</TableHead>
                  <TableHead>Total Amount</TableHead>
                  <TableHead>Payment Method</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSales.map((sale: Sale) => (
                  <TableRow key={sale.id}>
                    <TableCell className="font-mono">
                      {sale.transaction_number}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">
                          {sale.created_at.toLocaleDateString()}
                        </p>
                        <p className="text-sm text-gray-500">
                          {sale.created_at.toLocaleTimeString()}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="font-medium">Cashier #{sale.cashier_id}</p>
                    </TableCell>
                    <TableCell>
                      <p className="font-medium text-green-600">
                        ${sale.total_amount.toFixed(2)}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {sale.payment_method}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={
                          sale.status === 'completed' ? 'default' : 
                          sale.status === 'cancelled' ? 'destructive' : 
                          'secondary'
                        }
                        className="capitalize"
                      >
                        {sale.status === 'completed' && <CheckCircle className="w-3 h-3 mr-1" />}
                        {sale.status === 'cancelled' && <XCircle className="w-3 h-3 mr-1" />}
                        {sale.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => viewSaleDetails(sale)}
                        >
                          <Eye className="w-3 h-3 mr-1" />
                          View
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {filteredSales.length === 0 && (
            <div className="text-center py-12">
              <History className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p className="text-gray-500">
                {searchQuery || startDate || endDate 
                  ? 'No sales found matching your criteria' 
                  : 'No sales transactions yet'
                }
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sale Details Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Transaction Details #{selectedSale?.sale.transaction_number}
            </DialogTitle>
            <DialogDescription>
              Sale completed on {selectedSale?.sale.created_at.toLocaleString()}
            </DialogDescription>
          </DialogHeader>

          {selectedSale && (
            <div className="space-y-6">
              {/* Sale Info */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm text-gray-600">Cashier</p>
                  <p className="font-medium">Cashier #{selectedSale.sale.cashier_id}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Payment Method</p>
                  <p className="font-medium capitalize">{selectedSale.sale.payment_method}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Status</p>
                  <Badge 
                    variant={selectedSale.sale.status === 'completed' ? 'default' : 'destructive'}
                    className="capitalize"
                  >
                    {selectedSale.sale.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Date & Time</p>
                  <p className="font-medium">{selectedSale.sale.created_at.toLocaleString()}</p>
                </div>
              </div>

              {/* Items */}
              <div>
                <h4 className="font-medium mb-3">Items Purchased</h4>
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Unit Price</TableHead>
                        <TableHead>Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedSale.items.map((item: SaleItem) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{item.product_name}</p>
                              <p className="text-sm text-gray-500">#{item.barcode}</p>
                            </div>
                          </TableCell>
                          <TableCell>{item.quantity}</TableCell>
                          <TableCell>${item.unit_price.toFixed(2)}</TableCell>
                          <TableCell className="font-medium">
                            ${item.total_price.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Totals */}
              <div className="space-y-2 p-4 bg-gray-50 rounded-lg">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>${selectedSale.sale.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Discount:</span>
                  <span>-${selectedSale.sale.discount_amount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tax:</span>
                  <span>${selectedSale.sale.tax_amount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-lg border-t pt-2">
                  <span>Total:</span>
                  <span className="text-green-600">${selectedSale.sale.total_amount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Amount Paid:</span>
                  <span>${selectedSale.sale.amount_paid.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Change:</span>
                  <span>${selectedSale.sale.change_amount.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Close
            </Button>
            {selectedSale && (
              <Button 
                onClick={() => printReceipt(selectedSale.sale, selectedSale.items)}
              >
                <Printer className="w-4 h-4 mr-2" />
                Print Receipt
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
