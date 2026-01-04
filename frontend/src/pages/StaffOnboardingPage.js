import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { User, Mail, Phone, MapPin, Calendar, CheckCircle, PawPrint, DollarSign } from 'lucide-react';
import { toast } from 'sonner';

const PAYMENT_METHODS = [
  { value: 'zelle', label: 'Zelle', placeholder: 'Email or phone number', icon: '💳' },
  { value: 'venmo', label: 'Venmo', placeholder: '@username', icon: '💙' },
  { value: 'cashapp', label: 'CashApp', placeholder: '$cashtag', icon: '💵' },
];

const StaffOnboardingPage = () => {
  const { user, api } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    full_name: user?.full_name || '',
    email: user?.email || '',
    phone: '',
    address: '',
    date_of_birth: '',
    payment_method: 'zelle',
    payment_id: ''
  });

  useEffect(() => {
    // Pre-fill with existing data if available
    const fetchExistingData = async () => {
      try {
        const res = await api.get('/staff/onboarding-status');
        if (res.data.user_data) {
          setFormData(prev => ({
            ...prev,
            ...res.data.user_data
          }));
        }
      } catch (error) {
        console.error('Failed to fetch existing data');
      }
    };
    fetchExistingData();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.full_name || !formData.email) {
      toast.error('Please fill in your name and email');
      return;
    }
    
    setSubmitting(true);
    try {
      await api.post('/staff/onboarding', formData);
      toast.success('Profile setup complete! Welcome to the team.');
      
      // Redirect to appropriate dashboard
      if (user?.role === 'walker') {
        navigate('/walker');
      } else if (user?.role === 'sitter') {
        navigate('/sitter');
      } else {
        navigate('/');
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to complete setup');
    } finally {
      setSubmitting(false);
    }
  };

  const roleDisplay = user?.role === 'walker' ? 'Walker' : 'Sitter';
  const roleColor = user?.role === 'walker' ? 'from-blue-500 to-blue-600' : 'from-purple-500 to-purple-600';

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-orange-50 py-8 px-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary flex items-center justify-center">
            <PawPrint className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Welcome to BowWowMeow!</h1>
          <p className="text-muted-foreground mt-2">Let's set up your {roleDisplay.toLowerCase()} profile</p>
        </div>

        <Card className="rounded-2xl shadow-lg">
          <CardHeader className={`bg-gradient-to-r ${roleColor} text-white rounded-t-2xl`}>
            <div className="flex items-center gap-3">
              <User className="w-6 h-6" />
              <div>
                <CardTitle>Your Profile</CardTitle>
                <CardDescription className="text-white/80">Tell us about yourself</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Full Name */}
              <div className="space-y-2">
                <Label htmlFor="full_name" className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Full Name *
                </Label>
                <Input
                  id="full_name"
                  value={formData.full_name}
                  onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                  placeholder="John Smith"
                  required
                />
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Email *
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  placeholder="john@example.com"
                  required
                />
              </div>

              {/* Phone */}
              <div className="space-y-2">
                <Label htmlFor="phone" className="flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  Phone Number
                </Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  placeholder="(555) 123-4567"
                />
              </div>

              {/* Address */}
              <div className="space-y-2">
                <Label htmlFor="address" className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Address
                </Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({...formData, address: e.target.value})}
                  placeholder="123 Main St, City, State ZIP"
                />
              </div>

              {/* Date of Birth */}
              <div className="space-y-2">
                <Label htmlFor="date_of_birth" className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Date of Birth
                </Label>
                <Input
                  id="date_of_birth"
                  type="date"
                  value={formData.date_of_birth}
                  onChange={(e) => setFormData({...formData, date_of_birth: e.target.value})}
                />
              </div>

              {/* Submit Button */}
              <Button 
                type="submit" 
                disabled={submitting}
                className={`w-full bg-gradient-to-r ${roleColor} hover:opacity-90 text-white py-6 text-lg`}
              >
                {submitting ? 'Setting up...' : 'Complete Setup'}
                <CheckCircle className="w-5 h-5 ml-2" />
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground mt-4">
          Your information helps us connect you with clients and manage your schedule.
        </p>
      </div>
    </div>
  );
};

export default StaffOnboardingPage;
