import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { 
  DollarSign, FileText, Clock, CheckCircle, AlertCircle, 
  TrendingUp, Calendar, Users, Edit2, Save, RefreshCw, Settings, CreditCard
} from 'lucide-react';
import { toast } from 'sonner';

const AdminBillingPage = () => {
  const { api } = useAuth();
  const [services, setServices] = useState([]);
  const [clientsDue, setClientsDue] = useState([]);
  const [openInvoices, setOpenInvoices] = useState([]);
  const [revenue, setRevenue] = useState({});
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingService, setEditingService] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', price: '', description: '' });
  const [paymentSettings, setPaymentSettings] = useState({
    zelle: { enabled: true, email: '', phone: '', name: '' },
    venmo: { enabled: true, username: '' },
    cashapp: { enabled: true, cashtag: '' },
    instructions: 'Please include your invoice number in the payment memo.',
  });
  const [savingPaymentSettings, setSavingPaymentSettings] = useState(false);

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [servicesRes, clientsDueRes, openInvRes, revenueRes, clientsRes, paymentInfoRes] = await Promise.all([
        api.get('/services'),
        api.get('/billing/clients-due'),
        api.get('/invoices/open'),
        api.get('/revenue/summary'),
        api.get('/users/clients'),
        api.get('/settings/payment-info'),
      ]);
      setServices(servicesRes.data);
      setClientsDue(clientsDueRes.data);
      setOpenInvoices(openInvRes.data);
      setRevenue(revenueRes.data);
      setClients(clientsRes.data);
      if (paymentInfoRes.data && Object.keys(paymentInfoRes.data).length > 0) {
        setPaymentSettings(paymentInfoRes.data);
      }
    } catch (error) {
      toast.error('Failed to load billing data');
    } finally {
      setLoading(false);
    }
  };

  const updateServicePricing = async (serviceId) => {
    try {
      await api.put(`/services/${serviceId}`, null, {
        params: {
          name: editForm.name || undefined,
          price: editForm.price ? parseFloat(editForm.price) : undefined,
          description: editForm.description || undefined,
        }
      });
      toast.success('Service pricing updated');
      setEditingService(null);
      fetchAllData();
    } catch (error) {
      toast.error('Failed to update pricing');
    }
  };

  const updateBillingCycle = async (clientId, cycle) => {
    try {
      await api.put(`/users/${clientId}/billing-cycle?billing_cycle=${cycle}`);
      toast.success('Billing cycle updated');
      fetchAllData();
    } catch (error) {
      toast.error('Failed to update billing cycle');
    }
  };

  const generateInvoice = async (clientId, appointmentIds) => {
    try {
      await api.post(`/billing/generate-invoice?client_id=${clientId}`, appointmentIds);
      toast.success('Invoice generated successfully');
      fetchAllData();
    } catch (error) {
      toast.error('Failed to generate invoice');
    }
  };

  const startEditing = (service) => {
    setEditingService(service.id);
    setEditForm({
      name: service.name,
      price: service.price.toString(),
      description: service.description,
    });
  };

  const savePaymentSettings = async () => {
    setSavingPaymentSettings(true);
    try {
      await api.put('/settings/payment-info', paymentSettings);
      toast.success('Payment settings saved');
    } catch (error) {
      toast.error('Failed to save payment settings');
    } finally {
      setSavingPaymentSettings(false);
    }
  };

  const markInvoiceAsPaid = async (invoiceId, paymentMethod) => {
    try {
      await api.post(`/invoices/${invoiceId}/mark-paid?payment_method=${paymentMethod}`);
      toast.success('Invoice marked as paid');
      fetchAllData();
    } catch (error) {
      toast.error('Failed to mark invoice as paid');
    }
  };

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
      <div className="space-y-8" data-testid="admin-billing-page">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-heading font-bold">Billing & Revenue</h1>
            <p className="text-muted-foreground">Manage pricing, invoices, and track revenue</p>
          </div>
          <Button onClick={fetchAllData} variant="outline" className="rounded-full" data-testid="refresh-btn">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Main Tabs */}
        <Tabs defaultValue="pricing" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
            <TabsTrigger value="pricing" data-testid="tab-pricing">Set Up Pricing</TabsTrigger>
            <TabsTrigger value="create" data-testid="tab-create">Create Invoices</TabsTrigger>
            <TabsTrigger value="open" data-testid="tab-open">Open Invoices</TabsTrigger>
            <TabsTrigger value="revenue" data-testid="tab-revenue">Revenue</TabsTrigger>
            <TabsTrigger value="payment-settings" data-testid="tab-payment-settings">Payment Settings</TabsTrigger>
          </TabsList>

          {/* Set Up Pricing Tab */}
          <TabsContent value="pricing" className="space-y-6">
            <Card className="rounded-2xl shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-primary" />
                  Service Pricing
                </CardTitle>
                <CardDescription>Configure pricing for all services</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {services.map((service) => (
                    <div
                      key={service.id}
                      className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl bg-muted/50"
                      data-testid={`service-${service.id}`}
                    >
                      {editingService === service.id ? (
                        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                          <Input
                            value={editForm.name}
                            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                            placeholder="Service name"
                          />
                          <Input
                            type="number"
                            value={editForm.price}
                            onChange={(e) => setEditForm({ ...editForm, price: e.target.value })}
                            placeholder="Price"
                          />
                          <Input
                            value={editForm.description}
                            onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                            placeholder="Description"
                          />
                        </div>
                      ) : (
                        <div className="flex items-center gap-4 flex-1">
                          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                            <DollarSign className="w-6 h-6 text-primary" />
                          </div>
                          <div className="flex-1">
                            <p className="font-medium">{service.name}</p>
                            <p className="text-sm text-muted-foreground">{service.description}</p>
                            <p className="text-xs text-muted-foreground">{service.duration_minutes} minutes</p>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-bold text-primary">${service.price.toFixed(2)}</p>
                          </div>
                        </div>
                      )}
                      <div className="flex gap-2">
                        {editingService === service.id ? (
                          <>
                            <Button size="sm" onClick={() => updateServicePricing(service.id)} className="rounded-full">
                              <Save className="w-4 h-4 mr-1" /> Save
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setEditingService(null)} className="rounded-full">
                              Cancel
                            </Button>
                          </>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => startEditing(service)} className="rounded-full" data-testid={`edit-service-${service.id}`}>
                            <Edit2 className="w-4 h-4 mr-1" /> Edit
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Client Billing Cycles */}
            <Card className="rounded-2xl shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-secondary" />
                  Client Billing Cycles
                </CardTitle>
                <CardDescription>Set how often each client is billed</CardDescription>
              </CardHeader>
              <CardContent>
                {clients.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">No clients yet</p>
                ) : (
                  <div className="space-y-3">
                    {clients.map((client) => (
                      <div
                        key={client.id}
                        className="flex items-center justify-between p-4 rounded-xl bg-muted/30"
                        data-testid={`client-billing-${client.id}`}
                      >
                        <div>
                          <p className="font-medium">{client.full_name}</p>
                          <p className="text-sm text-muted-foreground">{client.email}</p>
                        </div>
                        <Select
                          value={client.billing_cycle || 'weekly'}
                          onValueChange={(value) => updateBillingCycle(client.id, value)}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="daily">Daily</SelectItem>
                            <SelectItem value="weekly">Weekly</SelectItem>
                            <SelectItem value="monthly">Monthly</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Create Invoices Tab */}
          <TabsContent value="create" className="space-y-6">
            <Card className="rounded-2xl shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  Clients Ready for Invoicing
                </CardTitle>
                <CardDescription>Clients with completed, uninvoiced appointments</CardDescription>
              </CardHeader>
              <CardContent>
                {clientsDue.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <CheckCircle className="w-16 h-16 mx-auto mb-4 opacity-50 text-green-500" />
                    <p className="text-lg">All caught up!</p>
                    <p className="text-sm">No pending invoices to create</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {clientsDue.map((client) => (
                      <div
                        key={client.client_id}
                        className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl bg-muted/50"
                        data-testid={`client-due-${client.client_id}`}
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-xl bg-yellow-100 flex items-center justify-center">
                            <Users className="w-6 h-6 text-yellow-600" />
                          </div>
                          <div>
                            <p className="font-medium">{client.client_name}</p>
                            <p className="text-sm text-muted-foreground">{client.email}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="secondary" className="rounded-full text-xs capitalize">
                                {client.billing_cycle} billing
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {client.uninvoiced_appointments} appointment(s)
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-2xl font-bold text-primary">${client.total_amount.toFixed(2)}</p>
                          </div>
                          <Button
                            onClick={() => generateInvoice(client.client_id, client.appointment_ids)}
                            className="rounded-full"
                            data-testid={`generate-invoice-${client.client_id}`}
                          >
                            Generate Invoice
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Open Invoices Tab */}
          <TabsContent value="open" className="space-y-6">
            <Card className="rounded-2xl shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-yellow-600" />
                  Open Invoices
                </CardTitle>
                <CardDescription>{openInvoices.length} invoices awaiting payment</CardDescription>
              </CardHeader>
              <CardContent>
                {openInvoices.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <CheckCircle className="w-16 h-16 mx-auto mb-4 opacity-50 text-green-500" />
                    <p className="text-lg">All invoices paid!</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {openInvoices.map((invoice) => (
                      <div
                        key={invoice.id}
                        className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl bg-muted/50"
                        data-testid={`open-invoice-${invoice.id}`}
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                            invoice.status === 'overdue' ? 'bg-red-100' : 'bg-yellow-100'
                          }`}>
                            {invoice.status === 'overdue' ? (
                              <AlertCircle className="w-6 h-6 text-red-600" />
                            ) : (
                              <Clock className="w-6 h-6 text-yellow-600" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium">{invoice.client_name}</p>
                            <p className="text-sm text-muted-foreground">{invoice.client_email}</p>
                            <p className="text-xs text-muted-foreground">
                              Due: {invoice.due_date} • {invoice.appointment_ids?.length || 0} service(s)
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <Badge className={`rounded-full ${
                            invoice.status === 'overdue' 
                              ? 'bg-red-100 text-red-800' 
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {invoice.status === 'overdue' ? (
                              <><AlertCircle className="w-3 h-3 mr-1" /> Overdue</>
                            ) : (
                              <><Clock className="w-3 h-3 mr-1" /> Pending</>
                            )}
                          </Badge>
                          <p className="text-2xl font-bold">${invoice.amount.toFixed(2)}</p>
                          <Select onValueChange={(method) => markInvoiceAsPaid(invoice.id, method)}>
                            <SelectTrigger className="w-36" data-testid={`mark-paid-${invoice.id}`}>
                              <SelectValue placeholder="Mark as Paid" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="zelle">Paid via Zelle</SelectItem>
                              <SelectItem value="venmo">Paid via Venmo</SelectItem>
                              <SelectItem value="cashapp">Paid via CashApp</SelectItem>
                              <SelectItem value="cash">Paid in Cash</SelectItem>
                              <SelectItem value="check">Paid by Check</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Revenue Tab */}
          <TabsContent value="revenue" className="space-y-6">
            {/* Revenue Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="rounded-2xl shadow-sm">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Daily</p>
                      <p className="text-3xl font-bold mt-1">${revenue.daily?.toFixed(2) || '0.00'}</p>
                      <p className="text-xs text-muted-foreground">Today</p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                      <TrendingUp className="w-6 h-6 text-blue-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl shadow-sm">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Weekly</p>
                      <p className="text-3xl font-bold mt-1">${revenue.weekly?.toFixed(2) || '0.00'}</p>
                      <p className="text-xs text-muted-foreground">This week</p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
                      <TrendingUp className="w-6 h-6 text-green-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl shadow-sm">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Month to Date</p>
                      <p className="text-3xl font-bold mt-1">${revenue.month_to_date?.toFixed(2) || '0.00'}</p>
                      <p className="text-xs text-muted-foreground">This month</p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
                      <TrendingUp className="w-6 h-6 text-purple-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl shadow-sm">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Year to Date</p>
                      <p className="text-3xl font-bold mt-1">${revenue.year_to_date?.toFixed(2) || '0.00'}</p>
                      <p className="text-xs text-muted-foreground">This year</p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                      <DollarSign className="w-6 h-6 text-primary" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Revenue Details */}
            <Card className="rounded-2xl shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                  Revenue Overview
                </CardTitle>
                <CardDescription>
                  {revenue.total_paid_invoices || 0} paid invoices total
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 rounded-xl bg-blue-50 text-center">
                      <p className="text-sm text-blue-600 font-medium">Daily</p>
                      <p className="text-2xl font-bold text-blue-800">${revenue.daily?.toFixed(2) || '0.00'}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-green-50 text-center">
                      <p className="text-sm text-green-600 font-medium">Weekly</p>
                      <p className="text-2xl font-bold text-green-800">${revenue.weekly?.toFixed(2) || '0.00'}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-purple-50 text-center">
                      <p className="text-sm text-purple-600 font-medium">Month to Date</p>
                      <p className="text-2xl font-bold text-purple-800">${revenue.month_to_date?.toFixed(2) || '0.00'}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-orange-50 text-center">
                      <p className="text-sm text-orange-600 font-medium">Year to Date</p>
                      <p className="text-2xl font-bold text-orange-800">${revenue.year_to_date?.toFixed(2) || '0.00'}</p>
                    </div>
                  </div>

                  <div className="text-center text-sm text-muted-foreground pt-4 border-t">
                    Last updated: {revenue.as_of ? new Date(revenue.as_of).toLocaleString() : 'N/A'}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default AdminBillingPage;
