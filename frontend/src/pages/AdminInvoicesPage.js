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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog';
import { 
  DollarSign, FileText, Clock, CheckCircle, AlertCircle, 
  TrendingUp, Calendar, Users, Edit2, Save, RefreshCw, Settings, 
  CreditCard, Building2, Mail, MessageSquare, Eye, Send, Phone, Image,
  Zap, FileCheck, SendHorizonal
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
  
  // Company info state
  const [companyInfo, setCompanyInfo] = useState({
    company_name: '',
    address: '',
    phone: '',
    email: '',
    logo_url: '',
    tax_id: '',
    website: ''
  });
  const [savingCompanyInfo, setSavingCompanyInfo] = useState(false);
  
  // Invoice detail modal
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [invoiceDetail, setInvoiceDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [sendingSms, setSendingSms] = useState(false);
  
  // Notification config
  const [notificationConfig, setNotificationConfig] = useState({
    sendgrid_configured: false,
    twilio_configured: false
  });

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [servicesRes, clientsDueRes, openInvRes, revenueRes, clientsRes, paymentInfoRes, companyInfoRes] = await Promise.all([
        api.get('/services'),
        api.get('/billing/clients-due'),
        api.get('/invoices/open'),
        api.get('/revenue/summary'),
        api.get('/users/clients'),
        api.get('/settings/payment-info'),
        api.get('/settings/company-info'),
      ]);
      setServices(servicesRes.data);
      setClientsDue(clientsDueRes.data);
      setOpenInvoices(openInvRes.data);
      setRevenue(revenueRes.data);
      setClients(clientsRes.data);
      if (paymentInfoRes.data && Object.keys(paymentInfoRes.data).length > 0) {
        setPaymentSettings(paymentInfoRes.data);
      }
      if (companyInfoRes.data && Object.keys(companyInfoRes.data).length > 0) {
        setCompanyInfo(companyInfoRes.data);
      }
      
      // Check notification config
      try {
        const notifRes = await api.get('/settings/notification-config');
        setNotificationConfig(notifRes.data);
      } catch (e) {
        // Notification config endpoint might fail if not configured
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

  const saveCompanyInfo = async () => {
    setSavingCompanyInfo(true);
    try {
      await api.put('/settings/company-info', companyInfo);
      toast.success('Company info saved');
    } catch (error) {
      toast.error('Failed to save company info');
    } finally {
      setSavingCompanyInfo(false);
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

  const openInvoiceDetail = async (invoice) => {
    setSelectedInvoice(invoice);
    setDetailLoading(true);
    try {
      const response = await api.get(`/invoices/${invoice.id}/detail`);
      setInvoiceDetail(response.data);
    } catch (error) {
      toast.error('Failed to load invoice details');
      setInvoiceDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const closeInvoiceDetail = () => {
    setSelectedInvoice(null);
    setInvoiceDetail(null);
  };

  const sendInvoiceEmail = async (invoiceId) => {
    setSendingEmail(true);
    try {
      await api.post(`/invoices/${invoiceId}/send-email`);
      toast.success('Invoice email sent successfully');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to send email');
    } finally {
      setSendingEmail(false);
    }
  };

  const sendInvoiceSms = async (invoiceId) => {
    setSendingSms(true);
    try {
      await api.post(`/invoices/${invoiceId}/send-sms`);
      toast.success('Invoice SMS sent successfully');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to send SMS');
    } finally {
      setSendingSms(false);
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
        <Tabs defaultValue="revenue" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 h-auto p-1">
            <TabsTrigger value="revenue" className="flex flex-col py-3 gap-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground" data-testid="tab-revenue">
              <TrendingUp className="w-5 h-5" />
              <span className="text-xs">Revenue</span>
            </TabsTrigger>
            <TabsTrigger value="invoices" className="flex flex-col py-3 gap-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground" data-testid="tab-invoices">
              <FileText className="w-5 h-5" />
              <span className="text-xs">Invoices</span>
            </TabsTrigger>
            <TabsTrigger value="pricing" className="flex flex-col py-3 gap-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground" data-testid="tab-pricing">
              <DollarSign className="w-5 h-5" />
              <span className="text-xs">Pricing</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex flex-col py-3 gap-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground" data-testid="tab-settings">
              <Settings className="w-5 h-5" />
              <span className="text-xs">Settings</span>
            </TabsTrigger>
          </TabsList>

          {/* REVENUE TAB */}
          <TabsContent value="revenue" className="space-y-4">
            {/* Revenue Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Card className="rounded-xl">
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-sky-600">${revenue.daily?.toFixed(0) || '0'}</p>
                  <p className="text-xs text-muted-foreground">Today</p>
                </CardContent>
              </Card>
              <Card className="rounded-xl">
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-orange-600">${revenue.weekly?.toFixed(0) || '0'}</p>
                  <p className="text-xs text-muted-foreground">This Week</p>
                </CardContent>
              </Card>
              <Card className="rounded-xl">
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-sky-700">${revenue.month_to_date?.toFixed(0) || '0'}</p>
                  <p className="text-xs text-muted-foreground">Month to Date</p>
                </CardContent>
              </Card>
              <Card className="rounded-xl">
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-primary">${revenue.year_to_date?.toFixed(0) || '0'}</p>
                  <p className="text-xs text-muted-foreground">Year to Date</p>
                </CardContent>
              </Card>
            </div>

            {/* Revenue Details Card */}
            <Card className="rounded-xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-orange-600" />
                  Revenue Overview
                </CardTitle>
                <CardDescription>{revenue.total_paid_invoices || 0} paid invoices total</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-3 rounded-lg bg-sky-50 text-center">
                    <p className="text-xs text-sky-600 font-medium">Daily</p>
                    <p className="text-lg font-bold text-sky-800">${revenue.daily?.toFixed(2) || '0.00'}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-orange-50 text-center">
                    <p className="text-xs text-orange-600 font-medium">Weekly</p>
                    <p className="text-lg font-bold text-orange-800">${revenue.weekly?.toFixed(2) || '0.00'}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-sky-100 text-center">
                    <p className="text-xs text-sky-600 font-medium">MTD</p>
                    <p className="text-lg font-bold text-sky-800">${revenue.month_to_date?.toFixed(2) || '0.00'}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-orange-50 text-center">
                    <p className="text-xs text-orange-600 font-medium">YTD</p>
                    <p className="text-lg font-bold text-orange-800">${revenue.year_to_date?.toFixed(2) || '0.00'}</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground text-center mt-4 pt-3 border-t">
                  Last updated: {revenue.as_of ? new Date(revenue.as_of).toLocaleString() : 'N/A'}
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* INVOICES TAB */}
          <TabsContent value="invoices" className="space-y-4">
            {/* Create Invoices */}
            <Card className="rounded-xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  Clients Ready for Invoicing
                </CardTitle>
                <CardDescription>Create invoices for clients with unbilled services</CardDescription>
              </CardHeader>
              <CardContent>
                {clientsDue.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    <CheckCircle className="w-10 h-10 mx-auto mb-2 text-sky-500 opacity-70" />
                    <p className="text-sm">All clients are up to date!</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {clientsDue.map((client) => (
                      <div key={client.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div>
                          <p className="font-medium text-sm">{client.full_name}</p>
                          <p className="text-xs text-muted-foreground">{client.unbilled_appointments} unbilled services</p>
                        </div>
                        <Button size="sm" onClick={() => generateInvoice(client.id)} className="rounded-full">
                          Create Invoice
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Open Invoices */}
            <Card className="rounded-xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="w-5 h-5 text-amber-600" />
                  Open Invoices
                  {openInvoices.length > 0 && (
                    <Badge variant="secondary" className="rounded-full ml-1">{openInvoices.length}</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {openInvoices.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    <CheckCircle className="w-10 h-10 mx-auto mb-2 text-sky-500 opacity-70" />
                    <p className="text-sm">No open invoices</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {openInvoices.map((invoice) => (
                      <div key={invoice.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div>
                          <p className="font-medium text-sm">{invoice.client_name}</p>
                          <p className="text-xs text-muted-foreground">Due: {invoice.due_date}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold">${invoice.amount?.toFixed(2)}</p>
                          <Button size="sm" variant="outline" onClick={() => openInvoiceDetail(invoice)} className="rounded-full">
                            <Eye className="w-3 h-3 mr-1" /> View
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* PRICING TAB */}
          <TabsContent value="pricing" className="space-y-4">
            {/* Service Pricing */}
            <Card className="rounded-xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-primary" />
                  Service Pricing
                </CardTitle>
                <CardDescription>Configure pricing for all services</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {services.map((service) => (
                    <div key={service.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50" data-testid={`service-${service.id}`}>
                      {editingService === service.id ? (
                        <div className="flex-1 grid grid-cols-3 gap-2">
                          <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} placeholder="Service name" />
                          <Input type="number" value={editForm.price} onChange={(e) => setEditForm({ ...editForm, price: e.target.value })} placeholder="Price" />
                          <Input value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} placeholder="Description" />
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 flex-1">
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <DollarSign className="w-5 h-5 text-primary" />
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-sm">{service.name}</p>
                            <p className="text-xs text-muted-foreground">{service.description}</p>
                          </div>
                          <p className="text-lg font-bold text-primary">${service.price.toFixed(2)}</p>
                        </div>
                      )}
                      <div className="flex gap-2 ml-3">
                        {editingService === service.id ? (
                          <>
                            <Button size="sm" onClick={() => updateServicePricing(service.id)} className="rounded-full"><Save className="w-3 h-3 mr-1" /> Save</Button>
                            <Button size="sm" variant="outline" onClick={() => setEditingService(null)} className="rounded-full">Cancel</Button>
                          </>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => startEditing(service)} className="rounded-full" data-testid={`edit-service-${service.id}`}><Edit2 className="w-3 h-3 mr-1" /> Edit</Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Client Billing Cycles */}
            <Card className="rounded-xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-secondary" />
                  Client Billing Cycles
                </CardTitle>
              </CardHeader>
              <CardContent>
                {clients.length === 0 ? (
                  <p className="text-center py-6 text-muted-foreground text-sm">No clients yet</p>
                ) : (
                  <div className="space-y-2">
                    {clients.slice(0, 10).map((client) => (
                      <div key={client.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30" data-testid={`client-billing-${client.id}`}>
                        <div>
                          <p className="font-medium text-sm">{client.full_name}</p>
                          <p className="text-xs text-muted-foreground">{client.email}</p>
                        </div>
                        <Select value={client.billing_cycle || 'weekly'} onValueChange={(value) => updateBillingCycle(client.id, value)}>
                          <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
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

          {/* SETTINGS TAB */}
          <TabsContent value="settings" className="space-y-4">
            {/* Company Info */}
            <Card className="rounded-xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-primary" />
                  Company Information
                </CardTitle>
                <CardDescription>This information will appear on invoices</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="company-name">Company Name</Label>
                    <Input id="company-name" value={companyInfo.company_name} onChange={(e) => setCompanyInfo({ ...companyInfo, company_name: e.target.value })} placeholder="BowWowMeow Pet Services" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company-email">Business Email</Label>
                    <Input id="company-email" type="email" value={companyInfo.email} onChange={(e) => setCompanyInfo({ ...companyInfo, email: e.target.value })} placeholder="billing@bowwowmeow.com" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company-phone">Business Phone</Label>
                    <Input id="company-phone" value={companyInfo.phone} onChange={(e) => setCompanyInfo({ ...companyInfo, phone: e.target.value })} placeholder="(555) 123-4567" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company-website">Website</Label>
                    <Input id="company-website" value={companyInfo.website} onChange={(e) => setCompanyInfo({ ...companyInfo, website: e.target.value })} placeholder="www.bowwowmeow.com" />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="company-address">Business Address</Label>
                    <Textarea id="company-address" value={companyInfo.address} onChange={(e) => setCompanyInfo({ ...companyInfo, address: e.target.value })} placeholder="123 Pet Lane, Dogtown, CA 90210" rows={2} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company-tax-id">Tax ID / EIN</Label>
                    <Input id="company-tax-id" value={companyInfo.tax_id} onChange={(e) => setCompanyInfo({ ...companyInfo, tax_id: e.target.value })} placeholder="XX-XXXXXXX" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company-logo">Logo URL</Label>
                    <Input id="company-logo" value={companyInfo.logo_url} onChange={(e) => setCompanyInfo({ ...companyInfo, logo_url: e.target.value })} placeholder="https://example.com/logo.png" />
                  </div>
                </div>
                {companyInfo.logo_url && (
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-xs font-medium mb-2">Logo Preview</p>
                    <img src={companyInfo.logo_url} alt="Logo" className="max-h-16 object-contain" onError={(e) => e.target.style.display = 'none'} />
                  </div>
                )}
                <Button onClick={saveCompanyInfo} disabled={savingCompanyInfo} className="rounded-full" data-testid="save-company-info">
                  <Save className="w-4 h-4 mr-2" />{savingCompanyInfo ? 'Saving...' : 'Save Company Info'}
                </Button>
              </CardContent>
            </Card>

            {/* Invoice Delivery Config */}
            <Card className="rounded-xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Send className="w-5 h-5 text-secondary" />
                  Invoice Delivery
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className={`p-3 rounded-lg ${notificationConfig.sendgrid_configured ? 'bg-sky-50' : 'bg-yellow-50'}`}>
                    <div className="flex items-center gap-3">
                      <Mail className={`w-5 h-5 ${notificationConfig.sendgrid_configured ? 'text-sky-600' : 'text-yellow-600'}`} />
                      <div>
                        <p className="font-medium text-sm">Email (SendGrid)</p>
                        <p className="text-xs text-muted-foreground">{notificationConfig.sendgrid_configured ? 'Configured' : 'Not configured'}</p>
                      </div>
                    </div>
                  </div>
                  <div className={`p-3 rounded-lg ${notificationConfig.twilio_configured ? 'bg-sky-50' : 'bg-yellow-50'}`}>
                    <div className="flex items-center gap-3">
                      <MessageSquare className={`w-5 h-5 ${notificationConfig.twilio_configured ? 'text-sky-600' : 'text-yellow-600'}`} />
                      <div>
                        <p className="font-medium text-sm">SMS (Twilio)</p>
                        <p className="text-xs text-muted-foreground">{notificationConfig.twilio_configured ? 'Configured' : 'Not configured'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Payment Settings */}
            <Card className="rounded-xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-primary" />
                  Payment Methods
                </CardTitle>
                <CardDescription>Configure payment options for clients</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-3 rounded-lg border space-y-2">
                    <p className="font-medium text-sm">Zelle</p>
                    <Input placeholder="Email or Phone" value={paymentSettings.zelle?.email || ''} onChange={(e) => setPaymentSettings({...paymentSettings, zelle: {...paymentSettings.zelle, email: e.target.value}})} />
                  </div>
                  <div className="p-3 rounded-lg border space-y-2">
                    <p className="font-medium text-sm">Venmo</p>
                    <Input placeholder="@username" value={paymentSettings.venmo?.username || ''} onChange={(e) => setPaymentSettings({...paymentSettings, venmo: {...paymentSettings.venmo, username: e.target.value}})} />
                  </div>
                  <div className="p-3 rounded-lg border space-y-2">
                    <p className="font-medium text-sm">Cash App</p>
                    <Input placeholder="$cashtag" value={paymentSettings.cashapp?.cashtag || ''} onChange={(e) => setPaymentSettings({...paymentSettings, cashapp: {...paymentSettings.cashapp, cashtag: e.target.value}})} />
                  </div>
                </div>
                <Button onClick={savePaymentSettings} disabled={savingPaymentSettings} className="rounded-full">
                  <Save className="w-4 h-4 mr-2" />{savingPaymentSettings ? 'Saving...' : 'Save Payment Settings'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Invoice Detail Modal */}
        <Dialog open={!!selectedInvoice} onOpenChange={closeInvoiceDetail}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                Invoice Details
              </DialogTitle>
              <DialogDescription>
                Invoice #{selectedInvoice?.id?.slice(0, 8)}
              </DialogDescription>
            </DialogHeader>
            
            {detailLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : invoiceDetail ? (
              <div className="space-y-6">
                {/* Company Header (if set) */}
                {invoiceDetail.company_info?.company_name && (
                  <div className="p-4 rounded-xl bg-primary/10 text-center">
                    {invoiceDetail.company_info.logo_url && (
                      <img 
                        src={invoiceDetail.company_info.logo_url} 
                        alt="Logo" 
                        className="h-12 mx-auto mb-2 object-contain"
                      />
                    )}
                    <h2 className="text-xl font-bold">{invoiceDetail.company_info.company_name}</h2>
                    {invoiceDetail.company_info.address && (
                      <p className="text-sm text-muted-foreground whitespace-pre-line">{invoiceDetail.company_info.address}</p>
                    )}
                    {(invoiceDetail.company_info.phone || invoiceDetail.company_info.email) && (
                      <p className="text-sm text-muted-foreground">
                        {invoiceDetail.company_info.phone} {invoiceDetail.company_info.phone && invoiceDetail.company_info.email && '|'} {invoiceDetail.company_info.email}
                      </p>
                    )}
                  </div>
                )}

                {/* Invoice Summary */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-muted/50">
                    <p className="text-sm text-muted-foreground">Amount Due</p>
                    <p className="text-3xl font-bold text-primary">${invoiceDetail.amount?.toFixed(2)}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-muted/50">
                    <p className="text-sm text-muted-foreground">Status</p>
                    <Badge className={`mt-1 rounded-full ${
                      invoiceDetail.status === 'paid' ? 'bg-sky-100 text-sky-800' :
                      invoiceDetail.status === 'overdue' ? 'bg-red-100 text-red-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {invoiceDetail.status?.toUpperCase()}
                    </Badge>
                  </div>
                </div>

                {/* Client Info */}
                {invoiceDetail.client && (
                  <div className="p-4 rounded-xl bg-muted/30">
                    <h4 className="font-medium mb-2">Bill To:</h4>
                    <p className="font-medium">{invoiceDetail.client.full_name}</p>
                    {invoiceDetail.client.email && (
                      <p className="text-sm text-muted-foreground">{invoiceDetail.client.email}</p>
                    )}
                    {invoiceDetail.client.phone && (
                      <p className="text-sm text-muted-foreground">{invoiceDetail.client.phone}</p>
                    )}
                  </div>
                )}

                {/* Due Date */}
                <div className="flex justify-between items-center p-3 rounded-lg bg-muted/30">
                  <span className="text-muted-foreground">Due Date:</span>
                  <span className="font-medium">{invoiceDetail.due_date}</span>
                </div>

                {/* Services/Appointments */}
                {invoiceDetail.appointments && invoiceDetail.appointments.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-medium">Services</h4>
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="text-left p-3 text-sm font-medium">Service</th>
                            <th className="text-left p-3 text-sm font-medium">Date</th>
                            <th className="text-right p-3 text-sm font-medium">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {invoiceDetail.appointments.map((appt, idx) => (
                            <tr key={idx} className="border-t">
                              <td className="p-3">
                                <p className="font-medium">{appt.service_name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {appt.pet_names?.join(', ')} • Walker: {appt.walker_name}
                                </p>
                              </td>
                              <td className="p-3 text-sm">
                                {appt.scheduled_date} {appt.scheduled_time}
                              </td>
                              <td className="p-3 text-right font-medium">
                                ${appt.service_price?.toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-muted/30">
                          <tr>
                            <td colSpan="2" className="p-3 text-right font-bold">Total:</td>
                            <td className="p-3 text-right font-bold text-primary">${invoiceDetail.amount?.toFixed(2)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}

                {/* Send Actions */}
                {invoiceDetail.status !== 'paid' && (
                  <div className="flex gap-3 pt-4 border-t">
                    <Button
                      onClick={() => sendInvoiceEmail(invoiceDetail.id)}
                      disabled={sendingEmail || !notificationConfig.sendgrid_configured}
                      className="rounded-full flex-1"
                      variant={notificationConfig.sendgrid_configured ? "default" : "outline"}
                      data-testid="send-invoice-email"
                    >
                      <Mail className="w-4 h-4 mr-2" />
                      {sendingEmail ? 'Sending...' : 'Send Email'}
                    </Button>
                    <Button
                      onClick={() => sendInvoiceSms(invoiceDetail.id)}
                      disabled={sendingSms || !notificationConfig.twilio_configured}
                      className="rounded-full flex-1"
                      variant={notificationConfig.twilio_configured ? "default" : "outline"}
                      data-testid="send-invoice-sms"
                    >
                      <MessageSquare className="w-4 h-4 mr-2" />
                      {sendingSms ? 'Sending...' : 'Send SMS'}
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-center py-8 text-muted-foreground">No details available</p>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default AdminBillingPage;
