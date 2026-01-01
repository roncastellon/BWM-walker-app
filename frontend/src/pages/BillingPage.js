import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { CreditCard, CheckCircle, Clock, AlertCircle, Loader2, Smartphone, DollarSign, Copy, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

const BillingPage = () => {
  const { api } = useAuth();
  const [searchParams] = useSearchParams();
  const [invoices, setInvoices] = useState([]);
  const [paymentInfo, setPaymentInfo] = useState({});
  const [loading, setLoading] = useState(true);
  const [payingInvoice, setPayingInvoice] = useState(null);
  const [checkingPayment, setCheckingPayment] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  useEffect(() => {
    fetchData();
    
    // Check for payment return
    const sessionId = searchParams.get('session_id');
    if (sessionId) {
      pollPaymentStatus(sessionId);
    }
  }, [searchParams]);

  const fetchData = async () => {
    try {
      const [invoicesRes, paymentInfoRes] = await Promise.all([
        api.get('/invoices'),
        api.get('/settings/payment-info'),
      ]);
      setInvoices(invoicesRes.data);
      setPaymentInfo(paymentInfoRes.data);
    } catch (error) {
      toast.error('Failed to load billing data');
    } finally {
      setLoading(false);
    }
  };

  const pollPaymentStatus = async (sessionId, attempts = 0) => {
    const maxAttempts = 5;
    if (attempts >= maxAttempts) {
      toast.error('Payment status check timed out');
      setCheckingPayment(false);
      return;
    }

    setCheckingPayment(true);
    try {
      const response = await api.get(`/payments/status/${sessionId}`);
      if (response.data.payment_status === 'paid') {
        toast.success('Payment successful! Thank you.');
        setCheckingPayment(false);
        fetchData();
        window.history.replaceState({}, '', '/billing');
      } else if (response.data.status === 'expired') {
        toast.error('Payment session expired');
        setCheckingPayment(false);
      } else {
        setTimeout(() => pollPaymentStatus(sessionId, attempts + 1), 2000);
      }
    } catch (error) {
      console.error('Error checking payment:', error);
      setTimeout(() => pollPaymentStatus(sessionId, attempts + 1), 2000);
    }
  };

  const handleCreditCardPayment = async (invoiceId) => {
    setPayingInvoice(invoiceId);
    try {
      const origin = window.location.origin;
      const response = await api.post(`/payments/checkout?invoice_id=${invoiceId}&origin_url=${encodeURIComponent(origin)}`);
      if (response.data.url) {
        window.location.href = response.data.url;
      }
    } catch (error) {
      toast.error('Failed to initiate payment');
      setPayingInvoice(null);
    }
  };

  const openPaymentOptions = (invoice) => {
    setSelectedInvoice(invoice);
    setPaymentDialogOpen(true);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-green-100 text-green-800 rounded-full"><CheckCircle className="w-3 h-3 mr-1" /> Paid</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800 rounded-full"><Clock className="w-3 h-3 mr-1" /> Pending</Badge>;
      case 'overdue':
        return <Badge className="bg-red-100 text-red-800 rounded-full"><AlertCircle className="w-3 h-3 mr-1" /> Overdue</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800 rounded-full">{status}</Badge>;
    }
  };

  const pendingInvoices = invoices.filter(inv => inv.status === 'pending' || inv.status === 'overdue');
  const paidInvoices = invoices.filter(inv => inv.status === 'paid');
  const totalPending = pendingInvoices.reduce((sum, inv) => sum + inv.amount, 0);

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
      <div className="space-y-8" data-testid="billing-page">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-heading font-bold">Billing</h1>
          <p className="text-muted-foreground">View and pay your invoices</p>
        </div>

        {/* Payment Processing Notice */}
        {checkingPayment && (
          <Card className="rounded-2xl border-primary/50 bg-primary/5">
            <CardContent className="p-6 flex items-center gap-4">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
              <div>
                <p className="font-medium">Processing Payment</p>
                <p className="text-sm text-muted-foreground">Please wait while we confirm your payment...</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Summary Card */}
        <Card className="rounded-2xl shadow-sm bg-gradient-to-br from-primary/5 to-primary/10">
          <CardContent className="p-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div>
                <p className="text-sm text-muted-foreground">Total Outstanding</p>
                <p className="text-4xl font-bold">${totalPending.toFixed(2)}</p>
                <p className="text-sm text-muted-foreground mt-1">{pendingInvoices.length} pending invoice(s)</p>
              </div>
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                <CreditCard className="w-8 h-8 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pending Invoices */}
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl">Pending Invoices</CardTitle>
            <CardDescription>Invoices awaiting payment</CardDescription>
          </CardHeader>
          <CardContent>
            {pendingInvoices.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <CheckCircle className="w-16 h-16 mx-auto mb-4 opacity-50 text-green-500" />
                <p className="text-lg">All caught up!</p>
                <p className="text-sm">You have no pending invoices</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingInvoices.map((invoice) => (
                  <div
                    key={invoice.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-muted/50"
                    data-testid={`invoice-${invoice.id}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                        <CreditCard className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <p className="font-bold text-xl">${invoice.amount.toFixed(2)}</p>
                        <p className="text-sm text-muted-foreground">Due: {invoice.due_date}</p>
                        <p className="text-xs text-muted-foreground">
                          {invoice.appointment_ids?.length || 0} service(s)
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {getStatusBadge(invoice.status)}
                      <Button
                        onClick={() => openPaymentOptions(invoice)}
                        className="rounded-full"
                        data-testid={`pay-btn-${invoice.id}`}
                      >
                        Pay Now
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment History */}
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl">Payment History</CardTitle>
            <CardDescription>Previously paid invoices</CardDescription>
          </CardHeader>
          <CardContent>
            {paidInvoices.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Clock className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg">No payment history yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {paidInvoices.map((invoice) => (
                  <div
                    key={invoice.id}
                    className="flex items-center justify-between p-4 rounded-xl bg-muted/30"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <p className="font-medium">${invoice.amount.toFixed(2)}</p>
                        <p className="text-sm text-muted-foreground">
                          Paid: {invoice.paid_date}
                          {invoice.payment_method && (
                            <span className="ml-2 capitalize">via {invoice.payment_method}</span>
                          )}
                        </p>
                      </div>
                    </div>
                    {getStatusBadge(invoice.status)}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment Options Dialog */}
        <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Choose Payment Method</DialogTitle>
              <DialogDescription>
                Pay ${selectedInvoice?.amount?.toFixed(2)} - Invoice #{selectedInvoice?.id?.slice(0, 8)}
              </DialogDescription>
            </DialogHeader>

            <Tabs defaultValue="card" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="card" className="text-xs">Card</TabsTrigger>
                <TabsTrigger value="zelle" className="text-xs">Zelle</TabsTrigger>
                <TabsTrigger value="venmo" className="text-xs">Venmo</TabsTrigger>
                <TabsTrigger value="cashapp" className="text-xs">CashApp</TabsTrigger>
              </TabsList>

              {/* Credit Card */}
              <TabsContent value="card" className="mt-4">
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 rounded-2xl bg-blue-100 flex items-center justify-center mx-auto">
                    <CreditCard className="w-8 h-8 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-medium">Pay with Credit Card</h3>
                    <p className="text-sm text-muted-foreground">Secure payment via Stripe</p>
                  </div>
                  <Button
                    onClick={() => {
                      setPaymentDialogOpen(false);
                      handleCreditCardPayment(selectedInvoice?.id);
                    }}
                    disabled={payingInvoice === selectedInvoice?.id}
                    className="w-full rounded-full"
                    data-testid="pay-with-card"
                  >
                    {payingInvoice === selectedInvoice?.id ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <CreditCard className="w-4 h-4 mr-2" />
                        Pay ${selectedInvoice?.amount?.toFixed(2)}
                      </>
                    )}
                  </Button>
                </div>
              </TabsContent>

              {/* Zelle */}
              <TabsContent value="zelle" className="mt-4">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
                      <span className="text-purple-600 font-bold text-lg">Z</span>
                    </div>
                    <div>
                      <h3 className="font-medium">Pay with Zelle</h3>
                      <p className="text-sm text-muted-foreground">Send from your banking app</p>
                    </div>
                  </div>

                  {paymentInfo.zelle?.email || paymentInfo.zelle?.phone ? (
                    <div className="space-y-3 p-4 rounded-xl bg-muted/50">
                      {paymentInfo.zelle?.name && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Name</span>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{paymentInfo.zelle.name}</span>
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => copyToClipboard(paymentInfo.zelle.name)}>
                              <Copy className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      )}
                      {paymentInfo.zelle?.email && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Email</span>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{paymentInfo.zelle.email}</span>
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => copyToClipboard(paymentInfo.zelle.email)}>
                              <Copy className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      )}
                      {paymentInfo.zelle?.phone && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Phone</span>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{paymentInfo.zelle.phone}</span>
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => copyToClipboard(paymentInfo.zelle.phone)}>
                              <Copy className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      )}
                      <div className="pt-2 border-t">
                        <p className="text-xs text-muted-foreground">
                          Include memo: <strong>Invoice #{selectedInvoice?.id?.slice(0, 8)}</strong>
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">Zelle payment info not configured</p>
                  )}
                </div>
              </TabsContent>

              {/* Venmo */}
              <TabsContent value="venmo" className="mt-4">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                      <span className="text-blue-500 font-bold text-lg">V</span>
                    </div>
                    <div>
                      <h3 className="font-medium">Pay with Venmo</h3>
                      <p className="text-sm text-muted-foreground">Send via Venmo app</p>
                    </div>
                  </div>

                  {paymentInfo.venmo?.username ? (
                    <div className="space-y-3 p-4 rounded-xl bg-muted/50">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Username</span>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">@{paymentInfo.venmo.username}</span>
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => copyToClipboard(paymentInfo.venmo.username)}>
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                      <div className="pt-2 border-t">
                        <p className="text-xs text-muted-foreground">
                          Include note: <strong>Invoice #{selectedInvoice?.id?.slice(0, 8)}</strong>
                        </p>
                      </div>
                      <a 
                        href={`https://venmo.com/${paymentInfo.venmo.username}?txn=pay&amount=${selectedInvoice?.amount}&note=Invoice%20${selectedInvoice?.id?.slice(0, 8)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block"
                      >
                        <Button variant="outline" className="w-full rounded-full">
                          <ExternalLink className="w-4 h-4 mr-2" />
                          Open Venmo
                        </Button>
                      </a>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">Venmo payment info not configured</p>
                  )}
                </div>
              </TabsContent>

              {/* CashApp */}
              <TabsContent value="cashapp" className="mt-4">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
                      <DollarSign className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <h3 className="font-medium">Pay with Cash App</h3>
                      <p className="text-sm text-muted-foreground">Send via Cash App</p>
                    </div>
                  </div>

                  {paymentInfo.cashapp?.cashtag ? (
                    <div className="space-y-3 p-4 rounded-xl bg-muted/50">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">$Cashtag</span>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">${paymentInfo.cashapp.cashtag}</span>
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => copyToClipboard(`$${paymentInfo.cashapp.cashtag}`)}>
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                      <div className="pt-2 border-t">
                        <p className="text-xs text-muted-foreground">
                          Include note: <strong>Invoice #{selectedInvoice?.id?.slice(0, 8)}</strong>
                        </p>
                      </div>
                      <a 
                        href={`https://cash.app/$${paymentInfo.cashapp.cashtag}/${selectedInvoice?.amount}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block"
                      >
                        <Button variant="outline" className="w-full rounded-full">
                          <ExternalLink className="w-4 h-4 mr-2" />
                          Open Cash App
                        </Button>
                      </a>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">Cash App payment info not configured</p>
                  )}
                </div>
              </TabsContent>
            </Tabs>

            {paymentInfo.instructions && (
              <p className="text-xs text-muted-foreground text-center mt-4 pt-4 border-t">
                {paymentInfo.instructions}
              </p>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default BillingPage;
