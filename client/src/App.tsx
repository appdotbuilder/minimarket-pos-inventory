
import { useState, useEffect, useCallback } from 'react';
import { trpc } from '@/utils/trpc';
import type { User } from '../../server/src/schema';
import { LoginScreen } from '@/components/LoginScreen';
import { Dashboard } from '@/components/Dashboard';
import { POSInterface } from '@/components/POSInterface';
import { ProductManagement } from '@/components/ProductManagement';
import { StockManagement } from '@/components/StockManagement';
import { SalesHistory } from '@/components/SalesHistory';
import { Reports } from '@/components/Reports';
import { UserManagement } from '@/components/UserManagement';
import { SupplierManagement } from '@/components/SupplierManagement';
import { CategoryManagement } from '@/components/CategoryManagement';
import { Button } from '@/components/ui/button';
import { 
  ShoppingCart, 
  Package, 
  BarChart3, 
  Users, 
  LogOut, 
  Home,
  History,
  Truck,
  Tags,
  Package2
} from 'lucide-react';

type ActiveScreen = 
  | 'dashboard' 
  | 'pos' 
  | 'products' 
  | 'stock' 
  | 'sales' 
  | 'reports' 
  | 'users' 
  | 'suppliers' 
  | 'categories';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [activeScreen, setActiveScreen] = useState<ActiveScreen>('dashboard');
  const [isLoading, setIsLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const userId = localStorage.getItem('user_id');
      
      if (token && userId) {
        const currentUser = await trpc.getCurrentUser.query(parseInt(userId));
        if (currentUser && currentUser.is_active) {
          setUser(currentUser);
        } else {
          localStorage.removeItem('auth_token');
          localStorage.removeItem('user_id');
        }
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user_id');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const handleLogin = useCallback((userData: User, token: string) => {
    setUser(userData);
    localStorage.setItem('auth_token', token);
    localStorage.setItem('user_id', userData.id.toString());
  }, []);

  const handleLogout = useCallback(() => {
    setUser(null);
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_id');
    setActiveScreen('dashboard');
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading MiniMarket POS...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  const isAdmin = user.role === 'admin';

  const navigationItems = [
    { id: 'dashboard' as const, label: 'Dashboard', icon: Home, show: true },
    { id: 'pos' as const, label: 'Point of Sale', icon: ShoppingCart, show: true },
    { id: 'products' as const, label: 'Products', icon: Package, show: isAdmin },
    { id: 'stock' as const, label: 'Stock Management', icon: Package2, show: isAdmin },
    { id: 'categories' as const, label: 'Categories', icon: Tags, show: isAdmin },
    { id: 'suppliers' as const, label: 'Suppliers', icon: Truck, show: isAdmin },
    { id: 'sales' as const, label: 'Sales History', icon: History, show: true },
    { id: 'reports' as const, label: 'Reports', icon: BarChart3, show: isAdmin },
    { id: 'users' as const, label: 'User Management', icon: Users, show: isAdmin },
  ];

  const renderActiveScreen = () => {
    switch (activeScreen) {
      case 'dashboard':
        return <Dashboard user={user} />;
      case 'pos':
        return <POSInterface user={user} />;
      case 'products':
        return <ProductManagement />;
      case 'stock':
        return <StockManagement user={user} />;
      case 'categories':
        return <CategoryManagement />;
      case 'suppliers':
        return <SupplierManagement />;
      case 'sales':
        return <SalesHistory user={user} />;
      case 'reports':
        return <Reports />;
      case 'users':
        return <UserManagement />;
      default:
        return <Dashboard user={user} />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation Bar */}
      <header className="bg-white shadow-sm border-b">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <ShoppingCart className="w-5 h-5 text-white" />
                </div>
                <h1 className="text-xl font-bold text-gray-900">MiniMarket POS</h1>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">{user.username}</p>
                <p className="text-xs text-gray-500 capitalize">{user.role}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="text-gray-600 hover:text-gray-900"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar Navigation */}
        <nav className="w-64 bg-white shadow-sm h-screen sticky top-0">
          <div className="p-4">
            <div className="space-y-1">
              {navigationItems
                .filter(item => item.show)
                .map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveScreen(item.id)}
                      className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                        activeScreen === item.id
                          ? 'bg-blue-100 text-blue-700'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <Icon className="w-5 h-5 mr-3" />
                      {item.label}
                    </button>
                  );
                })}
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <main className="flex-1 p-6">
          {renderActiveScreen()}
        </main>
      </div>
    </div>
  );
}

export default App;
