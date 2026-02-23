import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../components/ui/dialog';
import { Clock, DollarSign, CheckCircle, Send, PawPrint, RefreshCw, FileText, AlertCircle, Pencil, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';

const PayrollPage = () => {
  const { api } = useAuth();
  const [currentPayroll, setCurrentPayroll] = useState(null);
  const [paysheets, setPaysheets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  
  // Edit state
  const [editingWalkId, setEditingWalkId] = useState(null);
  const [editAmount, setEditAmount] = useState('');
  const [excludedWalks, setExcludedWalks] = useState(new Set()); // Walks to exclude from submission

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [payrollRes, tsRes] = await Promise.all([
        api.get('/payroll/current'),
        api.get('/paysheets'),
      ]);
      setCurrentPayroll(payrollRes.data);
      setPaysheets(tsRes.data);
      setExcludedWalks(new Set()); // Reset excluded walks on refresh
    } catch (error) {
      toast.error('Failed to load payroll data');
    } finally {
      setLoading(false);
    }
  };

  // Start editing a walk's earnings
  const startEditWalk = (walk) => {
    setEditingWalkId(walk.id);
    setEditAmount(walk.earnings?.toFixed(2) || '0');
  };

  // Save edited earnings
  const saveEditedEarnings = (walkId) => {
    const newAmount = parseFloat(editAmount);
    if (isNaN(newAmount) || newAmount < 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    
    // Update the walk's earnings in local state
    setCurrentPayroll(prev => {
      if (!prev) return prev;
      const updatedWalks = prev.walks.map(w => 
        w.id === walkId ? { ...w, earnings: newAmount, edited: true } : w
      );
      const newTotal = updatedWalks
        .filter(w => !excludedWalks.has(w.id))
        .reduce((sum, w) => sum + (w.earnings || 0), 0);
      return {
        ...prev,
        walks: updatedWalks,
        total_earnings: newTotal
      };
    });
    
    setEditingWalkId(null);
    setEditAmount('');
    toast.success('Amount updated');
  };

  // Cancel editing
  const cancelEdit = () => {
    setEditingWalkId(null);
    setEditAmount('');
  };

  // Toggle exclude/include a walk from submission
  const toggleExcludeWalk = (walkId) => {
    setExcludedWalks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(walkId)) {
        newSet.delete(walkId);
      } else {
        newSet.add(walkId);
      }
      return newSet;
    });
    
    // Recalculate total
    setCurrentPayroll(prev => {
      if (!prev) return prev;
      const newExcluded = new Set(excludedWalks);
      if (newExcluded.has(walkId)) {
        newExcluded.delete(walkId);
      } else {
        newExcluded.add(walkId);
      }
      const newTotal = prev.walks
        .filter(w => !newExcluded.has(w.id))
        .reduce((sum, w) => sum + (w.earnings || 0), 0);
      return {
        ...prev,
        total_earnings: newTotal,
        total_walks: prev.walks.filter(w => !newExcluded.has(w.id)).length
      };
    });
  };

  // Set amount to zero
  const setAmountToZero = (walkId) => {
    setCurrentPayroll(prev => {
      if (!prev) return prev;
      const updatedWalks = prev.walks.map(w => 
        w.id === walkId ? { ...w, earnings: 0, edited: true } : w
      );
      const newTotal = updatedWalks
        .filter(w => !excludedWalks.has(w.id))
        .reduce((sum, w) => sum + (w.earnings || 0), 0);
      return {
        ...prev,
        walks: updatedWalks,
        total_earnings: newTotal
      };
    });
    toast.success('Amount set to $0');
  };

  const openReviewModal = () => {
    if (!currentPayroll || currentPayroll.total_walks === 0) {
      toast.error('No completed services to submit');
      return;
    }
    setReviewModalOpen(true);
  };

  const submitPaysheet = async () => {
    setSubmitting(true);
    try {
      await api.post('/paysheets/submit');
      toast.success('Paysheet submitted to admin for payment!');
      setReviewModalOpen(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to submit paysheet');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDistance = (meters) => {
    if (!meters) return '0 m';
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(2)} km`;
    }
    return `${Math.round(meters)} m`;
  };

  const formatDuration = (minutes) => {
    if (!minutes) return '0 min';
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hrs > 0) {
      return `${hrs}h ${mins}m`;
    }
    return `${mins} min`;
  };

  // Group walks by service type for review
  const getServiceBreakdown = () => {
    if (!currentPayroll?.walks) return {};
    
    const breakdown = {};
    currentPayroll.walks.forEach(walk => {
      const type = walk.service_type || 'other';
      if (!breakdown[type]) {
        breakdown[type] = {
          count: 0,
          earnings: 0,
          walks: []
        };
      }
      breakdown[type].count += 1;
      breakdown[type].earnings += walk.earnings || 0;
      breakdown[type].walks.push(walk);
    });
    return breakdown;
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

  const getServiceColor = (type) => {
    if (type?.includes('walk')) return 'bg-sky-100 text-sky-800 border-sky-200';
    if (type?.includes('overnight') || type?.includes('petsit')) return 'bg-purple-100 text-purple-800 border-purple-200';
    if (type === 'doggy_day_care') return 'bg-orange-100 text-orange-800 border-orange-200';
    if (type === 'transport') return 'bg-blue-100 text-blue-800 border-blue-200';
    if (type === 'concierge') return 'bg-pink-100 text-pink-800 border-pink-200';
    return 'bg-gray-100 text-gray-800 border-gray-200';
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

  const serviceBreakdown = getServiceBreakdown();

  return (
    <Layout>
      <div className="space-y-4 sm:space-y-6 px-2 sm:px-0" data-testid="payroll-page">
        {/* Header - Mobile First */}
        <div className="flex flex-col gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-heading font-bold">Time Sheets & Payroll</h1>
            <p className="text-sm text-muted-foreground">Track your completed services and submit for payment</p>
          </div>
          <Button variant="outline" className="rounded-full w-full sm:w-auto" onClick={fetchData}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Pay Rates Info - Collapsible on mobile */}
        <Card className="rounded-2xl shadow-sm bg-primary/5 border-primary/20">
          <CardContent className="p-3 sm:p-4">
            <div className="space-y-2 sm:space-y-3 text-xs sm:text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium w-20 sm:w-24">Walks:</span>
                <Badge className="bg-sky-100 text-sky-800 rounded-full text-xs">30m: ${currentPayroll?.pay_rates?.walk_30 || 15}</Badge>
                <Badge className="bg-sky-100 text-sky-800 rounded-full text-xs">45m: ${currentPayroll?.pay_rates?.walk_45 || 22}</Badge>
                <Badge className="bg-sky-100 text-sky-800 rounded-full text-xs">60m: ${currentPayroll?.pay_rates?.walk_60 || 30}</Badge>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium w-20 sm:w-24">Overnight:</span>
                <Badge className="bg-purple-100 text-purple-800 rounded-full text-xs">Stay: ${currentPayroll?.pay_rates?.overnight || 30}</Badge>
                <Badge className="bg-purple-100 text-purple-800 rounded-full text-xs">Our: ${currentPayroll?.pay_rates?.petsit_our_location || 40}</Badge>
                <Badge className="bg-purple-100 text-purple-800 rounded-full text-xs">Yours: ${currentPayroll?.pay_rates?.petsit_your_location || 50}</Badge>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium w-20 sm:w-24">Other:</span>
                <Badge className="bg-orange-100 text-orange-800 rounded-full text-xs">Day Care: ${currentPayroll?.pay_rates?.doggy_day_care || 25}</Badge>
                <Badge className="bg-orange-100 text-orange-800 rounded-full text-xs">Concierge: ${currentPayroll?.pay_rates?.concierge || 30}</Badge>
                <Badge className="bg-orange-100 text-orange-800 rounded-full text-xs">Transport: ${currentPayroll?.pay_rates?.transport || 20}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Current Period Summary - Stack on mobile */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <Card className="rounded-2xl shadow-sm">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Services Completed</p>
                  <p className="text-3xl font-bold mt-1">
                    {currentPayroll?.total_walks || 0}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    ready for submission
                  </p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Clock className="w-6 h-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Hours</p>
                  <p className="text-3xl font-bold mt-1">
                    {currentPayroll?.total_hours || 0}h
                  </p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-secondary/10 flex items-center justify-center">
                  <PawPrint className="w-6 h-6 text-secondary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm border-2 border-green-200 bg-green-50/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Amount Due</p>
                  <p className="text-3xl font-bold mt-1 text-green-600">
                    ${currentPayroll?.total_earnings?.toFixed(2) || '0.00'}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Completed Services - Ready for Submission */}
        <Card className="rounded-2xl shadow-sm">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle>Completed Services</CardTitle>
              <CardDescription>
                Edit amounts or remove services before submitting. Tap the $ to edit.
              </CardDescription>
            </div>
            <Button
              onClick={openReviewModal}
              disabled={!currentPayroll || currentPayroll.walks?.filter(w => !excludedWalks.has(w.id)).length === 0}
              className="rounded-full bg-green-600 hover:bg-green-700"
              data-testid="submit-for-pay-btn"
            >
              <FileText className="w-4 h-4 mr-2" />
              Submit for Pay
            </Button>
          </CardHeader>
          <CardContent>
            {!currentPayroll || currentPayroll.walks?.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <CheckCircle className="w-16 h-16 mx-auto mb-4 opacity-30 text-green-500" />
                <p className="text-lg">No completed services pending</p>
                <p className="text-sm">Complete services to add them to your paysheet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {currentPayroll.walks.map((walk) => {
                  const isExcluded = excludedWalks.has(walk.id);
                  const isEditing = editingWalkId === walk.id;
                  
                  return (
                    <div
                      key={walk.id}
                      className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl gap-3 transition-all ${
                        isExcluded 
                          ? 'bg-red-50/50 opacity-60 border border-red-200' 
                          : 'bg-muted/50'
                      }`}
                      data-testid={`walk-${walk.id}`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                          isExcluded ? 'bg-red-100' : 'bg-primary/10'
                        }`}>
                          <PawPrint className={`w-5 h-5 ${isExcluded ? 'text-red-500' : 'text-primary'}`} />
                        </div>
                        <div>
                          <p className={`font-medium ${isExcluded ? 'line-through text-muted-foreground' : ''}`}>
                            {walk.client_name}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {walk.pet_names?.join(', ')}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            <Badge variant="secondary" className="rounded-full text-xs">
                              {walk.date}
                            </Badge>
                            {walk.time && (
                              <Badge variant="secondary" className="rounded-full text-xs">
                                {walk.time}
                              </Badge>
                            )}
                            <Badge className={`rounded-full text-xs ${getServiceColor(walk.service_type)}`}>
                              {formatServiceType(walk.service_type)}
                            </Badge>
                            {walk.edited && (
                              <Badge className="rounded-full text-xs bg-amber-100 text-amber-800">
                                Edited
                              </Badge>
                            )}
                            {isExcluded && (
                              <Badge className="rounded-full text-xs bg-red-100 text-red-800">
                                Excluded
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 sm:gap-4">
                        <div className="text-center hidden sm:block">
                          <p className="text-xs text-muted-foreground">Duration</p>
                          <p className="font-medium">{formatDuration(walk.duration_minutes)}</p>
                        </div>
                        
                        {/* Editable Earnings */}
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground">Earned</p>
                          {isEditing ? (
                            <div className="flex items-center gap-1">
                              <span className="text-green-600">$</span>
                              <Input
                                type="number"
                                step="0.01"
                                value={editAmount}
                                onChange={(e) => setEditAmount(e.target.value)}
                                className="w-20 h-7 text-center text-sm"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') saveEditedEarnings(walk.id);
                                  if (e.key === 'Escape') cancelEdit();
                                }}
                              />
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-green-600"
                                onClick={() => saveEditedEarnings(walk.id)}
                              >
                                <CheckCircle className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-gray-500"
                                onClick={cancelEdit}
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          ) : (
                            <button
                              onClick={() => startEditWalk(walk)}
                              className={`font-bold flex items-center gap-1 hover:bg-green-100 px-2 py-1 rounded transition-colors ${
                                isExcluded ? 'text-gray-400 line-through' : 'text-green-600'
                              }`}
                              disabled={isExcluded}
                            >
                              ${walk.earnings?.toFixed(2)}
                              {!isExcluded && <Pencil className="w-3 h-3 opacity-50" />}
                            </button>
                          )}
                        </div>
                        
                        {/* Action Buttons */}
                        <div className="flex items-center gap-1">
                          {!isEditing && (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0 text-amber-600 hover:bg-amber-100"
                                onClick={() => setAmountToZero(walk.id)}
                                title="Set to $0"
                                disabled={isExcluded}
                              >
                                <DollarSign className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className={`h-8 w-8 p-0 ${isExcluded ? 'text-green-600 hover:bg-green-100' : 'text-red-600 hover:bg-red-100'}`}
                                onClick={() => toggleExcludeWalk(walk.id)}
                                title={isExcluded ? 'Include in submission' : 'Exclude from submission'}
                              >
                                {isExcluded ? <CheckCircle className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Previous Paysheets */}
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle>Submitted Paysheets</CardTitle>
            <CardDescription>Your payment history</CardDescription>
          </CardHeader>
          <CardContent>
            {paysheets.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No paysheets submitted yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {paysheets.map((ts) => (
                  <div
                    key={ts.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl bg-muted/30 gap-3"
                    data-testid={`paysheet-${ts.id}`}
                  >
                    <div>
                      <p className="font-medium">
                        {ts.period_start} to {ts.period_end}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {ts.total_hours}h • {ts.total_walks} services
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-lg">${ts.total_earnings?.toFixed(2)}</span>
                      <Badge className={`rounded-full ${
                        ts.paid 
                          ? 'bg-green-100 text-green-800' 
                          : ts.approved 
                            ? 'bg-blue-100 text-blue-800' 
                            : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {ts.paid ? 'Paid' : ts.approved ? 'Approved' : 'Pending Review'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Review & Submit Modal */}
      <Dialog open={reviewModalOpen} onOpenChange={setReviewModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Review Paysheet Submission
            </DialogTitle>
            <DialogDescription>
              Review your completed services before submitting to admin for payment
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Important Notice */}
            <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-amber-800">Only completed services are included</p>
                <p className="text-amber-700">Once submitted, this paysheet will be sent to admin for review and payment.</p>
              </div>
            </div>

            {/* Service Breakdown by Type */}
            <div className="space-y-3">
              <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Service Breakdown</h4>
              {Object.entries(serviceBreakdown).map(([type, data]) => (
                <div key={type} className={`p-4 rounded-xl border ${getServiceColor(type)}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold">{formatServiceType(type)}</span>
                    <Badge variant="secondary" className="rounded-full">
                      {data.count} {data.count === 1 ? 'service' : 'services'}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    {data.walks.map(walk => (
                      <div key={walk.id} className="flex justify-between text-sm py-1 border-t border-current/10 first:border-0">
                        <span>{walk.client_name} - {walk.date}</span>
                        <span className="font-medium">${walk.earnings?.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between mt-2 pt-2 border-t border-current/20 font-semibold">
                    <span>Subtotal</span>
                    <span>${data.earnings.toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Total Summary */}
            <div className="p-4 rounded-xl bg-green-50 border-2 border-green-200">
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-semibold text-green-800">Total Payment Due</p>
                  <p className="text-sm text-green-600">{currentPayroll?.total_walks} completed services</p>
                </div>
                <p className="text-3xl font-bold text-green-700">
                  ${currentPayroll?.total_earnings?.toFixed(2)}
                </p>
              </div>
            </div>
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setReviewModalOpen(false)}
              className="rounded-full"
            >
              Cancel
            </Button>
            <Button
              onClick={submitPaysheet}
              disabled={submitting}
              className="rounded-full bg-green-600 hover:bg-green-700"
              data-testid="confirm-submit-btn"
            >
              <Send className="w-4 h-4 mr-2" />
              {submitting ? 'Submitting...' : 'Submit to Admin'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default PayrollPage;
