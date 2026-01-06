import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dog, PawPrint, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const AuthPage = () => {
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [showInstallHelp, setShowInstallHelp] = useState(false);
  const [registerForm, setRegisterForm] = useState({
    username: '',
    email: '',
    password: '',
    full_name: '',
    phone: '',
    role: 'client',
  });
  const [loading, setLoading] = useState(false);
  const [checkingSetup, setCheckingSetup] = useState(true);
  const { login, register } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    checkSetupStatus();
  }, []);

  const checkSetupStatus = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/auth/setup-status`);
      if (response.data.setup_required) {
        navigate('/setup');
      }
    } catch (error) {
      console.error('Failed to check setup status:', error);
    } finally {
      setCheckingSetup(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await login(loginForm.username, loginForm.password);
      toast.success(`Welcome back, ${user.full_name}!`);
      navigateByRole(user.role);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await register(registerForm);
      toast.success(`Welcome to BowWowMeow, ${user.full_name}!`);
      navigateByRole(user.role);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const navigateByRole = (role) => {
    switch (role) {
      case 'admin':
        navigate('/admin');
        break;
      case 'walker':
        navigate('/walker');
        break;
      default:
        navigate('/dashboard');
    }
  };

  if (checkingSetup) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-100 via-orange-50 to-sky-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-sky-400 to-orange-400 mb-4">
            <Dog className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-heading font-bold text-foreground">BowWowMeow</h1>
          <p className="text-muted-foreground mt-2">Premium Pet Care Services</p>
        </div>

        <Card className="rounded-3xl shadow-xl border-sky-200/50">
          <Tabs defaultValue="login">
            <CardHeader>
              <TabsList className="grid w-full grid-cols-2 bg-gradient-to-r from-sky-100 to-orange-100">
                <TabsTrigger value="login" data-testid="login-tab" className="data-[state=active]:bg-sky-500 data-[state=active]:text-white">Login</TabsTrigger>
                <TabsTrigger value="register" data-testid="register-tab" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white">Register</TabsTrigger>
              </TabsList>
            </CardHeader>
            <CardContent>
              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-username">Username</Label>
                    <Input
                      id="login-username"
                      data-testid="login-username"
                      placeholder="Enter your username"
                      value={loginForm.username}
                      onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                      required
                      className="border-sky-200 focus:border-sky-400"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Password</Label>
                    <Input
                      id="login-password"
                      data-testid="login-password"
                      type="password"
                      placeholder="Enter your password"
                      value={loginForm.password}
                      onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                      required
                      className="border-sky-200 focus:border-sky-400"
                    />
                  </div>
                  <Button
                    type="submit"
                    data-testid="login-submit"
                    className="w-full rounded-full bg-sky-500 hover:bg-sky-600"
                    disabled={loading}
                  >
                    {loading ? 'Signing in...' : 'Sign In'}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="register">
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="reg-username">Username</Label>
                      <Input
                        id="reg-username"
                        data-testid="register-username"
                        placeholder="Choose username"
                        value={registerForm.username}
                        onChange={(e) => setRegisterForm({ ...registerForm, username: e.target.value })}
                        required
                        className="border-orange-200 focus:border-orange-400"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="reg-email">Email</Label>
                      <Input
                        id="reg-email"
                        data-testid="register-email"
                        type="email"
                        placeholder="your@email.com"
                        value={registerForm.email}
                        onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                        required
                        className="border-orange-200 focus:border-orange-400"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-fullname">Full Name</Label>
                    <Input
                      id="reg-fullname"
                      data-testid="register-fullname"
                      placeholder="Your full name"
                      value={registerForm.full_name}
                      onChange={(e) => setRegisterForm({ ...registerForm, full_name: e.target.value })}
                      required
                      className="border-orange-200 focus:border-orange-400"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-phone">Phone</Label>
                    <Input
                      id="reg-phone"
                      data-testid="register-phone"
                      placeholder="(555) 123-4567"
                      value={registerForm.phone}
                      onChange={(e) => setRegisterForm({ ...registerForm, phone: e.target.value })}
                      className="border-orange-200 focus:border-orange-400"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-password">Password</Label>
                    <Input
                      id="reg-password"
                      data-testid="register-password"
                      type="password"
                      placeholder="Create a password"
                      value={registerForm.password}
                      onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                      required
                      className="border-orange-200 focus:border-orange-400"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Account Type</Label>
                    <Select
                      value={registerForm.role}
                      onValueChange={(value) => setRegisterForm({ ...registerForm, role: value })}
                    >
                      <SelectTrigger data-testid="register-role" className="border-orange-200">
                        <SelectValue placeholder="Select account type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="client">Pet Owner (Client)</SelectItem>
                        <SelectItem value="walker">Walker & Sitter</SelectItem>
                        <SelectItem value="admin">Administrator</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    type="submit"
                    data-testid="register-submit"
                    className="w-full rounded-full bg-orange-500 hover:bg-orange-600"
                    disabled={loading}
                  >
                    {loading ? 'Creating account...' : 'Create Account'}
                  </Button>
                </form>
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>

        <p className="text-center text-sm text-muted-foreground mt-6">
          <PawPrint className="inline w-4 h-4 mr-1 text-sky-400" />
          Trusted by pet owners everywhere
        </p>

        {/* Install App Link */}
        <button 
          onClick={() => setShowInstallHelp(true)}
          className="flex items-center justify-center gap-2 mx-auto mt-4 text-sm text-sky-600 hover:text-sky-700 transition-colors"
        >
          <Smartphone className="w-4 h-4" />
          <span>Install App on Your Phone</span>
        </button>

        {/* Install Help Modal */}
        {showInstallHelp && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl overflow-hidden">
              <div className="bg-gradient-to-r from-orange-500 to-sky-500 p-4 text-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-6 h-6" />
                    <h2 className="font-bold text-lg">Install BowWowMeow</h2>
                  </div>
                  <button 
                    onClick={() => setShowInstallHelp(false)}
                    className="text-white hover:bg-white/20 rounded-full p-1"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div className="p-4 space-y-4">
                {/* iPhone/iPad Instructions */}
                <div className="space-y-3">
                  <h3 className="font-bold text-gray-800 flex items-center gap-2">
                    🍎 iPhone / iPad (Safari)
                  </h3>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600">
                    <li>Open this site in <strong>Safari</strong></li>
                    <li>Tap the <strong>Share</strong> button (square with arrow)</li>
                    <li>Scroll down and tap <strong>"Add to Home Screen"</strong></li>
                    <li>Tap <strong>"Add"</strong> in the top right</li>
                  </ol>
                </div>

                <hr className="border-gray-200" />

                {/* Android Instructions */}
                <div className="space-y-3">
                  <h3 className="font-bold text-gray-800 flex items-center gap-2">
                    🤖 Android (Chrome)
                  </h3>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600">
                    <li>Open this site in <strong>Chrome</strong></li>
                    <li>Tap the <strong>menu</strong> (three dots)</li>
                    <li>Tap <strong>"Add to Home Screen"</strong></li>
                    <li>Tap <strong>"Add"</strong></li>
                  </ol>
                </div>

                {/* App Icon Preview */}
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-500 mb-2">The app icon:</p>
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl overflow-hidden shadow-md">
                    <img src="/icons/icon-192x192.png" alt="BowWowMeow icon" className="w-full h-full" />
                  </div>
                </div>
              </div>

              <div className="p-4 border-t bg-gray-50">
                <Button 
                  onClick={() => setShowInstallHelp(false)}
                  className="w-full bg-gradient-to-r from-orange-500 to-sky-500 hover:from-orange-600 hover:to-sky-600 text-white rounded-full"
                >
                  Got it!
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuthPage;
