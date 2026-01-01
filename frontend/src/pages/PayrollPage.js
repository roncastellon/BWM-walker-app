import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Calendar } from '../components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { CalendarIcon, Clock, DollarSign, CheckCircle, Send } from 'lucide-react';
import { format, startOfWeek, endOfWeek, addDays } from 'date-fns';
import { toast } from 'sonner';

const PayrollPage = () => {
  const { api } = useAuth();
  const [timesheets, setTimesheets] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [selectedWeekStart, setSelectedWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [tsRes, apptsRes] = await Promise.all([
        api.get('/timesheets'),
        api.get('/appointments'),
      ]);
      setTimesheets(tsRes.data);
      setAppointments(apptsRes.data);
    } catch (error) {
      toast.error('Failed to load payroll data');
    } finally {
      setLoading(false);
    }
  };

  const weekEnd = endOfWeek(selectedWeekStart, { weekStartsOn: 1 });
  const weekStartStr = format(selectedWeekStart, 'yyyy-MM-dd');
  const weekEndStr = format(weekEnd, 'yyyy-MM-dd');

  const weekAppointments = appointments.filter(appt => {
    return appt.status === 'completed' &&
           appt.scheduled_date >= weekStartStr &&
           appt.scheduled_date <= weekEndStr;
  });

  const totalMinutes = weekAppointments.reduce((sum, appt) => sum + (appt.actual_duration_minutes || 0), 0);
  const totalHours = (totalMinutes / 60).toFixed(2);
  const hourlyRate = 20; // Example rate
  const weeklyEarnings = (parseFloat(totalHours) * hourlyRate).toFixed(2);

  const existingTimesheet = timesheets.find(ts => ts.week_start === weekStartStr);

  const submitTimesheet = async () => {
    if (weekAppointments.length === 0) {
      toast.error('No completed walks for this week');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/timesheets/submit', null, {
        params: {
          week_start: weekStartStr,
          week_end: weekEndStr,
        }
      });
      toast.success('Timesheet submitted successfully!');
      fetchData();
    } catch (error) {
      toast.error('Failed to submit timesheet');
    } finally {
      setSubmitting(false);
    }
  };

  // Generate week days
  const weekDays = [];
  for (let i = 0; i < 7; i++) {
    weekDays.push(addDays(selectedWeekStart, i));
  }

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
      <div className="space-y-8" data-testid="payroll-page">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-heading font-bold">Payroll</h1>
            <p className="text-muted-foreground">Track your hours and submit timesheets</p>
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="rounded-full" data-testid="select-week">
                <CalendarIcon className="w-4 h-4 mr-2" />
                Week of {format(selectedWeekStart, 'MMM d')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={selectedWeekStart}
                onSelect={(date) => date && setSelectedWeekStart(startOfWeek(date, { weekStartsOn: 1 }))}
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="rounded-2xl shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Hours</p>
                  <p className="text-3xl font-bold mt-1">{totalHours}h</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Clock className="w-6 h-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Completed Walks</p>
                  <p className="text-3xl font-bold mt-1">{weekAppointments.length}</p>
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
                  <p className="text-sm text-muted-foreground">Est. Earnings</p>
                  <p className="text-3xl font-bold mt-1">${weeklyEarnings}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Weekly Breakdown */}
        <Card className="rounded-2xl shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Weekly Breakdown</CardTitle>
              <CardDescription>
                {format(selectedWeekStart, 'MMMM d')} - {format(weekEnd, 'MMMM d, yyyy')}
              </CardDescription>
            </div>
            {existingTimesheet ? (
              <Badge className={`rounded-full ${existingTimesheet.approved ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                {existingTimesheet.approved ? 'Approved' : 'Submitted'}
              </Badge>
            ) : (
              <Button
                onClick={submitTimesheet}
                disabled={submitting || weekAppointments.length === 0}
                className="rounded-full"
                data-testid="submit-timesheet-btn"
              >
                <Send className="w-4 h-4 mr-2" />
                {submitting ? 'Submitting...' : 'Submit Timesheet'}
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {weekDays.map((day) => {
                const dayStr = format(day, 'yyyy-MM-dd');
                const dayAppointments = weekAppointments.filter(a => a.scheduled_date === dayStr);
                const dayMinutes = dayAppointments.reduce((sum, a) => sum + (a.actual_duration_minutes || 0), 0);

                return (
                  <div
                    key={dayStr}
                    className={`p-4 rounded-xl ${dayAppointments.length > 0 ? 'bg-muted/50' : 'bg-muted/20'}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <span className="font-medium">{format(day, 'EEEE')}</span>
                        <span className="text-sm text-muted-foreground">{format(day, 'MMM d')}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-medium">{(dayMinutes / 60).toFixed(1)}h</span>
                        <span className="text-sm text-muted-foreground ml-2">
                          ({dayAppointments.length} walks)
                        </span>
                      </div>
                    </div>
                    {dayAppointments.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {dayAppointments.map((appt) => (
                          <Badge key={appt.id} variant="secondary" className="rounded-full text-xs">
                            {appt.scheduled_time} - {appt.actual_duration_minutes}min
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Previous Timesheets */}
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle>Previous Timesheets</CardTitle>
            <CardDescription>Your submitted timesheets</CardDescription>
          </CardHeader>
          <CardContent>
            {timesheets.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No timesheets submitted yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {timesheets.map((ts) => (
                  <div
                    key={ts.id}
                    className="flex items-center justify-between p-4 rounded-xl bg-muted/30"
                  >
                    <div>
                      <p className="font-medium">
                        Week of {format(new Date(ts.week_start), 'MMM d, yyyy')}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {ts.total_hours}h • {ts.total_walks} walks
                      </p>
                    </div>
                    <Badge className={`rounded-full ${ts.approved ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                      {ts.approved ? 'Approved' : 'Pending'}
                    </Badge>
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

export default PayrollPage;
