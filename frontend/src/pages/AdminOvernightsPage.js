import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { 
  Moon, Calendar, Clock, PawPrint, CheckCircle, AlertTriangle,
  ChevronLeft, ChevronRight, LogIn, LogOut, Plus, RefreshCw, User,
  DollarSign, Mail, Trash2
} from 'lucide-react';
import { toast } from 'sonner';

const AdminOvernightsPage = () => {
  const navigate = useNavigate();
  const { api } = useAuth();
  const [overnights, setOvernights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedStay, setSelectedStay] = useState(null);
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [extendModalOpen, setExtendModalOpen] = useState(false);
  const [extendDays, setExtendDays] = useState(1);
  const [endingTodayPrompt, setEndingTodayPrompt] = useState([]);
  const [invoices, setInvoices] = useState([]); // Track invoices for appointments
  
  // Remove stay confirmation state
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);
  
  // Edit modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    scheduled_date: '',
    end_date: '',
    status: 'scheduled'
  });

  useEffect(() => {
    fetchOvernights();
    fetchInvoices();
  }, [currentDate]);

  useEffect(() => {
    // Check for stays ending today after 6 PM
    checkEndingToday();
    const interval = setInterval(checkEndingToday, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [overnights]);

  const fetchInvoices = async () => {
    try {
      const res = await api.get('/invoices');
      setInvoices(res.data || []);
    } catch (error) {
      console.error('Failed to fetch invoices:', error);
    }
  };

  // Get invoice for a specific appointment
  const getInvoiceForAppointment = (appointmentId) => {
    return invoices.find(inv => inv.appointment_ids?.includes(appointmentId));
  };

  const fetchOvernights = async () => {
    setLoading(true);
    try {
      // Fetch services to get overnight service types
      const servicesRes = await api.get('/services');
      
      // Get all services that are overnight-type (by duration_type or name)
      const overnightServices = servicesRes.data.filter(s => 
        s.duration_type === 'nights' || 
        s.service_type?.toLowerCase().includes('overnight') ||
        s.service_type?.toLowerCase().includes('petsit') ||
        s.service_type?.toLowerCase().includes('boarding') ||
        s.service_type?.toLowerCase().includes('stay') ||
        s.name?.toLowerCase().includes('overnight') ||
        s.name?.toLowerCase().includes('boarding') ||
        s.name?.toLowerCase().includes('pet sitting')
      );
      
      const overnightServiceTypes = overnightServices.map(s => s.service_type);
      console.log('Overnight services found:', overnightServices.map(s => ({ name: s.name, service_type: s.service_type, duration_type: s.duration_type })));
      console.log('Overnight service types:', overnightServiceTypes);
      
      const res = await api.get('/appointments/calendar');
      console.log('All appointments:', res.data.length);
      
      // Filter overnight-type appointments
      const filtered = res.data.filter(a => {
        const serviceType = (a.service_type || '').toLowerCase();
        const dType = (a.duration_type || '').toLowerCase();
        
        // Match by service type containing keywords, duration_type, or being in overnight services list
        const matches = (
          serviceType.includes('overnight') ||
          serviceType.includes('petsit') ||
          serviceType.includes('boarding') ||
          serviceType.includes('stay') ||
          serviceType.includes('pet_sitting') ||
          serviceType.includes('sitting') ||
          dType === 'nights' ||
          overnightServiceTypes.includes(a.service_type)
        );
        
        if (matches) {
          console.log('Matched overnight:', a.service_type, a.scheduled_date, a.pet_names);
        }
        
        return matches;
      });
      
      console.log('Overnight appointments found:', filtered.length);
      setOvernights(filtered);
    } catch (error) {
      console.error('Failed to load overnights:', error);
      toast.error('Failed to load overnights');
    } finally {
      setLoading(false);
    }
  };

  const checkEndingToday = () => {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const hour = now.getHours();
    
    // Only show prompt after 6 PM
    if (hour < 18) {
      setEndingTodayPrompt([]);
      return;
    }
    
    // Find stays ending today that are still in progress
    const ending = overnights.filter(stay => {
      const endDate = stay.end_date || stay.scheduled_date;
      return endDate === today && stay.status === 'in_progress';
    });
    
    setEndingTodayPrompt(ending);
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const navigateDate = (days) => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + days);
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const getStaysForDate = (dateStr) => {
    return overnights.filter(stay => {
      const startDate = stay.scheduled_date;
      const endDate = stay.end_date || stay.scheduled_date;
      return dateStr >= startDate && dateStr <= endDate;
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'scheduled': return 'bg-yellow-100 text-yellow-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getServiceLabel = (type) => {
    const labels = {
      'overnight': 'Overnight Stay',
      'stay_overnight': 'Overnight Stay',
      'petsit_our_location': 'Our Location',
      'petsit_your_location': "Client's Home",
    };
    return labels[type] || type?.replace(/_/g, ' ');
  };

  // Open edit modal
  const openEditModal = (stay) => {
    setSelectedStay(stay);
    setEditForm({
      scheduled_date: stay.scheduled_date || '',
      end_date: stay.end_date || stay.scheduled_date || '',
      status: stay.status || 'scheduled'
    });
    setEditModalOpen(true);
  };

  // Save edited stay
  const handleSaveEdit = async () => {
    if (!selectedStay) return;
    try {
      await api.put(`/appointments/${selectedStay.id}`, {
        scheduled_date: editForm.scheduled_date,
        end_date: editForm.end_date,
        status: editForm.status
      });
      toast.success('Stay updated successfully!');
      fetchOvernights();
      setEditModalOpen(false);
      setActionModalOpen(false);
    } catch (error) {
      toast.error('Failed to update stay');
    }
  };

  // Check-in a stay
  const handleCheckIn = async (stay) => {
    try {
      await api.put(`/appointments/${stay.id}`, {
        status: 'in_progress',
        start_time: new Date().toISOString()
      });
      toast.success(`${stay.pet_names?.join(', ') || 'Pet'} checked in!`);
      fetchOvernights();
      setActionModalOpen(false);
    } catch (error) {
      toast.error('Failed to check in');
    }
  };

  // Check-out / Complete a stay
  const handleCheckOut = async (stay) => {
    try {
      await api.put(`/appointments/${stay.id}`, {
        status: 'completed',
        end_time: new Date().toISOString()
      });
      toast.success(`${stay.pet_names?.join(', ') || 'Pet'} checked out!`);
      fetchOvernights();
      setActionModalOpen(false);
      
      // Fetch service price for invoice
      try {
        const servicesRes = await api.get('/services');
        const service = servicesRes.data.find(s => 
          s.service_type === stay.service_type || 
          s.name?.toLowerCase().includes(stay.service_type?.toLowerCase().replace(/_/g, ' '))
        );
        setInvoiceServicePrice(service?.price || 0);
      } catch (e) {
        setInvoiceServicePrice(0);
      }
      
      // Show invoice prompt after checkout
      setInvoiceStay(stay);
      setInvoiceModalOpen(true);
    } catch (error) {
      toast.error('Failed to check out');
    }
  };

  // Invoice modal state
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [invoiceStay, setInvoiceStay] = useState(null);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [invoiceServicePrice, setInvoiceServicePrice] = useState(0);

  // Generate and send invoice
  const handleGenerateInvoice = async (sendEmail = false) => {
    if (!invoiceStay) return;
    setInvoiceLoading(true);
    
    try {
      // Create invoice using request body
      const invoiceRes = await api.post('/invoices', {
        client_id: invoiceStay.client_id,
        appointment_ids: [invoiceStay.id]
      });
      
      const newInvoiceId = invoiceRes.data?.id;
      
      if (sendEmail && newInvoiceId) {
        // Send invoice email to client
        try {
          await api.post(`/invoices/${newInvoiceId}/send-email`);
          toast.success('Invoice created and sent to client!');
        } catch (emailError) {
          toast.success('Invoice created! (Email sending not configured)');
        }
      } else {
        toast.success('Invoice created successfully!');
      }
      
      setInvoiceModalOpen(false);
      setInvoiceStay(null);
    } catch (error) {
      console.error('Invoice error:', error);
      toast.error(error.response?.data?.detail || 'Failed to create invoice');
    } finally {
      setInvoiceLoading(false);
    }
  };

  // Extend a stay
  const handleExtendStay = async () => {
    if (!selectedStay) return;
    try {
      const currentEnd = new Date(selectedStay.end_date || selectedStay.scheduled_date);
      currentEnd.setDate(currentEnd.getDate() + extendDays);
      const newEndDate = currentEnd.toISOString().split('T')[0];
      
      await api.put(`/appointments/${selectedStay.id}`, {
        end_date: newEndDate
      });
      toast.success(`Stay extended to ${newEndDate}`);
      fetchOvernights();
      setExtendModalOpen(false);
      setEndingTodayPrompt(prev => prev.filter(s => s.id !== selectedStay.id));
    } catch (error) {
      toast.error('Failed to extend stay');
    }
  };

  const openStayDetails = (stay) => {
    setSelectedStay(stay);
    setActionModalOpen(true);
  };

  // Calculate days remaining for a stay
  const getDaysRemaining = (stay, dateStr) => {
    if (!stay.end_date || stay.status === 'completed') return null;
    const endDate = new Date(stay.end_date);
    const currentViewDate = new Date(dateStr);
    const diffTime = endDate - currentViewDate;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 0 ? diffDays : null;
  };

  const openExtendModal = (stay) => {
    setSelectedStay(stay);
    setExtendDays(1);
    setExtendModalOpen(true);
  };

  // Get current week dates
  const getWeekDates = () => {
    const dates = [];
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      dates.push(date);
    }
    return dates;
  };

  const weekDates = getWeekDates();
  const today = new Date().toISOString().split('T')[0];

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
      <div className="space-y-4 px-2 sm:px-0" data-testid="admin-overnights-page">
        {/* Ending Today Alert */}
        {endingTodayPrompt.length > 0 && (
          <Card className="rounded-xl border-2 border-orange-400 bg-orange-50">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-6 h-6 text-orange-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold text-orange-800">Stays Ending Today</p>
                  <p className="text-sm text-orange-700 mb-3">The following stays are scheduled to end today. Do you need to extend?</p>
                  <div className="space-y-2">
                    {endingTodayPrompt.map(stay => (
                      <div key={stay.id} className="flex items-center justify-between p-2 bg-white rounded-lg">
                        <div>
                          <p className="font-medium">{stay.pet_names?.join(', ') || 'Pet'}</p>
                          <p className="text-xs text-muted-foreground">{stay.client_name}</p>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => openExtendModal(stay)} className="rounded-full">
                            Extend
                          </Button>
                          <Button size="sm" onClick={() => { setSelectedStay(stay); handleCheckOut(stay); }} className="rounded-full bg-green-600 hover:bg-green-700">
                            Complete
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-heading font-bold flex items-center gap-2">
              <Moon className="w-6 h-6 text-purple-600" />
              Overnights Calendar
            </h1>
            <p className="text-sm text-muted-foreground">Manage overnight stays and boardings</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchOvernights} className="rounded-full">
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={goToToday} className="rounded-full">
              Today
            </Button>
          </div>
        </div>

        {/* Week Navigation */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigateDate(-7)} className="rounded-full">
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <p className="font-medium text-sm">{formatDate(weekDates[0])} - {formatDate(weekDates[6])}</p>
          <Button variant="ghost" size="sm" onClick={() => navigateDate(7)} className="rounded-full">
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>

        {/* Week View */}
        <div className="grid grid-cols-1 sm:grid-cols-7 gap-2">
          {weekDates.map((date) => {
            const dateStr = date.toISOString().split('T')[0];
            const isToday = dateStr === today;
            const stays = getStaysForDate(dateStr);
            
            return (
              <Card 
                key={dateStr} 
                className={`rounded-xl ${isToday ? 'border-2 border-purple-500 bg-purple-50/50' : ''}`}
              >
                <CardHeader className="p-2 pb-1">
                  <p className={`text-xs font-medium ${isToday ? 'text-purple-700' : 'text-muted-foreground'}`}>
                    {date.toLocaleDateString('en-US', { weekday: 'short' })}
                  </p>
                  <p className={`text-lg font-bold ${isToday ? 'text-purple-700' : ''}`}>
                    {date.getDate()}
                  </p>
                </CardHeader>
                <CardContent className="p-2 pt-0 space-y-1">
                  {stays.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-2">-</p>
                  ) : (
                    stays.map(stay => {
                      const isStart = stay.scheduled_date === dateStr;
                      const isEnd = (stay.end_date || stay.scheduled_date) === dateStr;
                      const isMiddle = !isStart && !isEnd;
                      
                      // Determine display based on status
                      const isCheckInDay = stay.status === 'scheduled' && isStart;
                      const isCheckedIn = stay.status === 'in_progress';
                      const isCompleted = stay.status === 'completed';
                      
                      return (
                        <div
                          key={stay.id}
                          onClick={() => openStayDetails(stay)}
                          className={`p-2 rounded-lg cursor-pointer text-xs transition-colors hover:opacity-80 ${
                            isCheckInDay ? 'bg-red-50 border-2 border-red-400' :
                            isCheckedIn ? 'bg-green-50 border border-green-200' :
                            isCompleted ? 'bg-blue-50 border border-blue-200' :
                            'bg-amber-50'
                          }`}
                          data-testid={`overnight-stay-${stay.id}-${dateStr}`}
                        >
                          {/* Pet names - show all */}
                          <div className="flex items-center gap-1 mb-1">
                            <span className="font-medium truncate">
                              {stay.pet_names?.length > 0 
                                ? stay.pet_names.join(', ') 
                                : 'Pet'}
                            </span>
                          </div>
                          
                          {/* Days remaining - show for active stays */}
                          {isCheckedIn && !isEnd && getDaysRemaining(stay, dateStr) !== null && (
                            <p className="text-[10px] text-purple-600 font-medium mb-1">
                              {getDaysRemaining(stay, dateStr)} day{getDaysRemaining(stay, dateStr) !== 1 ? 's' : ''} left
                            </p>
                          )}
                          
                          {/* Status badges */}
                          <div className="space-y-0.5">
                            {isCheckInDay ? (
                              <p className="text-[11px] text-red-600 font-bold uppercase tracking-wide">
                                CHECK IN
                              </p>
                            ) : stay.status === 'scheduled' ? (
                              <p className="text-[10px] text-amber-600">
                                Awaiting check-in
                              </p>
                            ) : isCheckedIn ? (
                              <>
                                <div className="flex items-center gap-1">
                                  <CheckCircle className="w-3 h-3 text-green-600" />
                                  <p className="text-[10px] text-green-700 font-medium">Checked In</p>
                                </div>
                                {isEnd && (
                                  <p className="text-[10px] text-orange-600 font-medium">Check out today</p>
                                )}
                              </>
                            ) : isCompleted ? (
                              <>
                                <div className="flex items-center gap-1">
                                  <CheckCircle className="w-3 h-3 text-green-600" />
                                  <p className="text-[10px] text-green-700">Checked In</p>
                                </div>
                                <div className="flex items-center gap-1">
                                  <CheckCircle className="w-3 h-3 text-green-600" />
                                  <p className="text-[10px] text-green-700 font-medium">Checked Out</p>
                                </div>
                                {/* Invoice badge */}
                                {getInvoiceForAppointment(stay.id) ? (
                                  <div className="flex items-center gap-1 mt-1">
                                    <DollarSign className="w-3 h-3 text-blue-600" />
                                    <p className="text-[10px] text-blue-600 font-medium">Invoiced</p>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1 mt-1">
                                    <AlertTriangle className="w-3 h-3 text-amber-500" />
                                    <p className="text-[10px] text-amber-600">Not billed</p>
                                  </div>
                                )}
                              </>
                            ) : (
                              <p className="text-[10px] text-gray-600">{stay.status}</p>
                            )}
                          </div>
                          
                          <p className="text-[9px] text-muted-foreground truncate mt-0.5">
                            {stay.client_name?.split(' ')[0]}
                          </p>
                        </div>
                      );
                    })
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Active Stays Summary */}
        <Card className="rounded-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <PawPrint className="w-5 h-5 text-purple-600" />
              Currently Staying
            </CardTitle>
          </CardHeader>
          <CardContent>
            {overnights.filter(s => s.status === 'in_progress').length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No active stays</p>
            ) : (
              <div className="space-y-2">
                {overnights.filter(s => s.status === 'in_progress').map(stay => {
                  const todayStr = new Date().toISOString().split('T')[0];
                  const daysLeft = getDaysRemaining(stay, todayStr);
                  return (
                  <div
                    key={stay.id}
                    onClick={() => openStayDetails(stay)}
                    className="flex items-center justify-between p-3 rounded-lg bg-blue-50 cursor-pointer hover:bg-blue-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-200 flex items-center justify-center">
                        <PawPrint className="w-5 h-5 text-blue-700" />
                      </div>
                      <div>
                        <p className="font-medium">{stay.pet_names?.join(', ') || 'Pet'}</p>
                        <p className="text-xs text-muted-foreground">
                          {stay.client_name} • {getServiceLabel(stay.service_type)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {stay.scheduled_date} → {stay.end_date || stay.scheduled_date}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge className={`${getStatusColor(stay.status)} rounded-full`}>
                        Checked In
                      </Badge>
                      {daysLeft !== null && (
                        <p className="text-xs text-purple-600 font-medium mt-1">
                          {daysLeft} day{daysLeft !== 1 ? 's' : ''} left
                        </p>
                      )}
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Stay Details Modal */}
      <Dialog open={actionModalOpen} onOpenChange={setActionModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Moon className="w-5 h-5 text-purple-600" />
              Overnight Stay Details
            </DialogTitle>
          </DialogHeader>
          {selectedStay && (
            <div className="space-y-4 py-2">
              <div className="p-4 rounded-lg bg-purple-50">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-full bg-purple-200 flex items-center justify-center">
                    <PawPrint className="w-6 h-6 text-purple-700" />
                  </div>
                  <div>
                    <p className="font-bold text-lg">{selectedStay.pet_names?.join(', ') || 'Pet'}</p>
                    <p className="text-sm text-muted-foreground">{selectedStay.client_name}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-muted-foreground">Service</p>
                    <p className="font-medium">{getServiceLabel(selectedStay.service_type)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Status</p>
                    <Badge className={`${getStatusColor(selectedStay.status)} rounded-full`}>
                      {selectedStay.status}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Check-in Date</p>
                    <p className="font-medium">{selectedStay.scheduled_date}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Check-out Date</p>
                    <p className="font-medium">{selectedStay.end_date || selectedStay.scheduled_date}</p>
                  </div>
                </div>
              </div>
              
              <div className="flex flex-col gap-2">
                {selectedStay.status === 'scheduled' && (
                  <Button onClick={() => handleCheckIn(selectedStay)} className="rounded-full bg-green-600 hover:bg-green-700">
                    <LogIn className="w-4 h-4 mr-2" />
                    Check In
                  </Button>
                )}
                {selectedStay.status === 'in_progress' && (
                  <>
                    <Button onClick={() => { setActionModalOpen(false); openExtendModal(selectedStay); }} variant="outline" className="rounded-full">
                      <Plus className="w-4 h-4 mr-2" />
                      Extend Stay
                    </Button>
                    <Button onClick={() => handleCheckOut(selectedStay)} className="rounded-full bg-green-600 hover:bg-green-700">
                      <LogOut className="w-4 h-4 mr-2" />
                      Check Out & Complete
                    </Button>
                  </>
                )}
                {selectedStay.status === 'completed' && (
                  <>
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
                      <p className="font-medium text-green-800">Stay Completed</p>
                    </div>
                    
                    {/* Invoice Status */}
                    {(() => {
                      const invoice = getInvoiceForAppointment(selectedStay.id);
                      if (invoice) {
                        return (
                          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <DollarSign className="w-5 h-5 text-blue-600" />
                                <span className="font-medium text-blue-800">Invoice Created</span>
                              </div>
                              <Badge className={`rounded-full ${
                                invoice.status === 'paid' ? 'bg-green-500 text-white' :
                                invoice.status === 'overdue' ? 'bg-red-500 text-white' :
                                'bg-amber-100 text-amber-800'
                              }`}>
                                {invoice.status}
                              </Badge>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div>
                                <p className="text-blue-600 text-xs">Amount</p>
                                <p className="font-bold text-blue-800">${invoice.amount?.toFixed(2)}</p>
                              </div>
                              <div>
                                <p className="text-blue-600 text-xs">Due Date</p>
                                <p className="font-medium">{invoice.due_date}</p>
                              </div>
                            </div>
                            <Button 
                              onClick={() => navigate(`/admin/billing?invoice=${invoice.id}`)}
                              variant="outline"
                              size="sm"
                              className="w-full mt-3 rounded-full text-blue-600 border-blue-300"
                            >
                              View Invoice Details
                            </Button>
                          </div>
                        );
                      } else {
                        return (
                          <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                            <div className="flex items-center gap-2 mb-2">
                              <AlertTriangle className="w-5 h-5 text-amber-600" />
                              <span className="font-medium text-amber-800">Not Yet Billed</span>
                            </div>
                            <Button 
                              onClick={() => {
                                setActionModalOpen(false);
                                setInvoiceStay(selectedStay);
                                // Fetch service price
                                api.get('/services').then(res => {
                                  const service = res.data.find(s => 
                                    s.service_type === selectedStay.service_type || 
                                    s.name?.toLowerCase().includes(selectedStay.service_type?.toLowerCase().replace(/_/g, ' '))
                                  );
                                  setInvoiceServicePrice(service?.price || 0);
                                  setInvoiceModalOpen(true);
                                });
                              }}
                              className="w-full rounded-full bg-amber-500 hover:bg-amber-600 text-white"
                            >
                              <DollarSign className="w-4 h-4 mr-2" />
                              Create Invoice
                            </Button>
                          </div>
                        );
                      }
                    })()}
                  </>
                )}
                {/* Edit button - always available */}
                <Button 
                  onClick={() => { setActionModalOpen(false); openEditModal(selectedStay); }} 
                  variant="outline" 
                  className="rounded-full"
                >
                  <Calendar className="w-4 h-4 mr-2" />
                  Edit Dates
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Extend Stay Modal */}
      <Dialog open={extendModalOpen} onOpenChange={setExtendModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-blue-600" />
              Extend Stay
            </DialogTitle>
            <DialogDescription>
              Extend the stay for {selectedStay?.pet_names?.join(', ') || 'this pet'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground">Current check-out date</p>
              <p className="font-medium">{selectedStay?.end_date || selectedStay?.scheduled_date}</p>
            </div>
            <div className="space-y-2">
              <Label>Extend by</Label>
              <Select value={extendDays.toString()} onValueChange={(v) => setExtendDays(parseInt(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6, 7].map(d => (
                    <SelectItem key={d} value={d.toString()}>
                      {d} {d === 1 ? 'night' : 'nights'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExtendModalOpen(false)} className="rounded-full">
              Cancel
            </Button>
            <Button onClick={handleExtendStay} className="rounded-full">
              Extend Stay
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Stay Modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-600" />
              Edit Stay Dates
            </DialogTitle>
            <DialogDescription>
              Edit the dates for {selectedStay?.pet_names?.join(', ') || 'this pet'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-3 rounded-lg bg-purple-50">
              <p className="text-sm font-medium">{selectedStay?.pet_names?.join(', ') || 'Pet'}</p>
              <p className="text-xs text-muted-foreground">{selectedStay?.client_name} • {getServiceLabel(selectedStay?.service_type)}</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date (Check-in)</Label>
                <Input
                  type="date"
                  value={editForm.scheduled_date}
                  onChange={(e) => setEditForm({...editForm, scheduled_date: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label>End Date (Check-out)</Label>
                <Input
                  type="date"
                  value={editForm.end_date}
                  onChange={(e) => setEditForm({...editForm, end_date: e.target.value})}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={editForm.status} onValueChange={(v) => setEditForm({...editForm, status: v})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="scheduled">Scheduled (Not checked in)</SelectItem>
                  <SelectItem value="in_progress">In Progress (Checked in)</SelectItem>
                  <SelectItem value="completed">Completed (Checked out)</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditModalOpen(false)} className="rounded-full">
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} className="rounded-full">
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invoice Modal - shown after checkout */}
      <Dialog open={invoiceModalOpen} onOpenChange={setInvoiceModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-600" />
              Generate Invoice
            </DialogTitle>
            <DialogDescription>
              Create an invoice for this completed stay
            </DialogDescription>
          </DialogHeader>
          
          {invoiceStay && (
            <div className="space-y-4 py-4">
              {/* Stay Summary */}
              <div className="p-4 rounded-lg bg-green-50 border border-green-200">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-green-200 flex items-center justify-center">
                    <PawPrint className="w-5 h-5 text-green-700" />
                  </div>
                  <div>
                    <p className="font-bold">{invoiceStay.pet_names?.join(' & ') || 'Pet'}</p>
                    <p className="text-sm text-muted-foreground">{invoiceStay.client_name}</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-muted-foreground">Check-in</p>
                    <p className="font-medium">{invoiceStay.scheduled_date}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Check-out</p>
                    <p className="font-medium">{invoiceStay.end_date || invoiceStay.scheduled_date}</p>
                  </div>
                </div>
                
                {(() => {
                  const startDate = new Date(invoiceStay.scheduled_date);
                  const endDate = new Date(invoiceStay.end_date || invoiceStay.scheduled_date);
                  // Count calendar days inclusively (18th to 20th = 3 days)
                  const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
                  const servicePrice = invoiceServicePrice || 0;
                  const totalAmount = servicePrice * totalDays;
                  
                  return (
                    <div className="mt-3 pt-3 border-t border-green-200">
                      <div className="flex justify-between text-sm">
                        <span>{totalDays} day{totalDays > 1 ? 's' : ''} × ${servicePrice.toFixed(2)}</span>
                        <span className="font-bold text-lg text-green-700">${totalAmount.toFixed(2)}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
              
              {/* Action Buttons */}
              <div className="space-y-2">
                <Button 
                  onClick={() => handleGenerateInvoice(true)} 
                  className="w-full rounded-full bg-green-600 hover:bg-green-700"
                  disabled={invoiceLoading}
                >
                  <Mail className="w-4 h-4 mr-2" />
                  {invoiceLoading ? 'Sending...' : 'Create & Send Invoice'}
                </Button>
                <Button 
                  onClick={() => handleGenerateInvoice(false)} 
                  variant="outline"
                  className="w-full rounded-full"
                  disabled={invoiceLoading}
                >
                  <DollarSign className="w-4 h-4 mr-2" />
                  {invoiceLoading ? 'Creating...' : 'Create Invoice Only'}
                </Button>
                <Button 
                  onClick={() => { setInvoiceModalOpen(false); setInvoiceStay(null); }} 
                  variant="ghost"
                  className="w-full rounded-full text-muted-foreground"
                >
                  Skip for Now
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default AdminOvernightsPage;
