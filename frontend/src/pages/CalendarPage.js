import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Calendar } from '../components/ui/calendar';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Clock, User, PawPrint } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

const CalendarPage = () => {
  const { api, isAdmin } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [walkers, setWalkers] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedWalker, setSelectedWalker] = useState('all');
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
      case 'scheduled': return 'bg-blue-100 text-blue-800';
      case 'in_progress': return 'bg-yellow-100 text-yellow-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
  const filteredAppointments = appointments.filter(appt => {
    const dateMatch = appt.scheduled_date === selectedDateStr;
    const walkerMatch = selectedWalker === 'all' || appt.walker_id === selectedWalker || (!appt.walker_id && selectedWalker === 'unassigned');
    return dateMatch && walkerMatch;
  });

  // Get dates with appointments for calendar highlighting
  const appointmentDates = [...new Set(appointments.map(a => a.scheduled_date))];

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
      <div className="space-y-8" data-testid="calendar-page">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-heading font-bold">
              {isAdmin ? 'Team Calendar' : 'My Schedule'}
            </h1>
            <p className="text-muted-foreground">View and manage appointments</p>
          </div>
          {isAdmin && (
            <Select value={selectedWalker} onValueChange={setSelectedWalker}>
              <SelectTrigger className="w-48" data-testid="filter-walker">
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar */}
          <Card className="rounded-2xl shadow-sm lg:col-span-1">
            <CardHeader>
              <CardTitle>Select Date</CardTitle>
            </CardHeader>
            <CardContent className="flex justify-center">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                modifiers={{
                  hasAppointment: (date) => appointmentDates.includes(format(date, 'yyyy-MM-dd'))
                }}
                modifiersStyles={{
                  hasAppointment: { backgroundColor: 'hsl(25 95% 53% / 0.2)', fontWeight: 'bold' }
                }}
                className="rounded-md"
              />
            </CardContent>
          </Card>

          {/* Appointments for Selected Date */}
          <Card className="rounded-2xl shadow-sm lg:col-span-2">
            <CardHeader>
              <CardTitle>
                {format(selectedDate, 'EEEE, MMMM d, yyyy')}
              </CardTitle>
              <CardDescription>
                {filteredAppointments.length} appointment(s) scheduled
              </CardDescription>
            </CardHeader>
            <CardContent>
              {filteredAppointments.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Clock className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg">No appointments</p>
                  <p className="text-sm">No walks scheduled for this date</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredAppointments.sort((a, b) => a.scheduled_time.localeCompare(b.scheduled_time)).map((appt) => (
                    <div
                      key={appt.id}
                      className="p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
                      data-testid={`calendar-appt-${appt.id}`}
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                            <Clock className="w-6 h-6 text-primary" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-bold">{appt.scheduled_time}</span>
                              <Badge className={`${getStatusColor(appt.status)} rounded-full text-xs`}>
                                {appt.status}
                              </Badge>
                            </div>
                            <p className="font-medium capitalize">{appt.service_type.replace('_', ' ')}</p>
                            <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <User className="w-3 h-3" />
                                {appt.client_name}
                              </span>
                              {appt.walker_name && (
                                <span className="flex items-center gap-1">
                                  <PawPrint className="w-3 h-3" />
                                  {appt.walker_name}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {isAdmin && (
                          <div className="flex items-center gap-2">
                            <Select
                              value={appt.walker_id || ''}
                              onValueChange={(value) => assignWalker(appt.id, value)}
                            >
                              <SelectTrigger className="w-40" data-testid={`assign-walker-${appt.id}`}>
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
                          </div>
                        )}
                      </div>

                      {appt.notes && (
                        <div className="mt-3 pt-3 border-t border-border">
                          <p className="text-sm text-muted-foreground">
                            <strong>Notes:</strong> {appt.notes}
                          </p>
                        </div>
                      )}

                      {appt.actual_duration_minutes && (
                        <div className="mt-2 text-sm text-green-600">
                          Completed in {appt.actual_duration_minutes} minutes
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default CalendarPage;
