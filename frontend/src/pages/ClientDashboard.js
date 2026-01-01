import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Calendar, CreditCard, PawPrint, Clock, ArrowRight, MessageCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

const ClientDashboard = () => {
  const { user, api } = useAuth();
  const [stats, setStats] = useState({});
  const [appointments, setAppointments] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [pets, setPets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [statsRes, apptsRes, invoicesRes, petsRes] = await Promise.all([
        api.get('/dashboard/stats'),
        api.get('/appointments'),
        api.get('/invoices'),
        api.get('/pets'),
      ]);
      setStats(statsRes.data);
      setAppointments(apptsRes.data.slice(0, 5));
      setInvoices(invoicesRes.data.filter(inv => inv.status === 'pending').slice(0, 3));
      setPets(petsRes.data);
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
      <div className="space-y-8" data-testid="client-dashboard">
        {/* Welcome Section */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/90 to-primary p-8 text-primary-foreground">
          <div className="relative z-10">
            <h1 className="text-3xl lg:text-4xl font-heading font-bold mb-2">
              Welcome back, {user?.full_name?.split(' ')[0]}!
            </h1>
            <p className="text-primary-foreground/80 text-lg">
              Your pets are in great hands. Here's what's happening.
            </p>
          </div>
          <div className="absolute right-0 bottom-0 opacity-10">
            <PawPrint className="w-64 h-64" />
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="rounded-2xl shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">My Pets</p>
                  <p className="text-3xl font-bold mt-1">{stats.total_pets || 0}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <PawPrint className="w-6 h-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Upcoming Walks</p>
                  <p className="text-3xl font-bold mt-1">{stats.upcoming_appointments || 0}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-secondary/10 flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-secondary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pending Bills</p>
                  <p className="text-3xl font-bold mt-1">{stats.pending_invoices || 0}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
                  <CreditCard className="w-6 h-6 text-accent" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Upcoming Appointments */}
          <Card className="rounded-2xl shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-xl">Upcoming Appointments</CardTitle>
                <CardDescription>Your scheduled services</CardDescription>
              </div>
              <Link to="/schedule">
                <Button variant="ghost" size="sm" className="rounded-full" data-testid="view-all-appointments">
                  View All <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {appointments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No upcoming appointments</p>
                  <Link to="/schedule">
                    <Button className="mt-4 rounded-full" data-testid="book-first-service">
                      Book Your First Service
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {appointments.map((appt) => (
                    <div
                      key={appt.id}
                      className="flex items-center justify-between p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                          <Clock className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium capitalize">{appt.service_type.replace('_', ' ')}</p>
                          <p className="text-sm text-muted-foreground">
                            {appt.scheduled_date} at {appt.scheduled_time}
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
                <CardTitle className="text-xl">Pending Bills</CardTitle>
                <CardDescription>Outstanding invoices</CardDescription>
              </div>
              <Link to="/billing">
                <Button variant="ghost" size="sm" className="rounded-full" data-testid="view-all-billing">
                  View All <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {invoices.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CreditCard className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No pending bills</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {invoices.map((invoice) => (
                    <div
                      key={invoice.id}
                      className="flex items-center justify-between p-4 rounded-xl bg-muted/50"
                    >
                      <div>
                        <p className="font-medium">${invoice.amount.toFixed(2)}</p>
                        <p className="text-sm text-muted-foreground">Due: {invoice.due_date}</p>
                      </div>
                      <Link to="/billing">
                        <Button size="sm" className="rounded-full" data-testid={`pay-invoice-${invoice.id}`}>
                          Pay Now
                        </Button>
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* My Pets */}
        <Card className="rounded-2xl shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-xl">My Pets</CardTitle>
              <CardDescription>Your furry family members</CardDescription>
            </div>
            <Link to="/pets">
              <Button variant="ghost" size="sm" className="rounded-full" data-testid="manage-pets">
                Manage Pets <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {pets.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <PawPrint className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No pets added yet</p>
                <Link to="/pets">
                  <Button className="mt-4 rounded-full" data-testid="add-first-pet">
                    Add Your First Pet
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {pets.map((pet) => (
                  <div
                    key={pet.id}
                    className="flex items-center gap-4 p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <PawPrint className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{pet.name}</p>
                      <p className="text-sm text-muted-foreground capitalize">
                        {pet.breed || pet.species}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link to="/schedule">
            <Card className="rounded-2xl shadow-sm hover:shadow-lg transition-all cursor-pointer group" data-testid="quick-book-walk">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Book a Walk</p>
                  <p className="text-sm text-muted-foreground">Schedule services</p>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link to="/messages">
            <Card className="rounded-2xl shadow-sm hover:shadow-lg transition-all cursor-pointer group" data-testid="quick-message-walker">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-secondary/10 group-hover:bg-secondary/20 transition-colors flex items-center justify-center">
                  <MessageCircle className="w-6 h-6 text-secondary" />
                </div>
                <div>
                  <p className="font-medium">Message Walker</p>
                  <p className="text-sm text-muted-foreground">Contact your walker</p>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link to="/billing">
            <Card className="rounded-2xl shadow-sm hover:shadow-lg transition-all cursor-pointer group" data-testid="quick-pay-bill">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-accent/10 group-hover:bg-accent/20 transition-colors flex items-center justify-center">
                  <CreditCard className="w-6 h-6 text-accent" />
                </div>
                <div>
                  <p className="font-medium">Pay Bills</p>
                  <p className="text-sm text-muted-foreground">View invoices</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>
    </Layout>
  );
};

export default ClientDashboard;
