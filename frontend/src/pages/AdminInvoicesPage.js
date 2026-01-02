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
  Zap, FileCheck, SendHorizonal, User, PawPrint
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
  
  // Auto-invoice state
  const [pendingReviewInvoices, setPendingReviewInvoices] = useState([]);
  const [generatingInvoices, setGeneratingInvoices] = useState(false);
  const [sendingAllInvoices, setSendingAllInvoices] = useState(false);

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [servicesRes, clientsDueRes, openInvRes, revenueRes, clientsRes, paymentInfoRes, companyInfoRes, pendingRes] = await Promise.all([
        api.get('/services'),
        api.get('/billing/clients-due'),
        api.get('/invoices/open'),
        api.get('/revenue/summary'),
        api.get('/users/clients'),
        api.get('/settings/payment-info'),
        api.get('/settings/company-info'),
        api.get('/invoices/pending-review').catch(() => ({ data: [] })),
      ]);
      setServices(servicesRes.data);
      setClientsDue(clientsDueRes.data);
      setOpenInvoices(openInvRes.data);
      setRevenue(revenueRes.data);
      setClients(clientsRes.data);
      setPendingReviewInvoices(pendingRes.data || []);
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

  // Auto-invoice functions
  const generateAutoInvoices = async (cycle) => {
    setGeneratingInvoices(true);
    try {
      const res = await api.post(`/invoices/auto-generate?cycle=${cycle}`);
      toast.success(res.data.message);
      fetchAllData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to generate invoices');
    } finally {
      setGeneratingInvoices(false);
    }
  };

  const approveInvoice = async (invoiceId) => {
    try {
      await api.post(`/invoices/${invoiceId}/approve-review`);
      toast.success('Invoice approved');
      fetchAllData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to approve invoice');
    }
  };

  const massSendInvoices = async () => {
    setSendingAllInvoices(true);
    try {
      const res = await api.post('/invoices/mass-send');
      toast.success(res.data.message);
      fetchAllData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to send invoices');
    } finally {
      setSendingAllInvoices(false);
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
            {/* Auto-Generate Invoices */}
            <Card className="rounded-xl border-sky-200 bg-sky-50">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2 text-sky-800">
                  <Zap className="w-5 h-5" />
                  Auto-Generate Invoices
                </CardTitle>
                <CardDescription>Create invoices automatically for billing periods</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3">
                  <Button 
                    onClick={() => generateAutoInvoices('weekly')} 
                    disabled={generatingInvoices}
                    variant="outline"
                    className="rounded-full"
                  >
                    {generatingInvoices ? (
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Calendar className="w-4 h-4 mr-2" />
                    )}
                    Generate Weekly
                  </Button>
                  <Button 
                    onClick={() => generateAutoInvoices('monthly')} 
                    disabled={generatingInvoices}
                    variant="outline"
                    className="rounded-full"
                  >
                    {generatingInvoices ? (
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Calendar className="w-4 h-4 mr-2" />
                    )}
                    Generate Monthly
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Pending Review Invoices */}
            {pendingReviewInvoices.length > 0 && (
              <Card className="rounded-xl border-orange-200 bg-orange-50">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2 text-orange-800">
                        <FileCheck className="w-5 h-5" />
                        Pending Review
                        <Badge className="bg-orange-500 text-white rounded-full ml-2">{pendingReviewInvoices.length}</Badge>
                      </CardTitle>
                      <CardDescription>Review and approve invoices before sending</CardDescription>
                    </div>
                    <Button 
                      onClick={massSendInvoices} 
                      disabled={sendingAllInvoices || pendingReviewInvoices.filter(i => i.review_status === 'approved').length === 0}
                      className="rounded-full bg-orange-500 hover:bg-orange-600"
                    >
                      {sendingAllInvoices ? (
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <SendHorizonal className="w-4 h-4 mr-2" />
                      )}
                      Send All Approved
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {pendingReviewInvoices.map((invoice) => (
                      <div key={invoice.id} className="flex items-center justify-between p-3 rounded-lg bg-white border border-orange-200">
                        <div>
                          <p className="font-medium text-sm">{invoice.client?.full_name || 'Client'}</p>
                          <p className="text-xs text-muted-foreground">
                            {invoice.billing_period_start} - {invoice.billing_period_end}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold">${invoice.amount?.toFixed(2)}</p>
                          {invoice.review_status === 'pending' ? (
                            <Button size="sm" onClick={() => approveInvoice(invoice.id)} className="rounded-full bg-sky-500 hover:bg-sky-600">
                              Approve
                            </Button>
                          ) : (
                            <Badge className="bg-sky-100 text-sky-800 rounded-full">Approved</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

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
                <CardDescription>Choose how invoices are sent to clients</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Delivery Preference Selector */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Delivery Method</Label>
                  <Select 
                    value={companyInfo.invoice_delivery_preference || 'both'} 
                    onValueChange={(value) => setCompanyInfo({...companyInfo, invoice_delivery_preference: value})}
                  >
                    <SelectTrigger className="w-full md:w-64">
                      <SelectValue placeholder="Select delivery method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email">
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-sky-500" />
                          <span>Email Only</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="text">
                        <div className="flex items-center gap-2">
                          <MessageSquare className="w-4 h-4 text-green-500" />
                          <span>Text (SMS) Only</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="both">
                        <div className="flex items-center gap-2">
                          <Send className="w-4 h-4 text-orange-500" />
                          <span>Both Email & Text</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {companyInfo.invoice_delivery_preference === 'email' && 'Invoices will be sent via email only'}
                    {companyInfo.invoice_delivery_preference === 'text' && 'Invoices will be sent via text message only'}
                    {(companyInfo.invoice_delivery_preference === 'both' || !companyInfo.invoice_delivery_preference) && 'Invoices will be sent via both email and text message'}
                  </p>
                </div>

                {/* Service Status */}
                <div className="pt-2 border-t">
                  <p className="text-sm font-medium mb-3 text-muted-foreground">Service Status</p>
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
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
            {detailLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500"></div>
              </div>
            ) : invoiceDetail ? (
              <div className="invoice-container">
                {/* Invoice Header - Matches Business Card Design */}
                <div className="bg-white p-6 border-b-4 border-orange-500">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col items-center gap-2">
                      {/* Blue Dog & Orange Cat Icons */}
                      <svg viewBox="0 0 85 55" className="w-36 h-24">
                        {/* Blue Dog - with floppy angled ears higher on head */}
                        {/* Dog Tail - shorter, wagging up between dog and cat */}
                        <path d="M 42 30 Q 46 24 44 18 Q 43 16 45 17" fill="#38bdf8" stroke="#1e3a5f" strokeWidth="2" strokeLinecap="round"/>
                        {/* Body */}
                        <ellipse cx="25" cy="32" rx="20" ry="16" fill="#38bdf8" stroke="#1e3a5f" strokeWidth="2"/>
                        {/* Head */}
                        <circle cx="18" cy="18" r="14" fill="#38bdf8" stroke="#1e3a5f" strokeWidth="2"/>
                        {/* Left floppy ear - higher and angled */}
                        <ellipse cx="5" cy="14" rx="3" ry="9" fill="#38bdf8" stroke="#1e3a5f" strokeWidth="2" transform="rotate(20, 5, 14)"/>
                        {/* Right floppy ear - higher and angled */}
                        <ellipse cx="31" cy="14" rx="3" ry="9" fill="#38bdf8" stroke="#1e3a5f" strokeWidth="2" transform="rotate(-20, 31, 14)"/>
                        {/* Eyes */}
                        <circle cx="13" cy="14" r="2.5" fill="#1e3a5f"/>
                        <circle cx="23" cy="14" r="2.5" fill="#1e3a5f"/>
                        {/* Nose */}
                        <ellipse cx="18" cy="21" rx="3" ry="2" fill="#1e3a5f"/>
                        {/* Mouth */}
                        <path d="M 15 25 Q 18 28 21 25" fill="none" stroke="#1e3a5f" strokeWidth="1.5" strokeLinecap="round"/>
                        {/* Front paws */}
                        <ellipse cx="15" cy="46" rx="5" ry="4" fill="#38bdf8" stroke="#1e3a5f" strokeWidth="2"/>
                        <ellipse cx="30" cy="46" rx="5" ry="4" fill="#38bdf8" stroke="#1e3a5f" strokeWidth="2"/>
                        
                        {/* Orange Cat - Smaller with oval head */}
                        {/* Tail wrapping around body */}
                        <path d="M 50 38 Q 44 44 47 48 Q 50 50 55 46" fill="#fb923c" stroke="#1e3a5f" strokeWidth="2" strokeLinecap="round"/>
                        {/* Body - smaller */}
                        <ellipse cx="60" cy="34" rx="12" ry="10" fill="#fb923c" stroke="#1e3a5f" strokeWidth="2"/>
                        {/* Head - oval shape */}
                        <ellipse cx="64" cy="22" rx="8" ry="10" fill="#fb923c" stroke="#1e3a5f" strokeWidth="2"/>
                        {/* Ears - smaller to fit oval head */}
                        <polygon points="57,14 59,7 62,14" fill="#fb923c" stroke="#1e3a5f" strokeWidth="1.5"/>
                        <polygon points="67,14 69,8 71,14" fill="#fb923c" stroke="#1e3a5f" strokeWidth="1.5"/>
                        {/* Eyes */}
                        <circle cx="60" cy="20" r="2" fill="#1e3a5f"/>
                        <circle cx="68" cy="20" r="2" fill="#1e3a5f"/>
                        {/* Nose */}
                        <ellipse cx="64" cy="25" rx="1.5" ry="1" fill="#1e3a5f"/>
                        {/* Mouth */}
                        <path d="M 62 28 Q 64 30 66 28" fill="none" stroke="#1e3a5f" strokeWidth="1.5" strokeLinecap="round"/>
                        {/* Whiskers - left side */}
                        <line x1="56" y1="23" x2="50" y2="21" stroke="#1e3a5f" strokeWidth="1"/>
                        <line x1="56" y1="25" x2="50" y2="25" stroke="#1e3a5f" strokeWidth="1"/>
                        <line x1="56" y1="27" x2="50" y2="29" stroke="#1e3a5f" strokeWidth="1"/>
                        {/* Whiskers - right side */}
                        <line x1="72" y1="23" x2="78" y2="21" stroke="#1e3a5f" strokeWidth="1"/>
                        <line x1="72" y1="25" x2="78" y2="25" stroke="#1e3a5f" strokeWidth="1"/>
                        <line x1="72" y1="27" x2="78" y2="29" stroke="#1e3a5f" strokeWidth="1"/>
                        {/* Front paws */}
                        <ellipse cx="54" cy="42" rx="3.5" ry="2.5" fill="#fb923c" stroke="#1e3a5f" strokeWidth="2"/>
                        <ellipse cx="63" cy="42" rx="3.5" ry="2.5" fill="#fb923c" stroke="#1e3a5f" strokeWidth="2"/>
                      </svg>
                      <p className="text-sm font-medium text-gray-600">Dog Walking & Pet Sitting</p>
                    </div>
                    <div className="text-right">
                      <h1 className="text-2xl font-bold text-gray-800">INVOICE</h1>
                      <p className="text-sm text-gray-500">#{invoiceDetail.id?.slice(0, 8).toUpperCase()}</p>
                    </div>
                  </div>
                </div>

                {/* Teal/Blue Section - Company Info */}
                <div className="bg-sky-500 text-white p-6">
                  <h2 className="text-2xl font-bold mb-1">Bow Wow Meow</h2>
                  <p className="text-sky-100">Fort Lauderdale, Florida</p>
                  <p className="text-sky-100">(954) 594-2164 Text or Call</p>
                </div>

                {/* Invoice Content */}
                <div className="p-6 space-y-6">
                  {/* Amount and Status */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-gradient-to-br from-sky-50 to-sky-100 border border-sky-200">
                      <p className="text-sm text-sky-600 font-medium">Amount Due</p>
                      <p className="text-3xl font-bold text-sky-700">${invoiceDetail.amount?.toFixed(2)}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-gradient-to-br from-orange-50 to-orange-100 border border-orange-200">
                      <p className="text-sm text-orange-600 font-medium">Status</p>
                      <Badge className={`mt-1 rounded-full text-sm px-3 py-1 ${
                        invoiceDetail.status === 'paid' ? 'bg-sky-500 text-white' :
                        invoiceDetail.status === 'overdue' ? 'bg-red-500 text-white' :
                        'bg-orange-500 text-white'
                      }`}>
                        {invoiceDetail.status?.toUpperCase()}
                      </Badge>
                    </div>
                  </div>

                  {/* Bill To */}
                  {invoiceDetail.client && (
                    <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
                      <h4 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
                        <User className="w-4 h-4 text-sky-500" />
                        Bill To:
                      </h4>
                      <p className="font-medium text-gray-800">{invoiceDetail.client.full_name}</p>
                      {invoiceDetail.client.email && (
                        <p className="text-sm text-gray-600">{invoiceDetail.client.email}</p>
                      )}
                      {invoiceDetail.client.phone && (
                        <p className="text-sm text-gray-600">{invoiceDetail.client.phone}</p>
                      )}
                    </div>
                  )}

                  {/* Due Date */}
                  <div className="flex justify-between items-center p-3 rounded-lg bg-orange-50 border border-orange-200">
                    <span className="text-orange-700 font-medium">Due Date:</span>
                    <span className="font-bold text-orange-800">{invoiceDetail.due_date}</span>
                  </div>

                  {/* Services Table */}
                  {invoiceDetail.appointments && invoiceDetail.appointments.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-semibold text-gray-700 flex items-center gap-2">
                        <PawPrint className="w-4 h-4 text-orange-500" />
                        Services
                      </h4>
                      <div className="border border-gray-200 rounded-xl overflow-hidden">
                        <table className="w-full">
                          <thead className="bg-sky-500 text-white">
                            <tr>
                              <th className="text-left p-3 text-sm font-semibold">Service</th>
                              <th className="text-left p-3 text-sm font-semibold">Date</th>
                              <th className="text-right p-3 text-sm font-semibold">Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {invoiceDetail.appointments.map((appt, idx) => (
                              <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-sky-50'}>
                                <td className="p-3">
                                  <p className="font-medium text-gray-800">{appt.service_name}</p>
                                  <p className="text-xs text-gray-500">
                                    {appt.pet_names?.join(', ')} • Walker: {appt.walker_name}
                                  </p>
                                </td>
                                <td className="p-3 text-sm text-gray-600">
                                  {appt.scheduled_date} {appt.scheduled_time}
                                </td>
                                <td className="p-3 text-right font-medium text-gray-800">
                                  ${appt.service_price?.toFixed(2)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="bg-orange-500 text-white">
                            <tr>
                              <td colSpan="2" className="p-3 text-right font-bold">Total:</td>
                              <td className="p-3 text-right font-bold text-lg">${invoiceDetail.amount?.toFixed(2)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Thank You Footer */}
                  <div className="text-center p-4 rounded-xl bg-gradient-to-r from-sky-100 to-orange-100 border border-sky-200">
                    <p className="text-gray-700 font-medium">Thank you for trusting us with your furry friends! 🐾</p>
                    <p className="text-sm text-gray-500 mt-1">Bow Wow Meow - Where pets are family</p>
                  </div>

                  {/* Send Actions */}
                  {invoiceDetail.status !== 'paid' && (
                    <div className="flex gap-3 pt-4 border-t">
                      <Button
                        onClick={() => sendInvoiceEmail(invoiceDetail.id)}
                        disabled={sendingEmail || !notificationConfig.sendgrid_configured}
                        className="rounded-full flex-1 bg-sky-500 hover:bg-sky-600"
                        variant={notificationConfig.sendgrid_configured ? "default" : "outline"}
                        data-testid="send-invoice-email"
                      >
                        <Mail className="w-4 h-4 mr-2" />
                        {sendingEmail ? 'Sending...' : 'Send Email'}
                      </Button>
                      <Button
                        onClick={() => sendInvoiceSms(invoiceDetail.id)}
                        disabled={sendingSms || !notificationConfig.twilio_configured}
                        className="rounded-full flex-1 bg-orange-500 hover:bg-orange-600"
                        variant={notificationConfig.twilio_configured ? "default" : "outline"}
                        data-testid="send-invoice-sms"
                      >
                        <MessageSquare className="w-4 h-4 mr-2" />
                        {sendingSms ? 'Sending...' : 'Send SMS'}
                      </Button>
                    </div>
                  )}
                </div>
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
