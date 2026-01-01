import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Calendar, Clock, Play, Square, PawPrint, Users, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

const WalkerDashboard = () => {
  const { user, api } = useAuth();
  const [stats, setStats] = useState({});
  const [todayAppointments, setTodayAppointments] = useState([]);
  const [activeWalk, setActiveWalk] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef(null);

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
      const [statsRes, apptsRes] = await Promise.all([
        api.get('/dashboard/stats'),
        api.get('/appointments'),
      ]);
      setStats(statsRes.data);
      
      const today = new Date().toISOString().split('T')[0];
      const todayAppts = apptsRes.data.filter(a => a.scheduled_date === today);
      setTodayAppointments(todayAppts);
      
      // Check for active walk
      const active = apptsRes.data.find(a => a.status === 'in_progress');
      if (active) setActiveWalk(active);
    } catch (error) {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const startWalk = async (apptId) => {
    try {
      const response = await api.post(`/appointments/${apptId}/start`);
      toast.success('Walk started!');
      setActiveWalk({
        ...todayAppointments.find(a => a.id === apptId),
        start_time: response.data.start_time,
        status: 'in_progress'
      });
      fetchData();
    } catch (error) {
      toast.error('Failed to start walk');
    }
  };

  const endWalk = async () => {
    if (!activeWalk) return;
    try {
      const response = await api.post(`/appointments/${activeWalk.id}/end`);
      toast.success(`Walk completed! Duration: ${response.data.duration_minutes} minutes`);
      setActiveWalk(null);
      fetchData();
    } catch (error) {
      toast.error('Failed to end walk');
    }
  };

  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-100 text-blue-800';
      case 'in_progress': return 'bg-yellow-100 text-yellow-800';
      case 'completed': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
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
      <div className="space-y-8" data-testid="walker-dashboard">
        {/* Welcome Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-heading font-bold">Good day, {user?.full_name?.split(' ')[0]}!</h1>
            <p className="text-muted-foreground">Ready to make some tails wag?</p>
          </div>
          <Badge className="bg-secondary text-secondary-foreground w-fit rounded-full px-4 py-2">
            <PawPrint className="w-4 h-4 mr-2" />
            Walker Dashboard
          </Badge>
        </div>

        {/* Active Walk Timer */}
        {activeWalk && (
          <Card className="rounded-3xl shadow-xl border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10" data-testid="active-walk-card">
            <CardContent className="p-8">
              <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="text-center md:text-left">
                  <p className="text-sm text-muted-foreground mb-1">Active Walk</p>
                  <h2 className="text-2xl font-bold capitalize">{activeWalk.service_type.replace('_', ' ')}</h2>
                </div>
                
                <div className="relative">
                  <div className="timer-pulse w-32 h-32 rounded-full bg-primary flex items-center justify-center relative">
                    <span className="text-3xl font-mono font-bold text-primary-foreground" data-testid="walk-timer">
                      {formatTime(elapsedTime)}
                    </span>
                  </div>
                </div>

                <Button
                  onClick={endWalk}
                  variant="destructive"
                  size="lg"
                  className="rounded-full px-8"
                  data-testid="end-walk-btn"
                >
                  <Square className="w-5 h-5 mr-2" />
                  End Walk
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="rounded-2xl shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Today's Walks</p>
                  <p className="text-3xl font-bold mt-1">{stats.todays_appointments || 0}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Completed Walks</p>
                  <p className="text-3xl font-bold mt-1">{stats.completed_walks || 0}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-secondary/10 flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-secondary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pending</p>
                  <p className="text-3xl font-bold mt-1">{stats.pending_appointments || 0}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
                  <Clock className="w-6 h-6 text-accent" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Today's Schedule */}
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl">Today's Schedule</CardTitle>
            <CardDescription>
              {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {todayAppointments.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Calendar className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg">No walks scheduled for today</p>
                <p className="text-sm">Enjoy your day off!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {todayAppointments.map((appt) => (
                  <div
                    key={appt.id}
                    className={`flex items-center justify-between p-4 rounded-xl transition-all ${
                      appt.status === 'in_progress' 
                        ? 'bg-primary/10 border-2 border-primary' 
                        : 'bg-muted/50 hover:bg-muted'
                    }`}
                    data-testid={`appointment-${appt.id}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                        appt.status === 'in_progress' ? 'bg-primary' : 'bg-muted'
                      }`}>
                        <Clock className={`w-6 h-6 ${appt.status === 'in_progress' ? 'text-primary-foreground' : 'text-muted-foreground'}`} />
                      </div>
                      <div>
                        <p className="font-medium capitalize">{appt.service_type.replace('_', ' ')}</p>
                        <p className="text-sm text-muted-foreground">{appt.scheduled_time}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className={`${getStatusColor(appt.status)} rounded-full`}>
                        {appt.status.replace('_', ' ')}
                      </Badge>
                      {appt.status === 'scheduled' && !activeWalk && (
                        <Button
                          onClick={() => startWalk(appt.id)}
                          className="rounded-full"
                          data-testid={`start-walk-${appt.id}`}
                        >
                          <Play className="w-4 h-4 mr-2" />
                          Start
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default WalkerDashboard;
