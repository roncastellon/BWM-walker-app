import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { PawPrint, Building2, User, Mail, Lock, Phone, Loader2, CheckCircle, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const SetupPage = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [setupRequired, setSetupRequired] = useState(true);
  
  const [formData, setFormData] = useState({
    company_name: '',
    full_name: '',
    email: '',
    phone: '',
    username: '',
    password: '',
    confirm_password: ''
  });

  useEffect(() => {
    checkSetupStatus();
  }, []);

  const checkSetupStatus = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/auth/setup-status`);
      if (!response.data.setup_required) {
        // Admin already exists, redirect to login
        navigate('/auth');
      }
      setSetupRequired(response.data.setup_required);
    } catch (error) {
      console.error('Failed to check setup status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const validateStep1 = () => {
    if (!formData.company_name.trim()) {
      toast.error('Please enter your company name');
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (!formData.full_name.trim()) {
      toast.error('Please enter your full name');
      return false;
    }
    if (!formData.email.trim() || !formData.email.includes('@')) {
      toast.error('Please enter a valid email');
      return false;
    }
    if (!formData.username.trim() || formData.username.length < 3) {
      toast.error('Username must be at least 3 characters');
      return false;
    }
    if (!formData.password || formData.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return false;
    }
    if (formData.password !== formData.confirm_password) {
      toast.error('Passwords do not match');
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (step === 1 && validateStep1()) {
      setStep(2);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateStep2()) return;

    setSubmitting(true);
    try {
      const response = await axios.post(`${API_URL}/api/auth/setup-admin`, {
        username: formData.username,
        email: formData.email,
        password: formData.password,
        full_name: formData.full_name,
        company_name: formData.company_name,
        phone: formData.phone || null
      });

      toast.success('Admin account created! Welcome to WagWalk!');
      
      // Auto-login
      login(response.data.access_token, response.data.user);
      navigate('/admin');
    } catch (error) {
      const message = error.response?.data?.detail || 'Failed to create admin account';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-secondary/5">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!setupRequired) {
    return null; // Will redirect
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-secondary/5 p-4">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary text-primary-foreground mb-4">
            <PawPrint className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-heading font-bold">WagWalk</h1>
          <p className="text-muted-foreground mt-1">Let's set up your account</p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className={`flex items-center gap-2 ${step >= 1 ? 'text-primary' : 'text-muted-foreground'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 1 ? 'bg-primary text-white' : 'bg-muted'}`}>
              {step > 1 ? <CheckCircle className="w-5 h-5" /> : '1'}
            </div>
            <span className="text-sm font-medium hidden sm:inline">Business</span>
          </div>
          <div className="w-12 h-0.5 bg-muted" />
          <div className={`flex items-center gap-2 ${step >= 2 ? 'text-primary' : 'text-muted-foreground'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 2 ? 'bg-primary text-white' : 'bg-muted'}`}>
              2
            </div>
            <span className="text-sm font-medium hidden sm:inline">Account</span>
          </div>
        </div>

        <Card className="rounded-2xl shadow-lg">
          <CardHeader className="text-center pb-2">
            <CardTitle>
              {step === 1 ? 'Your Business' : 'Create Admin Account'}
            </CardTitle>
            <CardDescription>
              {step === 1 
                ? 'Tell us about your pet care business' 
                : 'Set up your administrator login'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {step === 1 && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="company_name">Company Name *</Label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="company_name"
                        name="company_name"
                        placeholder="WagWalk Pet Services"
                        value={formData.company_name}
                        onChange={handleChange}
                        className="pl-10"
                        autoFocus
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="phone">Business Phone (Optional)</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="phone"
                        name="phone"
                        type="tel"
                        placeholder="(555) 123-4567"
                        value={formData.phone}
                        onChange={handleChange}
                        className="pl-10"
                      />
                    </div>
                  </div>

                  <Button 
                    type="button" 
                    onClick={handleNext}
                    className="w-full rounded-full mt-6"
                    size="lg"
                  >
                    Continue
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </>
              )}

              {step === 2 && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="full_name">Your Full Name *</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="full_name"
                        name="full_name"
                        placeholder="John Smith"
                        value={formData.full_name}
                        onChange={handleChange}
                        className="pl-10"
                        autoFocus
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address *</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        placeholder="john@example.com"
                        value={formData.email}
                        onChange={handleChange}
                        className="pl-10"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="username">Username *</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="username"
                        name="username"
                        placeholder="johnadmin"
                        value={formData.username}
                        onChange={handleChange}
                        className="pl-10"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="password">Password *</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="password"
                          name="password"
                          type="password"
                          placeholder="••••••••"
                          value={formData.password}
                          onChange={handleChange}
                          className="pl-10"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirm_password">Confirm *</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="confirm_password"
                          name="confirm_password"
                          type="password"
                          placeholder="••••••••"
                          value={formData.confirm_password}
                          onChange={handleChange}
                          className="pl-10"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3 mt-6">
                    <Button 
                      type="button" 
                      variant="outline"
                      onClick={() => setStep(1)}
                      className="flex-1 rounded-full"
                    >
                      Back
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={submitting}
                      className="flex-1 rounded-full"
                      size="lg"
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        <>
                          Create Account
                          <CheckCircle className="w-4 h-4 ml-2" />
                        </>
                      )}
                    </Button>
                  </div>
                </>
              )}
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Already have an account?{' '}
          <button 
            onClick={() => navigate('/auth')} 
            className="text-primary hover:underline font-medium"
          >
            Sign in
          </button>
        </p>
      </div>
    </div>
  );
};

export default SetupPage;
