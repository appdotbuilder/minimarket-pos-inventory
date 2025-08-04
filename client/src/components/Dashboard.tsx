
import { useState, useEffect, useCallback } from 'react';
import { trpc } from '@/utils/trpc';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  DollarSign, 
  ShoppingCart, 
  TrendingUp, 
  AlertTriangle,
  Package,
  Users,
  Calendar,
  Clock
} from 'lucide-react';
import type { User, DashboardData, Product } from '../../../server/src/schema';

interface DashboardProps {
  user: User;
}

export function Dashboard({ user }: DashboardProps) {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadDashboardData = useCallback(async () => {
    try {
      const [dashboard, lowStock] = await Promise.all([
        trpc.getDashboardData.query(),
        trpc.getLowStockProducts.query()
      ]);
      
      setDashboardData(dashboard);
      setLowStockProducts(lowStock);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-3/4"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const salesCards = [
    {
      title: 'Today\'s Sales',
      value: `$${dashboardData?.daily_sales?.toFixed(2) || '0.00'}`,
      icon: DollarSign,
      color: 'text-green-600'
    },
    {
      title: 'Weekly Sales',
      value: `$${dashboardData?.weekly_sales?.toFixed(2) || '0.00'}`,
      icon: TrendingUp,
      color: 'text-blue-600'
    },
    {
      title: 'Monthly Sales',
      value: `$${dashboardData?.monthly_sales?.toFixed(2) || '0.00'}`,
      icon: Calendar,
      color: 'text-purple-600'
    },
    {
      title: 'Total Transactions',
      value: dashboardData?.total_transactions?.toString() || '0',
      icon: ShoppingCart,
      color: 'text-orange-600'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Welcome back, {user.username}! 👋
          </h1>
          <p className="text-gray-600 mt-1">
            Here's what's happening in your store today
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-500">
            {new Date().toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </p>
          <p className="text-xs text-gray-400">
            <Clock className="w-3 h-3 inline mr-1" />
            {new Date().toLocaleTimeString()}
          </p>
        </div>
      </div>

      {/* Low Stock Alert */}
      {lowStockProducts.length > 0 && (
        <Alert className="border-orange-200 bg-orange-50">
          <AlertTriangle className="h-4 w-4 text-orange-600" />
          <AlertDescription className="text-orange-800">
            <strong>Low Stock Alert!</strong> {lowStockProducts.length} products are running low on stock.
            <span className="ml-2 text-sm">
              {lowStockProducts.slice(0, 3).map(p => p.name).join(', ')}
              {lowStockProducts.length > 3 && ` and ${lowStockProducts.length - 3} more...`}
            </span>
          </AlertDescription>
        </Alert>
      )}

      {/* Sales Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {salesCards.map((card, index) => {
          const Icon = card.icon;
          return (
            <Card key={index} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">{card.title}</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{card.value}</p>
                  </div>
                  <Icon className={`w-8 h-8 ${card.color}`} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Selling Products */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <TrendingUp className="w-5 h-5 mr-2 text-green-600" />
              Top Selling Products
            </CardTitle>
            <CardDescription>Best performing products this month</CardDescription>
          </CardHeader>
          <CardContent>
            {dashboardData?.top_selling_products?.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Package className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>No sales data available yet</p>
                <p className="text-sm">Start selling to see top products here</p>
              </div>
            ) : (
              <div className="space-y-4">
                {dashboardData?.top_selling_products?.map((product, index) => (
                  <div key={product.product_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{product.product_name}</p>
                        <p className="text-sm text-gray-500">{product.total_sold} units sold</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-green-600">${product.revenue.toFixed(2)}</p>
                    </div>
                  </div>
                )) || []}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Transactions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Clock className="w-5 h-5 mr-2 text-blue-600" />
              Recent Transactions
            </CardTitle>
            <CardDescription>Latest sales transactions</CardDescription>
          </CardHeader>
          <CardContent>
            {dashboardData?.recent_transactions?.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <ShoppingCart className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>No recent transactions</p>
                <p className="text-sm">Start making sales to see transactions here</p>
              </div>
            ) : (
              <div className="space-y-4">
                {dashboardData?.recent_transactions?.map((transaction) => (
                  <div key={transaction.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">#{transaction.transaction_number}</p>
                      <p className="text-sm text-gray-500">
                        {transaction.created_at.toLocaleTimeString()} • {transaction.payment_method}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-gray-900">${transaction.total_amount.toFixed(2)}</p>
                      <Badge 
                        variant={transaction.status === 'completed' ? 'default' : 'destructive'}
                        className="text-xs"
                      >
                        {transaction.status}
                      </Badge>
                    </div>
                  </div>
                )) || []}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats for Admin */}
      {user.role === 'admin' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Users className="w-5 h-5 mr-2 text-purple-600" />
              System Overview
            </CardTitle>
            <CardDescription>Quick system statistics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <AlertTriangle className="w-8 h-8 text-red-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-red-600">{lowStockProducts.length}</p>
                <p className="text-sm text-red-700">Low Stock Items</p>
              </div>
              
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <DollarSign className="w-8 h-8 text-green-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-green-600">
                  ${dashboardData?.daily_sales?.toFixed(2) || '0.00'}
                </p>
                <p className="text-sm text-green-700">Today's Revenue</p>
              </div>
              
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <ShoppingCart className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-blue-600">{dashboardData?.total_transactions || 0}</p>
                <p className="text-sm text-blue-700">Total Transactions</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
