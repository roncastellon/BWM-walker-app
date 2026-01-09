import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { 
  Calendar, CreditCard, PawPrint, Clock, ArrowRight, MessageCircle, 
  User, Plus, DollarSign, CalendarPlus, Users, Eye, Send,
  TrendingUp, FileText, CheckCircle, Building2, UserPlus, Bell, X,
  Repeat, UserCog, AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Label } from '../components/ui/label';

const AdminDashboard = () => {
  const { user, api } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({});
  const [appointments, setAppointments] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [clients, setClients] = useState([]);
  const [walkers, setWalkers] = useState([]);
  const [sitters, setSitters] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [paysheets, setPaysheets] = useState([]);
  const [newClientNotifications, setNewClientNotifications] = useState([]);
  const [recurringSchedules, setRecurringSchedules] = useState([]);
  const [expandedClients, setExpandedClients] = useState({}); // Track expanded client sections
  
  // Walker change dialog state
  const [walkerChangeDialog, setWalkerChangeDialog] = useState({
    open: false,
    schedule: null,
    selectedWalkerId: '',
    changeType: 'one_time', // 'one_time' (first/default) or 'permanent'
    specificDate: ''
  });

  useEffect(() => {
    fetchData();
    fetchNewClientNotifications();
    fetchRecurringSchedules();
  }, []);

  const fetchRecurringSchedules = async () => {
    try {
      const res = await api.get('/recurring-schedules');
      setRecurringSchedules(res.data || []);
    } catch (error) {
      console.error('Failed to fetch recurring schedules');
    }
  };

  const fetchNewClientNotifications = async () => {
    try {
      const res = await api.get('/admin/new-client-notifications');
      setNewClientNotifications(res.data || []);
    } catch (error) {
      console.error('Failed to fetch new client notifications');
    }
  };

  const dismissNotification = async (notificationId) => {
    try {
      await api.put(`/admin/new-client-notifications/${notificationId}/dismiss`);
      setNewClientNotifications(prev => prev.filter(n => n.id !== notificationId));
    } catch (error) {
      toast.error('Failed to dismiss notification');
    }
  };

  const goToClientPricing = (clientId) => {
    navigate(`/admin/clients?highlight=${clientId}`);
  };

  // Open walker change dialog
  const openWalkerChangeDialog = (schedule) => {
    // Calculate next date for this schedule
    const dayNum = schedule.day_of_week;
    const today = new Date();
    const todayWeekday = today.getDay() === 0 ? 6 : today.getDay() - 1; // Convert to Mon=0 format
    let daysAhead = dayNum - todayWeekday;
    if (daysAhead <= 0) daysAhead += 7;
    const nextDate = new Date(today);
    nextDate.setDate(today.getDate() + daysAhead);
    
    setWalkerChangeDialog({
      open: true,
      schedule,
      selectedWalkerId: schedule.walker_id || '',
      changeType: 'one_time', // Default to one-time
      specificDate: nextDate.toISOString().split('T')[0]
    });
  };

  // Handle walker change submission
  const handleWalkerChange = async () => {
    if (!walkerChangeDialog.selectedWalkerId) {
      toast.error('Please select a walker');
      return;
    }

    try {
      const res = await api.put(
        `/recurring-schedules/${walkerChangeDialog.schedule.id}/change-walker?walker_id=${walkerChangeDialog.selectedWalkerId}&change_type=${walkerChangeDialog.changeType}&specific_date=${walkerChangeDialog.specificDate}`
      );
      
      if (walkerChangeDialog.changeType === 'one_time') {
        toast.success(`Walker changed for ${walkerChangeDialog.specificDate} only. Original walker will resume next week.`);
      } else {
        toast.success('Walker permanently changed for all future walks.');
      }
      
      setWalkerChangeDialog({ ...walkerChangeDialog, open: false });
      fetchRecurringSchedules();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to change walker');
    }
  };

  const getDayName = (dayNum) => {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    return days[dayNum] || 'Unknown';
  };

  const fetchData = async () => {
    try {
      const [statsRes, apptsRes, invoicesRes, clientsRes, walkersRes, sittersRes, contactsRes, paysheetsRes] = await Promise.all([
        api.get('/dashboard/stats'),
        api.get('/appointments/calendar'),
        api.get('/invoices'),
        api.get('/users/clients'),
        api.get('/users/walkers'),
        api.get('/sitters').catch(() => ({ data: [] })),
        api.get('/messages/contacts'),
        api.get('/paysheets'),
      ]);
      setStats(statsRes.data);
      setAppointments(apptsRes.data);
      setInvoices(invoicesRes.data);
      setClients(clientsRes.data || []);
      setWalkers(walkersRes.data || []);
      setSitters(sittersRes.data || []);
      setContacts(contactsRes.data || []);
      setPaysheets(paysheetsRes.data || []);
    } catch (error) {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const approvePaysheet = async (paysheetId) => {
    try {
      await api.put(`/paysheets/${paysheetId}/approve`);
      toast.success('Paysheet approved');
      fetchData();
    } catch (error) {
      toast.error('Failed to approve paysheet');
    }
  };

  const markPaysheetPaid = async (paysheetId) => {
    try {
      await api.put(`/paysheets/${paysheetId}/mark-paid`);
      toast.success('Paysheet marked as paid');
      fetchData();
    } catch (error) {
      toast.error('Failed to mark paysheet as paid');
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

  const todayAppts = appointments.filter(a => {
    const today = new Date().toISOString().split('T')[0];
    return a.scheduled_date === today;
  });
  const pendingInvoices = invoices.filter(inv => inv.status === 'pending' || inv.status === 'overdue');
  const pendingPaysheets = paysheets.filter(ts => !ts.paid);
  const walkerContacts = contacts.filter(c => c.role === 'walker');
  const clientContacts = contacts.filter(c => c.role === 'client');

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
      <div className="space-y-6" data-testid="admin-dashboard">
        {/* New Client Notifications */}
        {newClientNotifications.length > 0 && (
          <div className="space-y-2">
            {newClientNotifications.map((notification) => (
              <Card key={notification.id} className="rounded-xl border-2 border-amber-400 bg-amber-50">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center">
                        <UserPlus className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="font-semibold text-amber-900">New Client Needs Pricing!</p>
                        <p className="text-sm text-amber-700">{notification.client_name} has completed onboarding.</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button 
                        size="sm" 
                        className="bg-amber-500 hover:bg-amber-600 text-white"
                        onClick={() => goToClientPricing(notification.client_id)}
                      >
                        Set Pricing
                        <ArrowRight className="w-4 h-4 ml-1" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => dismissNotification(notification.id)}
                        className="text-amber-600 hover:text-amber-800"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Welcome Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-secondary p-6 text-primary-foreground">
          <div className="relative z-10">
            <h1 className="text-2xl lg:text-3xl font-heading font-bold mb-1">
              Admin Dashboard
            </h1>
            <p className="text-primary-foreground/80">
              Manage your pet care business
            </p>
          </div>
          <Badge className="absolute top-4 right-4 bg-white/20 text-white rounded-full">
            Administrator
          </Badge>
        </div>

        {/* Quick Stats - Clickable */}
        <div className="grid grid-cols-4 gap-3">
          <Link to="/admin/clients">
            <Card className="rounded-xl hover:shadow-md hover:bg-sky-50 transition-all cursor-pointer">
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold text-sky-600">{stats.total_clients || 0}</p>
                <p className="text-xs text-muted-foreground">Clients</p>
              </CardContent>
            </Card>
          </Link>
          <Link to="/admin/walkers">
            <Card className="rounded-xl hover:shadow-md hover:bg-orange-50 transition-all cursor-pointer">
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold text-orange-500">{(stats.total_walkers || 0) + sitters.length}</p>
                <p className="text-xs text-muted-foreground">Staff</p>
              </CardContent>
            </Card>
          </Link>
          <Link to="/admin/calendar">
            <Card className="rounded-xl hover:shadow-md hover:bg-sky-50 transition-all cursor-pointer">
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold text-sky-600">{todayAppts.length}</p>
                <p className="text-xs text-muted-foreground">Today</p>
              </CardContent>
            </Card>
          </Link>
          <Link to="/admin/billing">
            <Card className="rounded-xl hover:shadow-md hover:bg-orange-50 transition-all cursor-pointer">
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold text-orange-500">${(stats.month_revenue || 0).toFixed(0)}</p>
                <p className="text-xs text-muted-foreground">MTD Revenue</p>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Main Tabs */}
        <Tabs defaultValue="schedule" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 h-auto p-1">
            <TabsTrigger value="schedule" className="flex flex-col py-3 gap-1 data-[state=active]:bg-sky-500 data-[state=active]:text-white">
              <Calendar className="w-5 h-5" />
              <span className="text-xs">Schedule</span>
            </TabsTrigger>
            <Link to="/admin/billing" className="flex flex-col py-3 gap-1 items-center justify-center text-center rounded-md hover:bg-orange-100 transition-colors">
              <CreditCard className="w-5 h-5" />
              <span className="text-xs leading-tight">Billing &<br/>Payroll</span>
            </Link>
            <TabsTrigger value="chat" className="flex flex-col py-3 gap-1 data-[state=active]:bg-sky-500 data-[state=active]:text-white">
              <MessageCircle className="w-5 h-5" />
              <span className="text-xs">Chat</span>
            </TabsTrigger>
            <TabsTrigger value="profiles" className="flex flex-col py-3 gap-1 data-[state=active]:bg-orange-500 data-[state=active]:text-white">
              <Users className="w-5 h-5" />
              <span className="text-xs">Profiles</span>
            </TabsTrigger>
          </TabsList>

          {/* SCHEDULE TAB */}
          <TabsContent value="schedule" className="space-y-4">
            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-3">
              <Link to="/admin/calendar">
                <Card className="rounded-xl hover:shadow-md transition-all cursor-pointer h-full">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-sky-100 flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-sky-600" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">View Calendar</p>
                      <p className="text-xs text-muted-foreground">Team schedule</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
              <Link to="/admin/calendar">
                <Card className="rounded-xl hover:shadow-md transition-all cursor-pointer h-full">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                      <CalendarPlus className="w-5 h-5 text-orange-500" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">Add Appointment</p>
                      <p className="text-xs text-muted-foreground">Schedule new</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </div>

            {/* Today's Appointments */}
            <Card className="rounded-xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="w-5 h-5 text-primary" />
                  Today&apos;s Schedule
                  <Badge variant="secondary" className="rounded-full ml-2">{todayAppts.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {todayAppts.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    <Calendar className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No appointments today</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {todayAppts.slice(0, 5).map((appt) => (
                      <div
                        key={appt.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
                        onClick={() => navigate(`/admin/calendar?highlight=${appt.id}`)}
                      >
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-10 h-10 rounded-lg flex items-center justify-center"
                            style={{ backgroundColor: appt.walker_color ? `${appt.walker_color}20` : 'rgb(var(--primary) / 0.1)' }}
                          >
                            <PawPrint className="w-5 h-5" style={{ color: appt.walker_color || 'rgb(var(--primary))' }} />
                          </div>
                          <div>
                            <p className="font-medium text-sm capitalize">{appt.service_type?.replace('_', ' ')}</p>
                            <p className="text-xs text-muted-foreground">
                              {appt.scheduled_time} • {appt.pet_names?.length > 0 ? appt.pet_names.join(', ') : appt.client_name}
                            </p>
                          </div>
                        </div>
                        <Badge className={`${getStatusColor(appt.status)} rounded-full text-xs`}>
                          {appt.status}
                        </Badge>
                      </div>
                    ))}
                    {todayAppts.length > 5 && (
                      <Link to="/admin/calendar">
                        <Button variant="ghost" size="sm" className="w-full rounded-full">
                          View all {todayAppts.length} appointments
                        </Button>
                      </Link>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recurring Schedules Section - Grouped by Client */}
            <Card className="rounded-xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Repeat className="w-5 h-5 text-orange-500" />
                  Recurring Schedules
                  <Badge variant="secondary" className="rounded-full ml-2">
                    {recurringSchedules.filter(s => s.status === 'active').length}
                  </Badge>
                </CardTitle>
                <CardDescription>Grouped by client - click to expand</CardDescription>
              </CardHeader>
              <CardContent>
                {recurringSchedules.filter(s => s.status === 'active').length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No active recurring schedules</p>
                ) : (
                  <div className="space-y-2">
                    {/* Group schedules by client */}
                    {(() => {
                      const activeSchedules = recurringSchedules.filter(s => s.status === 'active');
                      const groupedByClient = activeSchedules.reduce((acc, schedule) => {
                        const clientId = schedule.client_id || 'unknown';
                        if (!acc[clientId]) {
                          acc[clientId] = [];
                        }
                        acc[clientId].push(schedule);
                        return acc;
                      }, {});
                      
                      return Object.entries(groupedByClient).map(([clientId, clientSchedules]) => {
                        const client = clients.find(c => c.id === clientId);
                        const isExpanded = expandedClients?.[clientId];
                        
                        return (
                          <div key={clientId} className="border rounded-xl overflow-hidden">
                            {/* Client Header - Clickable */}
                            <div
                              className="flex items-center justify-between p-3 bg-muted/30 hover:bg-muted/50 cursor-pointer transition-colors"
                              onClick={() => setExpandedClients(prev => ({
                                ...prev,
                                [clientId]: !prev?.[clientId]
                              }))}
                            >
                              <div className="flex items-center gap-3">
                                <Avatar className="w-8 h-8">
                                  <AvatarImage src={client?.profile_image} />
                                  <AvatarFallback className="bg-orange-100 text-orange-600 text-sm">
                                    {client?.full_name?.charAt(0) || '?'}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="font-medium text-sm">
                                    {client?.full_name || 'Unknown Client'}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {clientSchedules.length} schedule{clientSchedules.length !== 1 ? 's' : ''}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="rounded-full bg-orange-50 text-orange-700">
                                  {clientSchedules.length}
                                </Badge>
                                <svg
                                  className={`w-4 h-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </div>
                            </div>
                            
                            {/* Expanded Schedules */}
                            {isExpanded && (
                              <div className="border-t bg-background">
                                {clientSchedules.map((schedule) => {
                                  const walker = walkers.find(w => w.id === schedule.walker_id);
                                  return (
                                    <div
                                      key={schedule.id}
                                      className="flex items-center justify-between p-3 border-b last:border-b-0 hover:bg-muted/30 transition-colors"
                                    >
                                      <div className="flex items-center gap-3">
                                        <div className="p-1.5 rounded-lg bg-orange-100">
                                          <Repeat className="w-3 h-3 text-orange-600" />
                                        </div>
                                        <div>
                                          <p className="text-sm">
                                            {getDayName(schedule.day_of_week)} at {schedule.scheduled_time}
                                          </p>
                                          <p className="text-xs text-muted-foreground capitalize">
                                            {schedule.service_type?.replace('_', ' ') || 'Walk'}
                                          </p>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <Badge 
                                          variant="outline" 
                                          className={`rounded-full text-xs ${walker ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-500'}`}
                                        >
                                          {walker?.full_name || 'Unassigned'}
                                        </Badge>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="rounded-full h-7 w-7 p-0"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            openWalkerChangeDialog(schedule);
                                          }}
                                          title="Change Walker"
                                        >
                                          <UserCog className="w-3 h-3" />
                                        </Button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      });
                    })()}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* CHAT TAB */}
          <TabsContent value="chat" className="space-y-4">
            {/* Mass Text Quick Action */}
            <Link to="/admin/mass-text">
              <Card className="rounded-xl hover:shadow-md transition-all cursor-pointer bg-gradient-to-r from-primary/5 to-secondary/5 border-primary/20">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <MessageCircle className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">Send Mass Text</p>
                    <p className="text-sm text-muted-foreground">Text all clients, walkers, or everyone</p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>

            {/* Walkers/Sitters */}
            <Card className="rounded-xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <PawPrint className="w-5 h-5 text-secondary" />
                  Walkers / Sitters
                </CardTitle>
              </CardHeader>
              <CardContent>
                {walkerContacts.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No walkers or sitters</p>
                ) : (
                  <div className="space-y-2">
                    {walkerContacts.slice(0, 5).map((contact) => (
                      <Link to="/admin/chat" key={contact.id}>
                        <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                          <Avatar className="w-10 h-10">
                            <AvatarImage src={contact.profile_image} />
                            <AvatarFallback style={{ backgroundColor: contact.color ? `${contact.color}20` : 'rgb(var(--secondary) / 0.1)', color: contact.color || 'rgb(var(--secondary))' }}>
                              {contact.full_name?.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <p className="font-medium text-sm">{contact.full_name}</p>
                            <p className="text-xs text-muted-foreground">{contact.role === 'sitter' ? 'Sitter' : 'Walker'}</p>
                          </div>
                          <Send className="w-4 h-4 text-muted-foreground" />
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Clients */}
            <Card className="rounded-xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" />
                  Clients
                </CardTitle>
              </CardHeader>
              <CardContent>
                {clientContacts.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No clients</p>
                ) : (
                  <div className="space-y-2">
                    {clientContacts.slice(0, 5).map((contact) => (
                      <Link to="/admin/chat" key={contact.id}>
                        <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                          <Avatar className="w-10 h-10">
                            <AvatarImage src={contact.profile_image} />
                            <AvatarFallback className="bg-primary/10 text-primary">
                              {contact.full_name?.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <p className="font-medium text-sm">{contact.full_name}</p>
                            <p className="text-xs text-muted-foreground">Client</p>
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

          {/* PROFILES TAB */}
          <TabsContent value="profiles" className="space-y-4">
            {/* Clients Section */}
            <Card className="rounded-xl">
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" />
                  Clients
                  <Badge variant="secondary" className="rounded-full ml-1">{clients.length}</Badge>
                </CardTitle>
                <Link to="/admin/clients">
                  <Button size="sm" className="rounded-full">
                    <Plus className="w-4 h-4 mr-1" />
                    Add New
                  </Button>
                </Link>
              </CardHeader>
              <CardContent>
                {clients.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No clients yet</p>
                ) : (
                  <div className="space-y-2">
                    {clients.slice(0, 4).map((client) => (
                      <Link to="/admin/clients" key={client.id}>
                        <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                          <Avatar className="w-10 h-10">
                            <AvatarImage src={client.profile_image} />
                            <AvatarFallback className="bg-primary/10 text-primary">
                              {client.full_name?.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <p className="font-medium text-sm">{client.full_name}</p>
                            <p className="text-xs text-muted-foreground">{client.email}</p>
                          </div>
                          <Button size="sm" variant="ghost" className="rounded-full">
                            Edit
                          </Button>
                        </div>
                      </Link>
                    ))}
                    {clients.length > 4 && (
                      <Link to="/admin/clients">
                        <Button variant="ghost" size="sm" className="w-full rounded-full">
                          View all {clients.length} clients
                        </Button>
                      </Link>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Walkers / Sitters Section */}
            <Card className="rounded-xl">
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <PawPrint className="w-5 h-5 text-secondary" />
                  Walkers / Sitters
                  <Badge variant="secondary" className="rounded-full ml-1">{walkers.length + sitters.length}</Badge>
                </CardTitle>
                <Link to="/admin/walkers">
                  <Button size="sm" variant="secondary" className="rounded-full">
                    <Plus className="w-4 h-4 mr-1" />
                    Add New
                  </Button>
                </Link>
              </CardHeader>
              <CardContent>
                {walkers.length === 0 && sitters.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No walkers or sitters yet</p>
                ) : (
                  <div className="space-y-2">
                    {/* Show Walkers */}
                    {walkers.slice(0, 2).map((walker) => (
                      <Link to="/admin/walkers" key={walker.id}>
                        <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                          <Avatar className="w-10 h-10">
                            <AvatarImage src={walker.profile_image} />
                            <AvatarFallback style={{ backgroundColor: walker.color ? `${walker.color}20` : 'rgb(var(--secondary) / 0.1)', color: walker.color || 'rgb(var(--secondary))' }}>
                              {walker.full_name?.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <p className="font-medium text-sm">{walker.full_name}</p>
                            <p className="text-xs text-muted-foreground">Walker</p>
                          </div>
                          <Badge className="bg-sky-100 text-sky-700 rounded-full">Walker</Badge>
                        </div>
                      </Link>
                    ))}
                    {/* Show Sitters */}
                    {sitters.slice(0, 2).map((sitter) => (
                      <Link to="/admin/sitters" key={sitter.id}>
                        <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                          <Avatar className="w-10 h-10">
                            <AvatarImage src={sitter.profile_image} />
                            <AvatarFallback className="bg-orange-100 text-orange-600">
                              {sitter.full_name?.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <p className="font-medium text-sm">{sitter.full_name}</p>
                            <p className="text-xs text-muted-foreground">Sitter</p>
                          </div>
                          <Badge className="bg-orange-100 text-orange-700 rounded-full">Sitter</Badge>
                        </div>
                      </Link>
                    ))}
                    {(walkers.length > 2 || sitters.length > 2) && (
                      <Link to="/admin/walkers">
                        <Button variant="ghost" size="sm" className="w-full rounded-full">
                          View all {walkers.length + sitters.length} walkers/sitters
                        </Button>
                      </Link>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Admin Profile */}
            <Card className="rounded-xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <User className="w-5 h-5 text-primary" />
                  Admin Profile
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Link to="/admin/profile">
                  <div className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                    <Avatar className="w-12 h-12">
                      <AvatarImage src={user?.profile_image} />
                      <AvatarFallback className="bg-primary/10 text-primary text-lg">
                        {user?.full_name?.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-medium">{user?.full_name}</p>
                      <p className="text-sm text-muted-foreground">{user?.email}</p>
                    </div>
                    <Button size="sm" variant="outline" className="rounded-full">
                      Edit Profile
                    </Button>
                  </div>
                </Link>
                <Link to="/admin/billing">
                  <div className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="w-12 h-12 rounded-lg bg-secondary/10 flex items-center justify-center">
                      <Building2 className="w-6 h-6 text-secondary" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">Company Info</p>
                      <p className="text-sm text-muted-foreground">Logo, contact details</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </Link>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Walker Change Dialog */}
        <Dialog open={walkerChangeDialog.open} onOpenChange={(open) => setWalkerChangeDialog({...walkerChangeDialog, open})}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Change Walker</DialogTitle>
              <DialogDescription>
                Change walker for {walkerChangeDialog.schedule?.client_name || 'this schedule'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="walker-select">Select Walker</Label>
                <Select 
                  value={walkerChangeDialog.selectedWalkerId} 
                  onValueChange={(value) => setWalkerChangeDialog({...walkerChangeDialog, selectedWalkerId: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a walker" />
                  </SelectTrigger>
                  <SelectContent>
                    {walkers.map((walker) => (
                      <SelectItem key={walker.id} value={walker.id}>
                        {walker.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>Change Type</Label>
                <div className="space-y-2 mt-2">
                  <div className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id="one-time"
                      name="changeType"
                      value="one_time"
                      checked={walkerChangeDialog.changeType === 'one_time'}
                      onChange={(e) => setWalkerChangeDialog({...walkerChangeDialog, changeType: e.target.value})}
                      className="w-4 h-4"
                    />
                    <Label htmlFor="one-time" className="text-sm font-normal">
                      One-time change for {walkerChangeDialog.specificDate}
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id="permanent"
                      name="changeType"
                      value="permanent"
                      checked={walkerChangeDialog.changeType === 'permanent'}
                      onChange={(e) => setWalkerChangeDialog({...walkerChangeDialog, changeType: e.target.value})}
                      className="w-4 h-4"
                    />
                    <Label htmlFor="permanent" className="text-sm font-normal">
                      Permanent change for all future walks
                    </Label>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end space-x-2 pt-4">
                <Button 
                  variant="outline" 
                  onClick={() => setWalkerChangeDialog({...walkerChangeDialog, open: false})}
                >
                  Cancel
                </Button>
                <Button onClick={handleWalkerChange}>
                  Change Walker
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default AdminDashboard;
