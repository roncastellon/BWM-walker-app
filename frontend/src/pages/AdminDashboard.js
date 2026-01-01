import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Users, Calendar, CreditCard, PawPrint, TrendingUp, DollarSign, Clock, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

const AdminDashboard = () => {
  const { user, api } = useAuth();
  const [stats, setStats] = useState({});
  const [recentAppointments, setRecentAppointments] = useState([]);
  const [pendingInvoices, setPendingInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [statsRes, apptsRes, invoicesRes] = await Promise.all([
        api.get('/dashboard/stats'),
        api.get('/appointments/calendar'),
        api.get('/invoices'),
      ]);
      setStats(statsRes.data);
      setRecentAppointments(apptsRes.data.slice(0, 5));
      setPendingInvoices(invoicesRes.data.filter(inv => inv.status === 'pending').slice(0, 5));
    } catch (error) {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
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
      <div className="space-y-8" data-testid="admin-dashboard">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-heading font-bold">Admin Dashboard</h1>
            <p className="text-muted-foreground">Manage your pet care business</p>
          </div>
          <Badge className="bg-primary text-primary-foreground w-fit rounded-full px-4 py-2">
            Administrator
          </Badge>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="rounded-2xl shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Clients</p>
                  <p className="text-3xl font-bold mt-1">{stats.total_clients || 0}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Users className="w-6 h-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Walkers</p>
                  <p className="text-3xl font-bold mt-1">{stats.total_walkers || 0}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-secondary/10 flex items-center justify-center">
                  <PawPrint className="w-6 h-6 text-secondary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Appointments</p>
                  <p className="text-3xl font-bold mt-1">{stats.total_appointments || 0}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-accent" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Revenue</p>
                  <p className="text-3xl font-bold mt-1">${(stats.total_revenue || 0).toFixed(0)}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Appointments */}
          <Card className="rounded-2xl shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-xl">Recent Appointments</CardTitle>
                <CardDescription>Latest scheduled services</CardDescription>
              </div>
              <Link to="/admin/calendar">
                <Button variant="outline" size="sm" className="rounded-full" data-testid="view-calendar">
                  View Calendar
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {recentAppointments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No appointments yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {recentAppointments.map((appt) => (
                    <div
                      key={appt.id}
                      className="flex items-center justify-between p-4 rounded-xl bg-muted/50"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                          <Clock className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium capitalize">{appt.service_type.replace('_', ' ')}</p>
                          <p className="text-sm text-muted-foreground">
                            {appt.client_name} • {appt.scheduled_date}
                          </p>
                        </div>
                      </div>
                      <Badge className={`${getStatusColor(appt.status)} rounded-full`}>
                        {appt.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pending Invoices */}
          <Card className="rounded-2xl shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-xl">Pending Invoices</CardTitle>
                <CardDescription>{stats.pending_invoices || 0} awaiting payment</CardDescription>
              </div>
              <Link to="/admin/invoices">
                <Button variant="outline" size="sm" className="rounded-full" data-testid="view-invoices">
                  View All
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {pendingInvoices.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>All invoices paid!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {pendingInvoices.map((invoice) => (
                    <div
                      key={invoice.id}
                      className="flex items-center justify-between p-4 rounded-xl bg-muted/50"
                    >
                      <div>
                        <p className="font-medium">${invoice.amount.toFixed(2)}</p>
                        <p className="text-sm text-muted-foreground">Due: {invoice.due_date}</p>
                      </div>
                      <Badge className="bg-yellow-100 text-yellow-800 rounded-full">
                        Pending
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Link to="/admin/clients">
            <Card className="rounded-2xl shadow-sm hover:shadow-lg transition-all cursor-pointer group h-full" data-testid="manage-clients">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors flex items-center justify-center">
                  <Users className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Manage Clients</p>
                  <p className="text-sm text-muted-foreground">View & edit clients</p>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link to="/admin/walkers">
            <Card className="rounded-2xl shadow-sm hover:shadow-lg transition-all cursor-pointer group h-full" data-testid="manage-walkers">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-secondary/10 group-hover:bg-secondary/20 transition-colors flex items-center justify-center">
                  <PawPrint className="w-6 h-6 text-secondary" />
                </div>
                <div>
                  <p className="font-medium">Manage Walkers</p>
                  <p className="text-sm text-muted-foreground">Walker profiles</p>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link to="/admin/calendar">
            <Card className="rounded-2xl shadow-sm hover:shadow-lg transition-all cursor-pointer group h-full" data-testid="view-schedule">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-accent/10 group-hover:bg-accent/20 transition-colors flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-accent" />
                </div>
                <div>
                  <p className="font-medium">Team Calendar</p>
                  <p className="text-sm text-muted-foreground">View schedule</p>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link to="/admin/chat">
            <Card className="rounded-2xl shadow-sm hover:shadow-lg transition-all cursor-pointer group h-full" data-testid="team-chat">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-purple-100 group-hover:bg-purple-200 transition-colors flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <p className="font-medium">Team Chat</p>
                  <p className="text-sm text-muted-foreground">Communication</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>
    </Layout>
  );
};

export default AdminDashboard;
