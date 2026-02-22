import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { 
  Calendar, PawPrint, Clock, MapPin, Phone, ChevronLeft, ChevronRight,
  Play, CheckCircle, AlertCircle, User, Plus
} from 'lucide-react';
import { toast } from 'sonner';
import { format, addDays, startOfWeek, isSameDay } from 'date-fns';

// Helper to format date as YYYY-MM-DD in LOCAL timezone
const formatLocalDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const WalkerMySchedulePage = () => {
  const navigate = useNavigate();
  const { user, api } = useAuth();
  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [view, setView] = useState('day'); // 'day' or 'week'

  useEffect(() => {
    fetchAppointments();
  }, []);

  const fetchAppointments = async () => {
    try {
      // Use calendar endpoint and filter for this walker
      const response = await api.get('/appointments/calendar');
      const walkerAppts = (response.data || []).filter(a => a.walker_id === user?.id);
      setAppointments(walkerAppts);
    } catch (error) {
      console.error('Failed to fetch appointments:', error);
      toast.error('Failed to load schedule');
    } finally {
      setLoading(false);
    }
  };

  const formatTime12Hour = (time24) => {
    if (!time24) return '';
    const [hours, minutes] = time24.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'scheduled':
        return <Badge className="bg-blue-100 text-blue-800">Scheduled</Badge>;
      case 'in_progress':
        return <Badge className="bg-orange-100 text-orange-800">In Progress</Badge>;
      case 'completed':
        return <Badge className="bg-green-100 text-green-800">Completed</Badge>;
      case 'cancelled':
        return <Badge className="bg-red-100 text-red-800">Cancelled</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  // Get appointments for a specific date
  const getAppointmentsForDate = (date) => {
    const dateStr = formatLocalDate(date);
    return appointments
      .filter(a => a.scheduled_date === dateStr && a.status !== 'cancelled')
      .sort((a, b) => (a.scheduled_time || '').localeCompare(b.scheduled_time || ''));
  };

  // Get week dates starting from Sunday
  const getWeekDates = () => {
    const start = startOfWeek(selectedDate);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  };

  const todayAppointments = getAppointmentsForDate(selectedDate);
  const today = formatLocalDate(new Date());
  const isToday = formatLocalDate(selectedDate) === today;

  // Navigation
  const goToPrevDay = () => setSelectedDate(addDays(selectedDate, -1));
  const goToNextDay = () => setSelectedDate(addDays(selectedDate, 1));
  const goToToday = () => setSelectedDate(new Date());

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
      <div className="p-4 space-y-4 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">My Schedule</h1>
            <p className="text-muted-foreground">View your upcoming appointments</p>
          </div>
          {user?.can_schedule_walks && (
            <Button 
              onClick={() => navigate('/walker/schedule/new')}
              className="rounded-full"
            >
              <Plus className="w-4 h-4 mr-2" />
              Schedule Walk
            </Button>
          )}
        </div>

        {/* View Toggle */}
        <Tabs value={view} onValueChange={setView} className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-xs">
            <TabsTrigger value="day">Day View</TabsTrigger>
            <TabsTrigger value="week">Week View</TabsTrigger>
          </TabsList>

          {/* Day View */}
          <TabsContent value="day" className="space-y-4">
            {/* Date Navigation */}
            <Card className="rounded-xl">
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <Button variant="ghost" size="sm" onClick={goToPrevDay}>
                    <ChevronLeft className="w-5 h-5" />
                  </Button>
                  <div className="text-center">
                    <p className="font-bold text-lg">
                      {format(selectedDate, 'EEEE')}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {format(selectedDate, 'MMMM d, yyyy')}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={goToNextDay}>
                    <ChevronRight className="w-5 h-5" />
                  </Button>
                </div>
                {!isToday && (
                  <div className="flex justify-center mt-2">
                    <Button variant="outline" size="sm" onClick={goToToday} className="rounded-full">
                      Go to Today
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Appointments List */}
            {todayAppointments.length === 0 ? (
              <Card className="rounded-xl">
                <CardContent className="p-8 text-center">
                  <Calendar className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No walks scheduled for this day</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {todayAppointments.map((appt) => (
                  <Card key={appt.id} className="rounded-xl hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                            <PawPrint className="w-6 h-6 text-primary" />
                          </div>
                          <div>
                            <p className="font-bold text-lg">
                              {appt.pet_names?.join(' & ') || 'Pet'}
                            </p>
                            <p className="text-sm text-muted-foreground capitalize">
                              {appt.service_type?.replace('_', ' ')}
                            </p>
                            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Clock className="w-4 h-4" />
                                {formatTime12Hour(appt.scheduled_time)}
                              </span>
                              <span className="flex items-center gap-1">
                                <User className="w-4 h-4" />
                                {appt.client_name}
                              </span>
                            </div>
                            {appt.address && (
                              <p className="flex items-center gap-1 mt-1 text-sm text-muted-foreground">
                                <MapPin className="w-4 h-4" />
                                {appt.address}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          {getStatusBadge(appt.status)}
                          {appt.status === 'scheduled' && isToday && (
                            <Button 
                              size="sm" 
                              className="rounded-full"
                              onClick={() => navigate('/walker')}
                            >
                              <Play className="w-4 h-4 mr-1" />
                              Start
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Week View */}
          <TabsContent value="week" className="space-y-4">
            <div className="grid grid-cols-7 gap-1">
              {getWeekDates().map((date) => {
                const dateStr = formatLocalDate(date);
                const dayAppts = getAppointmentsForDate(date);
                const isSelected = isSameDay(date, selectedDate);
                const isTodayDate = dateStr === today;
                
                return (
                  <Card 
                    key={dateStr}
                    className={`rounded-lg cursor-pointer hover:shadow-md transition-all ${
                      isSelected ? 'ring-2 ring-primary' : ''
                    } ${isTodayDate ? 'bg-primary/5' : ''}`}
                    onClick={() => {
                      setSelectedDate(date);
                      setView('day');
                    }}
                  >
                    <CardContent className="p-2 text-center">
                      <p className="text-xs font-medium text-muted-foreground">
                        {format(date, 'EEE')}
                      </p>
                      <p className={`text-lg font-bold ${isTodayDate ? 'text-primary' : ''}`}>
                        {format(date, 'd')}
                      </p>
                      {dayAppts.length > 0 && (
                        <Badge className="mt-1 text-xs" variant="secondary">
                          {dayAppts.length} walk{dayAppts.length > 1 ? 's' : ''}
                        </Badge>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Summary for selected date */}
            <Card className="rounded-xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  {format(selectedDate, 'EEEE, MMMM d')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {todayAppointments.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No walks scheduled</p>
                ) : (
                  <div className="space-y-2">
                    {todayAppointments.map((appt) => (
                      <div 
                        key={appt.id} 
                        className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{formatTime12Hour(appt.scheduled_time)}</span>
                          <span className="text-muted-foreground">•</span>
                          <span>{appt.pet_names?.join(', ')}</span>
                        </div>
                        {getStatusBadge(appt.status)}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default WalkerMySchedulePage;
