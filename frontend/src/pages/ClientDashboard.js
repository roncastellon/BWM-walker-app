import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { 
  Calendar, CreditCard, PawPrint, Clock, ArrowRight, MessageCircle, 
  User, Plus, DollarSign, CalendarPlus, ShoppingBag, Eye, Send,
  Dog, Cat, Bird, CheckCircle, Edit2, X, Trash2
} from 'lucide-react';
import { toast } from 'sonner';

const ClientDashboard = () => {
  const { user, api } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [pets, setPets] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Edit/Cancel appointment state
  const [selectedAppt, setSelectedAppt] = useState(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({ scheduled_date: '', scheduled_time: '', notes: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [apptsRes, invoicesRes, petsRes, contactsRes] = await Promise.all([
        api.get('/appointments'),
        api.get('/invoices'),
        api.get('/pets'),
        api.get('/messages/contacts'),
      ]);
      setAppointments(apptsRes.data);
      setInvoices(invoicesRes.data);
      setPets(petsRes.data);
      setContacts(contactsRes.data || []);
    } catch (error) {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (appt) => {
    setSelectedAppt(appt);
    setEditForm({
      scheduled_date: appt.scheduled_date,
      scheduled_time: appt.scheduled_time,
      notes: appt.notes || ''
    });
    setEditModalOpen(true);
  };

  const openCancelModal = (appt) => {
    setSelectedAppt(appt);
    setCancelModalOpen(true);
  };

  const handleEditSubmit = async () => {
    if (!selectedAppt) return;
    setSaving(true);
    try {
      await api.put(`/appointments/${selectedAppt.id}/client-edit`, null, {
        params: editForm
      });
      toast.success('Appointment updated successfully');
      setEditModalOpen(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update appointment');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelAppointment = async () => {
    if (!selectedAppt) return;
    setSaving(true);
    try {
      await api.post(`/appointments/${selectedAppt.id}/client-cancel`);
      toast.success('Appointment cancelled successfully');
      setCancelModalOpen(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to cancel appointment');
    } finally {
      setSaving(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'scheduled': return 'bg-sky-100 text-sky-800';
      case 'in_progress': return 'bg-orange-100 text-orange-800';
      case 'completed': return 'bg-sky-50 text-sky-700';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getSpeciesIcon = (species) => {
    switch (species?.toLowerCase()) {
      case 'cat': return <Cat className="w-5 h-5" />;
      case 'bird': return <Bird className="w-5 h-5" />;
      default: return <Dog className="w-5 h-5" />;
    }
  };

  const upcomingAppts = appointments.filter(a => 
    a.status === 'scheduled' || a.status === 'in_progress'
  );
  const pendingInvoices = invoices.filter(inv => inv.status === 'pending' || inv.status === 'overdue');
  const walkerContacts = contacts.filter(c => c.role === 'walker');
  const adminContacts = contacts.filter(c => c.role === 'admin');

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
      <div className="space-y-6" data-testid="client-dashboard">
        {/* Welcome Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/90 to-primary p-6 text-primary-foreground">
          <div className="relative z-10">
            <h1 className="text-2xl lg:text-3xl font-heading font-bold mb-1">
              Welcome, {user?.full_name?.split(' ')[0]}!
            </h1>
            <p className="text-primary-foreground/80">
              Your pets are in great hands
            </p>
          </div>
          <div className="absolute right-4 bottom-0 opacity-10">
            <PawPrint className="w-32 h-32" />
          </div>
        </div>

        {/* Main Tabs */}
        <Tabs defaultValue="schedule" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 h-auto p-1">
            <TabsTrigger value="schedule" className="flex flex-col py-3 gap-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Calendar className="w-5 h-5" />
              <span className="text-xs">Schedule</span>
            </TabsTrigger>
            <TabsTrigger value="billing" className="flex flex-col py-3 gap-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <CreditCard className="w-5 h-5" />
              <span className="text-xs">Billing</span>
            </TabsTrigger>
            <TabsTrigger value="chat" className="flex flex-col py-3 gap-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <MessageCircle className="w-5 h-5" />
              <span className="text-xs">Chat</span>
            </TabsTrigger>
            <TabsTrigger value="profile" className="flex flex-col py-3 gap-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <User className="w-5 h-5" />
              <span className="text-xs">Profile</span>
            </TabsTrigger>
          </TabsList>

          {/* SCHEDULE TAB */}
          <TabsContent value="schedule" className="space-y-4">
            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-3">
              <Link to="/schedule">
                <Card className="rounded-xl hover:shadow-md transition-all cursor-pointer h-full">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <CalendarPlus className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">Schedule New</p>
                      <p className="text-xs text-muted-foreground">Book a walk or stay</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
              <Link to="/schedule">
                <Card className="rounded-xl hover:shadow-md transition-all cursor-pointer h-full">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center">
                      <ShoppingBag className="w-5 h-5 text-secondary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">Other Services</p>
                      <p className="text-xs text-muted-foreground">Transport, concierge</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </div>

            {/* Upcoming Walks/Stays */}
            <Card className="rounded-xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="w-5 h-5 text-primary" />
                  Upcoming Walks & Stays
                </CardTitle>
              </CardHeader>
              <CardContent>
                {upcomingAppts.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    <Calendar className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No upcoming appointments</p>
                    <Link to="/schedule">
                      <Button size="sm" className="mt-3 rounded-full">
                        Book Now
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {upcomingAppts.slice(0, 5).map((appt) => (
                      <div
                        key={appt.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <PawPrint className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium text-sm capitalize">{appt.service_type?.replace('_', ' ')}</p>
                            <p className="text-xs text-muted-foreground">
                              {appt.scheduled_date} • {appt.scheduled_time}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={`${getStatusColor(appt.status)} rounded-full text-xs`}>
                            {appt.status}
                          </Badge>
                          {appt.status === 'scheduled' && (
                            <>
                              <Button size="sm" variant="ghost" onClick={() => openEditModal(appt)} className="h-8 w-8 p-0">
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => openCancelModal(appt)} className="h-8 w-8 p-0 text-destructive hover:text-destructive">
                                <X className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* BILLING TAB */}
          <TabsContent value="billing" className="space-y-4">
            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-3">
              <Link to="/billing">
                <Card className="rounded-xl hover:shadow-md transition-all cursor-pointer h-full">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Eye className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">View My Bills</p>
                      <p className="text-xs text-muted-foreground">Invoice history</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
              <Link to="/billing">
                <Card className="rounded-xl hover:shadow-md transition-all cursor-pointer h-full">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                      <DollarSign className="w-5 h-5 text-orange-600" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">Pay My Bill</p>
                      <p className="text-xs text-muted-foreground">Make a payment</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </div>

            {/* Pending Bills */}
            <Card className="rounded-xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-primary" />
                  Pending Bills
                  {pendingInvoices.length > 0 && (
                    <Badge variant="destructive" className="rounded-full ml-2">
                      {pendingInvoices.length}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {pendingInvoices.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    <CheckCircle className="w-10 h-10 mx-auto mb-2 text-sky-500 opacity-70" />
                    <p className="text-sm">All bills paid!</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pendingInvoices.slice(0, 5).map((invoice) => (
                      <div
                        key={invoice.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                      >
                        <div>
                          <p className="font-bold text-lg">${invoice.amount?.toFixed(2)}</p>
                          <p className="text-xs text-muted-foreground">Due: {invoice.due_date}</p>
                        </div>
                        <Link to="/billing">
                          <Button size="sm" className="rounded-full">
                            Pay Now
                          </Button>
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* CHAT TAB */}
          <TabsContent value="chat" className="space-y-4">
            {/* Admin Contacts */}
            <Card className="rounded-xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <MessageCircle className="w-5 h-5 text-primary" />
                  Admin
                </CardTitle>
              </CardHeader>
              <CardContent>
                {adminContacts.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No admin contacts</p>
                ) : (
                  <div className="space-y-2">
                    {adminContacts.map((contact) => (
                      <Link to="/messages" key={contact.id}>
                        <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                          <Avatar className="w-10 h-10">
                            <AvatarImage src={contact.profile_image} />
                            <AvatarFallback className="bg-primary/10 text-primary">
                              {contact.full_name?.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <p className="font-medium text-sm">{contact.full_name}</p>
                            <p className="text-xs text-muted-foreground">Administrator</p>
                          </div>
                          <Send className="w-4 h-4 text-muted-foreground" />
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* My Walkers */}
            <Card className="rounded-xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <PawPrint className="w-5 h-5 text-secondary" />
                  My Walkers
                </CardTitle>
              </CardHeader>
              <CardContent>
                {walkerContacts.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No walkers assigned yet</p>
                ) : (
                  <div className="space-y-2">
                    {walkerContacts.map((contact) => (
                      <Link to="/messages" key={contact.id}>
                        <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                          <Avatar className="w-10 h-10">
                            <AvatarImage src={contact.profile_image} />
                            <AvatarFallback className="bg-secondary/10 text-secondary">
                              {contact.full_name?.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <p className="font-medium text-sm">{contact.full_name}</p>
                            <p className="text-xs text-muted-foreground">Dog Walker</p>
                          </div>
                          <Send className="w-4 h-4 text-muted-foreground" />
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* PROFILE TAB */}
          <TabsContent value="profile" className="space-y-4">
            {/* Me */}
            <Link to="/profile">
              <Card className="rounded-xl hover:shadow-md transition-all cursor-pointer">
                <CardContent className="p-4 flex items-center gap-4">
                  <Avatar className="w-14 h-14">
                    <AvatarImage src={user?.profile_image} />
                    <AvatarFallback className="bg-primary/10 text-primary text-xl">
                      {user?.full_name?.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-medium">{user?.full_name}</p>
                    <p className="text-sm text-muted-foreground">{user?.email}</p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>

            {/* My Pets */}
            <Card className="rounded-xl">
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <PawPrint className="w-5 h-5 text-primary" />
                  My Pets
                </CardTitle>
                <Link to="/pets">
                  <Button size="sm" variant="ghost" className="rounded-full">
                    <Plus className="w-4 h-4 mr-1" />
                    Add
                  </Button>
                </Link>
              </CardHeader>
              <CardContent>
                {pets.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    <PawPrint className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No pets added yet</p>
                    <Link to="/pets">
                      <Button size="sm" className="mt-3 rounded-full">
                        Add Pet
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {pets.map((pet) => (
                      <Link to="/pets" key={pet.id}>
                        <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                          <Avatar className="w-10 h-10">
                            <AvatarImage src={pet.photo_url} />
                            <AvatarFallback className="bg-primary/10">
                              {getSpeciesIcon(pet.species)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <p className="font-medium text-sm">{pet.name}</p>
                            <p className="text-xs text-muted-foreground capitalize">
                              {pet.breed || pet.species}
                              {pet.age && ` • ${pet.age} yrs`}
                            </p>
                          </div>
                          <ArrowRight className="w-4 h-4 text-muted-foreground" />
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit Appointment Modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Appointment</DialogTitle>
            <DialogDescription>
              Update the date, time, or add notes for this appointment.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-date">Date</Label>
              <Input
                id="edit-date"
                type="date"
                value={editForm.scheduled_date}
                onChange={(e) => setEditForm({ ...editForm, scheduled_date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-time">Time</Label>
              <Input
                id="edit-time"
                type="time"
                value={editForm.scheduled_time}
                onChange={(e) => setEditForm({ ...editForm, scheduled_time: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-notes">Notes (optional)</Label>
              <Input
                id="edit-notes"
                placeholder="Special instructions..."
                value={editForm.notes}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditModalOpen(false)}>Cancel</Button>
            <Button onClick={handleEditSubmit} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Appointment Modal */}
      <Dialog open={cancelModalOpen} onOpenChange={setCancelModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="w-5 h-5" />
              Cancel Appointment
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel this appointment? There is no cancellation fee.
            </DialogDescription>
          </DialogHeader>
          {selectedAppt && (
            <div className="p-4 rounded-lg bg-muted/50 my-4">
              <p className="font-medium capitalize">{selectedAppt.service_type?.replace('_', ' ')}</p>
              <p className="text-sm text-muted-foreground">
                {selectedAppt.scheduled_date} at {selectedAppt.scheduled_time}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelModalOpen(false)}>Keep Appointment</Button>
            <Button variant="destructive" onClick={handleCancelAppointment} disabled={saving}>
              {saving ? 'Cancelling...' : 'Yes, Cancel'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default ClientDashboard;
