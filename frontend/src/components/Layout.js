import { useState, useEffect, useRef } from 'react';
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
  Navigation,
  Bell,
  Crown,
  Bed,
  Trees,
  DollarSign,
  Moon,
  Sun,
} from 'lucide-react';

const Layout = ({ children }) => {
  const { user, api, logout, isAdmin, isWalker, isClient } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [hasNewMessage, setHasNewMessage] = useState(false);
  const prevCountRef = useRef(0);

  // Poll for unread messages (but not on messages page to avoid conflicts)
  useEffect(() => {
    const isOnMessagesPage = location.pathname.includes('/messages') || 
                              location.pathname.includes('/chat') ||
                              location.pathname === '/admin/chat' ||
                              location.pathname === '/walker/chat';
    
    const fetchUnreadCount = async () => {
      if (isOnMessagesPage) return; // Don't poll on messages page
      
      try {
        const response = await api.get('/messages/unread-count');
        const newCount = response.data.unread_count;
        
        // Check if count increased (new message arrived)
        if (newCount > prevCountRef.current) {
          setHasNewMessage(true);
          // Reset animation after 3 seconds
          setTimeout(() => setHasNewMessage(false), 3000);
        }
        
        prevCountRef.current = newCount;
        setUnreadCount(newCount);
      } catch (error) {
        console.error('Failed to fetch unread count');
      }
    };

    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 10000); // Poll every 10 seconds (was 5)
    
    return () => clearInterval(interval);
  }, [api, location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/auth');
  };

  const getNavItems = () => {
    if (isAdmin) {
      return [
        { path: '/admin', label: 'Dashboard', icon: Home },
        { path: '/admin/calendar', label: 'Calendar', icon: Calendar },
        { path: '/admin/overnights', label: 'Overnights', icon: Moon },
        { path: '/admin/daycare', label: 'Daycare', icon: Sun },
        { path: '/tracking', label: 'Live Tracking', icon: Navigation },
        { path: '/admin/clients', label: 'Clients', icon: Users },
        { path: '/admin/walkers', label: 'Walkers', icon: PawPrint },
        { path: '/admin/sitters', label: 'Sitters', icon: Bed },
        { path: '/admin/payroll', label: 'Staff Payroll', icon: DollarSign },
        { path: '/admin/billing', label: 'Billing & Revenue', icon: CreditCard },
        { path: '/admin/chat', label: 'Team Chat', icon: MessageCircle },
        { path: '/subscription', label: 'Subscription', icon: Crown },
        { path: '/admin/profile', label: 'My Profile', icon: Settings },
      ];
    }
    if (isWalker) {
      return [
        { path: '/walker', label: 'Dashboard', icon: Home },
        { path: '/walker/schedule', label: 'My Schedule', icon: Calendar },
        { path: '/tracking', label: 'Walk Tracking', icon: Navigation },
        { path: '/walker/payroll', label: 'Time Sheets & Payroll', icon: CreditCard },
        { path: '/walker/chat', label: 'Messages', icon: MessageCircle },
        { path: '/walker/profile', label: 'My Profile', icon: Settings },
      ];
    }
    if (user?.role === 'sitter') {
      return [
        { path: '/sitter', label: 'Dashboard', icon: Home },
        { path: '/sitter/schedule', label: 'My Schedule', icon: Calendar },
        { path: '/sitter/payroll', label: 'Completed Stays', icon: CreditCard },
        { path: '/sitter/chat', label: 'Messages', icon: MessageCircle },
        { path: '/sitter/profile', label: 'My Profile', icon: Settings },
      ];
    }
    return [
      { path: '/dashboard', label: 'Dashboard', icon: Home },
      { path: '/schedule', label: 'Book Services', icon: Calendar },
      { path: '/tracking', label: 'Track My Pet', icon: Navigation },
      { path: '/billing', label: 'Billing', icon: CreditCard },
      { path: '/messages', label: 'Messages', icon: MessageCircle },
      { path: '/pets', label: 'My Pets', icon: PawPrint },
      { path: '/profile', label: 'My Profile', icon: Settings },
    ];
  };

  const navItems = getNavItems();

  const getMessagesPath = () => {
    if (isAdmin) return '/admin/chat';
    if (isWalker) return '/walker/chat';
    if (user?.role === 'sitter') return '/sitter/chat';
    return '/messages';
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 sm:h-16 items-center justify-between px-3 sm:px-4">
          {/* Logo and Dog Park Button */}
          <div className="flex items-center gap-2 sm:gap-3">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-primary flex items-center justify-center">
                <Dog className="w-5 h-5 sm:w-6 sm:h-6 text-primary-foreground" />
              </div>
              <span className="font-heading text-lg sm:text-xl font-bold hidden sm:inline">BowWowMeow</span>
            </Link>
            
            {/* Dog Park Icon - Hidden on mobile */}
            <Link
              to="/dog-park"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-[50%_40%_45%_55%/40%_50%_45%_55%] bg-green-500 hover:bg-green-600 text-white transition-all shadow-md hover:shadow-lg hover:scale-105"
              style={{ fontFamily: "'Comic Sans MS', cursive, sans-serif" }}
              data-testid="dog-park-link"
            >
              <PawPrint className="w-4 h-4" />
              <span className="text-sm font-bold">Dog Park</span>
            </Link>
          </div>

          {/* Desktop Navigation - Only on large screens */}
          <nav className="hidden lg:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                    isActive
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Right side - Message Icon & User Menu */}
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Message Notification Icon */}
            <Link
              to={getMessagesPath()}
              className={`relative p-2 rounded-lg transition-all ${
                hasNewMessage 
                  ? 'bg-primary text-primary-foreground animate-pulse' 
                  : unreadCount > 0 
                    ? 'bg-primary/10 text-primary' 
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
              data-testid="message-notification"
            >
              <MessageCircle className={`w-5 h-5 ${hasNewMessage ? 'animate-bounce' : ''}`} />
              {unreadCount > 0 && (
                <span className={`absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full text-xs font-bold flex items-center justify-center ${
                  hasNewMessage 
                    ? 'bg-white text-primary' 
                    : 'bg-primary text-primary-foreground'
                }`}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </Link>

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 sm:h-10 sm:w-10 rounded-full">
                  <Avatar className="h-8 w-8 sm:h-10 sm:w-10">
                    <AvatarImage src={user?.profile_image} alt={user?.full_name} />
                    <AvatarFallback className="bg-primary/10 text-primary text-sm sm:text-base">
                      {user?.full_name?.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium">{user?.full_name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{user?.role}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Mobile Menu Toggle - Visible on screens smaller than lg */}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden rounded-lg hover:bg-muted"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              data-testid="mobile-menu-toggle"
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile Sidebar - Slide in from left */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="fixed inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <nav className="fixed top-14 sm:top-16 left-0 bottom-0 w-72 bg-background border-r p-4 overflow-y-auto shadow-xl">
            {/* Dog Park Link in Mobile Menu */}
            <Link
              to="/dog-park"
              onClick={() => setSidebarOpen(false)}
              className="flex items-center gap-2 px-4 py-3 mb-3 rounded-xl bg-green-500 hover:bg-green-600 text-white transition-all"
              style={{ fontFamily: "'Comic Sans MS', cursive, sans-serif" }}
            >
              <PawPrint className="w-5 h-5" />
              <span className="font-bold">Dog Park</span>
            </Link>
            
            <div className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                const isMessageItem = item.icon === MessageCircle;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl transition-colors ${
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-muted'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="w-5 h-5" />
                      <span className="font-medium">{item.label}</span>
                    </div>
                    {isMessageItem && unreadCount > 0 && (
                      <span className={`min-w-[20px] h-[20px] rounded-full text-xs font-bold flex items-center justify-center ${
                        isActive 
                          ? 'bg-primary-foreground text-primary' 
                          : 'bg-primary text-primary-foreground'
                      }`}>
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
            
            {/* User info at bottom of sidebar */}
            <div className="absolute bottom-0 left-0 right-0 p-4 border-t bg-background">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={user?.profile_image} alt={user?.full_name} />
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {user?.full_name?.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{user?.full_name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{user?.role}</p>
                </div>
              </div>
              <Button 
                variant="outline" 
                className="w-full mt-3 rounded-full text-destructive hover:bg-destructive/10"
                onClick={() => { setSidebarOpen(false); handleLogout(); }}
              >
                <LogOut className="w-4 h-4 mr-2" />
                Log out
              </Button>
            </div>
          </nav>
        </div>
      )}

      {/* Main Content */}
      <main className="container px-3 sm:px-4 py-4 sm:py-6">
        {children}
      </main>
    </div>
  );
};

export default Layout;
