import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { 
  Calendar, Clock, User, PawPrint, AlertTriangle, 
  UserCheck, ChevronRight, CalendarOff, RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';

// Helper function to format 24-hour time to 12-hour AM/PM format
const formatTime12Hour = (timeStr) => {
  if (!timeStr) return '';
  const [hours, minutes] = timeStr.split(':');
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
};

const AdminTimeOffPage = () => {
  const { api } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [timeOffRequests, setTimeOffRequests] = useState([]);
  const [needsReassignment, setNeedsReassignment] = useState([]);
  const [walkers, setWalkers] = useState([]);
  
  // Reassignment dialog state
  const [reassignDialog, setReassignDialog] = useState({
    open: false,
    appointment: null,
    selectedWalkerId: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [timeOffRes, reassignRes, walkersRes] = await Promise.all([
        api.get('/time-off'),
        api.get('/appointments/needs-reassignment'),
        api.get('/users/walkers')
      ]);
      setTimeOffRequests(timeOffRes.data || []);
      setNeedsReassignment(reassignRes.data || []);
      setWalkers(walkersRes.data || []);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const openReassignDialog = (appt) => {
    setReassignDialog({
      open: true,
      appointment: appt,
      selectedWalkerId: ''
    });
  };

  const handleReassign = async () => {
    if (!reassignDialog.selectedWalkerId) {
      toast.error('Please select a walker');
      return;
    }

    try {
      await api.put(`/appointments/${reassignDialog.appointment.id}`, {
        walker_id: reassignDialog.selectedWalkerId,
        needs_reassignment: false
      });
      toast.success('Appointment reassigned successfully');
      setReassignDialog({ open: false, appointment: null, selectedWalkerId: '' });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to reassign appointment');
    }
  };

  const viewInCalendar = (apptId) => {
    navigate(`/admin/calendar?highlight=${apptId}`);
  };

  // Group appointments by date
  const groupedAppointments = needsReassignment.reduce((acc, appt) => {
    const date = appt.scheduled_date;
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(appt);
    return acc;
  }, {});

  // Sort dates
  const sortedDates = Object.keys(groupedAppointments).sort();

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
      <div className="space-y-6" data-testid="admin-timeoff-page">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-heading font-bold">Time Off & Reassignments</h1>
            <p className="text-muted-foreground">Manage walker time-off and appointment reassignments</p>
          </div>
          <Button variant="outline" onClick={fetchData} data-testid="refresh-btn">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="rounded-xl border-orange-200 bg-orange-50">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-orange-500 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-orange-600">{needsReassignment.length}</p>
                <p className="text-sm text-orange-700">Needs Reassignment</p>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-xl border-blue-200 bg-blue-50">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-500 flex items-center justify-center">
                <CalendarOff className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-600">{timeOffRequests.length}</p>
                <p className="text-sm text-blue-700">Time-Off Requests</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="reassignment" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="reassignment" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white">
              <AlertTriangle className="w-4 h-4 mr-2" />
              Needs Reassignment ({needsReassignment.length})
            </TabsTrigger>
            <TabsTrigger value="timeoff" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white">
              <CalendarOff className="w-4 h-4 mr-2" />
              Time-Off History ({timeOffRequests.length})
            </TabsTrigger>
          </TabsList>

          {/* Reassignment Tab */}
          <TabsContent value="reassignment" className="space-y-4">
            {needsReassignment.length === 0 ? (
              <Card className="rounded-xl">
                <CardContent className="py-12 text-center">
                  <UserCheck className="w-16 h-16 mx-auto mb-4 text-green-500 opacity-50" />
                  <p className="text-lg font-medium text-green-600">All Appointments Covered!</p>
                  <p className="text-muted-foreground">No appointments need reassignment right now.</p>
                </CardContent>
              </Card>
            ) : (
              sortedDates.map((date) => (
                <Card key={date} className="rounded-xl">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-primary" />
                      {format(parseISO(date), 'EEEE, MMMM d, yyyy')}
                      <Badge variant="destructive" className="rounded-full ml-2">
                        {groupedAppointments[date].length}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {groupedAppointments[date].map((appt) => {
                      // Get pet names from enriched data
                      const petIds = appt.pet_ids || [];
                      
                      return (
                        <div 
                          key={appt.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-orange-50/50 border border-orange-100"
                          data-testid={`reassign-item-${appt.id}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                              <PawPrint className="w-5 h-5 text-orange-600" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{formatTime12Hour(appt.scheduled_time)}</span>
                                <span className="text-muted-foreground">•</span>
                                <span className="capitalize">{appt.service_type?.replace(/_/g, ' ')}</span>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {appt.client?.full_name || 'Unknown Client'}
                                {appt.original_walker && (
                                  <span className="text-red-500"> • Originally: {appt.original_walker.full_name}</span>
                                )}
                              </p>
                              {appt.reassignment_reason && (
                                <Badge variant="outline" className="text-xs mt-1 bg-red-50 text-red-600 border-red-200">
                                  {appt.reassignment_reason === 'walker_time_off' ? 'Walker Time Off' : appt.reassignment_reason}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="rounded-full"
                              onClick={() => viewInCalendar(appt.id)}
                            >
                              View
                            </Button>
                            <Button
                              size="sm"
                              className="rounded-full bg-orange-500 hover:bg-orange-600"
                              onClick={() => openReassignDialog(appt)}
                              data-testid={`reassign-btn-${appt.id}`}
                            >
                              <UserCheck className="w-4 h-4 mr-1" />
                              Reassign
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* Time-Off History Tab */}
          <TabsContent value="timeoff" className="space-y-4">
            {timeOffRequests.length === 0 ? (
              <Card className="rounded-xl">
                <CardContent className="py-12 text-center">
                  <CalendarOff className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-lg font-medium">No Time-Off Requests</p>
                  <p className="text-muted-foreground">Walker time-off requests will appear here.</p>
                </CardContent>
              </Card>
            ) : (
              <Card className="rounded-xl">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CalendarOff className="w-5 h-5 text-blue-500" />
                    Time-Off Requests
                  </CardTitle>
                  <CardDescription>History of all walker time-off requests</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {timeOffRequests.map((request) => (
                    <div 
                      key={request.id}
                      className="flex items-center justify-between p-4 rounded-lg bg-blue-50/50 border border-blue-100"
                      data-testid={`timeoff-item-${request.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="w-10 h-10">
                          <AvatarImage src={request.walker?.profile_image} />
                          <AvatarFallback className="bg-blue-100 text-blue-600">
                            {request.walker?.full_name?.charAt(0) || '?'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{request.walker?.full_name || 'Unknown Walker'}</p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Calendar className="w-3 h-3" />
                            {format(parseISO(request.start_date), 'MMM d')} - {format(parseISO(request.end_date), 'MMM d, yyyy')}
                          </div>
                          {request.reason && (
                            <p className="text-xs text-muted-foreground mt-1 italic">"{request.reason}"</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge 
                          className={`rounded-full ${
                            request.status === 'approved' 
                              ? 'bg-green-100 text-green-700' 
                              : request.status === 'pending'
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {request.status}
                        </Badge>
                        {request.affected_appointments?.length > 0 && (
                          <Badge variant="outline" className="rounded-full">
                            {request.affected_appointments.length} affected
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Reassignment Dialog */}
      <Dialog open={reassignDialog.open} onOpenChange={(open) => setReassignDialog(prev => ({ ...prev, open }))}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-orange-500" />
              Reassign Appointment
            </DialogTitle>
            <DialogDescription>
              Select a new walker for this appointment
            </DialogDescription>
          </DialogHeader>
          
          {reassignDialog.appointment && (
            <div className="space-y-4">
              {/* Appointment Details */}
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">
                    {reassignDialog.appointment.scheduled_date} at {formatTime12Hour(reassignDialog.appointment.scheduled_time)}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Client: {reassignDialog.appointment.client?.full_name || 'Unknown'}
                </p>
                <p className="text-sm text-muted-foreground capitalize">
                  Service: {reassignDialog.appointment.service_type?.replace(/_/g, ' ')}
                </p>
                {reassignDialog.appointment.original_walker && (
                  <p className="text-sm text-red-500">
                    Originally assigned to: {reassignDialog.appointment.original_walker.full_name}
                  </p>
                )}
              </div>

              {/* Walker Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Select New Walker</label>
                <Select 
                  value={reassignDialog.selectedWalkerId} 
                  onValueChange={(value) => setReassignDialog(prev => ({ ...prev, selectedWalkerId: value }))}
                >
                  <SelectTrigger data-testid="select-new-walker">
                    <SelectValue placeholder="Choose a walker..." />
                  </SelectTrigger>
                  <SelectContent>
                    {walkers
                      .filter(w => w.id !== reassignDialog.appointment?.walker_id)
                      .map((walker) => (
                        <SelectItem key={walker.id} value={walker.id}>
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: walker.walker_color || '#3B82F6' }}
                            />
                            {walker.full_name}
                          </div>
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setReassignDialog({ open: false, appointment: null, selectedWalkerId: '' })}>
              Cancel
            </Button>
            <Button onClick={handleReassign} className="bg-orange-500 hover:bg-orange-600" data-testid="confirm-reassign-btn">
              <UserCheck className="w-4 h-4 mr-2" />
              Reassign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default AdminTimeOffPage;
