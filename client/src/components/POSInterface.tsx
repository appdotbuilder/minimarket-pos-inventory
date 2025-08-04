
import { useState, useEffect, useCallback, useRef } from 'react';
import { trpc } from '@/utils/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  ShoppingCart, 
  Scan, 
  Plus, 
  Minus, 
  Trash2, 
  Calculator,
  CreditCard,
  Banknote,
  Printer,
  Search,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import type { User, Product, CartItem, CreateSaleInput, Sale, SaleItem } from '../../../server/src/schema';

interface POSInterfaceProps {
  user: User;
}

interface POSCartItem extends CartItem {
  id: string; // Local cart ID for management
}

interface ReceiptTotals {
  subtotal: number;
  discountedSubtotal: number;
  taxAmount: number;
  total: number;
  change: number;
}

export function POSInterface({ user }: POSInterfaceProps) {
  const [cart, setCart] = useState<POSCartItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [discountAmount, setDiscountAmount] = useState(0);
  const [taxRate] = useState(10); // 10% default tax - removed unused setTaxRate
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'mixed'>('cash');
  const [amountPaid, setAmountPaid] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  const loadProducts = useCallback(async () => {
    try {
      const allProducts = await trpc.getProducts.query();
      setProducts(allProducts.filter(p => p.is_active && p.stock_quantity > 0));
    } catch (error) {
      console.error('Failed to load products:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  // Auto-focus barcode input
  useEffect(() => {
    if (barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  }, [cart]);

  const showNotification = useCallback((type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  }, []);

  const handleBarcodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;

    try {
      const product = await trpc.getProductByBarcode.query(barcodeInput.trim());
      if (product && product.is_active && product.stock_quantity > 0) {
        addToCart(product);
        setBarcodeInput('');
        showNotification('success', `${product.name} added to cart`);
      } else {
        showNotification('error', 'Product not found or out of stock');
      }
    } catch (error) {
      console.error('Barcode lookup failed:', error);
      showNotification('error', 'Failed to lookup product');
    }
  };

  const addToCart = (product: Product, quantity: number = 1) => {
    const existingItem = cart.find(item => item.product_id === product.id);
    
    if (existingItem) {
      const newQuantity = existingItem.quantity + quantity;
      if (newQuantity <= product.stock_quantity) {
        setCart((prev: POSCartItem[]) => 
          prev.map((item: POSCartItem) => 
            item.product_id === product.id 
              ? { ...item, quantity: newQuantity }
              : item
          )
        );
      } else {
        showNotification('error', 'Not enough stock available');
      }
    } else {
      if (quantity <= product.stock_quantity) {
        const cartItem: POSCartItem = {
          id: `cart-${Date.now()}-${product.id}`,
          product_id: product.id,
          barcode: product.barcode,
          product_name: product.name,
          quantity,
          unit_price: product.selling_price
        };
        setCart((prev: POSCartItem[]) => [...prev, cartItem]);
      } else {
        showNotification('error', 'Not enough stock available');
      }
    }
  };

  const updateCartItemQuantity = (cartItemId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeFromCart(cartItemId);
      return;
    }

    const cartItem = cart.find(item => item.id === cartItemId);
    if (!cartItem) return;

    const product = products.find(p => p.id === cartItem.product_id);
    if (!product) return;

    if (newQuantity <= product.stock_quantity) {
      setCart((prev: POSCartItem[]) => 
        prev.map((item: POSCartItem) => 
          item.id === cartItemId 
            ? { ...item, quantity: newQuantity }
            : item
        )
      );
    } else {
      showNotification('error', 'Not enough stock available');
    }
  };

  const removeFromCart = (cartItemId: string) => {
    setCart((prev: POSCartItem[]) => prev.filter((item: POSCartItem) => item.id !== cartItemId));
  };

  const clearCart = () => {
    setCart([]);
    setDiscountAmount(0);
    setAmountPaid(0);
    setBarcodeInput('');
    setSearchQuery('');
  };

  const calculateTotals = (): ReceiptTotals => {
    const subtotal = cart.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
    const discountedSubtotal = subtotal - discountAmount;
    const taxAmount = (discountedSubtotal * taxRate) / 100;
    const total = discountedSubtotal + taxAmount;
    const change = Math.max(0, amountPaid - total);

    return {
      subtotal,
      discountedSubtotal,
      taxAmount,
      total,
      change
    };
  };

  const processSale = async () => {
    if (cart.length === 0) {
      showNotification('error', 'Cart is empty');
      return;
    }

    const totals = calculateTotals();
    if (amountPaid < totals.total) {
      showNotification('error', 'Insufficient payment amount');
      return;
    }

    setIsProcessing(true);
    try {
      const saleData: CreateSaleInput = {
        cashier_id: user.id,
        items: cart.map(item => ({
          product_id: item.product_id,
          barcode: item.barcode,
          product_name: item.product_name,
          quantity: item.quantity,
          unit_price: item.unit_price
        })),
        discount_amount: discountAmount,
        tax_amount: totals.taxAmount,
        payment_method: paymentMethod,
        amount_paid: amountPaid
      };

      const result = await trpc.createSale.mutate(saleData);
      
      showNotification('success', `Sale completed! Transaction #${result.sale.transaction_number}`);
      clearCart();
      
      // Print receipt (placeholder)
      printReceipt(result.sale, result.items, totals);
      
      // Reload products to update stock
      await loadProducts();
      
    } catch (error) {
      console.error('Sale processing failed:', error);
      showNotification('error', 'Failed to process sale');
    } finally {
      setIsProcessing(false);
    }
  };

  const printReceipt = (sale: Sale, items: SaleItem[], totals: ReceiptTotals) => {
    // This is a placeholder for receipt printing
    // In a real implementation, this would connect to a thermal printer
    const receiptWindow = window.open('', '_blank');
    if (receiptWindow) {
      receiptWindow.document.write(`
        <html>
          <head><title>Receipt #${sale.transaction_number}</title></head>
          <body style="font-family: monospace; width: 300px; margin: 20px;">
            <div style="text-align: center;">
              <h2>MiniMarket POS</h2>
              <p>Receipt #${sale.transaction_number}</p>
              <p>${new Date().toLocaleString()}</p>
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
              <span>$${totals.subtotal.toFixed(2)}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span>Discount:</span>
              <span>-$${discountAmount.toFixed(2)}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span>Tax (${taxRate}%):</span>
              <span>$${totals.taxAmount.toFixed(2)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-weight: bold;">
              <span>Total:</span>
              <span>$${totals.total.toFixed(2)}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span>Paid:</span>
              <span>$${amountPaid.toFixed(2)}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span>Change:</span>
              <span>$${totals.change.toFixed(2)}</span>
            </div>
            <hr>
            <div style="text-align: center;">
              <p>Thank you for shopping!</p>
              <p>Cashier: ${user.username}</p>
            </div>
          </body>
        </html>
      `);
      receiptWindow.document.close();
      receiptWindow.print();
    }
  };

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.barcode.includes(searchQuery)
  );

  const totals = calculateTotals();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading POS system...</p>
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

      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center">
          <ShoppingCart className="w-8 h-8 mr-3 text-blue-600" />
          Point of Sale
        </h1>
        <div className="text-right">
          <p className="text-sm text-gray-600">Cashier: {user.username}</p>
          <p className="text-xs text-gray-500">{new Date().toLocaleString()}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Product Search and Selection */}
        <div className="lg:col-span-2 space-y-6">
          {/* Barcode Scanner */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Scan className="w-5 h-5 mr-2" />
                Barcode Scanner
              </CardTitle>
              <CardDescription>Scan or enter product barcode</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleBarcodeSubmit} className="flex space-x-2">
                <Input
                  ref={barcodeInputRef}
                  type="text"
                  placeholder="Scan or enter barcode..."
                  value={barcodeInput}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBarcodeInput(e.target.value)}
                  className="flex-1"
                />
                <Button type="submit">
                  <Plus className="w-4 h-4 mr-1" />
                  Add
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Product Search */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Search className="w-5 h-5 mr-2" />
                Product Search
              </CardTitle>
              <CardDescription>Search and select products manually</CardDescription>
            </CardHeader>
            <CardContent>
              <Input
                type="text"
                placeholder="Search products by name or barcode..."
                value={searchQuery}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                className="mb-4"
              />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto">
                {filteredProducts.slice(0, 20).map((product: Product) => (
                  <div
                    key={product.id}
                    className="border rounded-lg p-3 hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => addToCart(product)}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">{product.name}</h4>
                        <p className="text-sm text-gray-500">#{product.barcode}</p>
                        <p className="text-sm text-gray-600">Stock: {product.stock_quantity}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-green-600">${product.selling_price.toFixed(2)}</p>
                        <Button size="sm" className="mt-1">
                          <Plus className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {filteredProducts.length === 0 && searchQuery && (
                <div className="text-center py-8 text-gray-500">
                  <Search className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>No products found</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Shopping Cart and Payment */}
        <div className="space-y-6">
          {/* Shopping Cart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center">
                  <ShoppingCart className="w-5 h-5 mr-2" />
                  Shopping Cart
                </span>
                <Badge variant="secondary">{cart.length} items</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {cart.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <ShoppingCart className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>Cart is empty</p>
                  <p className="text-sm">Scan or search for products to add</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {cart.map((item: POSCartItem) => (
                    <div key={item.id} className="border rounded-lg p-3">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-medium text-gray-900 text-sm">{item.product_name}</h4>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeFromCart(item.id)}
                          className="text-red-600 hover:text-red-700 h-6 w-6 p-0"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateCartItemQuantity(item.id, item.quantity - 1)}
                            className="h-6 w-6 p-0"
                          >
                            <Minus className="w-3 h-3" />
                          </Button>
                          <span className="text-sm font-medium w-8 text-center">{item.quantity}</span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateCartItemQuantity(item.id, item.quantity + 1)}
                            className="h-6 w-6 p-0"
                          >
                            <Plus className="w-3 h-3" />
                          </Button>
                        </div>
                        
                        <div className="text-right">
                          <p className="text-sm text-gray-600">${item.unit_price.toFixed(2)} each</p>
                          <p className="font-medium text-green-600">
                            ${(item.quantity * item.unit_price).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {cart.length > 0 && (
                <Button
                  variant="outline"
                  onClick={clearCart}
                  className="w-full text-red-600 hover:text-red-700"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Clear Cart
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Order Summary and Payment */}
          {cart.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Calculator className="w-5 h-5 mr-2" />
                  Order Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Totals */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Subtotal:</span>
                    <span>${totals.subtotal.toFixed(2)}</span>
                  </div>
                  
                  <div className="flex justify-between items-center text-sm">
                    <span>Discount:</span>
                    <Input
                      type="number"
                      min="0"
                      max={totals.subtotal}
                      step="0.01"
                      value={discountAmount}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
                        setDiscountAmount(parseFloat(e.target.value) || 0)
                      }
                      className="w-20 h-7 text-right text-xs"
                    />
                  </div>
                  
                  <div className="flex justify-between text-sm">
                    <span>Tax ({taxRate}%):</span>
                    <span>${totals.taxAmount.toFixed(2)}</span>
                  </div>
                  
                  <Separator />
                  
                  <div className="flex justify-between font-bold">
                    <span>Total:</span>
                    <span className="text-green-600">${totals.total.toFixed(2)}</span>
                  </div>
                </div>

                {/* Payment Method */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Payment Method:</label>
                  <Select value={paymentMethod} onValueChange={(value: 'cash' | 'card' | 'mixed') => setPaymentMethod(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">
                        <div className="flex items-center">
                          <Banknote className="w-4 h-4 mr-2" />
                          Cash
                        </div>
                      </SelectItem>
                      <SelectItem value="card">
                        <div className="flex items-center">
                          <CreditCard className="w-4 h-4 mr-2" />
                          Card
                        </div>
                      </SelectItem>
                      <SelectItem value="mixed">Mixed Payment</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Amount Paid */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Amount Paid:</label>
                  <Input
                    type="number"
                    min={totals.total}
                    step="0.01"
                    value={amountPaid}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
                      setAmountPaid(parseFloat(e.target.value) || 0)
                    }
                    placeholder="Enter amount paid"
                  />
                  {amountPaid >= totals.total && (
                    <p className="text-sm text-green-600">
                      Change: ${totals.change.toFixed(2)}
                    </p>
                  )}
                </div>

                {/* Process Sale Button */}
                <Button
                  onClick={processSale}
                  disabled={isProcessing || amountPaid < totals.total}
                  className="w-full h-12 text-lg font-semibold"
                >
                  {isProcessing ? (
                    <div className="flex items-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Processing...
                    </div>
                  ) : (
                    <div className="flex items-center">
                      <Printer className="w-5 h-5 mr-2" />
                      Complete Sale
                    </div>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
