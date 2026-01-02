import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';
import { 
  Clock, User, PawPrint, ChevronLeft, ChevronRight, 
  CalendarDays, CalendarRange, Calendar as CalendarIcon,
  MapPin, Phone, Mail, X, Plus, Edit, Trash2, Save
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
  const [clients, setClients] = useState([]);
  const [services, setServices] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedWalker, setSelectedWalker] = useState('all');
  const [viewMode, setViewMode] = useState('week');
  const [loading, setLoading] = useState(true);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [appointmentDetail, setAppointmentDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Admin add/edit appointment state
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedClientPets, setSelectedClientPets] = useState([]);
  const [formData, setFormData] = useState({
    client_id: '',
    walker_id: '',
    pet_ids: [],
    service_type: '',
    scheduled_date: '',
    scheduled_time: '',
    notes: '',
    status: 'scheduled'
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const requests = [
        api.get('/appointments/calendar'),
        api.get('/users/walkers'),
        api.get('/services'),
      ];
      
      if (isAdmin) {
        requests.push(api.get('/users?role=client'));
      }
      
      const responses = await Promise.all(requests);
      setAppointments(responses[0].data);
      setWalkers(responses[1].data);
      setServices(responses[2].data);
      
      if (isAdmin && responses[3]) {
        setClients(responses[3].data);
      }
    } catch (error) {
      toast.error('Failed to load calendar data');
    } finally {
      setLoading(false);
    }
  };

  const fetchClientPets = async (clientId) => {
    if (!clientId) {
      setSelectedClientPets([]);
      return;
    }
    try {
      const response = await api.get(`/pets?owner_id=${clientId}`);
      setSelectedClientPets(response.data);
    } catch (error) {
      setSelectedClientPets([]);
    }
  };

  const openAppointmentDetail = async (appt) => {
    setSelectedAppointment(appt);
    setDetailLoading(true);
    try {
      const response = await api.get(`/appointments/${appt.id}/detail`);
      setAppointmentDetail(response.data);
    } catch (error) {
      toast.error('Failed to load appointment details');
      setAppointmentDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const closeAppointmentDetail = () => {
    setSelectedAppointment(null);
    setAppointmentDetail(null);
    setEditMode(false);
  };

  const assignWalker = async (apptId, walkerId) => {
    try {
      await api.put(`/appointments/${apptId}`, { walker_id: walkerId });
      toast.success('Walker assigned successfully');
      fetchData();
      if (selectedAppointment?.id === apptId) {
        const response = await api.get(`/appointments/${apptId}/detail`);
        setAppointmentDetail(response.data);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to assign walker');
    }
  };

  const openAddDialog = (date = null) => {
    setFormData({
      client_id: '',
      walker_id: '',
      pet_ids: [],
      service_type: '',
      scheduled_date: date ? format(date, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
      scheduled_time: '',
      notes: '',
      status: 'scheduled'
    });
    setSelectedClientPets([]);
    setAddDialogOpen(true);
  };

  const openEditDialog = () => {
    if (!appointmentDetail) return;
    setFormData({
      client_id: appointmentDetail.client_id || '',
      walker_id: appointmentDetail.walker_id || '',
      pet_ids: appointmentDetail.pet_ids || [],
      service_type: appointmentDetail.service_type || '',
      scheduled_date: appointmentDetail.scheduled_date || '',
      scheduled_time: appointmentDetail.scheduled_time || '',
      notes: appointmentDetail.notes || '',
      status: appointmentDetail.status || 'scheduled'
    });
    fetchClientPets(appointmentDetail.client_id);
    setEditMode(true);
  };

  const handleCreateAppointment = async (e) => {
    e.preventDefault();
    if (!formData.client_id || !formData.service_type || !formData.scheduled_date || !formData.scheduled_time) {
      toast.error('Please fill in all required fields');
      return;
    }
    
    try {
      await api.post('/appointments/admin', formData);
      toast.success('Appointment created successfully');
      setAddDialogOpen(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create appointment');
    }
  };

  const handleUpdateAppointment = async () => {
    if (!appointmentDetail) return;
    
    try {
      await api.put(`/appointments/${appointmentDetail.id}`, formData);
      toast.success('Appointment updated successfully');
      setEditMode(false);
      closeAppointmentDetail();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update appointment');
    }
  };

  const handleDeleteAppointment = async () => {
    if (!appointmentDetail || !window.confirm('Are you sure you want to cancel this appointment?')) return;
    
    try {
      await api.put(`/appointments/${appointmentDetail.id}`, { status: 'cancelled' });
      toast.success('Appointment cancelled');
      closeAppointmentDetail();
      fetchData();
    } catch (error) {
      toast.error('Failed to cancel appointment');
    }
  };

  const getWalkerColor = (walkerId) => {
    const walker = walkers.find(w => w.id === walkerId);
    return walker?.walker_color || '#9CA3AF';
  };

  const getWalkerName = (walkerId) => {
    const walker = walkers.find(w => w.id === walkerId);
    return walker?.full_name || 'Unassigned';
  };

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
      const notCancelled = appt.status !== 'cancelled';
      return dateMatch && walkerMatch && notCancelled;
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

  const timeSlots = ['07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'];

  const renderAppointmentCard = (appt, compact = false) => (
    <div
      key={appt.id}
      className={`p-2 rounded-lg cursor-pointer hover:opacity-80 transition-opacity ${compact ? 'text-xs' : ''}`}
      style={getAppointmentStyles(appt)}
      data-testid={`calendar-appt-${appt.id}`}
      onClick={() => openAppointmentDetail(appt)}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="font-medium">{appt.scheduled_time}</span>
        {!compact && (
          <Badge className={`${getStatusBadgeColor(appt.status)} text-xs rounded-full`}>
            {appt.status}
          </Badge>
        )}
      </div>
      <p className={`${compact ? 'truncate' : ''}`}>{appt.client_name}</p>
      {!compact && (
        <p className="text-xs text-muted-foreground capitalize">
          {appt.service_type?.replace(/_/g, ' ')} • {getWalkerName(appt.walker_id)}
        </p>
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
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-heading font-bold">Calendar</h1>
            <p className="text-muted-foreground">Manage appointments and schedules</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {isAdmin && (
              <Button className="rounded-full" onClick={() => openAddDialog()} data-testid="add-appointment-btn">
                <Plus className="w-4 h-4 mr-2" />
                Add Walk
              </Button>
            )}
            <Select value={selectedWalker} onValueChange={setSelectedWalker}>
              <SelectTrigger className="w-[180px]" data-testid="filter-walker">
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
          </div>
        </div>

        {/* View Toggle & Navigation */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <Tabs value={viewMode} onValueChange={setViewMode}>
            <TabsList>
              <TabsTrigger value="day" data-testid="view-day">
                <CalendarDays className="w-4 h-4 mr-1" />
                Day
              </TabsTrigger>
              <TabsTrigger value="week" data-testid="view-week">
                <CalendarRange className="w-4 h-4 mr-1" />
                Week
              </TabsTrigger>
              <TabsTrigger value="month" data-testid="view-month">
                <CalendarIcon className="w-4 h-4 mr-1" />
                Month
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => navigate('prev')} data-testid="nav-prev">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" onClick={goToToday} data-testid="nav-today">
              Today
            </Button>
            <Button variant="outline" size="icon" onClick={() => navigate('next')} data-testid="nav-next">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          <h2 className="text-xl font-semibold">{getViewTitle()}</h2>
        </div>

        {/* Calendar Views */}
        {viewMode === 'day' && (
          <Card className="rounded-2xl shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{format(currentDate, 'EEEE, MMMM d')}</CardTitle>
                  <CardDescription>
                    {filterAppointments(currentDate).length} appointment(s)
                  </CardDescription>
                </div>
                {isAdmin && (
                  <Button size="sm" variant="outline" onClick={() => openAddDialog(currentDate)}>
                    <Plus className="w-4 h-4 mr-1" /> Add
                  </Button>
                )}
              </div>
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
                    {isAdmin && (
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="w-full mt-1 h-6 text-xs"
                        onClick={() => openAddDialog(date)}
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                    )}
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
                        <div className="flex items-center justify-between">
                          <p className={`text-sm font-medium mb-1 ${
                            isToday(date) ? 'text-primary' : ''
                          }`}>
                            {format(date, 'd')}
                          </p>
                          {isAdmin && isCurrentMonth && (
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="h-5 w-5 p-0"
                              onClick={() => openAddDialog(date)}
                            >
                              <Plus className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                        <div className="space-y-1">
                          {dayAppts.slice(0, 3).map((appt) => (
                            <div
                              key={appt.id}
                              className="text-xs p-1 rounded truncate cursor-pointer hover:opacity-80"
                              style={getAppointmentStyles(appt)}
                              title={`${appt.scheduled_time} - ${appt.client_name} (${getWalkerName(appt.walker_id)})`}
                              onClick={() => openAppointmentDetail(appt)}
                            >
                              {appt.scheduled_time} {appt.service_type?.replace(/_/g, ' ')}
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

        {/* Add Appointment Dialog (Admin) */}
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Appointment</DialogTitle>
              <DialogDescription>Schedule a walk or service for a client</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateAppointment} className="space-y-4">
              <div className="space-y-2">
                <Label>Client *</Label>
                <Select 
                  value={formData.client_id} 
                  onValueChange={(value) => {
                    setFormData({ ...formData, client_id: value, pet_ids: [] });
                    fetchClientPets(value);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedClientPets.length > 0 && (
                <div className="space-y-2">
                  <Label>Pet(s)</Label>
                  <div className="flex flex-wrap gap-2">
                    {selectedClientPets.map((pet) => (
                      <Button
                        key={pet.id}
                        type="button"
                        variant={formData.pet_ids.includes(pet.id) ? 'default' : 'outline'}
                        size="sm"
                        className="rounded-full"
                        onClick={() => {
                          const ids = formData.pet_ids.includes(pet.id)
                            ? formData.pet_ids.filter(id => id !== pet.id)
                            : [...formData.pet_ids, pet.id];
                          setFormData({ ...formData, pet_ids: ids });
                        }}
                      >
                        {pet.name}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Service *</Label>
                <Select value={formData.service_type} onValueChange={(value) => setFormData({ ...formData, service_type: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a service" />
                  </SelectTrigger>
                  <SelectContent>
                    {services.map((service) => (
                      <SelectItem key={service.id} value={service.service_type}>
                        {service.name} - ${service.price.toFixed(2)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Date *</Label>
                  <Input 
                    type="date" 
                    value={formData.scheduled_date}
                    onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Time *</Label>
                  <Select value={formData.scheduled_time} onValueChange={(value) => setFormData({ ...formData, scheduled_time: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select time" />
                    </SelectTrigger>
                    <SelectContent>
                      {timeSlots.map((time) => (
                        <SelectItem key={time} value={time}>{time}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Assign Walker</Label>
                <Select value={formData.walker_id || 'none'} onValueChange={(value) => setFormData({ ...formData, walker_id: value === 'none' ? '' : value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a walker (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {walkers.map((walker) => (
                      <SelectItem key={walker.id} value={walker.id}>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: walker.walker_color }} />
                          {walker.full_name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  placeholder="Any special instructions..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>

              <Button type="submit" className="w-full rounded-full">
                Create Appointment
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        {/* Appointment Detail Modal */}
        <Dialog open={!!selectedAppointment} onOpenChange={closeAppointmentDetail}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-primary" />
                Appointment Details
              </DialogTitle>
              <DialogDescription>
                {selectedAppointment?.scheduled_date} at {selectedAppointment?.scheduled_time}
              </DialogDescription>
            </DialogHeader>
            
            {detailLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : appointmentDetail ? (
              editMode ? (
                /* Edit Mode */
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Date</Label>
                      <Input 
                        type="date" 
                        value={formData.scheduled_date}
                        onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Time</Label>
                      <Select value={formData.scheduled_time} onValueChange={(value) => setFormData({ ...formData, scheduled_time: value })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {timeSlots.map((time) => (
                            <SelectItem key={time} value={time}>{time}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Service</Label>
                    <Select value={formData.service_type} onValueChange={(value) => setFormData({ ...formData, service_type: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {services.map((service) => (
                          <SelectItem key={service.id} value={service.service_type}>
                            {service.name} - ${service.price.toFixed(2)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Walker</Label>
                    <Select value={formData.walker_id || 'none'} onValueChange={(value) => setFormData({ ...formData, walker_id: value === 'none' ? '' : value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Unassigned</SelectItem>
                        {walkers.map((walker) => (
                          <SelectItem key={walker.id} value={walker.id}>
                            {walker.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="scheduled">Scheduled</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Notes</Label>
                    <Textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={() => setEditMode(false)}>
                      Cancel
                    </Button>
                    <Button className="flex-1" onClick={handleUpdateAppointment}>
                      <Save className="w-4 h-4 mr-2" />
                      Save Changes
                    </Button>
                  </div>
                </div>
              ) : (
                /* View Mode */
                <div className="space-y-6">
                  {/* Admin Actions */}
                  {isAdmin && appointmentDetail.status !== 'cancelled' && (
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={openEditDialog}>
                        <Edit className="w-4 h-4 mr-1" />
                        Edit
                      </Button>
                      <Button variant="destructive" size="sm" onClick={handleDeleteAppointment}>
                        <X className="w-4 h-4 mr-1" />
                        Cancel
                      </Button>
                    </div>
                  )}

                  {/* Service Info */}
                  <div className="p-4 rounded-xl bg-primary/10">
                    <h3 className="font-semibold text-lg capitalize">
                      {appointmentDetail.service?.name || appointmentDetail.service_type?.replace(/_/g, ' ')}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {appointmentDetail.service?.description}
                    </p>
                    <div className="flex items-center gap-4 mt-2">
                      <Badge className={`${getStatusBadgeColor(appointmentDetail.status)} rounded-full`}>
                        {appointmentDetail.status}
                      </Badge>
                      {appointmentDetail.service?.price && (
                        <span className="font-semibold text-primary">${appointmentDetail.service.price.toFixed(2)}</span>
                      )}
                    </div>
                  </div>

                  {/* Client Info */}
                  {appointmentDetail.client && (
                    <div className="space-y-2">
                      <h4 className="font-medium flex items-center gap-2">
                        <User className="w-4 h-4" /> Client
                      </h4>
                      <div className="p-3 rounded-lg bg-muted/50">
                        <p className="font-medium">{appointmentDetail.client.full_name}</p>
                        {appointmentDetail.client.email && (
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <Mail className="w-3 h-3" /> {appointmentDetail.client.email}
                          </p>
                        )}
                        {appointmentDetail.client.phone && (
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <Phone className="w-3 h-3" /> {appointmentDetail.client.phone}
                          </p>
                        )}
                        {appointmentDetail.client.address && (
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <MapPin className="w-3 h-3" /> {appointmentDetail.client.address}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Walker Info */}
                  <div className="space-y-2">
                    <h4 className="font-medium flex items-center gap-2">
                      <PawPrint className="w-4 h-4" /> Walker
                    </h4>
                    {appointmentDetail.walker ? (
                      <div 
                        className="p-3 rounded-lg"
                        style={{ 
                          backgroundColor: `${appointmentDetail.walker.walker_color}15`,
                          borderLeft: `4px solid ${appointmentDetail.walker.walker_color}`
                        }}
                      >
                        <p className="font-medium">{appointmentDetail.walker.full_name}</p>
                        {appointmentDetail.walker.phone && (
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <Phone className="w-3 h-3" /> {appointmentDetail.walker.phone}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="p-3 rounded-lg bg-gray-100 text-gray-600">
                        <p>No walker assigned</p>
                        {isAdmin && (
                          <Select onValueChange={(value) => assignWalker(appointmentDetail.id, value)}>
                            <SelectTrigger className="mt-2">
                              <SelectValue placeholder="Assign a walker" />
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
                    )}
                  </div>

                  {/* Pets */}
                  {appointmentDetail.pets && appointmentDetail.pets.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-medium flex items-center gap-2">
                        <PawPrint className="w-4 h-4" /> Pet(s)
                      </h4>
                      <div className="grid gap-2">
                        {appointmentDetail.pets.map((pet) => (
                          <div key={pet.id} className="p-3 rounded-lg bg-muted/50 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                              <PawPrint className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium">{pet.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {pet.breed || pet.species} {pet.age && `• ${pet.age} years`} {pet.weight && `• ${pet.weight} lbs`}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  {appointmentDetail.notes && (
                    <div className="space-y-2">
                      <h4 className="font-medium">Notes</h4>
                      <p className="text-sm text-muted-foreground p-3 rounded-lg bg-muted/50">
                        {appointmentDetail.notes}
                      </p>
                    </div>
                  )}

                  {/* Duration info if completed */}
                  {appointmentDetail.status === 'completed' && appointmentDetail.actual_duration_minutes && (
                    <div className="p-3 rounded-lg bg-green-50 text-green-800">
                      <p className="text-sm">
                        <Clock className="w-4 h-4 inline mr-1" />
                        Completed in {appointmentDetail.actual_duration_minutes} minutes
                      </p>
                    </div>
                  )}
                </div>
              )
            ) : (
              <p className="text-center py-8 text-muted-foreground">No details available</p>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default CalendarPage;
