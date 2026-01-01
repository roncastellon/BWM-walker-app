import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import {
  Dog,
  Home,
  Calendar,
  CreditCard,
  MessageCircle,
  Users,
  Clock,
  Settings,
  LogOut,
  Menu,
  X,
  PawPrint,
  FileText,
} from 'lucide-react';

const Layout = ({ children }) => {
  const { user, logout, isAdmin, isWalker, isClient } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/auth');
  };

  const getNavItems = () => {
    if (isAdmin) {
      return [
        { path: '/admin', label: 'Dashboard', icon: Home },
        { path: '/admin/calendar', label: 'Calendar', icon: Calendar },
        { path: '/admin/clients', label: 'Clients', icon: Users },
        { path: '/admin/walkers', label: 'Walkers', icon: PawPrint },
        { path: '/admin/invoices', label: 'Invoices', icon: FileText },
        { path: '/admin/chat', label: 'Team Chat', icon: MessageCircle },
      ];
    }
    if (isWalker) {
      return [
        { path: '/walker', label: 'Dashboard', icon: Home },
        { path: '/walker/schedule', label: 'My Schedule', icon: Calendar },
        { path: '/walker/payroll', label: 'Payroll', icon: CreditCard },
        { path: '/walker/chat', label: 'Messages', icon: MessageCircle },
        { path: '/walker/profile', label: 'My Profile', icon: Settings },
      ];
    }
    return [
      { path: '/dashboard', label: 'Dashboard', icon: Home },
      { path: '/schedule', label: 'Book Services', icon: Calendar },
      { path: '/billing', label: 'Billing', icon: CreditCard },
      { path: '/messages', label: 'Messages', icon: MessageCircle },
      { path: '/pets', label: 'My Pets', icon: PawPrint },
    ];
  };

  const navItems = getNavItems();

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 glass border-b border-border/50 px-4 py-3">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-lg hover:bg-muted"
            data-testid="mobile-menu-toggle"
          >
            {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
          <Link to="/" className="flex items-center gap-2">
            <Dog className="w-8 h-8 text-primary" />
            <span className="font-heading font-bold text-xl">WagWalk</span>
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full" data-testid="user-menu">
                <Avatar className="w-8 h-8">
                  <AvatarImage src={user?.profile_image} />
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    {user?.full_name?.charAt(0) || 'U'}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{user?.full_name}</DropdownMenuLabel>
              <DropdownMenuLabel className="font-normal text-xs text-muted-foreground capitalize">
                {user?.role}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} data-testid="logout-btn">
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-card border-r border-border z-40 transform transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          <div className="p-6 border-b border-border">
            <Link to="/" className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Dog className="w-6 h-6 text-primary" />
              </div>
              <span className="font-heading font-bold text-xl">WagWalk</span>
            </Link>
          </div>

          <nav className="flex-1 p-4 space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  data-testid={`nav-${item.label.toLowerCase().replace(' ', '-')}`}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-lg'
                      : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="p-4 border-t border-border">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
              <Avatar>
                <AvatarImage src={user?.profile_image} />
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {user?.full_name?.charAt(0) || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{user?.full_name}</p>
                <p className="text-xs text-muted-foreground capitalize">{user?.role}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                className="shrink-0"
                data-testid="sidebar-logout"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-30"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="lg:ml-64 pt-16 lg:pt-0 min-h-screen">
        <div className="p-4 lg:p-8">{children}</div>
      </main>
    </div>
  );
};

export default Layout;
