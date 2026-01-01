import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Calendar } from '../components/ui/calendar';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { 
  Clock, User, PawPrint, ChevronLeft, ChevronRight, 
  CalendarDays, CalendarRange, Calendar as CalendarIcon 
} from 'lucide-react';
import { 
  format, addDays, subDays, addWeeks, subWeeks, addMonths, subMonths,
  startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval,
  isSameDay, isSameMonth, isToday
} from 'date-fns';
import { toast } from 'sonner';

const CalendarPage = () => {
  const { api, isAdmin } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [walkers, setWalkers] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedWalker, setSelectedWalker] = useState('all');
  const [viewMode, setViewMode] = useState('week'); // day, week, month
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [apptsRes, walkersRes] = await Promise.all([
        api.get('/appointments/calendar'),
        api.get('/users/walkers'),
      ]);
      setAppointments(apptsRes.data);
      setWalkers(walkersRes.data);
    } catch (error) {
      toast.error('Failed to load calendar data');
    } finally {
      setLoading(false);
    }
  };

  const assignWalker = async (apptId, walkerId) => {
    try {
      await api.put(`/appointments/${apptId}/assign?walker_id=${walkerId}`);
      toast.success('Walker assigned successfully');
      fetchData();
    } catch (error) {
      toast.error('Failed to assign walker');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'in_progress': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'completed': return 'bg-green-100 text-green-800 border-green-200';
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const filterAppointments = (date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return appointments.filter(appt => {
      const dateMatch = appt.scheduled_date === dateStr;
      const walkerMatch = selectedWalker === 'all' || 
                          appt.walker_id === selectedWalker || 
                          (!appt.walker_id && selectedWalker === 'unassigned');
      return dateMatch && walkerMatch;
    });
  };

  const navigate = (direction) => {
    if (viewMode === 'day') {
      setCurrentDate(direction === 'next' ? addDays(currentDate, 1) : subDays(currentDate, 1));
    } else if (viewMode === 'week') {
      setCurrentDate(direction === 'next' ? addWeeks(currentDate, 1) : subWeeks(currentDate, 1));
    } else {
      setCurrentDate(direction === 'next' ? addMonths(currentDate, 1) : subMonths(currentDate, 1));
    }
  };

  const goToToday = () => setCurrentDate(new Date());

  // Get dates for current view
  const getViewDates = () => {
    if (viewMode === 'day') {
      return [currentDate];
    } else if (viewMode === 'week') {
      const start = startOfWeek(currentDate, { weekStartsOn: 0 });
      const end = endOfWeek(currentDate, { weekStartsOn: 0 });
      return eachDayOfInterval({ start, end });
    } else {
      const start = startOfMonth(currentDate);
      const end = endOfMonth(currentDate);
      return eachDayOfInterval({ start, end });
    }
  };

  const getViewTitle = () => {
    if (viewMode === 'day') {
      return format(currentDate, 'EEEE, MMMM d, yyyy');
    } else if (viewMode === 'week') {
      const start = startOfWeek(currentDate, { weekStartsOn: 0 });
      const end = endOfWeek(currentDate, { weekStartsOn: 0 });
      return `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`;
    } else {
      return format(currentDate, 'MMMM yyyy');
    }
  };

  const timeSlots = [
    '07:00', '08:00', '09:00', '10:00', '11:00', '12:00',
    '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'
  ];

  const renderAppointmentCard = (appt, compact = false) => (
    <div
      key={appt.id}
      className={`p-2 rounded-lg border ${getStatusColor(appt.status)} ${compact ? 'text-xs' : ''}`}
      data-testid={`calendar-appt-${appt.id}`}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="font-medium">{appt.scheduled_time}</span>
        {!compact && (
          <Badge variant="outline" className="text-xs rounded-full">
            {appt.status}
          </Badge>
        )}
      </div>
      <p className={`font-medium capitalize ${compact ? 'truncate' : ''}`}>
        {appt.service_type.replace('_', ' ')}
      </p>
      <p className={`text-muted-foreground ${compact ? 'truncate' : ''}`}>
        {appt.client_name}
      </p>
      {!compact && appt.walker_name && (
        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
          <PawPrint className="w-3 h-3" />
          {appt.walker_name}
        </p>
      )}
      {!compact && isAdmin && (
        <Select
          value={appt.walker_id || ''}
          onValueChange={(value) => assignWalker(appt.id, value)}
        >
          <SelectTrigger className="mt-2 h-7 text-xs">
            <SelectValue placeholder="Assign walker" />
          </SelectTrigger>
          <SelectContent>
            {walkers.map((walker) => (
              <SelectItem key={walker.id} value={walker.id}>
                {walker.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );

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
      <div className="space-y-6" data-testid="calendar-page">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-heading font-bold">
              {isAdmin ? 'Team Calendar' : 'My Schedule'}
            </h1>
            <p className="text-muted-foreground">View and manage appointments</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            {/* View Mode Tabs */}
            <Tabs value={viewMode} onValueChange={setViewMode} className="w-auto">
              <TabsList>
                <TabsTrigger value="day" className="gap-1" data-testid="view-day">
                  <CalendarIcon className="w-4 h-4" />
                  Day
                </TabsTrigger>
                <TabsTrigger value="week" className="gap-1" data-testid="view-week">
                  <CalendarRange className="w-4 h-4" />
                  Week
                </TabsTrigger>
                <TabsTrigger value="month" className="gap-1" data-testid="view-month">
                  <CalendarDays className="w-4 h-4" />
                  Month
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {isAdmin && (
              <Select value={selectedWalker} onValueChange={setSelectedWalker}>
                <SelectTrigger className="w-40" data-testid="filter-walker">
                  <SelectValue placeholder="Filter by walker" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Walkers</SelectItem>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {walkers.map((walker) => (
                    <SelectItem key={walker.id} value={walker.id}>
                      {walker.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => navigate('prev')} data-testid="nav-prev">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => navigate('next')} data-testid="nav-next">
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button variant="outline" onClick={goToToday} data-testid="nav-today">
              Today
            </Button>
          </div>
          <h2 className="text-xl font-semibold">{getViewTitle()}</h2>
        </div>

        {/* Calendar Views */}
        {viewMode === 'day' && (
          <Card className="rounded-2xl shadow-sm">
            <CardHeader>
              <CardTitle>{format(currentDate, 'EEEE, MMMM d')}</CardTitle>
              <CardDescription>
                {filterAppointments(currentDate).length} appointment(s)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {filterAppointments(currentDate).length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Clock className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg">No appointments</p>
                  <p className="text-sm">No walks scheduled for this day</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filterAppointments(currentDate)
                    .sort((a, b) => a.scheduled_time.localeCompare(b.scheduled_time))
                    .map((appt) => renderAppointmentCard(appt))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {viewMode === 'week' && (
          <Card className="rounded-2xl shadow-sm overflow-hidden">
            <CardContent className="p-0">
              <div className="grid grid-cols-7 border-b">
                {getViewDates().map((date) => (
                  <div
                    key={date.toISOString()}
                    className={`p-3 text-center border-r last:border-r-0 ${
                      isToday(date) ? 'bg-primary/10' : ''
                    }`}
                  >
                    <p className="text-sm text-muted-foreground">{format(date, 'EEE')}</p>
                    <p className={`text-lg font-semibold ${isToday(date) ? 'text-primary' : ''}`}>
                      {format(date, 'd')}
                    </p>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 min-h-[400px]">
                {getViewDates().map((date) => {
                  const dayAppts = filterAppointments(date);
                  return (
                    <div
                      key={date.toISOString()}
                      className={`p-2 border-r last:border-r-0 ${
                        isToday(date) ? 'bg-primary/5' : ''
                      }`}
                    >
                      <div className="space-y-2">
                        {dayAppts
                          .sort((a, b) => a.scheduled_time.localeCompare(b.scheduled_time))
                          .slice(0, 5)
                          .map((appt) => renderAppointmentCard(appt, true))}
                        {dayAppts.length > 5 && (
                          <p className="text-xs text-muted-foreground text-center">
                            +{dayAppts.length - 5} more
                          </p>
                        )}
                        {dayAppts.length === 0 && (
                          <p className="text-xs text-muted-foreground text-center py-4">
                            No appointments
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {viewMode === 'month' && (
          <Card className="rounded-2xl shadow-sm overflow-hidden">
            <CardContent className="p-0">
              {/* Month header */}
              <div className="grid grid-cols-7 border-b bg-muted/30">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                  <div key={day} className="p-3 text-center text-sm font-medium text-muted-foreground">
                    {day}
                  </div>
                ))}
              </div>
              
              {/* Month grid */}
              <div className="grid grid-cols-7">
                {(() => {
                  const monthStart = startOfMonth(currentDate);
                  const monthEnd = endOfMonth(currentDate);
                  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
                  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
                  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
                  
                  return days.map((date) => {
                    const dayAppts = filterAppointments(date);
                    const isCurrentMonth = isSameMonth(date, currentDate);
                    
                    return (
                      <div
                        key={date.toISOString()}
                        className={`min-h-[100px] p-2 border-b border-r ${
                          !isCurrentMonth ? 'bg-muted/20 text-muted-foreground' : ''
                        } ${isToday(date) ? 'bg-primary/10' : ''}`}
                      >
                        <p className={`text-sm font-medium mb-1 ${
                          isToday(date) ? 'text-primary' : ''
                        }`}>
                          {format(date, 'd')}
                        </p>
                        <div className="space-y-1">
                          {dayAppts.slice(0, 3).map((appt) => (
                            <div
                              key={appt.id}
                              className={`text-xs p-1 rounded truncate ${getStatusColor(appt.status)}`}
                              title={`${appt.scheduled_time} - ${appt.client_name}`}
                            >
                              {appt.scheduled_time} {appt.service_type.replace('_', ' ')}
                            </div>
                          ))}
                          {dayAppts.length > 3 && (
                            <p className="text-xs text-muted-foreground">
                              +{dayAppts.length - 3} more
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Legend */}
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-blue-100 border border-blue-200"></div>
            <span>Scheduled</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-yellow-100 border border-yellow-200"></div>
            <span>In Progress</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-green-100 border border-green-200"></div>
            <span>Completed</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-red-100 border border-red-200"></div>
            <span>Cancelled</span>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default CalendarPage;
