import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { 
  Navigation, Play, Square, MapPin, Clock, Route, 
  PawPrint, User, RefreshCw, Locate
} from 'lucide-react';
import { toast } from 'sonner';

// Fix for default marker icons in React-Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom dog paw marker
const createPawIcon = (color) => {
  return L.divIcon({
    html: `<div style="background-color: ${color}; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3);">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
        <path d="M12 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm6-4c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zM6 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm3.5-4C8.4 2 7.5 2.9 7.5 4s.9 2 1.5 2 1.5-.9 1.5-2-.4-2-1.5-2zm5 0c-1.1 0-1.5.9-1.5 2s.4 2 1.5 2 1.5-.9 1.5-2-.4-2-1.5-2zm-2.5 8c-2.2 0-4 1.8-4 4v4c0 1.1.9 2 2 2h4c1.1 0 2-.9 2-2v-4c0-2.2-1.8-4-4-4z"/>
      </svg>
    </div>`,
    className: '',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
};

// Component to recenter map
const MapRecenter = ({ center }) => {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView(center, map.getZoom());
    }
  }, [center, map]);
  return null;
};

const LiveTrackingPage = () => {
  const { api, user, isClient, isWalker, isAdmin } = useAuth();
  const [activeWalks, setActiveWalks] = useState([]);
  const [completedWalks, setCompletedWalks] = useState([]);
  const [selectedWalk, setSelectedWalk] = useState(null);
  const [liveData, setLiveData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tracking, setTracking] = useState(false);
  const [currentPosition, setCurrentPosition] = useState(null);
  const [walkerAppointments, setWalkerAppointments] = useState([]);
  const watchIdRef = useRef(null);
  const updateIntervalRef = useRef(null);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchActiveWalks, 10000); // Poll every 10 seconds
    return () => {
      clearInterval(interval);
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
    };
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchActiveWalks(),
        fetchCompletedWalks(),
        isWalker && fetchWalkerAppointments()
      ]);
    } catch (error) {
      toast.error('Failed to load tracking data');
    } finally {
      setLoading(false);
    }
  };

  const fetchActiveWalks = async () => {
    try {
      const response = await api.get('/walks/active');
      setActiveWalks(response.data);
      
      // If viewing a walk, update live data
      if (selectedWalk && response.data.find(w => w.id === selectedWalk.id)) {
        const updatedWalk = response.data.find(w => w.id === selectedWalk.id);
        setLiveData(updatedWalk);
      }
    } catch (error) {
      console.error('Error fetching active walks:', error);
    }
  };

  const fetchCompletedWalks = async () => {
    try {
      const response = await api.get('/walks/completed');
      setCompletedWalks(response.data);
    } catch (error) {
      console.error('Error fetching completed walks:', error);
    }
  };

  const fetchWalkerAppointments = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const response = await api.get('/appointments', { params: { date: today } });
      // Filter to scheduled appointments for today
      const scheduled = response.data.filter(a => a.status === 'scheduled');
      setWalkerAppointments(scheduled);
    } catch (error) {
      console.error('Error fetching appointments:', error);
    }
  };

  const startTracking = async (appointmentId) => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }

    try {
      // Get current position first
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          
          // Start tracking on backend
          await api.post(`/appointments/${appointmentId}/start-tracking`, null, {
            params: { lat: latitude, lng: longitude }
          });
          
          setTracking(true);
          setCurrentPosition({ lat: latitude, lng: longitude });
          toast.success('Walk tracking started!');
          
          // Start watching position
          watchIdRef.current = navigator.geolocation.watchPosition(
            (pos) => {
              setCurrentPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude });
            },
            (err) => console.error('Geolocation error:', err),
            { enableHighAccuracy: true, maximumAge: 5000 }
          );
          
          // Send updates every 15 seconds
          updateIntervalRef.current = setInterval(async () => {
            navigator.geolocation.getCurrentPosition(
              async (pos) => {
                try {
                  await api.post(`/appointments/${appointmentId}/update-location`, null, {
                    params: { lat: pos.coords.latitude, lng: pos.coords.longitude }
                  });
                } catch (err) {
                  console.error('Failed to update location:', err);
                }
              },
              (err) => console.error('Location update error:', err),
              { enableHighAccuracy: true }
            );
          }, 15000);
          
          fetchActiveWalks();
        },
        (error) => {
          toast.error('Unable to get your location. Please enable location services.');
          console.error('Geolocation error:', error);
        },
        { enableHighAccuracy: true }
      );
    } catch (error) {
      toast.error('Failed to start tracking');
      console.error(error);
    }
  };

  const stopTracking = async (appointmentId) => {
    try {
      // Get final position
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          await api.post(`/appointments/${appointmentId}/stop-tracking`, null, {
            params: { lat: position.coords.latitude, lng: position.coords.longitude }
          });
          
          // Clear watchers
          if (watchIdRef.current) {
            navigator.geolocation.clearWatch(watchIdRef.current);
            watchIdRef.current = null;
          }
          if (updateIntervalRef.current) {
            clearInterval(updateIntervalRef.current);
            updateIntervalRef.current = null;
          }
          
          setTracking(false);
          setCurrentPosition(null);
          toast.success('Walk completed!');
          fetchData();
        },
        async () => {
          // Stop without final position if error
          await api.post(`/appointments/${appointmentId}/stop-tracking`);
          setTracking(false);
          toast.success('Walk completed!');
          fetchData();
        }
      );
    } catch (error) {
      toast.error('Failed to stop tracking');
      console.error(error);
    }
  };

  const viewWalkDetails = async (walk) => {
    setSelectedWalk(walk);
    if (walk.is_tracking) {
      // Fetch live data
      try {
        const response = await api.get(`/appointments/${walk.id}/live-tracking`);
        setLiveData(response.data);
      } catch (error) {
        toast.error('Failed to load live tracking data');
      }
    } else {
      setLiveData(walk);
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
    if (minutes >= 60) {
      const hrs = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return `${hrs}h ${mins}m`;
    }
    return `${minutes} min`;
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
      <div className="space-y-6" data-testid="live-tracking-page">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-heading font-bold flex items-center gap-2">
              <Navigation className="w-8 h-8 text-primary" />
              {isClient ? 'Track My Pet' : 'Walk Tracking'}
            </h1>
            <p className="text-muted-foreground">
              {isClient ? 'See your pet\'s walk in real-time' : 'Start tracking walks and view routes'}
            </p>
          </div>
          <Button onClick={fetchData} variant="outline" className="rounded-full">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Walk List */}
          <div className="space-y-6">
            {/* For Walkers - Start Walk */}
            {isWalker && !tracking && walkerAppointments.length > 0 && (
              <Card className="rounded-2xl shadow-sm border-2 border-primary/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Play className="w-5 h-5 text-primary" />
                    Start a Walk
                  </CardTitle>
                  <CardDescription>Select an appointment to start tracking</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {walkerAppointments.map((appt) => (
                    <div key={appt.id} className="p-3 rounded-xl bg-muted/50 flex items-center justify-between">
                      <div>
                        <p className="font-medium">{appt.client_name}</p>
                        <p className="text-sm text-muted-foreground">{appt.scheduled_time}</p>
                      </div>
                      <Button 
                        size="sm" 
                        onClick={() => startTracking(appt.id)}
                        className="rounded-full"
                        data-testid={`start-walk-${appt.id}`}
                      >
                        <Play className="w-4 h-4 mr-1" /> Start
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Active Walks */}
            <Card className="rounded-2xl shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></div>
                  Active Walks
                </CardTitle>
                <CardDescription>{activeWalks.length} walk(s) in progress</CardDescription>
              </CardHeader>
              <CardContent>
                {activeWalks.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Navigation className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>No walks in progress</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {activeWalks.map((walk) => (
                      <div
                        key={walk.id}
                        className={`p-4 rounded-xl cursor-pointer transition-all ${
                          selectedWalk?.id === walk.id 
                            ? 'bg-primary/10 ring-2 ring-primary' 
                            : 'bg-muted/50 hover:bg-muted'
                        }`}
                        onClick={() => viewWalkDetails(walk)}
                        data-testid={`active-walk-${walk.id}`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-4 h-4 rounded-full" 
                              style={{ backgroundColor: walk.walker_color }}
                            />
                            <span className="font-medium">{walk.walker_name}</span>
                          </div>
                          <Badge className="bg-green-100 text-green-800 rounded-full">Live</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <PawPrint className="w-3 h-3" />
                          {walk.pet_names?.join(', ')}
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-sm">
                          <span className="flex items-center gap-1">
                            <Route className="w-3 h-3" />
                            {formatDistance(walk.distance_meters)}
                          </span>
                        </div>
                        
                        {/* Stop button for walker's own walk */}
                        {isWalker && walk.walker_id === user?.id && (
                          <Button
                            size="sm"
                            variant="destructive"
                            className="w-full mt-3 rounded-full"
                            onClick={(e) => {
                              e.stopPropagation();
                              stopTracking(walk.id);
                            }}
                            data-testid={`stop-walk-${walk.id}`}
                          >
                            <Square className="w-4 h-4 mr-1" /> Stop Walk
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Completed Walks */}
            <Card className="rounded-2xl shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Clock className="w-5 h-5 text-muted-foreground" />
                  Recent Walks
                </CardTitle>
                <CardDescription>View completed walk routes</CardDescription>
              </CardHeader>
              <CardContent>
                {completedWalks.length === 0 ? (
                  <p className="text-center py-4 text-muted-foreground">No completed walks yet</p>
                ) : (
                  <div className="space-y-2">
                    {completedWalks.slice(0, 5).map((walk) => (
                      <div
                        key={walk.id}
                        className={`p-3 rounded-xl cursor-pointer transition-all ${
                          selectedWalk?.id === walk.id 
                            ? 'bg-primary/10 ring-2 ring-primary' 
                            : 'bg-muted/30 hover:bg-muted/50'
                        }`}
                        onClick={() => viewWalkDetails(walk)}
                        data-testid={`completed-walk-${walk.id}`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-sm">{walk.pet_names?.join(', ')}</p>
                            <p className="text-xs text-muted-foreground">{walk.scheduled_date}</p>
                          </div>
                          <div className="text-right text-sm">
                            <p className="font-medium">{formatDistance(walk.distance_meters)}</p>
                            <p className="text-xs text-muted-foreground">{formatDuration(walk.duration_minutes)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Panel - Map */}
          <div className="lg:col-span-2">
            <Card className="rounded-2xl shadow-sm h-[600px]">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-primary" />
                  {selectedWalk ? (
                    <>
                      Walk Route 
                      {selectedWalk.is_tracking && (
                        <Badge className="bg-green-100 text-green-800 rounded-full ml-2">Live</Badge>
                      )}
                    </>
                  ) : 'Select a walk to view route'}
                </CardTitle>
                {selectedWalk && liveData && (
                  <div className="flex flex-wrap gap-4 text-sm mt-2">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-muted-foreground" />
                      <span>{liveData.walker_name || liveData.walker?.full_name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <PawPrint className="w-4 h-4 text-muted-foreground" />
                      <span>{liveData.pet_names?.join(', ') || liveData.pets?.map(p => p.name).join(', ')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Route className="w-4 h-4 text-muted-foreground" />
                      <span>{formatDistance(liveData.distance_meters)}</span>
                    </div>
                    {liveData.duration_minutes && (
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <span>{formatDuration(liveData.duration_minutes)}</span>
                      </div>
                    )}
                  </div>
                )}
              </CardHeader>
              <CardContent className="h-[500px] p-2">
                {selectedWalk && liveData?.gps_route?.length > 0 ? (
                  <MapContainer
                    center={[
                      liveData.current_location?.lat || liveData.gps_route[0].lat,
                      liveData.current_location?.lng || liveData.gps_route[0].lng
                    ]}
                    zoom={15}
                    className="h-full w-full rounded-xl"
                    data-testid="tracking-map"
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    
                    {/* Route polyline */}
                    <Polyline
                      positions={liveData.gps_route.map(p => [p.lat, p.lng])}
                      color={liveData.walker_color || '#f97316'}
                      weight={4}
                      opacity={0.8}
                    />
                    
                    {/* Start marker */}
                    <Marker position={[liveData.gps_route[0].lat, liveData.gps_route[0].lng]}>
                      <Popup>
                        <div className="text-center">
                          <p className="font-medium">Start</p>
                          <p className="text-xs text-gray-500">
                            {new Date(liveData.gps_route[0].timestamp).toLocaleTimeString()}
                          </p>
                        </div>
                      </Popup>
                    </Marker>
                    
                    {/* Current/End position marker */}
                    {liveData.gps_route.length > 1 && (
                      <Marker 
                        position={[
                          liveData.current_location?.lat || liveData.gps_route[liveData.gps_route.length - 1].lat,
                          liveData.current_location?.lng || liveData.gps_route[liveData.gps_route.length - 1].lng
                        ]}
                        icon={createPawIcon(liveData.walker_color || '#f97316')}
                      >
                        <Popup>
                          <div className="text-center">
                            <p className="font-medium">
                              {selectedWalk.is_tracking ? 'Current Position' : 'End'}
                            </p>
                            <p className="text-xs text-gray-500">
                              {formatDistance(liveData.distance_meters)} traveled
                            </p>
                          </div>
                        </Popup>
                      </Marker>
                    )}
                    
                    {/* Auto-recenter on live walk */}
                    {selectedWalk.is_tracking && liveData.current_location && (
                      <MapRecenter center={[liveData.current_location.lat, liveData.current_location.lng]} />
                    )}
                  </MapContainer>
                ) : (
                  <div className="h-full flex items-center justify-center bg-muted/30 rounded-xl">
                    <div className="text-center text-muted-foreground">
                      <MapPin className="w-16 h-16 mx-auto mb-4 opacity-30" />
                      <p className="text-lg">No route to display</p>
                      <p className="text-sm">Select an active or completed walk to view the route</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default LiveTrackingPage;
