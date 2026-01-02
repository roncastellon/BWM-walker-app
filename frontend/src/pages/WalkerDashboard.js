import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { 
  Calendar, CreditCard, PawPrint, Clock, ArrowRight, MessageCircle, 
  User, DollarSign, Play, Square, Navigation, MapPin, Smartphone,
  AlertTriangle, CheckCircle, Send, Users, FileText
} from 'lucide-react';
import { toast } from 'sonner';

const WalkerDashboard = () => {
  const { user, api } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({});
  const [todayAppointments, setTodayAppointments] = useState([]);
  const [nextWalk, setNextWalk] = useState(null);
  const [activeWalk, setActiveWalk] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [startingWalk, setStartingWalk] = useState(false);
  const timerRef = useRef(null);
  
  // GPS Permission Dialog State
  const [gpsDialogOpen, setGpsDialogOpen] = useState(false);
  const [gpsStatus, setGpsStatus] = useState('checking');
  const [pendingWalkId, setPendingWalkId] = useState(null);

  useEffect(() => {
    fetchData();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (activeWalk) {
      timerRef.current = setInterval(() => {
        const start = new Date(activeWalk.start_time);
        const now = new Date();
        setElapsedTime(Math.floor((now - start) / 1000));
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setElapsedTime(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeWalk]);

  const fetchData = async () => {
    try {
      const [statsRes, apptsRes, contactsRes] = await Promise.all([
        api.get('/dashboard/stats'),
        api.get('/appointments'),
        api.get('/messages/contacts'),
      ]);
      setStats(statsRes.data);
      setContacts(contactsRes.data || []);
      
      const today = new Date().toISOString().split('T')[0];
      const now = new Date();
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      
      const todayAppts = apptsRes.data
        .filter(a => a.scheduled_date === today)
        .sort((a, b) => a.scheduled_time.localeCompare(b.scheduled_time));
      
      setTodayAppointments(todayAppts);
      
      const active = apptsRes.data.find(a => a.status === 'in_progress');
      if (active) {
        setActiveWalk(active);
        setNextWalk(null);
      } else {
        const nextScheduled = todayAppts.find(a => 
          a.status === 'scheduled' && a.scheduled_time >= currentTime
        ) || todayAppts.find(a => a.status === 'scheduled');
        setNextWalk(nextScheduled || null);
      }
    } catch (error) {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const startWalk = async (apptId) => {
    setPendingWalkId(apptId);
    setGpsStatus('checking');
    setGpsDialogOpen(true);
    
    if (!navigator.geolocation) {
      setGpsStatus('unavailable');
      return;
    }
    
    if (navigator.permissions) {
      try {
        const permission = await navigator.permissions.query({ name: 'geolocation' });
        if (permission.state === 'granted') {
          setGpsStatus('granted');
        } else if (permission.state === 'denied') {
          setGpsStatus('denied');
        } else {
          setGpsStatus('prompt');
        }
      } catch {
        setGpsStatus('prompt');
      }
    } else {
      setGpsStatus('prompt');
    }
  };

  const requestGpsPermission = () => {
    setGpsStatus('requesting');
    navigator.geolocation.getCurrentPosition(
      () => {
        setGpsStatus('granted');
        toast.success('GPS tracking enabled!');
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          setGpsStatus('denied');
        } else {
          setGpsStatus('error');
        }
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const confirmStartWalk = async (withGps = true) => {
    if (!pendingWalkId) return;
    
    setStartingWalk(true);
    setGpsDialogOpen(false);
    
    try {
      if (withGps && navigator.geolocation && gpsStatus === 'granted') {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            try {
              await api.post(`/appointments/${pendingWalkId}/start-tracking`, null, {
                params: { lat: position.coords.latitude, lng: position.coords.longitude }
              });
              toast.success('Walk started with GPS tracking!');
              navigate('/tracking');
            } catch {
              await startWalkWithoutGps();
            }
            fetchData();
          },
          async () => { await startWalkWithoutGps(); },
          { enableHighAccuracy: true, timeout: 10000 }
        );
      } else {
        await startWalkWithoutGps();
      }
    } catch {
      toast.error('Failed to start walk');
    } finally {
      setStartingWalk(false);
      setPendingWalkId(null);
    }
  };

  const startWalkWithoutGps = async () => {
    try {
      const response = await api.post(`/appointments/${pendingWalkId}/start`);
      toast.success('Walk started!');
      setActiveWalk({
        ...todayAppointments.find(a => a.id === pendingWalkId),
        start_time: response.data.start_time,
        status: 'in_progress'
      });
      setNextWalk(null);
      fetchData();
    } catch {
      toast.error('Failed to start walk');
    }
  };

  const endWalk = async () => {
    if (!activeWalk) return;
    try {
      try {
        await api.post(`/appointments/${activeWalk.id}/stop-tracking`);
      } catch {
        await api.post(`/appointments/${activeWalk.id}/end`);
      }
      toast.success('Walk completed!');
      setActiveWalk(null);
      fetchData();
    } catch {
      toast.error('Failed to end walk');
    }
  };

  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${mins}:${String(secs).padStart(2, '0')}`;
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

  const clientContacts = contacts.filter(c => c.role === 'client');
  const adminContacts = contacts.filter(c => c.role === 'admin');

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
      <div className="space-y-6" data-testid="walker-dashboard">
        {/* Welcome Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-secondary/90 to-secondary p-6 text-secondary-foreground">
          <div className="relative z-10">
            <h1 className="text-2xl lg:text-3xl font-heading font-bold mb-1">
              Welcome, {user?.full_name?.split(' ')[0]}!
            </h1>
            <p className="text-secondary-foreground/80">
              {todayAppointments.length} walks scheduled today
            </p>
          </div>
          <div className="absolute right-4 bottom-0 opacity-10">
            <PawPrint className="w-32 h-32" />
          </div>
        </div>

        {/* Active Walk Banner */}
        {activeWalk && (
          <Card className="rounded-xl border-2 border-primary bg-primary/5">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center">
                    <Navigation className="w-6 h-6 text-primary-foreground animate-pulse" />
                  </div>
                  <div>
                    <Badge className="bg-orange-500 text-white rounded-full mb-1">In Progress</Badge>
                    <p className="font-medium capitalize">{activeWalk.service_type?.replace('_', ' ')}</p>
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-mono font-bold text-primary">{formatTime(elapsedTime)}</p>
                </div>
                <Button onClick={endWalk} variant="destructive" className="rounded-full">
                  <Square className="w-4 h-4 mr-2" />
                  End Walk
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Next Walk Banner */}
        {!activeWalk && nextWalk && (
          <Card className="rounded-xl border-2 border-secondary bg-secondary/5">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center">
                    <PawPrint className="w-6 h-6 text-secondary-foreground" />
                  </div>
                  <div>
                    <Badge className="bg-sky-100 text-sky-800 rounded-full mb-1">Up Next</Badge>
                    <p className="font-medium capitalize">{nextWalk.service_type?.replace('_', ' ')}</p>
                    <p className="text-xs text-muted-foreground">{nextWalk.scheduled_time} • {nextWalk.client_name}</p>
                  </div>
                </div>
                <Button 
                  onClick={() => startWalk(nextWalk.id)} 
                  disabled={startingWalk}
                  className="rounded-full bg-secondary hover:bg-secondary/90 text-secondary-foreground"
                >
                  <Play className="w-4 h-4 mr-2" />
                  Start Walk
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Tabs */}
        <Tabs defaultValue="schedule" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 h-auto p-1">
            <TabsTrigger value="schedule" className="flex flex-col py-3 gap-1 data-[state=active]:bg-sky-500 data-[state=active]:text-white">
              <Calendar className="w-5 h-5" />
              <span className="text-xs">Schedule</span>
            </TabsTrigger>
            <TabsTrigger value="payroll" className="flex flex-col py-3 gap-1 data-[state=active]:bg-sky-500 data-[state=active]:text-white">
              <DollarSign className="w-5 h-5" />
              <span className="text-xs">Payroll</span>
            </TabsTrigger>
            <TabsTrigger value="chat" className="flex flex-col py-3 gap-1 data-[state=active]:bg-sky-500 data-[state=active]:text-white">
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
              <Link to="/walker/schedule">
                <Card className="rounded-xl hover:shadow-md transition-all cursor-pointer h-full">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-secondary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">My Schedule</p>
                      <p className="text-xs text-muted-foreground">View full calendar</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
              <Link to="/tracking">
                <Card className="rounded-xl hover:shadow-md transition-all cursor-pointer h-full">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Navigation className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">Walk Tracking</p>
                      <p className="text-xs text-muted-foreground">GPS & route</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </div>

            {/* Today's Schedule */}
            <Card className="rounded-xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="w-5 h-5 text-secondary" />
                  Today's Walks
                  <Badge variant="secondary" className="rounded-full ml-2">{todayAppointments.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {todayAppointments.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    <Calendar className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No walks scheduled today</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {todayAppointments.map((appt) => (
                      <div
                        key={appt.id}
                        className={`flex items-center justify-between p-3 rounded-lg ${
                          appt.status === 'in_progress' ? 'bg-orange-100 border border-orange-400' :
                          appt.status === 'completed' ? 'bg-sky-50' : 'bg-muted/50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            appt.status === 'in_progress' ? 'bg-orange-500 text-white' :
                            appt.status === 'completed' ? 'bg-sky-100 text-sky-600' :
                            'bg-sky-100 text-sky-600'
                          }`}>
                            {appt.status === 'completed' ? <CheckCircle className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                          </div>
                          <div>
                            <p className="font-medium text-sm capitalize">{appt.service_type?.replace('_', ' ')}</p>
                            <p className="text-xs text-muted-foreground">{appt.scheduled_time} • {appt.client_name}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={`${getStatusColor(appt.status)} rounded-full text-xs`}>
                            {appt.status?.replace('_', ' ')}
                          </Badge>
                          {appt.status === 'scheduled' && !activeWalk && (
                            <Button size="sm" variant="outline" onClick={() => startWalk(appt.id)} className="rounded-full">
                              <Play className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* PAYROLL TAB */}
          <TabsContent value="payroll" className="space-y-4">
            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-3">
              <Link to="/walker/payroll">
                <Card className="rounded-xl hover:shadow-md transition-all cursor-pointer h-full">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-sky-100 flex items-center justify-center">
                      <CheckCircle className="w-5 h-5 text-sky-600" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">Completed Walks/Stays</p>
                      <p className="text-xs text-muted-foreground">View history</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
              <Link to="/walker/payroll">
                <Card className="rounded-xl hover:shadow-md transition-all cursor-pointer h-full">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <FileText className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">Billing Sheet</p>
                      <p className="text-xs text-muted-foreground">Weekly summary</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </div>

            {/* Stats Summary */}
            <Card className="rounded-xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-secondary" />
                  This Week
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center p-3 rounded-lg bg-muted/50">
                    <p className="text-2xl font-bold text-secondary">{stats.completed_walks || 0}</p>
                    <p className="text-xs text-muted-foreground">Walks Done</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-muted/50">
                    <p className="text-2xl font-bold text-primary">{stats.pending_appointments || 0}</p>
                    <p className="text-xs text-muted-foreground">Pending</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-muted/50">
                    <p className="text-2xl font-bold text-green-600">{stats.todays_appointments || 0}</p>
                    <p className="text-xs text-muted-foreground">Today</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* CHAT TAB */}
          <TabsContent value="chat" className="space-y-4">
            {/* Admin */}
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
                      <Link to="/walker/chat" key={contact.id}>
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

            {/* My Clients */}
            <Card className="rounded-xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="w-5 h-5 text-secondary" />
                  My Clients
                </CardTitle>
              </CardHeader>
              <CardContent>
                {clientContacts.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No clients assigned</p>
                ) : (
                  <div className="space-y-2">
                    {clientContacts.slice(0, 5).map((contact) => (
                      <Link to="/walker/chat" key={contact.id}>
                        <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                          <Avatar className="w-10 h-10">
                            <AvatarImage src={contact.profile_image} />
                            <AvatarFallback className="bg-secondary/10 text-secondary">
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

          {/* PROFILE TAB */}
          <TabsContent value="profile" className="space-y-4">
            {/* Me */}
            <Link to="/walker/profile">
              <Card className="rounded-xl hover:shadow-md transition-all cursor-pointer">
                <CardContent className="p-4 flex items-center gap-4">
                  <Avatar className="w-14 h-14">
                    <AvatarImage src={user?.profile_image} />
                    <AvatarFallback className="bg-secondary/10 text-secondary text-xl">
                      {user?.full_name?.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-medium">{user?.full_name}</p>
                    <p className="text-sm text-muted-foreground">{user?.email}</p>
                  </div>
                  <Badge className="bg-secondary/10 text-secondary rounded-full">Walker</Badge>
                </CardContent>
              </Card>
            </Link>

            {/* Stats */}
            <Card className="rounded-xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  My Stats
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  <div className="text-center p-4 rounded-lg bg-green-50">
                    <p className="text-3xl font-bold text-green-600">{stats.completed_walks || 0}</p>
                    <p className="text-sm text-muted-foreground">Total Completed</p>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-secondary/10">
                    <p className="text-3xl font-bold text-secondary">{stats.todays_appointments || 0}</p>
                    <p className="text-sm text-muted-foreground">Today's Walks</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* GPS Permission Dialog */}
      <Dialog open={gpsDialogOpen} onOpenChange={setGpsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Navigation className="w-5 h-5 text-primary" />
              Enable GPS Tracking
            </DialogTitle>
            <DialogDescription>
              Track your walk route for clients to see in real-time
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {gpsStatus === 'checking' && (
              <div className="flex items-center justify-center py-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            )}
            
            {gpsStatus === 'unavailable' && (
              <div className="p-4 rounded-xl bg-red-50 border border-red-200">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5" />
                  <div>
                    <p className="font-medium text-red-800">GPS Not Available</p>
                    <p className="text-sm text-red-600 mt-1">You can still start the walk without tracking.</p>
                  </div>
                </div>
              </div>
            )}
            
            {gpsStatus === 'denied' && (
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5" />
                  <div>
                    <p className="font-medium text-amber-800">Location Access Blocked</p>
                    <p className="text-sm text-amber-600 mt-1">Enable location in your browser/device settings.</p>
                  </div>
                </div>
              </div>
            )}
            
            {(gpsStatus === 'prompt' || gpsStatus === 'requesting') && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
                  <div className="flex items-start gap-3">
                    <Smartphone className="w-5 h-5 text-primary mt-0.5" />
                    <div>
                      <p className="font-medium">Allow Location Access</p>
                      <p className="text-sm text-muted-foreground mt-1">Tap below and allow when prompted.</p>
                    </div>
                  </div>
                </div>
                <Button onClick={requestGpsPermission} className="w-full rounded-full" disabled={gpsStatus === 'requesting'}>
                  {gpsStatus === 'requesting' ? 'Requesting...' : <><MapPin className="w-4 h-4 mr-2" />Enable Location</>}
                </Button>
              </div>
            )}
            
            {gpsStatus === 'granted' && (
              <div className="p-4 rounded-xl bg-green-50 border border-green-200">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                  <div>
                    <p className="font-medium text-green-800">GPS Ready!</p>
                    <p className="text-sm text-green-600 mt-1">Your route will be tracked.</p>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          <DialogFooter className="flex gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setGpsDialogOpen(false)} className="flex-1">Cancel</Button>
            {gpsStatus === 'granted' ? (
              <Button onClick={() => confirmStartWalk(true)} disabled={startingWalk} className="flex-1 rounded-full">
                <Play className="w-4 h-4 mr-2" />Start Walk
              </Button>
            ) : (
              <Button variant="secondary" onClick={() => confirmStartWalk(false)} disabled={startingWalk} className="flex-1">
                Start Without GPS
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default WalkerDashboard;
