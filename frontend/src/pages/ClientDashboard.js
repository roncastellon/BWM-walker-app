import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { 
  Calendar, CreditCard, PawPrint, Clock, ArrowRight, MessageCircle, 
  User, Plus, DollarSign, CalendarPlus, ShoppingBag, Eye, Send,
  Dog, Cat, Bird, CheckCircle, Edit2, X, Trash2, MapPin, Droplets, FileText, ChevronLeft, ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';

const ClientDashboard = () => {
  const { user, api } = useAuth();
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [pets, setPets] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);
  
  // Edit/Cancel appointment state
  const [selectedAppt, setSelectedAppt] = useState(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({ scheduled_date: '', scheduled_time: '', notes: '' });
  const [saving, setSaving] = useState(false);
  
  // Schedule view filter state
  const [scheduleView, setScheduleView] = useState('week'); // 'day', 'week', 'month'
  
  // Completed walks review state
  const [completedWalksDate, setCompletedWalksDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedCompletedWalk, setSelectedCompletedWalk] = useState(null);
  const [walkDetailModalOpen, setWalkDetailModalOpen] = useState(false);

  useEffect(() => {
    checkOnboardingStatus();
  }, []);

  const checkOnboardingStatus = async () => {
    try {
      const res = await api.get('/client/onboarding-status');
      if (res.data.needs_onboarding) {
        navigate('/client/onboarding');
        return;
      }
      setCheckingOnboarding(false);
      fetchData();
    } catch (error) {
      console.error('Failed to check onboarding status');
      setCheckingOnboarding(false);
      fetchData();
    }
  };

  const fetchData = async () => {
    try {
      const [apptsRes, invoicesRes, petsRes, contactsRes] = await Promise.all([
        api.get('/appointments'),
        api.get('/invoices'),
        api.get('/pets'),
        api.get('/messages/contacts'),
      ]);
      setAppointments(apptsRes.data);
      setInvoices(invoicesRes.data);
      setPets(petsRes.data);
      setContacts(contactsRes.data || []);
    } catch (error) {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (appt) => {
    setSelectedAppt(appt);
    setEditForm({
      scheduled_date: appt.scheduled_date,
      scheduled_time: appt.scheduled_time,
      notes: appt.notes || ''
    });
    setEditModalOpen(true);
  };

  const openCancelModal = (appt) => {
    setSelectedAppt(appt);
    setCancelModalOpen(true);
  };

  const handleEditSubmit = async () => {
    if (!selectedAppt) return;
    setSaving(true);
    try {
      await api.put(`/appointments/${selectedAppt.id}/client-edit`, null, {
        params: editForm
      });
      toast.success('Appointment updated successfully');
      setEditModalOpen(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update appointment');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelAppointment = async () => {
    if (!selectedAppt) return;
    setSaving(true);
    try {
      await api.post(`/appointments/${selectedAppt.id}/client-cancel`);
      toast.success('Appointment cancelled successfully');
      setCancelModalOpen(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to cancel appointment');
    } finally {
      setSaving(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'scheduled': return 'bg-sky-100 text-sky-800';
      case 'in_progress': return 'bg-orange-100 text-orange-800';
      case 'completed': return 'bg-sky-50 text-sky-700';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getSpeciesIcon = (species) => {
    switch (species?.toLowerCase()) {
      case 'cat': return <Cat className="w-5 h-5" />;
      case 'bird': return <Bird className="w-5 h-5" />;
      default: return <Dog className="w-5 h-5" />;
    }
  };

  const today = new Date().toISOString().split('T')[0];
  
  // Today's appointments only
  const todayAppts = appointments
    .filter(a => 
      (a.status === 'scheduled' || a.status === 'in_progress') &&
      a.scheduled_date === today
    )
    .sort((a, b) => (a.scheduled_time || '').localeCompare(b.scheduled_time || ''));
  
  // All upcoming appointments (for the "All Schedules" section)
  const upcomingAppts = appointments
    .filter(a => 
      (a.status === 'scheduled' || a.status === 'in_progress') &&
      a.scheduled_date >= today
    )
    .sort((a, b) => {
      // Sort by date first, then by time
      const dateCompare = a.scheduled_date?.localeCompare(b.scheduled_date || '');
      if (dateCompare !== 0) return dateCompare;
      return (a.scheduled_time || '').localeCompare(b.scheduled_time || '');
    });
  
  // Filter appointments based on selected view
  const getFilteredAppointments = () => {
    const now = new Date();
    const todayDate = now.toISOString().split('T')[0];
    
    let endDate;
    if (scheduleView === 'day') {
      endDate = todayDate;
    } else if (scheduleView === 'week') {
      const weekEnd = new Date(now);
      weekEnd.setDate(weekEnd.getDate() + 7);
      endDate = weekEnd.toISOString().split('T')[0];
    } else { // month
      const monthEnd = new Date(now);
      monthEnd.setMonth(monthEnd.getMonth() + 1);
      endDate = monthEnd.toISOString().split('T')[0];
    }
    
    return upcomingAppts.filter(a => a.scheduled_date <= endDate);
  };
  
  const filteredAppts = getFilteredAppointments();
  
  // Categorize appointments by service type
  const categorizeService = (serviceType) => {
    if (!serviceType) return 'other';
    const svc = serviceType.toLowerCase();
    if (svc.includes('walk')) return 'walks';
    if (svc.includes('day_care') || svc.includes('day_camp') || svc.includes('overnight') || svc.includes('boarding') || svc.includes('petsit')) return 'stays';
    if (svc.includes('transport') || svc.includes('concierge')) return 'transport';
    return 'other';
  };
  
  const walkAppts = filteredAppts.filter(a => categorizeService(a.service_type) === 'walks');
  const stayAppts = filteredAppts.filter(a => categorizeService(a.service_type) === 'stays');
  const transportAppts = filteredAppts.filter(a => categorizeService(a.service_type) === 'transport');
  const otherAppts = filteredAppts.filter(a => categorizeService(a.service_type) === 'other');
  
  const pendingInvoices = invoices.filter(inv => inv.status === 'pending' || inv.status === 'overdue');
  const walkerContacts = contacts.filter(c => c.role === 'walker');
  const adminContacts = contacts.filter(c => c.role === 'admin');
  
  // Completed walks for the selected date
  const completedWalks = appointments.filter(a => 
    a.status === 'completed' && 
    a.scheduled_date === completedWalksDate
  ).sort((a, b) => (a.scheduled_time || '').localeCompare(b.scheduled_time || ''));
  
  // Navigate completed walks date (within last 5 days)
  const navigateCompletedDate = (direction) => {
    const current = new Date(completedWalksDate + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const fiveDaysAgo = new Date(today);
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
    
    if (direction === 'prev') {
      current.setDate(current.getDate() - 1);
      if (current >= fiveDaysAgo) {
        setCompletedWalksDate(current.toISOString().split('T')[0]);
      }
    } else {
      current.setDate(current.getDate() + 1);
      if (current <= today) {
        setCompletedWalksDate(current.toISOString().split('T')[0]);
      }
    }
  };
  
  // Check if we can navigate (for disabling buttons)
  const canNavigatePrev = () => {
    const current = new Date(completedWalksDate + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const fiveDaysAgo = new Date(today);
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
    current.setDate(current.getDate() - 1);
    return current >= fiveDaysAgo;
  };
  
  const canNavigateNext = () => {
    const current = new Date(completedWalksDate + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    current.setDate(current.getDate() + 1);
    return current <= today;
  };
  
  // Open walk detail modal
  const openWalkDetail = (walk) => {
    setSelectedCompletedWalk(walk);
    setWalkDetailModalOpen(true);
  };
  
  // Format date for display
  const formatCompletedDate = (dateStr) => {
    const date = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (date.getTime() === today.getTime()) {
      return 'Today';
    }
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.getTime() === yesterday.getTime()) {
      return 'Yesterday';
    }
    
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  if (checkingOnboarding) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-orange-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading your profile...</p>
        </div>
      </div>
    );
  }

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
      <div className="space-y-6" data-testid="client-dashboard">
        {/* Welcome Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 p-6 text-white">
          <div className="relative z-10">
            <h1 className="text-2xl lg:text-3xl font-heading font-bold mb-1">
              Welcome, {user?.full_name?.split(' ')[0]}!
            </h1>
            <p className="text-white/80">
              Your pets are in great hands
            </p>
          </div>
          <div className="absolute right-4 bottom-0 opacity-10">
            <PawPrint className="w-32 h-32" />
          </div>
        </div>

        {/* Main Tabs */}
        <Tabs defaultValue="schedule" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 h-auto p-1">
            <TabsTrigger value="schedule" className="flex flex-col py-3 gap-1 data-[state=active]:bg-orange-500 data-[state=active]:text-white">
              <Calendar className="w-5 h-5" />
              <span className="text-xs">Schedule</span>
            </TabsTrigger>
            <TabsTrigger value="billing" className="flex flex-col py-3 gap-1 data-[state=active]:bg-sky-500 data-[state=active]:text-white">
              <CreditCard className="w-5 h-5" />
              <span className="text-xs">Billing</span>
            </TabsTrigger>
            <TabsTrigger value="chat" className="flex flex-col py-3 gap-1 data-[state=active]:bg-orange-500 data-[state=active]:text-white">
              <MessageCircle className="w-5 h-5" />
              <span className="text-xs">Chat</span>
            </TabsTrigger>
            <TabsTrigger value="profile" className="flex flex-col py-3 gap-1 data-[state=active]:bg-sky-500 data-[state=active]:text-white">
              <User className="w-5 h-5" />
              <span className="text-xs">Profile</span>
            </TabsTrigger>
          </TabsList>

          {/* SCHEDULE TAB */}
          <TabsContent value="schedule" className="space-y-4">
            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-3">
              <Link to="/schedule">
                <Card className="rounded-xl hover:shadow-md transition-all cursor-pointer h-full border-orange-200 hover:border-orange-300">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                      <CalendarPlus className="w-5 h-5 text-orange-600" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">Schedule New</p>
                      <p className="text-xs text-muted-foreground">Book a walk or stay</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
              <Link to="/schedule">
                <Card className="rounded-xl hover:shadow-md transition-all cursor-pointer h-full border-sky-200 hover:border-sky-300">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-sky-100 flex items-center justify-center">
                      <ShoppingBag className="w-5 h-5 text-sky-600" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">Other Services</p>
                      <p className="text-xs text-muted-foreground">Transport, concierge</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </div>

            {/* Today's Schedule */}
            <Card className="rounded-xl border-orange-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="w-5 h-5 text-orange-500" />
                  Today&apos;s Schedule
                  {todayAppts.length > 0 && (
                    <Badge className="bg-orange-500 text-white rounded-full ml-2">
                      {todayAppts.length}
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {todayAppts.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    <Calendar className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No appointments scheduled for today</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {todayAppts.map((appt) => (
                      <div
                        key={appt.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-orange-50/50 border border-orange-100"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                            <PawPrint className="w-5 h-5 text-orange-600" />
                          </div>
                          <div>
                            <p className="font-medium text-sm capitalize">{appt.service_type?.replace(/_/g, ' ')}</p>
                            <p className="text-xs text-muted-foreground">
                              {appt.scheduled_time || 'Time TBD'}
                              {appt.walker_name && ` • ${appt.walker_name}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={`${getStatusColor(appt.status)} rounded-full text-xs`}>
                            {appt.status}
                          </Badge>
                          {appt.status === 'scheduled' && (
                            <>
                              <Button size="sm" variant="ghost" onClick={() => openEditModal(appt)} className="h-8 w-8 p-0">
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => openCancelModal(appt)} className="h-8 w-8 p-0 text-destructive hover:text-destructive">
                                <X className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Completed Walks */}
            <Card className="rounded-xl border-green-200">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    Completed Walks
                  </CardTitle>
                  {/* Date Navigation */}
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0"
                      onClick={() => navigateCompletedDate('prev')}
                      disabled={!canNavigatePrev()}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-sm font-medium min-w-[80px] text-center">
                      {formatCompletedDate(completedWalksDate)}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0"
                      onClick={() => navigateCompletedDate('next')}
                      disabled={!canNavigateNext()}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <CardDescription>
                  Review walk details, routes, and notes (last 5 days)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {completedWalks.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    <CheckCircle className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No completed walks on {formatCompletedDate(completedWalksDate)}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {completedWalks.map((walk) => (
                      <div
                        key={walk.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-green-50/50 border border-green-100 cursor-pointer hover:bg-green-50 transition-colors"
                        onClick={() => openWalkDetail(walk)}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                            <CheckCircle className="w-5 h-5 text-green-600" />
                          </div>
                          <div>
                            <p className="font-medium text-sm capitalize">{walk.service_type?.replace(/_/g, ' ')}</p>
                            <p className="text-xs text-muted-foreground">
                              {walk.scheduled_time}
                              {walk.walker_name && ` • ${walk.walker_name}`}
                              {walk.actual_duration && ` • ${walk.actual_duration} min`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {/* Quick indicators */}
                          {walk.pee_count > 0 && (
                            <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-200 px-1.5">
                              🟡 {walk.pee_count}
                            </Badge>
                          )}
                          {walk.poop_count > 0 && (
                            <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200 px-1.5">
                              💩 {walk.poop_count}
                            </Badge>
                          )}
                          {walk.water_given && (
                            <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200 px-1.5">
                              💧
                            </Badge>
                          )}
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                            <Eye className="w-4 h-4 text-green-600" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* All My Schedules */}
            <Card className="rounded-xl">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between mb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-sky-500" />
                    All My Schedules
                  </CardTitle>
                  {filteredAppts.length > 0 && (
                    <Badge variant="secondary" className="rounded-full">
                      {filteredAppts.length}
                    </Badge>
                  )}
                </div>
                {/* View Toggle - on its own row */}
                <div className="flex gap-1 bg-muted rounded-full p-1 w-fit">
                  <Button
                    size="sm"
                    variant={scheduleView === 'day' ? 'default' : 'ghost'}
                    className={`rounded-full h-7 px-3 text-xs ${scheduleView === 'day' ? 'bg-sky-500 hover:bg-sky-600' : ''}`}
                    onClick={() => setScheduleView('day')}
                  >
                    Day
                  </Button>
                  <Button
                    size="sm"
                    variant={scheduleView === 'week' ? 'default' : 'ghost'}
                    className={`rounded-full h-7 px-3 text-xs ${scheduleView === 'week' ? 'bg-sky-500 hover:bg-sky-600' : ''}`}
                    onClick={() => setScheduleView('week')}
                  >
                    Week
                  </Button>
                  <Button
                    size="sm"
                    variant={scheduleView === 'month' ? 'default' : 'ghost'}
                    className={`rounded-full h-7 px-3 text-xs ${scheduleView === 'month' ? 'bg-sky-500 hover:bg-sky-600' : ''}`}
                    onClick={() => setScheduleView('month')}
                  >
                    Month
                  </Button>
                </div>
                <CardDescription className="mt-1">
                  {scheduleView === 'day' && 'Showing today only'}
                  {scheduleView === 'week' && 'Showing next 7 days'}
                  {scheduleView === 'month' && 'Showing next 30 days'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {filteredAppts.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    <Calendar className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No appointments for this period</p>
                    <Link to="/schedule">
                      <Button size="sm" className="mt-3 rounded-full bg-orange-500 hover:bg-orange-600">
                        Book Now
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-4 max-h-[500px] overflow-y-auto">
                    {/* Walks Section */}
                    {walkAppts.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <PawPrint className="w-4 h-4 text-orange-500" />
                          <p className="text-sm font-semibold text-orange-700">Walks ({walkAppts.length})</p>
                        </div>
                        <div className="space-y-2">
                          {walkAppts.map((appt) => {
                            const isToday = appt.scheduled_date === today;
                            return (
                              <div
                                key={appt.id}
                                className={`flex items-center justify-between p-2.5 rounded-lg border ${
                                  isToday ? 'bg-orange-50/50 border-orange-200' : 'bg-orange-50/20 border-orange-100'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center">
                                    <PawPrint className="w-4 h-4 text-orange-600" />
                                  </div>
                                  <div>
                                    <p className="font-medium text-sm capitalize">{appt.service_type?.replace(/_/g, ' ')}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {isToday ? 'Today' : new Date(appt.scheduled_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                      {appt.scheduled_time && ` • ${appt.scheduled_time}`}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Badge className={`${getStatusColor(appt.status)} rounded-full text-xs`}>{appt.status}</Badge>
                                  {appt.status === 'scheduled' && (
                                    <>
                                      <Button size="sm" variant="ghost" onClick={() => openEditModal(appt)} className="h-7 w-7 p-0"><Edit2 className="w-3 h-3" /></Button>
                                      <Button size="sm" variant="ghost" onClick={() => openCancelModal(appt)} className="h-7 w-7 p-0 text-destructive hover:text-destructive"><X className="w-3 h-3" /></Button>
                                    </>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Stays Section (Day Care, Overnights, Boarding) */}
                    {stayAppts.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Dog className="w-4 h-4 text-purple-500" />
                          <p className="text-sm font-semibold text-purple-700">Stays & Day Care ({stayAppts.length})</p>
                        </div>
                        <div className="space-y-2">
                          {stayAppts.map((appt) => {
                            const isToday = appt.scheduled_date === today;
                            return (
                              <div
                                key={appt.id}
                                className={`flex items-center justify-between p-2.5 rounded-lg border ${
                                  isToday ? 'bg-purple-50/50 border-purple-200' : 'bg-purple-50/20 border-purple-100'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
                                    <Dog className="w-4 h-4 text-purple-600" />
                                  </div>
                                  <div>
                                    <p className="font-medium text-sm capitalize">{appt.service_type?.replace(/_/g, ' ')}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {isToday ? 'Today' : new Date(appt.scheduled_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                      {appt.scheduled_time && ` • ${appt.scheduled_time}`}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Badge className={`${getStatusColor(appt.status)} rounded-full text-xs`}>{appt.status}</Badge>
                                  {appt.status === 'scheduled' && (
                                    <>
                                      <Button size="sm" variant="ghost" onClick={() => openEditModal(appt)} className="h-7 w-7 p-0"><Edit2 className="w-3 h-3" /></Button>
                                      <Button size="sm" variant="ghost" onClick={() => openCancelModal(appt)} className="h-7 w-7 p-0 text-destructive hover:text-destructive"><X className="w-3 h-3" /></Button>
                                    </>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Transport Section */}
                    {transportAppts.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <ArrowRight className="w-4 h-4 text-sky-500" />
                          <p className="text-sm font-semibold text-sky-700">Transport & Concierge ({transportAppts.length})</p>
                        </div>
                        <div className="space-y-2">
                          {transportAppts.map((appt) => {
                            const isToday = appt.scheduled_date === today;
                            return (
                              <div
                                key={appt.id}
                                className={`flex items-center justify-between p-2.5 rounded-lg border ${
                                  isToday ? 'bg-sky-50/50 border-sky-200' : 'bg-sky-50/20 border-sky-100'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-lg bg-sky-100 flex items-center justify-center">
                                    <ArrowRight className="w-4 h-4 text-sky-600" />
                                  </div>
                                  <div>
                                    <p className="font-medium text-sm capitalize">{appt.service_type?.replace(/_/g, ' ')}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {isToday ? 'Today' : new Date(appt.scheduled_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                      {appt.scheduled_time && ` • ${appt.scheduled_time}`}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Badge className={`${getStatusColor(appt.status)} rounded-full text-xs`}>{appt.status}</Badge>
                                  {appt.status === 'scheduled' && (
                                    <>
                                      <Button size="sm" variant="ghost" onClick={() => openEditModal(appt)} className="h-7 w-7 p-0"><Edit2 className="w-3 h-3" /></Button>
                                      <Button size="sm" variant="ghost" onClick={() => openCancelModal(appt)} className="h-7 w-7 p-0 text-destructive hover:text-destructive"><X className="w-3 h-3" /></Button>
                                    </>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Other Services Section */}
                    {otherAppts.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Calendar className="w-4 h-4 text-gray-500" />
                          <p className="text-sm font-semibold text-gray-700">Other Services ({otherAppts.length})</p>
                        </div>
                        <div className="space-y-2">
                          {otherAppts.map((appt) => {
                            const isToday = appt.scheduled_date === today;
                            return (
                              <div
                                key={appt.id}
                                className={`flex items-center justify-between p-2.5 rounded-lg border ${
                                  isToday ? 'bg-gray-50 border-gray-200' : 'bg-gray-50/50 border-gray-100'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                                    <Calendar className="w-4 h-4 text-gray-600" />
                                  </div>
                                  <div>
                                    <p className="font-medium text-sm capitalize">{appt.service_type?.replace(/_/g, ' ')}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {isToday ? 'Today' : new Date(appt.scheduled_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                      {appt.scheduled_time && ` • ${appt.scheduled_time}`}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Badge className={`${getStatusColor(appt.status)} rounded-full text-xs`}>{appt.status}</Badge>
                                  {appt.status === 'scheduled' && (
                                    <>
                                      <Button size="sm" variant="ghost" onClick={() => openEditModal(appt)} className="h-7 w-7 p-0"><Edit2 className="w-3 h-3" /></Button>
                                      <Button size="sm" variant="ghost" onClick={() => openCancelModal(appt)} className="h-7 w-7 p-0 text-destructive hover:text-destructive"><X className="w-3 h-3" /></Button>
                                    </>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* BILLING TAB */}
          <TabsContent value="billing" className="space-y-4">
            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-3">
              <Link to="/billing">
                <Card className="rounded-xl hover:shadow-md transition-all cursor-pointer h-full border-sky-200 hover:border-sky-300">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-sky-100 flex items-center justify-center">
                      <Eye className="w-5 h-5 text-sky-600" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">View My Bills</p>
                      <p className="text-xs text-muted-foreground">Invoice history</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
              <Link to="/billing">
                <Card className="rounded-xl hover:shadow-md transition-all cursor-pointer h-full border-orange-200 hover:border-orange-300">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                      <DollarSign className="w-5 h-5 text-orange-600" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">Pay My Bill</p>
                      <p className="text-xs text-muted-foreground">Make a payment</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </div>

            {/* Pending Bills */}
            <Card className="rounded-xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-orange-500" />
                  Pending Bills
                  {pendingInvoices.length > 0 && (
                    <Badge className="bg-orange-500 text-white rounded-full ml-2">
                      {pendingInvoices.length}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {pendingInvoices.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    <CheckCircle className="w-10 h-10 mx-auto mb-2 text-sky-500 opacity-70" />
                    <p className="text-sm">All bills paid!</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pendingInvoices.slice(0, 5).map((invoice) => (
                      <div
                        key={invoice.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-orange-50/50 border border-orange-100"
                      >
                        <div>
                          <p className="font-bold text-lg text-orange-600">${invoice.amount?.toFixed(2)}</p>
                          <p className="text-xs text-muted-foreground">Due: {invoice.due_date}</p>
                        </div>
                        <Link to="/billing">
                          <Button size="sm" className="rounded-full bg-orange-500 hover:bg-orange-600">
                            Pay Now
                          </Button>
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* CHAT TAB */}
          <TabsContent value="chat" className="space-y-4">
            {/* Admin Contacts */}
            <Card className="rounded-xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <MessageCircle className="w-5 h-5 text-primary" />
                  Admin
                </CardTitle>
              </CardHeader>
              <CardContent>
                {adminContacts.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No admin contacts</p>
                ) : (
                  <div className="space-y-2">
                    {adminContacts.map((contact) => (
                      <Link to="/messages" key={contact.id}>
                        <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                          <Avatar className="w-10 h-10">
                            <AvatarImage src={contact.profile_image} />
                            <AvatarFallback className="bg-primary/10 text-primary">
                              {contact.full_name?.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <p className="font-medium text-sm">{contact.full_name}</p>
                            <p className="text-xs text-muted-foreground">Administrator</p>
                          </div>
                          <Send className="w-4 h-4 text-muted-foreground" />
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* My Walkers */}
            <Card className="rounded-xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <PawPrint className="w-5 h-5 text-secondary" />
                  My Walkers
                </CardTitle>
              </CardHeader>
              <CardContent>
                {walkerContacts.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No walkers assigned yet</p>
                ) : (
                  <div className="space-y-2">
                    {walkerContacts.map((contact) => (
                      <Link to="/messages" key={contact.id}>
                        <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                          <Avatar className="w-10 h-10">
                            <AvatarImage src={contact.profile_image} />
                            <AvatarFallback className="bg-secondary/10 text-secondary">
                              {contact.full_name?.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <p className="font-medium text-sm">{contact.full_name}</p>
                            <p className="text-xs text-muted-foreground">Dog Walker</p>
                          </div>
                          <Send className="w-4 h-4 text-muted-foreground" />
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* PROFILE TAB */}
          <TabsContent value="profile" className="space-y-4">
            {/* Me */}
            <Link to="/profile">
              <Card className="rounded-xl hover:shadow-md transition-all cursor-pointer">
                <CardContent className="p-4 flex items-center gap-4">
                  <Avatar className="w-14 h-14">
                    <AvatarImage src={user?.profile_image} />
                    <AvatarFallback className="bg-primary/10 text-primary text-xl">
                      {user?.full_name?.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-medium">{user?.full_name}</p>
                    <p className="text-sm text-muted-foreground">{user?.email}</p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>

            {/* My Pets */}
            <Card className="rounded-xl">
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <PawPrint className="w-5 h-5 text-primary" />
                  My Pets
                </CardTitle>
                <Link to="/pets">
                  <Button size="sm" variant="ghost" className="rounded-full">
                    <Plus className="w-4 h-4 mr-1" />
                    Add
                  </Button>
                </Link>
              </CardHeader>
              <CardContent>
                {pets.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    <PawPrint className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No pets added yet</p>
                    <Link to="/pets">
                      <Button size="sm" className="mt-3 rounded-full">
                        Add Pet
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {pets.map((pet) => (
                      <Link to="/pets" key={pet.id}>
                        <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                          <Avatar className="w-10 h-10">
                            <AvatarImage src={pet.photo_url} />
                            <AvatarFallback className="bg-primary/10">
                              {getSpeciesIcon(pet.species)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <p className="font-medium text-sm">{pet.name}</p>
                            <p className="text-xs text-muted-foreground capitalize">
                              {pet.breed || pet.species}
                              {pet.age && ` • ${pet.age} yrs`}
                            </p>
                          </div>
                          <ArrowRight className="w-4 h-4 text-muted-foreground" />
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit Appointment Modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Appointment</DialogTitle>
            <DialogDescription>
              Update the date, time, or add notes for this appointment.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-date">Date</Label>
              <Input
                id="edit-date"
                type="date"
                value={editForm.scheduled_date}
                onChange={(e) => setEditForm({ ...editForm, scheduled_date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-time">Time</Label>
              <Input
                id="edit-time"
                type="time"
                value={editForm.scheduled_time}
                onChange={(e) => setEditForm({ ...editForm, scheduled_time: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-notes">Notes (optional)</Label>
              <Input
                id="edit-notes"
                placeholder="Special instructions..."
                value={editForm.notes}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditModalOpen(false)}>Cancel</Button>
            <Button onClick={handleEditSubmit} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Appointment Modal */}
      <Dialog open={cancelModalOpen} onOpenChange={setCancelModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="w-5 h-5" />
              Cancel Appointment
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel this appointment? There is no cancellation fee.
            </DialogDescription>
          </DialogHeader>
          {selectedAppt && (
            <div className="p-4 rounded-lg bg-muted/50 my-4">
              <p className="font-medium capitalize">{selectedAppt.service_type?.replace('_', ' ')}</p>
              <p className="text-sm text-muted-foreground">
                {selectedAppt.scheduled_date} at {selectedAppt.scheduled_time}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelModalOpen(false)}>Keep Appointment</Button>
            <Button variant="destructive" onClick={handleCancelAppointment} disabled={saving}>
              {saving ? 'Cancelling...' : 'Yes, Cancel'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Walk Detail Modal */}
      <Dialog open={walkDetailModalOpen} onOpenChange={setWalkDetailModalOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              Walk Details
            </DialogTitle>
            <DialogDescription>
              {selectedCompletedWalk && (
                <>
                  {new Date(selectedCompletedWalk.scheduled_date + 'T00:00:00').toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                  {selectedCompletedWalk.scheduled_time && ` at ${selectedCompletedWalk.scheduled_time}`}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          
          {selectedCompletedWalk && (
            <div className="space-y-4">
              {/* Service & Walker Info */}
              <div className="p-3 rounded-lg bg-green-50 border border-green-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium capitalize">{selectedCompletedWalk.service_type?.replace(/_/g, ' ')}</p>
                    <p className="text-sm text-muted-foreground">
                      Walker: {selectedCompletedWalk.walker_name || 'Not assigned'}
                    </p>
                  </div>
                  {selectedCompletedWalk.actual_duration && (
                    <Badge className="bg-green-100 text-green-700">
                      {selectedCompletedWalk.actual_duration} min
                    </Badge>
                  )}
                </div>
              </div>

              {/* Pee, Poop & Water Status */}
              <div className="grid grid-cols-3 gap-2">
                <div className="p-3 rounded-lg bg-yellow-50 border border-yellow-100 text-center">
                  <Droplets className="w-5 h-5 mx-auto text-yellow-500 mb-1" />
                  <p className="text-xl font-bold text-yellow-700">{selectedCompletedWalk.pee_count || 0}</p>
                  <p className="text-xs text-yellow-600">Pee</p>
                </div>
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-100 text-center">
                  <span className="text-xl">💩</span>
                  <p className="text-xl font-bold text-amber-700">{selectedCompletedWalk.poop_count || 0}</p>
                  <p className="text-xs text-amber-600">Poop</p>
                </div>
                <div className={`p-3 rounded-lg text-center ${selectedCompletedWalk.water_given ? 'bg-blue-50 border border-blue-100' : 'bg-gray-50 border border-gray-100'}`}>
                  <span className="text-xl">💧</span>
                  <p className={`text-xl font-bold ${selectedCompletedWalk.water_given ? 'text-blue-700' : 'text-gray-400'}`}>
                    {selectedCompletedWalk.water_given ? '✓' : '—'}
                  </p>
                  <p className={`text-xs ${selectedCompletedWalk.water_given ? 'text-blue-600' : 'text-gray-400'}`}>Water</p>
                </div>
              </div>

              {/* Walker Notes */}
              {selectedCompletedWalk.walker_notes && (
                <div className="p-3 rounded-lg bg-sky-50 border border-sky-100">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="w-4 h-4 text-sky-500" />
                    <p className="font-medium text-sm text-sky-700">Walker Notes</p>
                  </div>
                  <p className="text-sm text-gray-700">{selectedCompletedWalk.walker_notes}</p>
                </div>
              )}

              {/* GPS Route */}
              {selectedCompletedWalk.gps_route && selectedCompletedWalk.gps_route.length > 0 ? (
                <div className="p-3 rounded-lg bg-blue-50 border border-blue-100">
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="w-4 h-4 text-blue-500" />
                    <p className="font-medium text-sm text-blue-700">Walk Route</p>
                  </div>
                  <div className="aspect-video bg-gray-200 rounded-lg overflow-hidden relative">
                    {/* Simple route visualization */}
                    <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                      <div className="text-center">
                        <MapPin className="w-8 h-8 mx-auto mb-2 text-blue-500" />
                        <p className="text-sm">{selectedCompletedWalk.gps_route.length} GPS points recorded</p>
                        {selectedCompletedWalk.distance_miles && (
                          <p className="text-xs text-gray-400 mt-1">
                            Distance: {selectedCompletedWalk.distance_miles.toFixed(2)} miles
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-lg bg-gray-50 border border-gray-100 text-center">
                  <MapPin className="w-6 h-6 mx-auto text-gray-400 mb-1" />
                  <p className="text-sm text-gray-500">No GPS route recorded</p>
                </div>
              )}

              {/* Timestamps */}
              <div className="grid grid-cols-2 gap-3 text-center text-sm">
                {selectedCompletedWalk.started_at && (
                  <div className="p-2 rounded bg-gray-50">
                    <p className="text-xs text-gray-500">Started</p>
                    <p className="font-medium">
                      {new Date(selectedCompletedWalk.started_at).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                )}
                {selectedCompletedWalk.completed_at && (
                  <div className="p-2 rounded bg-gray-50">
                    <p className="text-xs text-gray-500">Completed</p>
                    <p className="font-medium">
                      {new Date(selectedCompletedWalk.completed_at).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button onClick={() => setWalkDetailModalOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default ClientDashboard;
