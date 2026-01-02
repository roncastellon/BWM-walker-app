import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Clock, DollarSign, CheckCircle, Send, PawPrint, Route, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

const PayrollPage = () => {
  const { api } = useAuth();
  const [currentPayroll, setCurrentPayroll] = useState(null);
  const [timesheets, setTimesheets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [payrollRes, tsRes] = await Promise.all([
        api.get('/payroll/current'),
        api.get('/timesheets'),
      ]);
      setCurrentPayroll(payrollRes.data);
      setTimesheets(tsRes.data);
    } catch (error) {
      toast.error('Failed to load payroll data');
    } finally {
      setLoading(false);
    }
  };

  const submitTimesheet = async () => {
    if (!currentPayroll || currentPayroll.total_walks === 0) {
      toast.error('No walks to submit');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/timesheets/submit');
      toast.success('Timesheet submitted successfully!');
      fetchData(); // Refresh to show reset and new timesheet
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to submit timesheet');
    } finally {
      setSubmitting(false);
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
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hrs > 0) {
      return `${hrs}h ${mins}m`;
    }
    return `${mins} min`;
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
      <div className="space-y-6" data-testid="payroll-page">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-heading font-bold">Time Sheets & Payroll</h1>
            <p className="text-muted-foreground">Track your hours and submit timesheets</p>
          </div>
          <Button variant="outline" className="rounded-full" onClick={fetchData}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Pay Rates Info */}
        <Card className="rounded-2xl shadow-sm bg-primary/5 border-primary/20">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <span className="font-medium">Pay Rates:</span>
              <Badge className="bg-primary/10 text-primary rounded-full">30-min walk: $15.00</Badge>
              <Badge className="bg-primary/10 text-primary rounded-full">60-min walk: $30.00</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Current Period Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="rounded-2xl shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Hours Walked</p>
                  <p className="text-3xl font-bold mt-1">
                    {currentPayroll?.total_hours || 0}h
                  </p>
                  <p className="text-xs text-muted-foreground">
                    ({currentPayroll?.total_minutes || 0} minutes)
                  </p>
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
                  <p className="text-sm text-muted-foreground">Walks Completed</p>
                  <p className="text-3xl font-bold mt-1">
                    {currentPayroll?.total_walks || 0}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-secondary/10 flex items-center justify-center">
                  <PawPrint className="w-6 h-6 text-secondary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm border-2 border-green-200 bg-green-50/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Amount Due</p>
                  <p className="text-3xl font-bold mt-1 text-green-600">
                    ${currentPayroll?.total_earnings?.toFixed(2) || '0.00'}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Current Period Walks */}
        <Card className="rounded-2xl shadow-sm">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle>Pending Walks</CardTitle>
              <CardDescription>
                Walks accumulated since last timesheet submission
              </CardDescription>
            </div>
            <Button
              onClick={submitTimesheet}
              disabled={submitting || !currentPayroll || currentPayroll.total_walks === 0}
              className="rounded-full"
              data-testid="submit-timesheet-btn"
            >
              <Send className="w-4 h-4 mr-2" />
              {submitting ? 'Submitting...' : 'Submit Timesheet'}
            </Button>
          </CardHeader>
          <CardContent>
            {!currentPayroll || currentPayroll.walks?.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <CheckCircle className="w-16 h-16 mx-auto mb-4 opacity-30 text-green-500" />
                <p className="text-lg">All caught up!</p>
                <p className="text-sm">Complete walks to add hours to your timesheet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {currentPayroll.walks.map((walk) => (
                  <div
                    key={walk.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl bg-muted/50 gap-3"
                    data-testid={`walk-${walk.id}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <PawPrint className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{walk.client_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {walk.pet_names?.join(', ')}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <Badge variant="secondary" className="rounded-full text-xs">
                            {walk.date}
                          </Badge>
                          {walk.time && (
                            <Badge variant="secondary" className="rounded-full text-xs">
                              {walk.time}
                            </Badge>
                          )}
                          <Badge variant="outline" className="rounded-full text-xs capitalize">
                            {walk.service_type?.replace('_', ' ')}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 sm:gap-6">
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">Duration</p>
                        <p className="font-medium">{formatDuration(walk.duration_minutes)}</p>
                      </div>
                      {walk.distance_meters > 0 && (
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground">Distance</p>
                          <p className="font-medium">{formatDistance(walk.distance_meters)}</p>
                        </div>
                      )}
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">Earned</p>
                        <p className="font-bold text-green-600">${walk.earnings?.toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Previous Timesheets */}
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle>Submitted Timesheets</CardTitle>
            <CardDescription>Your payment history</CardDescription>
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
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl bg-muted/30 gap-3"
                    data-testid={`timesheet-${ts.id}`}
                  >
                    <div>
                      <p className="font-medium">
                        {ts.period_start} to {ts.period_end}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {ts.total_hours}h • {ts.total_walks} walks
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-lg">${ts.total_earnings?.toFixed(2)}</span>
                      <Badge className={`rounded-full ${
                        ts.paid 
                          ? 'bg-green-100 text-green-800' 
                          : ts.approved 
                            ? 'bg-blue-100 text-blue-800' 
                            : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {ts.paid ? 'Paid' : ts.approved ? 'Approved' : 'Pending'}
                      </Badge>
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

export default PayrollPage;
