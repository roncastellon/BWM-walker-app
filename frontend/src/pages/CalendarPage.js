import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';
import { 
  Clock, User, PawPrint, ChevronLeft, ChevronRight, 
  CalendarDays, CalendarRange, Calendar as CalendarIcon 
} from 'lucide-react';
import { 
  format, addDays, subDays, addWeeks, subWeeks, addMonths, subMonths,
  startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval,
  isSameMonth, isToday
} from 'date-fns';
import { toast } from 'sonner';

const CalendarPage = () => {
  const { api, isAdmin } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [walkers, setWalkers] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedWalker, setSelectedWalker] = useState('all');
  const [viewMode, setViewMode] = useState('week');
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

  // Get walker color by ID
  const getWalkerColor = (walkerId) => {
    const walker = walkers.find(w => w.id === walkerId);
    return walker?.walker_color || '#9CA3AF'; // gray if no walker assigned
  };

  // Get walker name by ID
  const getWalkerName = (walkerId) => {
    const walker = walkers.find(w => w.id === walkerId);
    return walker?.full_name || 'Unassigned';
  };

  // Generate styles based on walker color
  const getAppointmentStyles = (appt) => {
    const color = appt.walker_id ? getWalkerColor(appt.walker_id) : '#9CA3AF';
    return {
      backgroundColor: `${color}20`,
      borderColor: color,
      borderWidth: '2px',
      borderStyle: 'solid',
    };
  };

  const getStatusBadgeColor = (status) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-100 text-blue-800';
      case 'in_progress': return 'bg-yellow-100 text-yellow-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
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

  const renderAppointmentCard = (appt, compact = false) => (
    <div
      key={appt.id}
      className={`p-2 rounded-lg ${compact ? 'text-xs' : ''}`}
      style={getAppointmentStyles(appt)}
      data-testid={`calendar-appt-${appt.id}`}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="font-medium">{appt.scheduled_time}</span>
        {!compact && (
          <Badge className={`${getStatusBadgeColor(appt.status)} text-xs rounded-full`}>
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
      {!compact && (
        <p className="text-xs flex items-center gap-1 mt-1" style={{ color: getWalkerColor(appt.walker_id) }}>
          <PawPrint className="w-3 h-3" />
          <span className="font-medium">{appt.walker_id ? getWalkerName(appt.walker_id) : 'Unassigned'}</span>
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
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: walker.walker_color }}
                  />
                  {walker.full_name}
                </div>
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
                <SelectTrigger className="w-44" data-testid="filter-walker">
                  <SelectValue placeholder="Filter by walker" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Walkers</SelectItem>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {walkers.map((walker) => (
                    <SelectItem key={walker.id} value={walker.id}>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: walker.walker_color }}
                        />
                        {walker.full_name}
                      </div>
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
              <div className="grid grid-cols-7 border-b bg-muted/30">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                  <div key={day} className="p-3 text-center text-sm font-medium text-muted-foreground">
                    {day}
                  </div>
                ))}
              </div>
              
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
                              className="text-xs p-1 rounded truncate"
                              style={getAppointmentStyles(appt)}
                              title={`${appt.scheduled_time} - ${appt.client_name} (${getWalkerName(appt.walker_id)})`}
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

        {/* Walker Legend */}
        <Card className="rounded-2xl shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Walker Legend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              {walkers.map((walker) => (
                <div key={walker.id} className="flex items-center gap-2">
                  <div 
                    className="w-4 h-4 rounded-full border-2" 
                    style={{ 
                      backgroundColor: `${walker.walker_color}20`,
                      borderColor: walker.walker_color 
                    }}
                  />
                  <span className="text-sm">{walker.full_name}</span>
                </div>
              ))}
              <div className="flex items-center gap-2">
                <div 
                  className="w-4 h-4 rounded-full border-2" 
                  style={{ 
                    backgroundColor: '#9CA3AF20',
                    borderColor: '#9CA3AF' 
                  }}
                />
                <span className="text-sm text-muted-foreground">Unassigned</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default CalendarPage;
