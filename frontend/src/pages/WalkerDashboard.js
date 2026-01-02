import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Calendar, Clock, Play, Square, PawPrint, Users, CheckCircle, Navigation, MapPin, Smartphone, AlertTriangle, Settings } from 'lucide-react';
import { toast } from 'sonner';

const WalkerDashboard = () => {
  const { user, api } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({});
  const [todayAppointments, setTodayAppointments] = useState([]);
  const [nextWalk, setNextWalk] = useState(null);
  const [activeWalk, setActiveWalk] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [loading, setLoading] = useState(true);
  const [startingWalk, setStartingWalk] = useState(false);
  const timerRef = useRef(null);
  
  // GPS Permission Dialog State
  const [gpsDialogOpen, setGpsDialogOpen] = useState(false);
  const [gpsStatus, setGpsStatus] = useState('checking'); // checking, granted, denied, unavailable
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
      const [statsRes, apptsRes] = await Promise.all([
        api.get('/dashboard/stats'),
        api.get('/appointments'),
      ]);
      setStats(statsRes.data);
      
      const today = new Date().toISOString().split('T')[0];
      const now = new Date();
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      
      // Get today's appointments
      const todayAppts = apptsRes.data
        .filter(a => a.scheduled_date === today)
        .sort((a, b) => a.scheduled_time.localeCompare(b.scheduled_time));
      
      setTodayAppointments(todayAppts);
      
      // Check for active walk
      const active = apptsRes.data.find(a => a.status === 'in_progress');
      if (active) {
        setActiveWalk(active);
        setNextWalk(null);
      } else {
        // Find the next scheduled walk (first scheduled walk of the day or next one by time)
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
    // Show GPS permission dialog first
    setPendingWalkId(apptId);
    setGpsStatus('checking');
    setGpsDialogOpen(true);
    
    // Check GPS availability and permission
    if (!navigator.geolocation) {
      setGpsStatus('unavailable');
      return;
    }
    
    // Check current permission status if available
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
      (position) => {
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
        // Start with GPS tracking
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            try {
              await api.post(`/appointments/${pendingWalkId}/start-tracking`, null, {
                params: {
                  lat: position.coords.latitude,
                  lng: position.coords.longitude
                }
              });
              toast.success('Walk started with GPS tracking!');
              navigate('/tracking');
            } catch (error) {
              // Fallback to regular start
              await startWalkWithoutGps();
            }
            fetchData();
          },
          async () => {
            await startWalkWithoutGps();
          },
          { enableHighAccuracy: true, timeout: 10000 }
        );
      } else {
        await startWalkWithoutGps();
      }
    } catch (error) {
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
    } catch (error) {
      toast.error('Failed to start walk');
    }
  };

  const endWalk = async () => {
    if (!activeWalk) return;
    try {
      // Try stop-tracking first (for GPS tracked walks), fallback to /end
      try {
        await api.post(`/appointments/${activeWalk.id}/stop-tracking`);
      } catch {
        await api.post(`/appointments/${activeWalk.id}/end`);
      }
      toast.success('Walk completed!');
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
    if (hrs > 0) {
      return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-100 text-blue-800';
      case 'in_progress': return 'bg-yellow-100 text-yellow-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
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
      <div className="space-y-6" data-testid="walker-dashboard">
        {/* Header */}
        <div>
          <h1 className="text-2xl md:text-3xl font-heading font-bold">
            Welcome back, {user?.full_name?.split(' ')[0]}!
          </h1>
          <p className="text-muted-foreground">Here's your schedule for today</p>
        </div>

        {/* Active Walk Timer - Shows when walk is in progress */}
        {activeWalk && (
          <Card className="rounded-2xl shadow-lg border-2 border-primary bg-primary/5">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center">
                    <Navigation className="w-8 h-8 text-primary-foreground animate-pulse" />
                  </div>
                  <div>
                    <Badge className="bg-green-500 text-white rounded-full mb-2">Walk In Progress</Badge>
                    <h2 className="text-xl font-bold capitalize">{activeWalk.service_type?.replace('_', ' ')}</h2>
                    <p className="text-muted-foreground">Started at {new Date(activeWalk.start_time).toLocaleTimeString()}</p>
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-5xl font-mono font-bold text-primary">{formatTime(elapsedTime)}</p>
                  <p className="text-sm text-muted-foreground">Duration</p>
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

        {/* Next/Pending Walk - Prominent card with Start button */}
        {!activeWalk && nextWalk && (
          <Card className="rounded-2xl shadow-lg border-2 border-secondary bg-secondary/5">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center">
                    <PawPrint className="w-8 h-8 text-secondary-foreground" />
                  </div>
                  <div>
                    <Badge className="bg-blue-100 text-blue-800 rounded-full mb-2">
                      {nextWalk.scheduled_time <= new Date().toTimeString().slice(0, 5) ? 'Ready Now' : 'Up Next'}
                    </Badge>
                    <h2 className="text-xl font-bold capitalize">{nextWalk.service_type?.replace('_', ' ')}</h2>
                    <p className="text-muted-foreground flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      Scheduled for {nextWalk.scheduled_time}
                    </p>
                    {nextWalk.client_name && (
                      <p className="text-sm text-muted-foreground">Client: {nextWalk.client_name}</p>
                    )}
                  </div>
                </div>
                <Button
                  onClick={() => startWalk(nextWalk.id)}
                  disabled={startingWalk}
                  size="lg"
                  className="rounded-full px-8 bg-secondary hover:bg-secondary/90 text-secondary-foreground"
                  data-testid="start-next-walk-btn"
                >
                  <Play className="w-5 h-5 mr-2" />
                  {startingWalk ? 'Starting...' : 'Start Walk'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* No Walks Message */}
        {!activeWalk && !nextWalk && todayAppointments.length === 0 && (
          <Card className="rounded-2xl shadow-sm bg-muted/30">
            <CardContent className="p-8 text-center">
              <Calendar className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h2 className="text-xl font-semibold mb-2">No walks scheduled</h2>
              <p className="text-muted-foreground">Enjoy your day off! Check your schedule for upcoming walks.</p>
            </CardContent>
          </Card>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                  <p className="text-sm text-muted-foreground">Completed</p>
                  <p className="text-3xl font-bold mt-1">{stats.completed_walks || 0}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-green-600" />
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
                <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                  <Clock className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Today's Full Schedule */}
        {todayAppointments.length > 0 && (
          <Card className="rounded-2xl shadow-sm">
            <CardHeader>
              <CardTitle className="text-xl">Today's Schedule</CardTitle>
              <CardDescription>
                {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {todayAppointments.map((appt) => (
                  <div
                    key={appt.id}
                    className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl transition-all gap-3 ${
                      appt.status === 'in_progress' 
                        ? 'bg-primary/10 border-2 border-primary' 
                        : appt.status === 'completed'
                          ? 'bg-green-50 border border-green-200'
                          : appt.id === nextWalk?.id
                            ? 'bg-secondary/10 border-2 border-secondary'
                            : 'bg-muted/50'
                    }`}
                    data-testid={`appointment-${appt.id}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                        appt.status === 'in_progress' ? 'bg-primary text-primary-foreground' : 
                        appt.status === 'completed' ? 'bg-green-100 text-green-600' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        {appt.status === 'completed' ? (
                          <CheckCircle className="w-6 h-6" />
                        ) : (
                          <Clock className="w-6 h-6" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium capitalize">{appt.service_type?.replace('_', ' ')}</p>
                        <p className="text-sm text-muted-foreground">{appt.scheduled_time}</p>
                        {appt.client_name && (
                          <p className="text-xs text-muted-foreground">Client: {appt.client_name}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className={`${getStatusColor(appt.status)} rounded-full`}>
                        {appt.status?.replace('_', ' ')}
                      </Badge>
                      {appt.status === 'scheduled' && !activeWalk && appt.id !== nextWalk?.id && (
                        <Button
                          onClick={() => startWalk(appt.id)}
                          size="sm"
                          variant="outline"
                          className="rounded-full"
                          data-testid={`start-walk-${appt.id}`}
                        >
                          <Play className="w-4 h-4 mr-1" />
                          Start
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
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
                    <p className="text-sm text-red-600 mt-1">
                      Your device doesn't support GPS tracking. You can still start the walk without tracking.
                    </p>
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
                    <p className="text-sm text-amber-600 mt-1">
                      Please enable location access in your browser/device settings:
                    </p>
                    <ul className="text-sm text-amber-600 mt-2 space-y-1 list-disc list-inside">
                      <li><strong>iPhone:</strong> Settings → Privacy → Location Services → Browser → Allow</li>
                      <li><strong>Android:</strong> Settings → Apps → Browser → Permissions → Location → Allow</li>
                      <li><strong>Browser:</strong> Click the lock icon in the address bar → Site Settings → Location → Allow</li>
                    </ul>
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
                      <p className="text-sm text-muted-foreground mt-1">
                        Tap the button below and allow location access when prompted by your browser.
                      </p>
                    </div>
                  </div>
                </div>
                
                <Button 
                  onClick={requestGpsPermission} 
                  className="w-full rounded-full"
                  disabled={gpsStatus === 'requesting'}
                >
                  {gpsStatus === 'requesting' ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Requesting Permission...
                    </>
                  ) : (
                    <>
                      <MapPin className="w-4 h-4 mr-2" />
                      Enable Location
                    </>
                  )}
                </Button>
              </div>
            )}
            
            {gpsStatus === 'granted' && (
              <div className="p-4 rounded-xl bg-green-50 border border-green-200">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                  <div>
                    <p className="font-medium text-green-800">GPS Ready!</p>
                    <p className="text-sm text-green-600 mt-1">
                      Location access is enabled. Your walk route will be tracked and visible to the client in real-time.
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {gpsStatus === 'error' && (
              <div className="p-4 rounded-xl bg-red-50 border border-red-200">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5" />
                  <div>
                    <p className="font-medium text-red-800">Location Error</p>
                    <p className="text-sm text-red-600 mt-1">
                      Unable to get your location. Make sure you're outdoors or near a window for better GPS signal.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          <DialogFooter className="flex gap-2 sm:gap-2">
            <Button 
              variant="outline" 
              onClick={() => setGpsDialogOpen(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            {gpsStatus === 'granted' ? (
              <Button 
                onClick={() => confirmStartWalk(true)} 
                disabled={startingWalk}
                className="flex-1 rounded-full"
              >
                <Play className="w-4 h-4 mr-2" />
                Start Walk
              </Button>
            ) : (
              <Button 
                variant="secondary"
                onClick={() => confirmStartWalk(false)} 
                disabled={startingWalk}
                className="flex-1"
              >
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
