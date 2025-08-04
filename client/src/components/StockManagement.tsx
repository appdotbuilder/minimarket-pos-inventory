
import { useState, useEffect, useCallback } from 'react';
import { trpc } from '@/utils/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Package2, 
  History,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  Settings
} from 'lucide-react';
import type { User, Product, StockMovement } from '../../../server/src/schema';

interface StockManagementProps {
  user: User;
}

export function StockManagement({ user }: StockManagementProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  const [adjustmentData, setAdjustmentData] = useState({
    product_id: 0,
    movement_type: 'adjustment' as const,
    quantity: 0,
    notes: ''
  });

  const showNotification = useCallback((type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  }, []);

  const loadData = useCallback(async () => {
    try {
      const [productsData, movementsData] = await Promise.all([
        trpc.getProducts.query(),
        trpc.getStockMovements.query()
      ]);
      
      setProducts(productsData);
      setStockMovements(movementsData);
    } catch (error) {
      console.error('Failed to load data:', error);
      showNotification('error', 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  }, [showNotification]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openAdjustmentDialog = (product: Product) => {
    setSelectedProduct(product);
    setAdjustmentData({
      product_id: product.id,
      movement_type: 'adjustment',
      quantity: 0,
      notes: ''
    });
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setSelectedProduct(null);
    setAdjustmentData({
      product_id: 0,
      movement_type: 'adjustment',
      quantity: 0,
      notes: ''
    });
  };

  const handleStockAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;

    setIsSubmitting(true);
    try {
      const newQuantity = selectedProduct.stock_quantity + adjustmentData.quantity;
      
      await trpc.adjustStock.mutate({
        productId: selectedProduct.id,
        newQuantity,
        userId: user.id,
        notes: adjustmentData.notes
      });

      // Reload data to get updated stock and movements
      await loadData();
      
      showNotification('success', 'Stock adjustment completed successfully');
      closeDialog();
    } catch (error) {
      console.error('Stock adjustment failed:', error);
      showNotification('error', 'Failed to adjust stock');
    } finally {
      setIsSubmitting(false);
    }
  };

  const lowStockProducts = products.filter(p => p.stock_quantity <= p.minimum_stock);
  const outOfStockProducts = products.filter(p => p.stock_quantity === 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading stock data...</p>
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
            <AlertTriangle className="h-4 w-4 text-red-600" />
          )}
          <AlertDescription className={notification.type === 'success' ? 'text-green-800' : 'text-red-800'}>
            {notification.message}
          </AlertDescription>
        </Alert>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center">
          <Package2 className="w-8 h-8 mr-3 text-blue-600" />
          Stock Management
        </h1>
      </div>

      {/* Alert Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-red-700">Out of Stock</p>
                <p className="text-2xl font-bold text-red-800">{outOfStockProducts.length}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-orange-700">Low Stock</p>
                <p className="text-2xl font-bold text-orange-800">{lowStockProducts.length}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-700">Total Products</p>
                <p className="text-2xl font-bold text-green-800">{products.length}</p>
              </div>
              <Package2 className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Stock Overview</TabsTrigger>
          <TabsTrigger value="movements">Stock Movements</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Product Stock Levels</CardTitle>
              <CardDescription>Current stock levels for all products</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Current Stock</TableHead>
                      <TableHead>Minimum Stock</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.map((product: Product) => (
                      <TableRow key={product.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{product.name}</p>
                            <p className="text-sm text-gray-500">#{product.barcode}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={`font-medium ${
                            product.stock_quantity === 0 
                              ? 'text-red-600' 
                              : product.stock_quantity <= product.minimum_stock 
                                ? 'text-orange-600' 
                                : 'text-green-600'
                          }`}>
                            {product.stock_quantity}
                          </span>
                        </TableCell>
                        <TableCell>{product.minimum_stock}</TableCell>
                        <TableCell>
                          {product.stock_quantity === 0 ? (
                            <Badge variant="destructive">Out of Stock</Badge>
                          ) : product.stock_quantity <= product.minimum_stock ? (
                            <Badge className="bg-orange-100 text-orange-800">Low Stock</Badge>
                          ) : (
                            <Badge className="bg-green-100 text-green-800">In Stock</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openAdjustmentDialog(product)}
                          >
                            <Settings className="w-3 h-3 mr-1" />
                            Adjust
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="movements" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <History className="w-5 h-5 mr-2" />
                Stock Movement History
              </CardTitle>
              <CardDescription>Track all stock changes and transactions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stockMovements.map((movement: StockMovement) => {
                      const product = products.find(p => p.id === movement.product_id);
                      return (
                        <TableRow key={movement.id}>
                          <TableCell>
                            {movement.created_at.toLocaleDateString()} {movement.created_at.toLocaleTimeString()}
                          </TableCell>
                          <TableCell>
                            {product ? (
                              <div>
                                <p className="font-medium">{product.name}</p>
                                <p className="text-sm text-gray-500">#{product.barcode}</p>
                              </div>
                            ) : (
                              'Unknown Product'
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center">
                              {movement.movement_type === 'in' ? (
                                <TrendingUp className="w-4 h-4 text-green-600 mr-1" />
                              ) : movement.movement_type === 'out' ? (
                                <TrendingDown className="w-4 h-4 text-red-600 mr-1" />
                              ) : (
                                <Settings className="w-4 h-4 text-blue-600 mr-1" />
                              )}
                              <Badge 
                                variant={
                                  movement.movement_type === 'in' ? 'default' : 
                                  movement.movement_type === 'out' ? 'destructive' : 
                                  'secondary'
                                }
                              >
                                {movement.movement_type.toUpperCase()}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell className={`font-medium ${
                            movement.movement_type === 'in' ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {movement.movement_type === 'in' ? '+' : '-'}{Math.abs(movement.quantity)}
                          </TableCell>
                          <TableCell>
                            {movement.reference_type && (
                              <Badge variant="outline">
                                {movement.reference_type}
                                {movement.reference_id && ` #${movement.reference_id}`}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {movement.notes && (
                              <p className="text-sm text-gray-600 max-w-xs truncate">
                                {movement.notes}
                              </p>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {stockMovements.length === 0 && (
                <div className="text-center py-12">
                  <History className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p className="text-gray-500">No stock movements recorded yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          {/* Out of Stock Alert */}
          {outOfStockProducts.length > 0 && (
            <Card className="border-red-200 bg-red-50">
              <CardHeader>
                <CardTitle className="text-red-800 flex items-center">
                  <AlertTriangle className="w-5 h-5 mr-2" />
                  Out of Stock Products ({outOfStockProducts.length})
                </CardTitle>
                <CardDescription className="text-red-700">
                  These products have zero stock and need immediate restocking
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {outOfStockProducts.map((product: Product) => (
                    <div key={product.id} className="flex items-center justify-between p-3 bg-white rounded-lg border">
                      <div>
                        <p className="font-medium text-gray-900">{product.name}</p>
                        <p className="text-sm text-gray-500">#{product.barcode}</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant="destructive">0 in stock</Badge>
                        <Button
                          size="sm"
                          onClick={() => openAdjustmentDialog(product)}
                        >
                          Restock
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Low Stock Alert */}
          {lowStockProducts.length > 0 && (
            <Card className="border-orange-200 bg-orange-50">
              <CardHeader>
                <CardTitle className="text-orange-800 flex items-center">
                  <AlertTriangle className="w-5 h-5 mr-2" />
                  Low Stock Products ({lowStockProducts.length})
                </CardTitle>
                <CardDescription className="text-orange-700">
                  These products are running low and should be restocked soon
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {lowStockProducts.map((product: Product) => (
                    <div key={product.id} className="flex items-center justify-between p-3 bg-white rounded-lg border">
                      <div>
                        <p className="font-medium text-gray-900">{product.name}</p>
                        <p className="text-sm text-gray-500">#{product.barcode}</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="text-right">
                          <p className="text-sm font-medium text-orange-600">
                            {product.stock_quantity} left
                          </p>
                          <p className="text-xs text-gray-500">
                            Min: {product.minimum_stock}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openAdjustmentDialog(product)}
                        >
                          Restock
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {lowStockProducts.length === 0 && outOfStockProducts.length === 0 && (
            <Card className="border-green-200 bg-green-50">
              <CardContent className="pt-6">
                <div className="text-center">
                  <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-600" />
                  <p className="text-green-800 font-medium">All products are well stocked!</p>
                  <p className="text-green-700 text-sm">No stock alerts at this time</p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Stock Adjustment Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Stock</DialogTitle>
            <DialogDescription>
              {selectedProduct && `Adjust stock for ${selectedProduct.name}`}
            </DialogDescription>
          </DialogHeader>

          {selectedProduct && (
            <form onSubmit={handleStockAdjustment} className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="font-medium">{selectedProduct.name}</p>
                <p className="text-sm text-gray-600">Current Stock: {selectedProduct.stock_quantity}</p>
                <p className="text-sm text-gray-600">Minimum Stock: {selectedProduct.minimum_stock}</p>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Adjustment Quantity</label>
                <Input
                  type="number"
                  value={adjustmentData.quantity}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setAdjustmentData((prev) => ({ 
                      ...prev, 
                      quantity: parseInt(e.target.value) || 0 
                    }))
                  }
                  placeholder="Enter positive or negative number"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  New stock will be: {selectedProduct.stock_quantity + adjustmentData.quantity}
                </p>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Notes</label>
                <Textarea
                  value={adjustmentData.notes}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    setAdjustmentData((prev) => ({ ...prev, notes: e.target.value }))
                  }
                  placeholder="Reason for adjustment (optional)"
                  rows={3}
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeDialog}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <div className="flex items-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Adjusting...
                    </div>
                  ) : (
                    'Adjust Stock'
                  )}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
