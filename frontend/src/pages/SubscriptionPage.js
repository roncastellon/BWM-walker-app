import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import { 
  Crown, Check, X, Zap, Users, PawPrint, FileText, MessageSquare,
  Navigation, TrendingUp, Palette, Calendar, Loader2, AlertCircle,
  CheckCircle, Sparkles
} from 'lucide-react';
import { toast } from 'sonner';

const SubscriptionPage = () => {
  const { api } = useAuth();
  const [searchParams] = useSearchParams();
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(false);
  const [startingTrial, setStartingTrial] = useState(false);

  useEffect(() => {
    fetchSubscription();
    
    // Check for success/cancel from Stripe
    if (searchParams.get('success') === 'true') {
      toast.success('Welcome to Premium! Your subscription is now active.');
    } else if (searchParams.get('canceled') === 'true') {
      toast.info('Upgrade canceled. You can upgrade anytime.');
    }
  }, [searchParams]);

  const fetchSubscription = async () => {
    try {
      const response = await api.get('/subscription');
      setSubscription(response.data);
    } catch (error) {
      toast.error('Failed to load subscription');
    } finally {
      setLoading(false);
    }
  };

  const startTrial = async () => {
    setStartingTrial(true);
    try {
      await api.post('/subscription/start-trial');
      toast.success('14-day Premium trial started!');
      fetchSubscription();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to start trial');
    } finally {
      setStartingTrial(false);
    }
  };

  const handleUpgrade = async (planType) => {
    setUpgrading(true);
    try {
      const response = await api.post(`/subscription/upgrade?plan_type=${planType}`);
      window.location.href = response.data.checkout_url;
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to start upgrade');
      setUpgrading(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel your subscription?')) return;
    
    try {
      await api.post('/subscription/cancel');
      toast.success('Subscription canceled');
      fetchSubscription();
    } catch (error) {
      toast.error('Failed to cancel subscription');
    }
  };

  const isPremium = subscription?.tier === 'premium';
  const isTrialing = subscription?.status === 'trialing';
  const trialUsed = !!subscription?.trial_ends_at;

  const features = [
    { name: 'Walkers', free: 'Up to 5', premium: 'Unlimited', icon: PawPrint, key: 'max_walkers' },
    { name: 'Clients', free: 'Up to 10', premium: 'Unlimited', icon: Users, key: 'max_clients' },
    { name: 'Invoicing', free: false, premium: true, icon: FileText, key: 'invoicing' },
    { name: 'Mass Text/SMS', free: false, premium: true, icon: MessageSquare, key: 'mass_text' },
    { name: 'GPS Walk Tracking', free: false, premium: true, icon: Navigation, key: 'gps_tracking' },
    { name: 'Revenue Reports', free: false, premium: true, icon: TrendingUp, key: 'revenue_reports' },
    { name: 'Recurring Schedules', free: false, premium: true, icon: Calendar, key: 'recurring_schedules' },
    { name: 'Custom Branding', free: false, premium: true, icon: Palette, key: 'custom_branding' },
  ];

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-8" data-testid="subscription-page">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-heading font-bold flex items-center justify-center gap-2">
            <Crown className="w-8 h-8 text-yellow-500" />
            Subscription
          </h1>
          <p className="text-muted-foreground mt-2">Unlock premium features for your business</p>
        </div>

        {/* Current Plan Status */}
        <Card className={`rounded-2xl ${isPremium ? 'bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-200' : ''}`}>
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${isPremium ? 'bg-yellow-100' : 'bg-muted'}`}>
                  {isPremium ? <Crown className="w-7 h-7 text-yellow-600" /> : <Zap className="w-7 h-7 text-muted-foreground" />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold capitalize">{subscription?.tier} Plan</h2>
                    {isTrialing && (
                      <Badge className="bg-blue-100 text-blue-800 rounded-full">Trial</Badge>
                    )}
                  </div>
                  {isTrialing && subscription?.trial_ends_at && (
                    <p className="text-sm text-muted-foreground">
                      Trial ends: {new Date(subscription.trial_ends_at).toLocaleDateString()}
                    </p>
                  )}
                  {isPremium && subscription?.plan_type && !isTrialing && (
                    <p className="text-sm text-muted-foreground capitalize">
                      {subscription.plan_type} billing
                    </p>
                  )}
                </div>
              </div>
              
              {isPremium && !isTrialing && (
                <Button variant="outline" onClick={handleCancel} className="rounded-full">
                  Cancel Subscription
                </Button>
              )}
            </div>

            {/* Usage Stats */}
            {!isPremium && subscription?.usage && (
              <div className="mt-6 grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-white/80">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Walkers</span>
                    <span className="text-sm text-muted-foreground">
                      {subscription.usage.walkers} / {subscription.limits.max_walkers}
                    </span>
                  </div>
                  <Progress value={(subscription.usage.walkers / subscription.limits.max_walkers) * 100} className="h-2" />
                </div>
                <div className="p-4 rounded-xl bg-white/80">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Clients</span>
                    <span className="text-sm text-muted-foreground">
                      {subscription.usage.clients} / {subscription.limits.max_clients}
                    </span>
                  </div>
                  <Progress value={(subscription.usage.clients / subscription.limits.max_clients) * 100} className="h-2" />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pricing Cards */}
        {!isPremium && (
          <div className="grid md:grid-cols-2 gap-6">
            {/* Free Plan */}
            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-5 h-5" />
                  Free
                </CardTitle>
                <CardDescription>Get started with basic features</CardDescription>
                <div className="pt-4">
                  <span className="text-4xl font-bold">$0</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {features.map((feature) => (
                    <li key={feature.key} className="flex items-center gap-3">
                      {feature.free ? (
                        <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
                      ) : (
                        <X className="w-5 h-5 text-muted-foreground shrink-0" />
                      )}
                      <span className={!feature.free ? 'text-muted-foreground' : ''}>
                        {feature.name}
                        {typeof feature.free === 'string' && ` (${feature.free})`}
                      </span>
                    </li>
                  ))}
                </ul>
                <Button variant="outline" className="w-full mt-6 rounded-full" disabled>
                  Current Plan
                </Button>
              </CardContent>
            </Card>

            {/* Premium Plan */}
            <Card className="rounded-2xl border-2 border-yellow-400 relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-yellow-400 text-yellow-900 text-xs font-bold px-3 py-1 rounded-bl-lg">
                POPULAR
              </div>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Crown className="w-5 h-5 text-yellow-500" />
                  Premium
                </CardTitle>
                <CardDescription>Everything you need to grow</CardDescription>
                <div className="pt-4 space-y-1">
                  <div>
                    <span className="text-4xl font-bold">$14.99</span>
                    <span className="text-muted-foreground">/month</span>
                  </div>
                  <p className="text-sm text-green-600">or $149/year (save $30!)</p>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {features.map((feature) => (
                    <li key={feature.key} className="flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
                      <span>
                        {feature.name}
                        {typeof feature.premium === 'string' && ` (${feature.premium})`}
                      </span>
                    </li>
                  ))}
                </ul>
                
                <div className="mt-6 space-y-3">
                  {!trialUsed && (
                    <Button 
                      onClick={startTrial}
                      disabled={startingTrial}
                      variant="outline"
                      className="w-full rounded-full border-yellow-400 text-yellow-700 hover:bg-yellow-50"
                    >
                      {startingTrial ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Starting...</>
                      ) : (
                        <><Sparkles className="w-4 h-4 mr-2" /> Start 14-Day Free Trial</>
                      )}
                    </Button>
                  )}
                  
                  <div className="grid grid-cols-2 gap-2">
                    <Button 
                      onClick={() => handleUpgrade('monthly')}
                      disabled={upgrading}
                      className="rounded-full bg-yellow-500 hover:bg-yellow-600 text-yellow-900"
                    >
                      {upgrading ? <Loader2 className="w-4 h-4 animate-spin" /> : '$14.99/mo'}
                    </Button>
                    <Button 
                      onClick={() => handleUpgrade('yearly')}
                      disabled={upgrading}
                      className="rounded-full bg-yellow-500 hover:bg-yellow-600 text-yellow-900"
                    >
                      {upgrading ? <Loader2 className="w-4 h-4 animate-spin" /> : '$149/yr'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Premium Features Detail */}
        {isPremium && (
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle>Your Premium Features</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {features.map((feature) => (
                  <div key={feature.key} className="p-4 rounded-xl bg-muted/50 text-center">
                    <feature.icon className="w-8 h-8 mx-auto mb-2 text-primary" />
                    <p className="font-medium text-sm">{feature.name}</p>
                    <CheckCircle className="w-4 h-4 mx-auto mt-2 text-green-500" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Feature Comparison */}
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>Feature Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4">Feature</th>
                    <th className="text-center py-3 px-4">Free</th>
                    <th className="text-center py-3 px-4 bg-yellow-50">Premium</th>
                  </tr>
                </thead>
                <tbody>
                  {features.map((feature) => (
                    <tr key={feature.key} className="border-b">
                      <td className="py-3 px-4 flex items-center gap-2">
                        <feature.icon className="w-4 h-4 text-muted-foreground" />
                        {feature.name}
                      </td>
                      <td className="text-center py-3 px-4">
                        {typeof feature.free === 'string' ? (
                          <span className="text-sm">{feature.free}</span>
                        ) : feature.free ? (
                          <Check className="w-5 h-5 text-green-500 mx-auto" />
                        ) : (
                          <X className="w-5 h-5 text-muted-foreground mx-auto" />
                        )}
                      </td>
                      <td className="text-center py-3 px-4 bg-yellow-50">
                        {typeof feature.premium === 'string' ? (
                          <span className="text-sm font-medium">{feature.premium}</span>
                        ) : (
                          <Check className="w-5 h-5 text-green-500 mx-auto" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default SubscriptionPage;
