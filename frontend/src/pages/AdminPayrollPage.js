import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { 
  Clock, DollarSign, CheckCircle, Send, PawPrint, RefreshCw, 
  FileText, AlertCircle, Eye, Edit, Trash2, Check, X, 
  CreditCard, User, Calendar
} from 'lucide-react';
import { toast } from 'sonner';

const AdminPayrollPage = () => {
  const { api } = useAuth();
  const [paysheets, setPaysheets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPaysheet, setSelectedPaysheet] = useState(null);
  const [viewMode, setViewMode] = useState('view'); // view, edit
  const [editedWalks, setEditedWalks] = useState([]);
  const [adminNotes, setAdminNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('pending');

  useEffect(() => {
    fetchPaysheets();
  }, []);

  const fetchPaysheets = async () => {
    setLoading(true);
    try {
      const res = await api.get('/paysheets');
      setPaysheets(res.data);
    } catch (error) {
      toast.error('Failed to load paysheets');
    } finally {
      setLoading(false);
    }
  };

  const openPaysheet = (paysheet, mode = 'view') => {
    setSelectedPaysheet(paysheet);
    setViewMode(mode);
    setEditedWalks(paysheet.walk_details || []);
    setAdminNotes(paysheet.admin_notes || '');
  };

  const closeModal = () => {
    setSelectedPaysheet(null);
    setViewMode('view');
    setEditedWalks([]);
    setAdminNotes('');
  };

  const approvePaysheet = async (paysheetId) => {
    try {
      await api.put(`/paysheets/${paysheetId}/approve`);
      toast.success('Paysheet approved!');
      fetchPaysheets();
      closeModal();
    } catch (error) {
      toast.error('Failed to approve paysheet');
    }
  };

  const markAsPaid = async (paysheetId) => {
    try {
      await api.put(`/paysheets/${paysheetId}/mark-paid`);
      toast.success('Paysheet marked as paid!');
      fetchPaysheets();
      closeModal();
    } catch (error) {
      toast.error('Failed to mark as paid');
    }
  };

  const saveEdits = async () => {
    if (!selectedPaysheet) return;
    setSaving(true);
    try {
      await api.put(`/paysheets/${selectedPaysheet.id}`, {
        walk_details: editedWalks,
        notes: adminNotes
      });
      toast.success('Paysheet updated!');
      fetchPaysheets();
      setViewMode('view');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const removeWalk = async (walkId) => {
    if (!selectedPaysheet) return;
    try {
      await api.delete(`/paysheets/${selectedPaysheet.id}/walks/${walkId}`);
      toast.success('Walk removed from paysheet');
      // Update local state
      setEditedWalks(editedWalks.filter(w => w.id !== walkId));
      // Refresh paysheets
      fetchPaysheets();
    } catch (error) {
      toast.error('Failed to remove walk');
    }
  };

  const updateWalkEarnings = (walkId, newEarnings) => {
    setEditedWalks(editedWalks.map(w => 
      w.id === walkId ? { ...w, earnings: parseFloat(newEarnings) || 0 } : w
    ));
  };

  const formatServiceType = (type) => {
    const labels = {
      'walk_30': '30-Min Walk',
      'walk_45': '45-Min Walk',
      'walk_60': '60-Min Walk',
      'overnight': 'Overnight Stay',
      'petsit_our_location': 'Pet Sit (Our Location)',
      'petsit_your_location': 'Pet Sit (Your Location)',
      'doggy_day_care': 'Doggy Day Care',
      'concierge': 'Concierge Service',
      'transport': 'Transport',
    };
    return labels[type] || type?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Other';
  };

  const getStatusBadge = (paysheet) => {
    if (paysheet.paid) {
      return <Badge className="bg-green-100 text-green-800 rounded-full">Paid</Badge>;
    }
    if (paysheet.approved) {
      return <Badge className="bg-blue-100 text-blue-800 rounded-full">Approved</Badge>;
    }
    return <Badge className="bg-yellow-100 text-yellow-800 rounded-full">Pending Review</Badge>;
  };

  const getServiceColor = (type) => {
    if (type?.includes('walk')) return 'bg-sky-100 text-sky-800 border-sky-200';
    if (type?.includes('overnight') || type?.includes('petsit')) return 'bg-purple-100 text-purple-800 border-purple-200';
    if (type === 'doggy_day_care') return 'bg-orange-100 text-orange-800 border-orange-200';
    if (type === 'transport') return 'bg-blue-100 text-blue-800 border-blue-200';
    if (type === 'concierge') return 'bg-pink-100 text-pink-800 border-pink-200';
    return 'bg-gray-100 text-gray-800 border-gray-200';
  };

  // Filter paysheets by status
  const pendingPaysheets = paysheets.filter(p => !p.approved && !p.paid);
  const approvedPaysheets = paysheets.filter(p => p.approved && !p.paid);
  const paidPaysheets = paysheets.filter(p => p.paid);

  // Calculate totals
  const pendingTotal = pendingPaysheets.reduce((sum, p) => sum + (p.total_earnings || 0), 0);
  const approvedTotal = approvedPaysheets.reduce((sum, p) => sum + (p.total_earnings || 0), 0);
  const paidTotal = paidPaysheets.reduce((sum, p) => sum + (p.total_earnings || 0), 0);

  // Calculate total for edited walks
  const editedTotal = editedWalks.reduce((sum, w) => sum + (w.earnings || 0), 0);

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
      <div className="space-y-6" data-testid="admin-payroll-page">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-heading font-bold">Staff Payroll</h1>
            <p className="text-muted-foreground">Review, approve and pay walker submissions</p>
          </div>
          <Button variant="outline" className="rounded-full" onClick={fetchPaysheets}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="rounded-2xl shadow-sm border-yellow-200 bg-yellow-50/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pending Review</p>
                  <p className="text-3xl font-bold mt-1 text-yellow-700">
                    ${pendingTotal.toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground">{pendingPaysheets.length} submissions</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-yellow-100 flex items-center justify-center">
                  <Clock className="w-6 h-6 text-yellow-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm border-blue-200 bg-blue-50/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Approved (Ready to Pay)</p>
                  <p className="text-3xl font-bold mt-1 text-blue-700">
                    ${approvedTotal.toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground">{approvedPaysheets.length} submissions</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm border-green-200 bg-green-50/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Paid (This Period)</p>
                  <p className="text-3xl font-bold mt-1 text-green-700">
                    ${paidTotal.toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground">{paidPaysheets.length} completed</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Paysheets Tabs */}
        <Card className="rounded-2xl shadow-sm">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <CardHeader className="pb-0">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="pending" className="rounded-full">
                  Pending Review ({pendingPaysheets.length})
                </TabsTrigger>
                <TabsTrigger value="approved" className="rounded-full">
                  Ready to Pay ({approvedPaysheets.length})
                </TabsTrigger>
                <TabsTrigger value="paid" className="rounded-full">
                  Paid ({paidPaysheets.length})
                </TabsTrigger>
              </TabsList>
            </CardHeader>
            <CardContent className="pt-4">
              {/* Pending Tab */}
              <TabsContent value="pending" className="mt-0">
                {pendingPaysheets.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Clock className="w-16 h-16 mx-auto mb-4 opacity-30" />
                    <p className="text-lg">No pending submissions</p>
                    <p className="text-sm">New paysheets will appear here for review</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pendingPaysheets.map((paysheet) => (
                      <PaysheetRow 
                        key={paysheet.id} 
                        paysheet={paysheet} 
                        onView={() => openPaysheet(paysheet, 'view')}
                        onEdit={() => openPaysheet(paysheet, 'edit')}
                        onApprove={() => approvePaysheet(paysheet.id)}
                        showApprove
                      />
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Approved Tab */}
              <TabsContent value="approved" className="mt-0">
                {approvedPaysheets.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <CheckCircle className="w-16 h-16 mx-auto mb-4 opacity-30" />
                    <p className="text-lg">No approved paysheets waiting</p>
                    <p className="text-sm">Approved paysheets ready for payment will appear here</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {approvedPaysheets.map((paysheet) => (
                      <PaysheetRow 
                        key={paysheet.id} 
                        paysheet={paysheet} 
                        onView={() => openPaysheet(paysheet, 'view')}
                        onPay={() => markAsPaid(paysheet.id)}
                        showPay
                      />
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Paid Tab */}
              <TabsContent value="paid" className="mt-0">
                {paidPaysheets.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <DollarSign className="w-16 h-16 mx-auto mb-4 opacity-30" />
                    <p className="text-lg">No paid paysheets yet</p>
                    <p className="text-sm">Completed payments will appear here</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {paidPaysheets.map((paysheet) => (
                      <PaysheetRow 
                        key={paysheet.id} 
                        paysheet={paysheet} 
                        onView={() => openPaysheet(paysheet, 'view')}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>
      </div>

      {/* View/Edit Modal */}
      <Dialog open={!!selectedPaysheet} onOpenChange={() => closeModal()}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {viewMode === 'edit' ? <Edit className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              {viewMode === 'edit' ? 'Edit Paysheet' : 'Paysheet Details'}
            </DialogTitle>
            <DialogDescription>
              {selectedPaysheet?.walker_name} • {selectedPaysheet?.period_start} to {selectedPaysheet?.period_end}
            </DialogDescription>
          </DialogHeader>

          {selectedPaysheet && (
            <div className="space-y-4 py-4">
              {/* Status Banner */}
              <div className={`flex items-center justify-between p-3 rounded-lg ${
                selectedPaysheet.paid ? 'bg-green-50 border border-green-200' :
                selectedPaysheet.approved ? 'bg-blue-50 border border-blue-200' :
                'bg-yellow-50 border border-yellow-200'
              }`}>
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  <span className="font-medium">{selectedPaysheet.walker_name}</span>
                </div>
                {getStatusBadge(selectedPaysheet)}
              </div>

              {/* Walk Details */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                    Services ({editedWalks.length})
                  </h4>
                  {viewMode === 'view' && !selectedPaysheet.paid && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setViewMode('edit')}
                      className="rounded-full"
                    >
                      <Edit className="w-4 h-4 mr-1" />
                      Edit
                    </Button>
                  )}
                </div>
                
                <div className="space-y-2">
                  {editedWalks.map((walk) => (
                    <div 
                      key={walk.id} 
                      className={`p-3 rounded-xl border ${getServiceColor(walk.service_type)} flex flex-col sm:flex-row sm:items-center justify-between gap-2`}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{walk.client_name}</span>
                          <Badge variant="secondary" className="rounded-full text-xs">
                            {walk.date}
                          </Badge>
                          <Badge className={`rounded-full text-xs ${getServiceColor(walk.service_type)}`}>
                            {formatServiceType(walk.service_type)}
                          </Badge>
                        </div>
                        {walk.pet_names?.length > 0 && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {walk.pet_names.join(', ')}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        {viewMode === 'edit' ? (
                          <>
                            <div className="flex items-center gap-1">
                              <span className="text-sm">$</span>
                              <Input
                                type="number"
                                step="0.01"
                                value={walk.earnings}
                                onChange={(e) => updateWalkEarnings(walk.id, e.target.value)}
                                className="w-20 h-8 text-right"
                              />
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeWalk(walk.id)}
                              className="text-red-500 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </>
                        ) : (
                          <span className="font-bold text-green-700">${walk.earnings?.toFixed(2)}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Admin Notes */}
              {viewMode === 'edit' && (
                <div className="space-y-2">
                  <Label>Admin Notes</Label>
                  <Textarea
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder="Add notes about adjustments..."
                    rows={2}
                  />
                </div>
              )}

              {selectedPaysheet.admin_notes && viewMode === 'view' && (
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-sm font-medium text-muted-foreground">Admin Notes</p>
                  <p className="text-sm mt-1">{selectedPaysheet.admin_notes}</p>
                </div>
              )}

              {/* Total */}
              <div className="p-4 rounded-xl bg-green-50 border-2 border-green-200">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-semibold text-green-800">Total Payment</p>
                    <p className="text-sm text-green-600">{editedWalks.length} services</p>
                  </div>
                  <p className="text-3xl font-bold text-green-700">
                    ${viewMode === 'edit' ? editedTotal.toFixed(2) : selectedPaysheet.total_earnings?.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            {viewMode === 'edit' ? (
              <>
                <Button variant="outline" onClick={() => setViewMode('view')} className="rounded-full">
                  Cancel
                </Button>
                <Button onClick={saveEdits} disabled={saving} className="rounded-full">
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={closeModal} className="rounded-full">
                  Close
                </Button>
                {!selectedPaysheet?.paid && !selectedPaysheet?.approved && (
                  <Button 
                    onClick={() => approvePaysheet(selectedPaysheet.id)} 
                    className="rounded-full bg-blue-600 hover:bg-blue-700"
                  >
                    <Check className="w-4 h-4 mr-2" />
                    Approve
                  </Button>
                )}
                {selectedPaysheet?.approved && !selectedPaysheet?.paid && (
                  <Button 
                    onClick={() => markAsPaid(selectedPaysheet.id)} 
                    className="rounded-full bg-green-600 hover:bg-green-700"
                  >
                    <DollarSign className="w-4 h-4 mr-2" />
                    Mark as Paid
                  </Button>
                )}
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

// Paysheet Row Component
const PaysheetRow = ({ paysheet, onView, onEdit, onApprove, onPay, showApprove, showPay }) => {
  const getStatusBadge = () => {
    if (paysheet.paid) {
      return <Badge className="bg-green-100 text-green-800 rounded-full">Paid</Badge>;
    }
    if (paysheet.approved) {
      return <Badge className="bg-blue-100 text-blue-800 rounded-full">Approved</Badge>;
    }
    return <Badge className="bg-yellow-100 text-yellow-800 rounded-full">Pending</Badge>;
  };

  return (
    <div 
      className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors gap-3"
      data-testid={`paysheet-row-${paysheet.id}`}
    >
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <User className="w-5 h-5 text-primary" />
        </div>
        <div>
          <p className="font-medium">{paysheet.walker_name}</p>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <Badge variant="secondary" className="rounded-full text-xs">
              <Calendar className="w-3 h-3 mr-1" />
              {paysheet.period_start} to {paysheet.period_end}
            </Badge>
            <Badge variant="outline" className="rounded-full text-xs">
              {paysheet.total_walks} services
            </Badge>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="font-bold text-lg text-green-600">${paysheet.total_earnings?.toFixed(2)}</span>
        {getStatusBadge()}
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={onView} className="rounded-full">
            <Eye className="w-4 h-4" />
          </Button>
          {showApprove && onEdit && (
            <Button variant="ghost" size="sm" onClick={onEdit} className="rounded-full">
              <Edit className="w-4 h-4" />
            </Button>
          )}
          {showApprove && onApprove && (
            <Button 
              size="sm" 
              onClick={onApprove} 
              className="rounded-full bg-blue-600 hover:bg-blue-700"
            >
              <Check className="w-4 h-4 mr-1" />
              Approve
            </Button>
          )}
          {showPay && onPay && (
            <Button 
              size="sm" 
              onClick={onPay} 
              className="rounded-full bg-green-600 hover:bg-green-700"
            >
              <DollarSign className="w-4 h-4 mr-1" />
              Pay
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminPayrollPage;
