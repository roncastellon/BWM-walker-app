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
  Zap, FileCheck, SendHorizonal, User, PawPrint, Plus, Trash2
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
    apple_pay: { enabled: true, phone: '', email: '' },
    apple_cash: { enabled: true, phone: '', email: '' },
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
  
  // Debug modal
  const [debugData, setDebugData] = useState(null);
  const [debugClientId, setDebugClientId] = useState(null);
  
  // Notification config
  const [notificationConfig, setNotificationConfig] = useState({
    sendgrid_configured: false,
    twilio_configured: false
  });
  
  // Auto-invoice state
  const [pendingReviewInvoices, setPendingReviewInvoices] = useState([]);
  const [generatingInvoices, setGeneratingInvoices] = useState(false);
  const [sendingAllInvoices, setSendingAllInvoices] = useState(false);
  
  // 1099 Report state
  const [payrollReport, setPayrollReport] = useState(null);
  const [reportYear, setReportYear] = useState(new Date().getFullYear());
  const [loadingReport, setLoadingReport] = useState(false);
  const [selectedStaffDetail, setSelectedStaffDetail] = useState(null);
  const [staffDetailLoading, setStaffDetailLoading] = useState(false);
  
  // Accounts Receivable Aging Report state
  const [agingReport, setAgingReport] = useState(null);
  const [loadingAgingReport, setLoadingAgingReport] = useState(false);
  const [expandedAgingBucket, setExpandedAgingBucket] = useState(null);
  
  // Paysheets state
  const [paysheets, setPaysheets] = useState([]);
  const [loadingPaysheets, setLoadingPaysheets] = useState(false);
  const [selectedPaysheet, setSelectedPaysheet] = useState(null);
  const [paysheetModalOpen, setPaysheetModalOpen] = useState(false);
  const [walkerPaymentInfo, setWalkerPaymentInfo] = useState(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);

  // New product/service state
  const [showNewServiceForm, setShowNewServiceForm] = useState(false);
  const [newService, setNewService] = useState({ name: '', price: '', description: '', duration: '' });

  // Custom billing plans state
  const [billingPlans, setBillingPlans] = useState([]);
  const [showNewPlanForm, setShowNewPlanForm] = useState(false);
  const [newPlan, setNewPlan] = useState({ name: '', description: '', discount_percent: 0, services: [] });
  const [assignPlanModalOpen, setAssignPlanModalOpen] = useState(false);
  const [selectedClientForPlan, setSelectedClientForPlan] = useState(null);

  useEffect(() => {
    fetchAllData();
    fetchBillingPlans();
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

  // Create new service/product
  const createNewService = async () => {
    if (!newService.name || !newService.price) {
      toast.error('Name and price are required');
      return;
    }
    try {
      // Generate service_type from name: "Doggy Day Camp" -> "doggy_day_camp"
      const serviceType = newService.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
      
      const response = await api.post('/services', {
        service_type: serviceType,
        name: newService.name,
        price: parseFloat(newService.price),
        description: newService.description || '',
        duration_minutes: newService.duration ? parseInt(newService.duration) : 30
      });
      
      console.log('Service created:', response.data);
      toast.success(`Service "${newService.name}" created successfully!`);
      setNewService({ name: '', price: '', description: '', duration: '' });
      setShowNewServiceForm(false);
      fetchAllData();
    } catch (error) {
      console.error('Service creation error:', error.response?.data || error.message);
      const errorMsg = error.response?.data?.detail || error.response?.data?.message || error.message || 'Failed to create service';
      toast.error(`Error: ${errorMsg}`);
    }
  };

  // Delete service
  const deleteService = async (serviceId) => {
    if (!window.confirm('Are you sure you want to delete this service?')) return;
    try {
      await api.delete(`/services/${serviceId}`);
      toast.success('Service deleted');
      fetchAllData();
    } catch (error) {
      toast.error('Failed to delete service');
    }
  };

  // Delete invoice and release appointments for rebilling
  const deleteInvoice = async (invoiceId) => {
    if (!window.confirm('Delete this invoice? The appointments will become available for billing again.')) return;
    try {
      const response = await api.delete(`/invoices/${invoiceId}`);
      toast.success(response.data.message || 'Invoice deleted');
      setSelectedInvoice(null);
      setInvoiceDetail(null);
      fetchAllData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete invoice');
    }
  };

  // Debug billing for a client
  const debugClientBilling = async (clientId) => {
    try {
      const response = await api.get(`/billing/debug/${clientId}`);
      setDebugData(response.data);
      setDebugClientId(clientId);
    } catch (error) {
      toast.error('Failed to fetch debug info');
    }
  };

  // Fetch billing plans
  const fetchBillingPlans = async () => {
    try {
      const res = await api.get('/billing-plans');
      setBillingPlans(res.data || []);
    } catch (error) {
      // Plans endpoint might not exist yet
    }
  };

  // Create billing plan
  const createBillingPlan = async () => {
    if (!newPlan.name) {
      toast.error('Plan name is required');
      return;
    }
    try {
      await api.post('/billing-plans', newPlan);
      toast.success('Billing plan created');
      setNewPlan({ name: '', description: '', discount_percent: 0, services: [] });
      setShowNewPlanForm(false);
      fetchBillingPlans();
    } catch (error) {
      toast.error('Failed to create billing plan');
    }
  };

  // Assign billing plan to client
  const assignPlanToClient = async (clientId, planId) => {
    try {
      await api.put(`/users/${clientId}/billing-plan?plan_id=${planId}`);
      toast.success('Billing plan assigned to client');
      setAssignPlanModalOpen(false);
      fetchAllData();
    } catch (error) {
      toast.error('Failed to assign billing plan');
    }
  };

  // Delete billing plan
  const deleteBillingPlan = async (planId) => {
    if (!window.confirm('Are you sure you want to delete this billing plan?')) return;
    try {
      await api.delete(`/billing-plans/${planId}`);
      toast.success('Billing plan deleted');
      fetchBillingPlans();
    } catch (error) {
      toast.error('Failed to delete billing plan');
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

  // 1099 Report functions
  const fetch1099Report = async (year) => {
    setLoadingReport(true);
    try {
      const response = await api.get(`/reports/payroll/1099?year=${year}`);
      setPayrollReport(response.data);
    } catch (error) {
      toast.error('Failed to load 1099 report');
      setPayrollReport(null);
    } finally {
      setLoadingReport(false);
    }
  };

  const fetchStaffDetail = async (staffId) => {
    setStaffDetailLoading(true);
    try {
      const response = await api.get(`/reports/payroll/1099/${staffId}?year=${reportYear}`);
      setSelectedStaffDetail(response.data);
    } catch (error) {
      toast.error('Failed to load staff details');
      setSelectedStaffDetail(null);
    } finally {
      setStaffDetailLoading(false);
    }
  };

  const closeStaffDetail = () => {
    setSelectedStaffDetail(null);
  };

  // Accounts Receivable Aging Report
  const fetchAgingReport = async () => {
    setLoadingAgingReport(true);
    try {
      const response = await api.get('/reports/receivable-aging');
      setAgingReport(response.data);
    } catch (error) {
      toast.error('Failed to load aging report');
      setAgingReport(null);
    } finally {
      setLoadingAgingReport(false);
    }
  };

  // Paysheets functions
  const fetchPaysheets = async () => {
    setLoadingPaysheets(true);
    try {
      const response = await api.get('/paysheets');
      setPaysheets(response.data);
    } catch (error) {
      toast.error('Failed to load paysheets');
    } finally {
      setLoadingPaysheets(false);
    }
  };

  const openPaysheetReview = (paysheet) => {
    setSelectedPaysheet(paysheet);
    setPaysheetModalOpen(true);
  };

  const closePaysheetReview = () => {
    setSelectedPaysheet(null);
    setPaysheetModalOpen(false);
  };

  const approvePaysheet = async (paysheetId) => {
    try {
      await api.put(`/paysheets/${paysheetId}/approve`);
      toast.success('Paysheet approved');
      fetchPaysheets();
      // Update the selected paysheet if it's open
      if (selectedPaysheet && selectedPaysheet.id === paysheetId) {
        setSelectedPaysheet({...selectedPaysheet, approved: true});
      }
    } catch (error) {
      toast.error('Failed to approve paysheet');
    }
  };

  const openPaymentModal = async (paysheet) => {
    try {
      // Fetch walker's payment info
      const response = await api.get(`/users/${paysheet.walker_id}`);
      setWalkerPaymentInfo(response.data);
      setSelectedPaysheet(paysheet);
      setPaysheetModalOpen(false);
      setPaymentModalOpen(true);
    } catch (error) {
      toast.error('Failed to load payment info');
    }
  };

  const markPaysheetPaid = async (paysheetId, paymentMethod) => {
    try {
      await api.put(`/paysheets/${paysheetId}/mark-paid`);
      toast.success(`Paysheet marked as paid via ${paymentMethod}`);
      fetchPaysheets();
      setPaymentModalOpen(false);
      setSelectedPaysheet(null);
      setWalkerPaymentInfo(null);
    } catch (error) {
      toast.error('Failed to mark paysheet as paid');
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
          <TabsList className="grid w-full grid-cols-6 h-auto p-1">
            <TabsTrigger value="revenue" className="flex flex-col py-3 gap-1 data-[state=active]:bg-sky-500 data-[state=active]:text-white" data-testid="tab-revenue">
              <TrendingUp className="w-5 h-5" />
              <span className="text-xs">Revenue</span>
            </TabsTrigger>
            <TabsTrigger value="invoices" className="flex flex-col py-3 gap-1 data-[state=active]:bg-orange-500 data-[state=active]:text-white" data-testid="tab-invoices">
              <FileText className="w-5 h-5" />
              <span className="text-xs">Invoices</span>
            </TabsTrigger>
            <TabsTrigger value="payroll" className="flex flex-col py-3 gap-1 data-[state=active]:bg-sky-500 data-[state=active]:text-white" data-testid="tab-payroll" onClick={fetchPaysheets}>
              <CreditCard className="w-5 h-5" />
              <span className="text-xs">Payroll</span>
            </TabsTrigger>
            <TabsTrigger value="reports" className="flex flex-col py-3 gap-1 data-[state=active]:bg-orange-500 data-[state=active]:text-white" data-testid="tab-reports">
              <Users className="w-5 h-5" />
              <span className="text-xs">Reports</span>
            </TabsTrigger>
            <TabsTrigger value="pricing" className="flex flex-col py-3 gap-1 data-[state=active]:bg-sky-500 data-[state=active]:text-white" data-testid="tab-pricing">
              <DollarSign className="w-5 h-5" />
              <span className="text-xs">Pricing</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex flex-col py-3 gap-1 data-[state=active]:bg-orange-500 data-[state=active]:text-white" data-testid="tab-settings">
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
            <Card className="rounded-xl border-orange-200 bg-orange-50">
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
                  <Button 
                    onClick={async () => {
                      if (!window.confirm('This will reset ALL invoiced appointments, making them available for billing again. Continue?')) return;
                      try {
                        // Reset for all clients
                        for (const client of clientsDue) {
                          await api.post(`/billing/reset-invoiced/${client.id}`);
                        }
                        toast.success('All billing status reset. You can now regenerate invoices.');
                        fetchAllData();
                      } catch (error) {
                        toast.error('Failed to reset billing status');
                      }
                    }} 
                    variant="ghost"
                    className="rounded-full text-orange-600 hover:text-orange-700 hover:bg-orange-100"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Reset Billing
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
                    <Button
                      size="sm"
                      onClick={() => {
                        // Approve all pending invoices
                        pendingReviewInvoices.filter(i => i.review_status === 'pending').forEach(inv => approveInvoice(inv.id));
                      }}
                      disabled={pendingReviewInvoices.filter(i => i.review_status === 'pending').length === 0}
                      className="rounded-full bg-green-500 hover:bg-green-600"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Approve All
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {pendingReviewInvoices.map((invoice) => (
                      <div key={invoice.id} className="flex items-center justify-between p-3 rounded-lg bg-white border border-orange-200">
                        <div className="flex-1">
                          <p className="font-medium text-sm">{invoice.client?.full_name || 'Client'}</p>
                          <p className="text-xs text-muted-foreground">
                            {invoice.billing_period_start} - {invoice.billing_period_end} • {invoice.appointment_ids?.length || 0} service(s)
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold">${invoice.amount?.toFixed(2)}</p>
                          <Button size="sm" variant="outline" onClick={() => openInvoiceDetail(invoice)} className="rounded-full">
                            <Eye className="w-3 h-3 mr-1" /> View
                          </Button>
                          {invoice.review_status === 'pending' ? (
                            <Button size="sm" onClick={() => approveInvoice(invoice.id)} className="rounded-full bg-sky-500 hover:bg-sky-600">
                              Approve
                            </Button>
                          ) : (
                            <>
                              <Button 
                                size="sm" 
                                onClick={() => sendInvoiceEmail(invoice.id)} 
                                disabled={sendingEmail || !notificationConfig.sendgrid_configured}
                                className="rounded-full bg-green-500 hover:bg-green-600"
                              >
                                <SendHorizonal className="w-3 h-3 mr-1" /> Send
                              </Button>
                            </>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => deleteInvoice(invoice.id)} className="rounded-full text-destructive hover:text-destructive hover:bg-destructive/10">
                            <Trash2 className="w-3 h-3" />
                          </Button>
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
                        <div className="flex gap-2">
                          <Button size="sm" variant="ghost" onClick={() => debugClientBilling(client.id)} className="rounded-full text-xs">
                            <AlertCircle className="w-3 h-3 mr-1" /> Debug
                          </Button>
                          <Button size="sm" onClick={() => generateInvoice(client.id)} className="rounded-full">
                            Create Invoice
                          </Button>
                        </div>
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
                          <Button 
                            size="sm" 
                            onClick={() => sendInvoiceEmail(invoice.id)} 
                            disabled={sendingEmail || !notificationConfig.sendgrid_configured}
                            className="rounded-full bg-green-500 hover:bg-green-600"
                          >
                            <SendHorizonal className="w-3 h-3 mr-1" /> Send
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => deleteInvoice(invoice.id)} className="rounded-full text-destructive hover:text-destructive hover:bg-destructive/10">
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* PAYROLL TAB - Paysheets */}
          <TabsContent value="payroll" className="space-y-4">
            <Card className="rounded-xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-sky-600" />
                  Submitted Paysheets
                </CardTitle>
                <CardDescription>Review and approve paysheets from walkers and sitters</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingPaysheets ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500"></div>
                  </div>
                ) : paysheets.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No paysheets submitted yet</p>
                    <p className="text-sm mt-1">Paysheets will appear here when staff submit them</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {paysheets.map((ts) => (
                      <div
                        key={ts.id}
                        className="p-4 rounded-xl border bg-card hover:shadow-md transition-all"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-semibold">{ts.walker_name || 'Staff'}</p>
                              <Badge className={`rounded-full text-xs ${
                                ts.paid ? 'bg-green-100 text-green-700' :
                                ts.approved ? 'bg-sky-100 text-sky-700' :
                                'bg-orange-100 text-orange-700'
                              }`}>
                                {ts.paid ? 'Paid' : ts.approved ? 'Approved' : 'Pending Review'}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              {ts.period_start} to {ts.period_end}
                            </p>
                            <div className="flex gap-4 mt-2 text-sm">
                              <span><strong>{ts.total_walks}</strong> walks</span>
                              <span><strong>{ts.total_hours?.toFixed(1) || '0.0'}</strong> hrs</span>
                              <span className="text-sky-600 font-bold">${ts.total_earnings?.toFixed(2) || '0.00'}</span>
                            </div>
                          </div>
                          <div className="flex gap-2 shrink-0">
                            {!ts.approved && !ts.paid && (
                              <Button 
                                size="sm" 
                                onClick={() => openPaysheetReview(ts)} 
                                className="rounded-full bg-orange-500 hover:bg-orange-600"
                              >
                                <Eye className="w-4 h-4 mr-1" />
                                Review
                              </Button>
                            )}
                            {ts.approved && !ts.paid && (
                              <Button 
                                size="sm" 
                                onClick={() => openPaymentModal(ts)} 
                                className="rounded-full bg-green-500 hover:bg-green-600"
                              >
                                <DollarSign className="w-4 h-4 mr-1" />
                                Pay
                              </Button>
                            )}
                            {ts.paid && (
                              <span className="text-green-600 font-medium text-sm flex items-center">
                                <CheckCircle className="w-4 h-4 mr-1" />
                                Paid
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* 1099 REPORTS TAB */}
          <TabsContent value="reports" className="space-y-4">
            {/* Report Controls */}
            <Card className="rounded-xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  1099 Payroll Reports
                </CardTitle>
                <CardDescription>Generate tax reports for walkers and sitters</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Label>Year:</Label>
                    <Select value={reportYear.toString()} onValueChange={(v) => setReportYear(parseInt(v))}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[2024, 2025, 2026].map(y => (
                          <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={() => fetch1099Report(reportYear)} disabled={loadingReport} className="rounded-full">
                    {loadingReport ? (
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <FileText className="w-4 h-4 mr-2" />
                    )}
                    Generate Report
                  </Button>
                </div>

                {payrollReport && (
                  <div className="space-y-4 pt-4 border-t">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <Card className="rounded-xl bg-sky-50">
                        <CardContent className="p-4 text-center">
                          <p className="text-2xl font-bold text-sky-600">{payrollReport.summary.total_staff}</p>
                          <p className="text-xs text-muted-foreground">Total Staff</p>
                        </CardContent>
                      </Card>
                      <Card className="rounded-xl bg-green-50">
                        <CardContent className="p-4 text-center">
                          <p className="text-2xl font-bold text-green-600">${payrollReport.summary.total_year_to_date.toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">Year to Date</p>
                        </CardContent>
                      </Card>
                      <Card className="rounded-xl bg-orange-50">
                        <CardContent className="p-4 text-center">
                          <p className="text-2xl font-bold text-orange-600">${payrollReport.summary.total_month_to_date.toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">Month to Date</p>
                        </CardContent>
                      </Card>
                      <Card className="rounded-xl bg-purple-50">
                        <CardContent className="p-4 text-center">
                          <p className="text-2xl font-bold text-purple-600">{payrollReport.summary.staff_requiring_1099}</p>
                          <p className="text-xs text-muted-foreground">Require 1099 (≥$600)</p>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Staff Table */}
                    <Card className="rounded-xl">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg">Individual Staff Earnings - {reportYear}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b bg-muted/50">
                                <th className="text-left p-3 font-medium">Name</th>
                                <th className="text-left p-3 font-medium">Role</th>
                                <th className="text-right p-3 font-medium">Month to Date</th>
                                <th className="text-right p-3 font-medium">Year to Date</th>
                                <th className="text-center p-3 font-medium">1099 Required</th>
                                <th className="text-center p-3 font-medium">Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {payrollReport.staff.map((member) => (
                                <tr key={member.id} className="border-b hover:bg-muted/30">
                                  <td className="p-3">
                                    <div>
                                      <p className="font-medium">{member.full_name}</p>
                                      <p className="text-xs text-muted-foreground">{member.email}</p>
                                    </div>
                                  </td>
                                  <td className="p-3">
                                    <Badge variant="outline" className="capitalize rounded-full">
                                      {member.role}
                                    </Badge>
                                  </td>
                                  <td className="p-3 text-right font-medium">${member.month_total.toLocaleString()}</td>
                                  <td className="p-3 text-right font-bold text-sky-600">${member.year_total.toLocaleString()}</td>
                                  <td className="p-3 text-center">
                                    {member.year_total >= 600 ? (
                                      <Badge className="bg-red-100 text-red-700 rounded-full">Yes</Badge>
                                    ) : (
                                      <Badge className="bg-gray-100 text-gray-600 rounded-full">No</Badge>
                                    )}
                                  </td>
                                  <td className="p-3 text-center">
                                    <Button size="sm" variant="outline" onClick={() => fetchStaffDetail(member.id)} className="rounded-full">
                                      <Eye className="w-4 h-4 mr-1" />
                                      Details
                                    </Button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Accounts Receivable Aging Report */}
            <Card className="rounded-xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-orange-500" />
                  Accounts Receivable Aging
                </CardTitle>
                <CardDescription>Track unpaid invoices by age buckets</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button onClick={fetchAgingReport} disabled={loadingAgingReport} className="rounded-full">
                  {loadingAgingReport ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <FileText className="w-4 h-4 mr-2" />
                  )}
                  Generate Aging Report
                </Button>

                {agingReport && (
                  <div className="space-y-4 pt-4 border-t">
                    {/* Summary Cards - Clickable to expand details */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                      <Card 
                        className={`rounded-xl bg-green-50 cursor-pointer transition-all hover:shadow-md hover:ring-2 hover:ring-green-300 ${expandedAgingBucket === 'current' ? 'ring-2 ring-green-500' : ''}`}
                        onClick={() => setExpandedAgingBucket(expandedAgingBucket === 'current' ? null : 'current')}
                      >
                        <CardContent className="p-4 text-center">
                          <p className="text-2xl font-bold text-green-600">${agingReport.buckets.current.total.toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">Current (0-30)</p>
                          <Badge className="mt-1 bg-green-100 text-green-700 rounded-full">{agingReport.buckets.current.count} invoices</Badge>
                          <p className="text-xs text-green-600 mt-2">Click to {expandedAgingBucket === 'current' ? 'collapse' : 'view details'}</p>
                        </CardContent>
                      </Card>
                      <Card 
                        className={`rounded-xl bg-yellow-50 cursor-pointer transition-all hover:shadow-md hover:ring-2 hover:ring-yellow-300 ${expandedAgingBucket === 'thirty' ? 'ring-2 ring-yellow-500' : ''}`}
                        onClick={() => setExpandedAgingBucket(expandedAgingBucket === 'thirty' ? null : 'thirty')}
                      >
                        <CardContent className="p-4 text-center">
                          <p className="text-2xl font-bold text-yellow-600">${agingReport.buckets.thirty.total.toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">30 Days (31-60)</p>
                          <Badge className="mt-1 bg-yellow-100 text-yellow-700 rounded-full">{agingReport.buckets.thirty.count} invoices</Badge>
                          <p className="text-xs text-yellow-600 mt-2">Click to {expandedAgingBucket === 'thirty' ? 'collapse' : 'view details'}</p>
                        </CardContent>
                      </Card>
                      <Card 
                        className={`rounded-xl bg-orange-50 cursor-pointer transition-all hover:shadow-md hover:ring-2 hover:ring-orange-300 ${expandedAgingBucket === 'sixty' ? 'ring-2 ring-orange-500' : ''}`}
                        onClick={() => setExpandedAgingBucket(expandedAgingBucket === 'sixty' ? null : 'sixty')}
                      >
                        <CardContent className="p-4 text-center">
                          <p className="text-2xl font-bold text-orange-600">${agingReport.buckets.sixty.total.toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">60 Days (61-90)</p>
                          <Badge className="mt-1 bg-orange-100 text-orange-700 rounded-full">{agingReport.buckets.sixty.count} invoices</Badge>
                          <p className="text-xs text-orange-600 mt-2">Click to {expandedAgingBucket === 'sixty' ? 'collapse' : 'view details'}</p>
                        </CardContent>
                      </Card>
                      <Card 
                        className={`rounded-xl bg-red-50 cursor-pointer transition-all hover:shadow-md hover:ring-2 hover:ring-red-300 ${expandedAgingBucket === 'ninety_plus' ? 'ring-2 ring-red-500' : ''}`}
                        onClick={() => setExpandedAgingBucket(expandedAgingBucket === 'ninety_plus' ? null : 'ninety_plus')}
                      >
                        <CardContent className="p-4 text-center">
                          <p className="text-2xl font-bold text-red-600">${agingReport.buckets.ninety_plus.total.toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">90+ Days</p>
                          <Badge className="mt-1 bg-red-100 text-red-700 rounded-full">{agingReport.buckets.ninety_plus.count} invoices</Badge>
                          <p className="text-xs text-red-600 mt-2">Click to {expandedAgingBucket === 'ninety_plus' ? 'collapse' : 'view details'}</p>
                        </CardContent>
                      </Card>
                      <Card className="rounded-xl bg-sky-50">
                        <CardContent className="p-4 text-center">
                          <p className="text-2xl font-bold text-sky-600">${agingReport.grand_total.toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">Total Outstanding</p>
                          <Badge className="mt-1 bg-sky-100 text-sky-700 rounded-full">{agingReport.total_invoices} invoices</Badge>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Detailed Invoice Table - Shows when a bucket is clicked */}
                    {expandedAgingBucket && agingReport.buckets[expandedAgingBucket] && agingReport.buckets[expandedAgingBucket].count > 0 && (
                      (() => {
                        const bucket = agingReport.buckets[expandedAgingBucket];
                        const colorSchemes = {
                          current: { header: 'bg-green-100 text-green-800', badge: 'bg-green-500', border: 'border-green-300' },
                          thirty: { header: 'bg-yellow-100 text-yellow-800', badge: 'bg-yellow-500', border: 'border-yellow-300' },
                          sixty: { header: 'bg-orange-100 text-orange-800', badge: 'bg-orange-500', border: 'border-orange-300' },
                          ninety_plus: { header: 'bg-red-100 text-red-800', badge: 'bg-red-500', border: 'border-red-300' }
                        };
                        const scheme = colorSchemes[expandedAgingBucket];
                        
                        return (
                          <Card className={`rounded-xl border-2 ${scheme.border} animate-in slide-in-from-top-2 duration-300`}>
                            <CardHeader className={`pb-3 ${scheme.header} rounded-t-xl`}>
                              <CardTitle className="text-lg flex items-center justify-between">
                                <span>{bucket.label}</span>
                                <div className="flex items-center gap-2">
                                  <Badge className={`${scheme.badge} text-white rounded-full`}>
                                    ${bucket.total.toLocaleString()}
                                  </Badge>
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    onClick={(e) => { e.stopPropagation(); setExpandedAgingBucket(null); }}
                                    className="h-6 w-6 p-0"
                                  >
                                    ✕
                                  </Button>
                                </div>
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-4">
                              <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="border-b bg-muted/50">
                                      <th className="text-left p-3 font-medium">Client</th>
                                      <th className="text-right p-3 font-medium">Amount</th>
                                      <th className="text-center p-3 font-medium">Due Date</th>
                                      <th className="text-center p-3 font-medium">Days Overdue</th>
                                      <th className="text-center p-3 font-medium">Status</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {bucket.invoices.map((invoice) => (
                                      <tr key={invoice.id} className="border-b hover:bg-muted/30">
                                        <td className="p-3 font-medium">{invoice.client_name}</td>
                                        <td className="p-3 text-right font-bold">${invoice.amount.toLocaleString()}</td>
                                        <td className="p-3 text-center">{invoice.due_date?.split('T')[0]}</td>
                                        <td className="p-3 text-center">
                                          {invoice.days_overdue > 0 ? (
                                            <Badge variant="destructive" className="rounded-full">{invoice.days_overdue} days</Badge>
                                          ) : (
                                            <Badge variant="outline" className="rounded-full text-green-600">Not due</Badge>
                                          )}
                                        </td>
                                        <td className="p-3 text-center">
                                          <Badge variant={invoice.status === 'overdue' ? 'destructive' : 'secondary'} className="rounded-full capitalize">
                                            {invoice.status}
                                          </Badge>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })()
                    )}

                    {/* Empty state when clicked bucket has no invoices */}
                    {expandedAgingBucket && agingReport.buckets[expandedAgingBucket] && agingReport.buckets[expandedAgingBucket].count === 0 && (
                      <Card className="rounded-xl border-2 border-dashed">
                        <CardContent className="p-8 text-center text-muted-foreground">
                          <p>No invoices in this aging bucket</p>
                          <Button variant="ghost" size="sm" onClick={() => setExpandedAgingBucket(null)} className="mt-2">
                            Close
                          </Button>
                        </CardContent>
                      </Card>
                    )}
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
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <DollarSign className="w-5 h-5 text-sky-600" />
                      Services & Pricing
                    </CardTitle>
                    <CardDescription>Configure pricing for all services</CardDescription>
                  </div>
                  <Button size="sm" onClick={() => setShowNewServiceForm(!showNewServiceForm)} className="rounded-full bg-orange-500 hover:bg-orange-600">
                    <Plus className="w-4 h-4 mr-1" />
                    Add Service
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {/* New Service Form */}
                {showNewServiceForm && (
                  <div className="p-4 mb-4 rounded-xl bg-orange-50 border border-orange-200">
                    <h4 className="font-semibold mb-3">Create New Service</h4>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <Input 
                        value={newService.name} 
                        onChange={(e) => setNewService({...newService, name: e.target.value})} 
                        placeholder="Service name (e.g., Weekend Walk)" 
                      />
                      <Input 
                        type="number" 
                        value={newService.price} 
                        onChange={(e) => setNewService({...newService, price: e.target.value})} 
                        placeholder="Price ($)" 
                      />
                      <Input 
                        value={newService.description} 
                        onChange={(e) => setNewService({...newService, description: e.target.value})} 
                        placeholder="Description" 
                      />
                      <Input 
                        type="number" 
                        value={newService.duration} 
                        onChange={(e) => setNewService({...newService, duration: e.target.value})} 
                        placeholder="Duration (minutes)" 
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={createNewService} className="rounded-full bg-orange-500 hover:bg-orange-600">
                        <Save className="w-4 h-4 mr-1" />
                        Create Service
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setShowNewServiceForm(false)} className="rounded-full">
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                {/* Existing Services */}
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
                          <div className="w-10 h-10 rounded-lg bg-sky-100 flex items-center justify-center">
                            <DollarSign className="w-5 h-5 text-sky-600" />
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-sm">{service.name}</p>
                            <p className="text-xs text-muted-foreground">{service.description}</p>
                          </div>
                          <p className="text-lg font-bold text-sky-600">${service.price.toFixed(2)}</p>
                        </div>
                      )}
                      <div className="flex gap-2 ml-3">
                        {editingService === service.id ? (
                          <>
                            <Button size="sm" onClick={() => updateServicePricing(service.id)} className="rounded-full"><Save className="w-3 h-3 mr-1" /> Save</Button>
                            <Button size="sm" variant="outline" onClick={() => setEditingService(null)} className="rounded-full">Cancel</Button>
                          </>
                        ) : (
                          <>
                            <Button size="sm" variant="outline" onClick={() => startEditing(service)} className="rounded-full" data-testid={`edit-service-${service.id}`}><Edit2 className="w-3 h-3" /></Button>
                            <Button size="sm" variant="outline" onClick={() => deleteService(service.id)} className="rounded-full text-red-500 hover:text-red-600"><Trash2 className="w-3 h-3" /></Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Custom Billing Plans */}
            <Card className="rounded-xl">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <FileText className="w-5 h-5 text-orange-500" />
                      Custom Billing Plans
                    </CardTitle>
                    <CardDescription>Create pricing packages for clients</CardDescription>
                  </div>
                  <Button size="sm" onClick={() => setShowNewPlanForm(!showNewPlanForm)} className="rounded-full bg-sky-500 hover:bg-sky-600">
                    <Plus className="w-4 h-4 mr-1" />
                    New Plan
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {/* New Plan Form */}
                {showNewPlanForm && (
                  <div className="p-4 mb-4 rounded-xl bg-sky-50 border border-sky-200">
                    <h4 className="font-semibold mb-3">Create Billing Plan</h4>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <Input 
                        value={newPlan.name} 
                        onChange={(e) => setNewPlan({...newPlan, name: e.target.value})} 
                        placeholder="Plan name (e.g., Premium Package)" 
                      />
                      <Input 
                        type="number" 
                        value={newPlan.discount_percent} 
                        onChange={(e) => setNewPlan({...newPlan, discount_percent: parseFloat(e.target.value) || 0})} 
                        placeholder="Discount %" 
                      />
                      <Input 
                        className="col-span-2"
                        value={newPlan.description} 
                        onChange={(e) => setNewPlan({...newPlan, description: e.target.value})} 
                        placeholder="Description (e.g., 10% off all walks)" 
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={createBillingPlan} className="rounded-full bg-sky-500 hover:bg-sky-600">
                        <Save className="w-4 h-4 mr-1" />
                        Create Plan
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setShowNewPlanForm(false)} className="rounded-full">
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                {/* Existing Plans */}
                {billingPlans.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    <FileText className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No billing plans yet</p>
                    <p className="text-xs">Create a plan to offer discounts to clients</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {billingPlans.map((plan) => (
                      <div key={plan.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div className="flex items-center gap-3 flex-1">
                          <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                            <FileText className="w-5 h-5 text-orange-600" />
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-sm">{plan.name}</p>
                            <p className="text-xs text-muted-foreground">{plan.description}</p>
                          </div>
                          {plan.discount_percent > 0 && (
                            <Badge className="bg-green-100 text-green-700 rounded-full">{plan.discount_percent}% off</Badge>
                          )}
                        </div>
                        <div className="flex gap-2 ml-3">
                          <Button size="sm" variant="outline" onClick={() => deleteBillingPlan(plan.id)} className="rounded-full text-red-500 hover:text-red-600"><Trash2 className="w-3 h-3" /></Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Client Billing Plans & Cycles */}
            <Card className="rounded-xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="w-5 h-5 text-sky-600" />
                  Client Billing Settings
                </CardTitle>
                <CardDescription>Assign billing plans and cycles to clients</CardDescription>
              </CardHeader>
              <CardContent>
                {clients.length === 0 ? (
                  <p className="text-center py-6 text-muted-foreground text-sm">No clients yet</p>
                ) : (
                  <div className="space-y-2">
                    {clients.slice(0, 10).map((client) => (
                      <div key={client.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30" data-testid={`client-billing-${client.id}`}>
                        <div className="flex-1">
                          <p className="font-medium text-sm">{client.full_name}</p>
                          <p className="text-xs text-muted-foreground">{client.email}</p>
                          {client.billing_plan_name && (
                            <Badge className="mt-1 bg-orange-100 text-orange-700 rounded-full text-xs">{client.billing_plan_name}</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Select value={client.billing_plan_id || 'none'} onValueChange={(value) => assignPlanToClient(client.id, value === 'none' ? null : value)}>
                            <SelectTrigger className="w-32"><SelectValue placeholder="No plan" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">No plan</SelectItem>
                              {billingPlans.map(plan => (
                                <SelectItem key={plan.id} value={plan.id}>{plan.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Select value={client.billing_cycle || 'weekly'} onValueChange={(value) => updateBillingCycle(client.id, value)}>
                            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="daily">Daily</SelectItem>
                              <SelectItem value="weekly">Weekly</SelectItem>
                              <SelectItem value="monthly">Monthly</SelectItem>
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
                  <div className="p-3 rounded-lg border space-y-2">
                    <p className="font-medium text-sm flex items-center gap-1">🍎 Apple Pay</p>
                    <Input placeholder="Phone or Email" value={paymentSettings.apple_pay?.email || ''} onChange={(e) => setPaymentSettings({...paymentSettings, apple_pay: {...paymentSettings.apple_pay, email: e.target.value}})} />
                  </div>
                  <div className="p-3 rounded-lg border space-y-2">
                    <p className="font-medium text-sm flex items-center gap-1">🍎 Apple Cash</p>
                    <Input placeholder="Phone or Email" value={paymentSettings.apple_cash?.email || ''} onChange={(e) => setPaymentSettings({...paymentSettings, apple_cash: {...paymentSettings.apple_cash, email: e.target.value}})} />
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
                        {/* Dog Tail - triangular with black outline and blue fill */}
                        <path d="M 38 28 L 44 16 L 46 30 Z" fill="#38bdf8" stroke="#1e3a5f" strokeWidth="2" strokeLinejoin="round"/>
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
                        {/* Tail - longer, wrapping around in front of paws */}
                        <path d="M 72 32 Q 80 36 78 42 Q 76 48 68 50 Q 58 52 50 48 Q 46 46 48 44" fill="#fb923c" stroke="#1e3a5f" strokeWidth="2" strokeLinecap="round"/>
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

                  {/* Approve Action for pending review invoices */}
                  {invoiceDetail.review_status === 'pending' && (
                    <div className="flex gap-3 pt-4 border-t">
                      <Button
                        onClick={() => {
                          approveInvoice(invoiceDetail.id);
                          // Update the local state too
                          setInvoiceDetail({...invoiceDetail, review_status: 'approved'});
                        }}
                        className="rounded-full flex-1 bg-green-500 hover:bg-green-600"
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Approve Invoice
                      </Button>
                      <Button
                        onClick={() => deleteInvoice(invoiceDetail.id)}
                        variant="destructive"
                        className="rounded-full"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </Button>
                    </div>
                  )}

                  {/* Send Actions - only for approved/open invoices */}
                  {invoiceDetail.status !== 'paid' && invoiceDetail.review_status !== 'pending' && (
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
                      <Button
                        onClick={() => deleteInvoice(invoiceDetail.id)}
                        variant="destructive"
                        className="rounded-full"
                        data-testid="delete-invoice"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
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

        {/* Staff 1099 Detail Modal */}
        <Dialog open={!!selectedStaffDetail} onOpenChange={closeStaffDetail}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            {staffDetailLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500"></div>
              </div>
            ) : selectedStaffDetail ? (
              <div className="space-y-6">
                <DialogHeader>
                  <DialogTitle className="text-xl">1099 Detail - {selectedStaffDetail.staff.full_name}</DialogTitle>
                  <DialogDescription>
                    Tax year {selectedStaffDetail.year} earnings breakdown
                  </DialogDescription>
                </DialogHeader>

                {/* Staff Info */}
                <div className="p-4 rounded-xl bg-muted/50">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Name</p>
                      <p className="font-medium">{selectedStaffDetail.staff.full_name}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Role</p>
                      <p className="font-medium capitalize">{selectedStaffDetail.staff.role}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Email</p>
                      <p className="font-medium">{selectedStaffDetail.staff.email || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Phone</p>
                      <p className="font-medium">{selectedStaffDetail.staff.phone || 'N/A'}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-muted-foreground">Address</p>
                      <p className="font-medium">{selectedStaffDetail.staff.address || 'N/A'}</p>
                    </div>
                  </div>
                </div>

                {/* Totals */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Card className="rounded-xl bg-sky-50">
                    <CardContent className="p-4 text-center">
                      <p className="text-2xl font-bold text-sky-600">${selectedStaffDetail.totals.year_earnings.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">Year Total</p>
                    </CardContent>
                  </Card>
                  <Card className="rounded-xl bg-green-50">
                    <CardContent className="p-4 text-center">
                      <p className="text-2xl font-bold text-green-600">{selectedStaffDetail.totals.total_walks}</p>
                      <p className="text-xs text-muted-foreground">Total Walks</p>
                    </CardContent>
                  </Card>
                  <Card className="rounded-xl bg-orange-50">
                    <CardContent className="p-4 text-center">
                      <p className="text-2xl font-bold text-orange-600">{selectedStaffDetail.totals.total_hours.toFixed(1)}</p>
                      <p className="text-xs text-muted-foreground">Total Hours</p>
                    </CardContent>
                  </Card>
                  <Card className="rounded-xl">
                    <CardContent className="p-4 text-center">
                      {selectedStaffDetail.totals.requires_1099 ? (
                        <Badge className="bg-red-100 text-red-700 rounded-full text-lg px-4 py-1">1099 Required</Badge>
                      ) : (
                        <Badge className="bg-gray-100 text-gray-600 rounded-full text-lg px-4 py-1">No 1099</Badge>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">≥$600 threshold</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Monthly Breakdown */}
                {selectedStaffDetail.monthly_breakdown.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-3">Monthly Breakdown</h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/50">
                            <th className="text-left p-2 font-medium">Month</th>
                            <th className="text-right p-2 font-medium">Earnings</th>
                            <th className="text-right p-2 font-medium">Walks</th>
                            <th className="text-right p-2 font-medium">Hours</th>
                            <th className="text-right p-2 font-medium">Paysheets</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedStaffDetail.monthly_breakdown.map((month) => (
                            <tr key={month.month} className="border-b">
                              <td className="p-2 font-medium">{month.month}</td>
                              <td className="p-2 text-right text-sky-600 font-medium">${month.earnings.toLocaleString()}</td>
                              <td className="p-2 text-right">{month.walks}</td>
                              <td className="p-2 text-right">{month.hours.toFixed(1)}</td>
                              <td className="p-2 text-right">{month.paysheets}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-center py-8 text-muted-foreground">No details available</p>
            )}
          </DialogContent>
        </Dialog>

        {/* Paysheet Review Modal */}
        <Dialog open={paysheetModalOpen} onOpenChange={setPaysheetModalOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            {selectedPaysheet ? (
              <div className="space-y-6">
                <DialogHeader>
                  <DialogTitle className="text-xl flex items-center gap-2">
                    <FileText className="w-5 h-5 text-sky-600" />
                    Review Paysheet
                  </DialogTitle>
                  <DialogDescription>
                    Review paysheet details before approving and paying
                  </DialogDescription>
                </DialogHeader>

                {/* Status Banner */}
                <div className={`p-4 rounded-xl ${
                  selectedPaysheet.paid ? 'bg-green-50 border border-green-200' :
                  selectedPaysheet.approved ? 'bg-sky-50 border border-sky-200' :
                  'bg-orange-50 border border-orange-200'
                }`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-lg">{selectedPaysheet.walker_name || 'Staff Member'}</p>
                      <p className="text-sm text-muted-foreground">
                        Period: {selectedPaysheet.period_start} to {selectedPaysheet.period_end}
                      </p>
                    </div>
                    <Badge className={`rounded-full text-sm px-3 py-1 ${
                      selectedPaysheet.paid ? 'bg-green-500 text-white' :
                      selectedPaysheet.approved ? 'bg-sky-500 text-white' :
                      'bg-orange-500 text-white'
                    }`}>
                      {selectedPaysheet.paid ? 'Paid' : selectedPaysheet.approved ? 'Approved' : 'Pending Review'}
                    </Badge>
                  </div>
                </div>

                {/* Summary Stats */}
                <div className="grid grid-cols-3 gap-4">
                  <Card className="rounded-xl bg-sky-50">
                    <CardContent className="p-4 text-center">
                      <p className="text-3xl font-bold text-sky-600">{selectedPaysheet.total_walks}</p>
                      <p className="text-sm text-muted-foreground">Total Walks</p>
                    </CardContent>
                  </Card>
                  <Card className="rounded-xl bg-orange-50">
                    <CardContent className="p-4 text-center">
                      <p className="text-3xl font-bold text-orange-600">{selectedPaysheet.total_hours?.toFixed(1) || '0.0'}</p>
                      <p className="text-sm text-muted-foreground">Total Hours</p>
                    </CardContent>
                  </Card>
                  <Card className="rounded-xl bg-green-50">
                    <CardContent className="p-4 text-center">
                      <p className="text-3xl font-bold text-green-600">${selectedPaysheet.total_earnings?.toFixed(2) || '0.00'}</p>
                      <p className="text-sm text-muted-foreground">Total Earnings</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Walk Details */}
                {selectedPaysheet.walk_details && selectedPaysheet.walk_details.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      Walk Details
                    </h4>
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="text-left p-3 font-medium">Date</th>
                            <th className="text-left p-3 font-medium">Service</th>
                            <th className="text-right p-3 font-medium">Duration</th>
                            <th className="text-right p-3 font-medium">Pay</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedPaysheet.walk_details.map((walk, idx) => (
                            <tr key={idx} className="border-t">
                              <td className="p-3">{walk.date}</td>
                              <td className="p-3 capitalize">{walk.service_type?.replace('_', ' ')}</td>
                              <td className="p-3 text-right">{walk.duration || '-'} min</td>
                              <td className="p-3 text-right font-medium">${walk.pay?.toFixed(2) || '0.00'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Payment Method Info */}
                <div className="p-4 rounded-xl bg-muted/50">
                  <h4 className="font-semibold mb-2">Payment Method</h4>
                  <p className="text-sm text-muted-foreground">
                    Pay via Zelle, Venmo, or CashApp (check staff profile for details)
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4 border-t">
                  {!selectedPaysheet.approved && !selectedPaysheet.paid && (
                    <>
                      <Button variant="outline" onClick={closePaysheetReview} className="flex-1 rounded-full">
                        Cancel
                      </Button>
                      <Button onClick={() => approvePaysheet(selectedPaysheet.id)} className="flex-1 rounded-full bg-sky-500 hover:bg-sky-600">
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Approve Paysheet
                      </Button>
                    </>
                  )}
                  {selectedPaysheet.approved && !selectedPaysheet.paid && (
                    <>
                      <Button variant="outline" onClick={closePaysheetReview} className="flex-1 rounded-full">
                        Close
                      </Button>
                      <Button onClick={() => openPaymentModal(selectedPaysheet)} className="flex-1 rounded-full bg-green-500 hover:bg-green-600">
                        <DollarSign className="w-4 h-4 mr-2" />
                        Pay
                      </Button>
                    </>
                  )}
                  {selectedPaysheet.paid && (
                    <Button variant="outline" onClick={closePaysheetReview} className="w-full rounded-full">
                      Close
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-center py-8 text-muted-foreground">No paysheet selected</p>
            )}
          </DialogContent>
        </Dialog>

        {/* Payment Modal */}
        <Dialog open={paymentModalOpen} onOpenChange={setPaymentModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-xl flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-green-600" />
                Pay {walkerPaymentInfo?.full_name || 'Staff'}
              </DialogTitle>
              <DialogDescription>
                Amount: <span className="font-bold text-lg text-green-600">${selectedPaysheet?.total_earnings?.toFixed(2) || '0.00'}</span>
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-4">
              <p className="text-sm text-muted-foreground mb-4">Select payment method and confirm once paid:</p>
              
              {/* Zelle Option */}
              <div 
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${walkerPaymentInfo?.zelle_email ? 'hover:border-purple-400 hover:bg-purple-50' : 'opacity-50 cursor-not-allowed'}`}
                onClick={() => walkerPaymentInfo?.zelle_email && markPaysheetPaid(selectedPaysheet.id, 'Zelle')}
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
                    <span className="text-purple-600 font-bold text-lg">Z</span>
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold">Zelle</p>
                    {walkerPaymentInfo?.zelle_email ? (
                      <p className="text-sm text-purple-600">{walkerPaymentInfo.zelle_email}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground">Not configured</p>
                    )}
                  </div>
                  {walkerPaymentInfo?.zelle_email && (
                    <Button size="sm" className="rounded-full bg-purple-500 hover:bg-purple-600">
                      Pay & Mark Paid
                    </Button>
                  )}
                </div>
              </div>

              {/* Venmo Option */}
              <div 
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${walkerPaymentInfo?.venmo_username ? 'hover:border-sky-400 hover:bg-sky-50' : 'opacity-50 cursor-not-allowed'}`}
                onClick={() => walkerPaymentInfo?.venmo_username && markPaysheetPaid(selectedPaysheet.id, 'Venmo')}
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-sky-100 flex items-center justify-center">
                    <span className="text-sky-600 font-bold text-lg">V</span>
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold">Venmo</p>
                    {walkerPaymentInfo?.venmo_username ? (
                      <p className="text-sm text-sky-600">@{walkerPaymentInfo.venmo_username}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground">Not configured</p>
                    )}
                  </div>
                  {walkerPaymentInfo?.venmo_username && (
                    <Button size="sm" className="rounded-full bg-sky-500 hover:bg-sky-600">
                      Pay & Mark Paid
                    </Button>
                  )}
                </div>
              </div>

              {/* CashApp Option */}
              <div 
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${walkerPaymentInfo?.cashapp_tag ? 'hover:border-green-400 hover:bg-green-50' : 'opacity-50 cursor-not-allowed'}`}
                onClick={() => walkerPaymentInfo?.cashapp_tag && markPaysheetPaid(selectedPaysheet.id, 'CashApp')}
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                    <span className="text-green-600 font-bold text-lg">$</span>
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold">Cash App</p>
                    {walkerPaymentInfo?.cashapp_tag ? (
                      <p className="text-sm text-green-600">${walkerPaymentInfo.cashapp_tag}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground">Not configured</p>
                    )}
                  </div>
                  {walkerPaymentInfo?.cashapp_tag && (
                    <Button size="sm" className="rounded-full bg-green-500 hover:bg-green-600">
                      Pay & Mark Paid
                    </Button>
                  )}
                </div>
              </div>

              {/* Apple Pay Option */}
              <div 
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${walkerPaymentInfo?.apple_pay_id || walkerPaymentInfo?.payment_methods?.apple_pay ? 'hover:border-gray-600 hover:bg-gray-50' : 'opacity-50 cursor-not-allowed'}`}
                onClick={() => (walkerPaymentInfo?.apple_pay_id || walkerPaymentInfo?.payment_methods?.apple_pay) && markPaysheetPaid(selectedPaysheet.id, 'Apple Pay')}
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gray-900 flex items-center justify-center">
                    <span className="text-white text-lg">🍎</span>
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold">Apple Pay</p>
                    {walkerPaymentInfo?.apple_pay_id || walkerPaymentInfo?.payment_methods?.apple_pay ? (
                      <p className="text-sm text-gray-600">{walkerPaymentInfo?.apple_pay_id || walkerPaymentInfo?.payment_methods?.apple_pay}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground">Not configured</p>
                    )}
                  </div>
                  {(walkerPaymentInfo?.apple_pay_id || walkerPaymentInfo?.payment_methods?.apple_pay) && (
                    <Button size="sm" className="rounded-full bg-gray-900 hover:bg-gray-800">
                      Pay & Mark Paid
                    </Button>
                  )}
                </div>
              </div>

              {/* Apple Cash Option */}
              <div 
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${walkerPaymentInfo?.apple_cash_id || walkerPaymentInfo?.payment_methods?.apple_cash ? 'hover:border-green-500 hover:bg-green-50' : 'opacity-50 cursor-not-allowed'}`}
                onClick={() => (walkerPaymentInfo?.apple_cash_id || walkerPaymentInfo?.payment_methods?.apple_cash) && markPaysheetPaid(selectedPaysheet.id, 'Apple Cash')}
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center">
                    <span className="text-white text-lg">🍎</span>
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold">Apple Cash</p>
                    {walkerPaymentInfo?.apple_cash_id || walkerPaymentInfo?.payment_methods?.apple_cash ? (
                      <p className="text-sm text-green-600">{walkerPaymentInfo?.apple_cash_id || walkerPaymentInfo?.payment_methods?.apple_cash}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground">Not configured</p>
                    )}
                  </div>
                  {(walkerPaymentInfo?.apple_cash_id || walkerPaymentInfo?.payment_methods?.apple_cash) && (
                    <Button size="sm" className="rounded-full bg-green-500 hover:bg-green-600">
                      Pay & Mark Paid
                    </Button>
                  )}
                </div>
              </div>

              {!walkerPaymentInfo?.zelle_email && !walkerPaymentInfo?.venmo_username && !walkerPaymentInfo?.cashapp_tag && !walkerPaymentInfo?.apple_pay_id && !walkerPaymentInfo?.apple_cash_id && !walkerPaymentInfo?.payment_methods?.apple_pay && !walkerPaymentInfo?.payment_methods?.apple_cash && (
                <div className="p-4 rounded-xl bg-orange-50 border border-orange-200">
                  <p className="text-sm text-orange-700">
                    <strong>No payment methods configured.</strong> Ask {walkerPaymentInfo?.full_name || 'the staff member'} to add their payment info to their profile.
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-4 border-t">
              <Button variant="outline" onClick={() => setPaymentModalOpen(false)} className="flex-1 rounded-full">
                Cancel
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Debug Modal */}
        <Dialog open={!!debugData} onOpenChange={() => setDebugData(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Billing Debug Info</DialogTitle>
              <DialogDescription>
                Shows why appointments may not be appearing in invoices
              </DialogDescription>
            </DialogHeader>
            {debugData && (
              <div className="space-y-4 text-sm">
                <div className="p-3 bg-muted rounded-lg">
                  <p><strong>Today:</strong> {debugData.today}</p>
                  <p><strong>Billing Period:</strong> {debugData.billing_period}</p>
                </div>
                
                <div>
                  <h4 className="font-semibold mb-2">All Appointments in Date Range ({debugData.all_appointments_in_range?.length || 0})</h4>
                  <div className="space-y-2">
                    {debugData.all_appointments_in_range?.map((appt, i) => (
                      <div key={i} className="p-2 border rounded text-xs">
                        <p><strong>Date:</strong> {appt.date}</p>
                        <p><strong>Service:</strong> {appt.service_type}</p>
                        <p><strong>Status:</strong> <span className={appt.status === 'completed' ? 'text-green-600' : 'text-orange-600'}>{appt.status}</span></p>
                        <p><strong>Invoiced:</strong> <span className={appt.invoiced ? 'text-red-600' : 'text-green-600'}>{appt.invoiced ? 'YES (already billed)' : 'NO (available)'}</span></p>
                        {appt.invoice_id && <p><strong>Invoice ID:</strong> {appt.invoice_id}</p>}
                      </div>
                    ))}
                    {debugData.all_appointments_in_range?.length === 0 && (
                      <p className="text-muted-foreground">No appointments found in this date range</p>
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Billable Appointments ({debugData.billable_appointments?.length || 0})</h4>
                  <div className="space-y-2">
                    {debugData.billable_appointments?.map((appt, i) => (
                      <div key={i} className="p-2 border border-green-300 bg-green-50 rounded text-xs">
                        <p><strong>Date:</strong> {appt.date}</p>
                        <p><strong>Service:</strong> {appt.service_type}</p>
                        <p><strong>Status:</strong> {appt.status}</p>
                      </div>
                    ))}
                    {debugData.billable_appointments?.length === 0 && (
                      <p className="text-muted-foreground">No billable appointments found</p>
                    )}
                  </div>
                </div>

                <Button 
                  onClick={async () => {
                    await api.post(`/billing/reset-invoiced/${debugClientId}`);
                    toast.success('Billing reset for this client');
                    setDebugData(null);
                    fetchAllData();
                  }}
                  variant="outline"
                  className="w-full"
                >
                  Reset Invoiced Status for This Client
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default AdminBillingPage;
