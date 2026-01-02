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
  User, DollarSign, Play, Square, Home, Moon, Sun,
  CheckCircle, Send, Users, FileText, Bed
} from 'lucide-react';
import { toast } from 'sonner';

const SitterDashboard = () => {
  const { user, api } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({});
  const [todayStays, setTodayStays] = useState([]);
  const [activeStays, setActiveStays] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [startingStay, setStartingStay] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

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
      
      // Filter for stay-type appointments
      const stayTypes = ['stay_day', 'stay_overnight', 'stay_extended', 'overnight', 'petsit_our_location'];
      const stays = apptsRes.data.filter(a => stayTypes.includes(a.service_type));
      
      const todayAppts = stays
        .filter(a => a.scheduled_date === today || (a.start_date <= today && a.end_date >= today))
        .sort((a, b) => (a.scheduled_time || '00:00').localeCompare(b.scheduled_time || '00:00'));
      
      setTodayStays(todayAppts);
      
      const active = stays.filter(a => a.status === 'in_progress');
      setActiveStays(active);
    } catch (error) {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const startStay = async (apptId) => {
    setStartingStay(true);
    try {
      await api.post(`/appointments/${apptId}/start`);
      toast.success('Stay started!');
      fetchData();
    } catch (error) {
      toast.error('Failed to start stay');
    } finally {
      setStartingStay(false);
    }
  };

  const endStay = async (apptId) => {
    try {
      await api.post(`/appointments/${apptId}/end`);
      toast.success('Stay completed!');
      fetchData();
    } catch (error) {
      toast.error('Failed to end stay');
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

  const getServiceLabel = (type) => {
    switch (type) {
      case 'stay_day': return 'Day Stay';
      case 'stay_overnight': return 'Overnight Stay';
      case 'stay_extended': return 'Extended Stay';
      case 'overnight': return 'Overnight';
      case 'petsit_our_location': return 'Boarding';
      default: return type?.replace('_', ' ');
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
      <div className="space-y-6" data-testid="sitter-dashboard">
        {/* Welcome Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-500/90 to-purple-600 p-6 text-white">
          <div className="relative z-10">
            <h1 className="text-2xl lg:text-3xl font-heading font-bold mb-1">
              Welcome, {user?.full_name?.split(' ')[0]}!
            </h1>
            <p className="text-white/80">
              {todayStays.length} stays today • {activeStays.length} currently active
            </p>
          </div>
          <div className="absolute right-4 bottom-0 opacity-10">
            <Bed className="w-32 h-32" />
          </div>
        </div>

        {/* Active Stays */}
        {activeStays.length > 0 && (
          <Card className="rounded-xl border-2 border-orange-500 bg-orange-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Moon className="w-5 h-5 text-orange-600" />
                Active Stays ({activeStays.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {activeStays.map((stay) => (
                  <div key={stay.id} className="flex items-center justify-between p-3 rounded-lg bg-white border border-orange-200">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                        <PawPrint className="w-5 h-5 text-orange-600" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{stay.client_name}</p>
                        <p className="text-xs text-muted-foreground">{getServiceLabel(stay.service_type)}</p>
                      </div>
                    </div>
                    <Button onClick={() => endStay(stay.id)} variant="outline" size="sm" className="rounded-full">
                      <Square className="w-3 h-3 mr-1" /> End Stay
                    </Button>
                  </div>
                ))}
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
              <Link to="/sitter/schedule">
                <Card className="rounded-xl hover:shadow-md transition-all cursor-pointer h-full">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-sky-100 flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-sky-600" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">My Schedule</p>
                      <p className="text-xs text-muted-foreground">View all stays</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
              <Card className="rounded-xl bg-orange-50">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                    <Bed className="w-5 h-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Active Stays</p>
                    <p className="text-xs text-muted-foreground">{activeStays.length} in progress</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Today's Stays */}
            <Card className="rounded-xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Sun className="w-5 h-5 text-sky-600" />
                  Today's Stays
                  <Badge variant="secondary" className="rounded-full ml-2">{todayStays.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {todayStays.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    <Bed className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No stays scheduled today</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {todayStays.map((stay) => (
                      <div
                        key={stay.id}
                        className={`flex items-center justify-between p-3 rounded-lg ${
                          stay.status === 'in_progress' ? 'bg-orange-100 border border-orange-300' :
                          stay.status === 'completed' ? 'bg-sky-50' : 'bg-muted/50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            stay.status === 'in_progress' ? 'bg-orange-500 text-white' :
                            stay.status === 'completed' ? 'bg-sky-100 text-sky-600' :
                            'bg-sky-100 text-sky-600'
                          }`}>
                            {stay.status === 'completed' ? <CheckCircle className="w-5 h-5" /> : <Bed className="w-5 h-5" />}
                          </div>
                          <div>
                            <p className="font-medium text-sm">{getServiceLabel(stay.service_type)}</p>
                            <p className="text-xs text-muted-foreground">{stay.client_name}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={`${getStatusColor(stay.status)} rounded-full text-xs`}>
                            {stay.status?.replace('_', ' ')}
                          </Badge>
                          {stay.status === 'scheduled' && (
                            <Button size="sm" variant="outline" onClick={() => startStay(stay.id)} disabled={startingStay} className="rounded-full">
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
            <div className="grid grid-cols-2 gap-3">
              <Link to="/sitter/payroll">
                <Card className="rounded-xl hover:shadow-md transition-all cursor-pointer h-full">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-sky-100 flex items-center justify-center">
                      <CheckCircle className="w-5 h-5 text-sky-600" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">Completed Stays</p>
                      <p className="text-xs text-muted-foreground">View history</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
              <Link to="/sitter/payroll">
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

            <Card className="rounded-xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-sky-600" />
                  This Week
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center p-3 rounded-lg bg-sky-50">
                    <p className="text-2xl font-bold text-sky-600">{stats.completed_walks || 0}</p>
                    <p className="text-xs text-muted-foreground">Stays Done</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-muted/50">
                    <p className="text-2xl font-bold text-primary">{stats.pending_appointments || 0}</p>
                    <p className="text-xs text-muted-foreground">Upcoming</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-muted/50">
                    <p className="text-2xl font-bold text-green-600">{activeStays.length}</p>
                    <p className="text-xs text-muted-foreground">Active Now</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* CHAT TAB */}
          <TabsContent value="chat" className="space-y-4">
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
                      <Link to="/sitter/chat" key={contact.id}>
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

            <Card className="rounded-xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="w-5 h-5 text-purple-600" />
                  My Clients
                </CardTitle>
              </CardHeader>
              <CardContent>
                {clientContacts.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No clients assigned</p>
                ) : (
                  <div className="space-y-2">
                    {clientContacts.slice(0, 5).map((contact) => (
                      <Link to="/sitter/chat" key={contact.id}>
                        <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                          <Avatar className="w-10 h-10">
                            <AvatarImage src={contact.profile_image} />
                            <AvatarFallback className="bg-purple-100 text-purple-600">
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
            <Link to="/sitter/profile">
              <Card className="rounded-xl hover:shadow-md transition-all cursor-pointer">
                <CardContent className="p-4 flex items-center gap-4">
                  <Avatar className="w-14 h-14">
                    <AvatarImage src={user?.profile_image} />
                    <AvatarFallback className="bg-purple-100 text-purple-600 text-xl">
                      {user?.full_name?.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-medium">{user?.full_name}</p>
                    <p className="text-sm text-muted-foreground">{user?.email}</p>
                  </div>
                  <Badge className="bg-purple-100 text-purple-600 rounded-full">Sitter</Badge>
                </CardContent>
              </Card>
            </Link>

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
                  <div className="text-center p-4 rounded-lg bg-purple-50">
                    <p className="text-3xl font-bold text-purple-600">{activeStays.length}</p>
                    <p className="text-sm text-muted-foreground">Active Stays</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default SitterDashboard;
