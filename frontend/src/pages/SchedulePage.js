import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { Calendar } from '../components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { CalendarIcon, Clock, Plus, PawPrint, Car, Moon, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

const SchedulePage = () => {
  const { api } = useAuth();
  const [services, setServices] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [pets, setPets] = useState([]);
  const [walkers, setWalkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [formData, setFormData] = useState({
    pet_ids: [],
    service_type: '',
    scheduled_date: '',
    scheduled_time: '',
    walker_id: '',
    notes: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [servicesRes, apptsRes, petsRes, walkersRes] = await Promise.all([
        api.get('/services'),
        api.get('/appointments'),
        api.get('/pets'),
        api.get('/users/walkers'),
      ]);
      setServices(servicesRes.data);
      setAppointments(apptsRes.data);
      setPets(petsRes.data);
      setWalkers(walkersRes.data);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.pet_ids.length) {
      toast.error('Please select at least one pet');
      return;
    }
    try {
      await api.post('/appointments', {
        ...formData,
        scheduled_date: format(selectedDate, 'yyyy-MM-dd'),
      });
      toast.success('Appointment booked successfully!');
      setDialogOpen(false);
      setFormData({
        pet_ids: [],
        service_type: '',
        scheduled_date: '',
        scheduled_time: '',
        walker_id: '',
        notes: '',
      });
      fetchData();
    } catch (error) {
      toast.error('Failed to book appointment');
    }
  };

  const getServiceIcon = (type) => {
    switch (type) {
      case 'walk_30':
      case 'walk_60':
        return <PawPrint className="w-5 h-5" />;
      case 'overnight':
        return <Moon className="w-5 h-5" />;
      case 'transport':
        return <Car className="w-5 h-5" />;
      case 'concierge':
        return <Sparkles className="w-5 h-5" />;
      default:
        return <Clock className="w-5 h-5" />;
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

  const timeSlots = [
    '07:00', '08:00', '09:00', '10:00', '11:00', '12:00',
    '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'
  ];

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
      <div className="space-y-8" data-testid="schedule-page">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-heading font-bold">Book Services</h1>
            <p className="text-muted-foreground">Schedule walks and care for your pets</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-full" data-testid="book-appointment-btn">
                <Plus className="w-4 h-4 mr-2" />
                Book Appointment
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Book New Appointment</DialogTitle>
                <DialogDescription>Schedule a service for your pet</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Select Pet(s)</Label>
                  {pets.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No pets added yet. Add a pet first.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {pets.map((pet) => (
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
                          data-testid={`select-pet-${pet.id}`}
                        >
                          {pet.name}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Service Type</Label>
                  <Select
                    value={formData.service_type}
                    onValueChange={(value) => setFormData({ ...formData, service_type: value })}
                  >
                    <SelectTrigger data-testid="select-service">
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
                    <Label>Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start" data-testid="select-date">
                          <CalendarIcon className="w-4 h-4 mr-2" />
                          {format(selectedDate, 'PPP')}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={selectedDate}
                          onSelect={(date) => date && setSelectedDate(date)}
                          disabled={(date) => date < new Date()}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-2">
                    <Label>Time</Label>
                    <Select
                      value={formData.scheduled_time}
                      onValueChange={(value) => setFormData({ ...formData, scheduled_time: value })}
                    >
                      <SelectTrigger data-testid="select-time">
                        <SelectValue placeholder="Select time" />
                      </SelectTrigger>
                      <SelectContent>
                        {timeSlots.map((time) => (
                          <SelectItem key={time} value={time}>
                            {time}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Preferred Walker (Optional)</Label>
                  <Select
                    value={formData.walker_id}
                    onValueChange={(value) => setFormData({ ...formData, walker_id: value })}
                  >
                    <SelectTrigger data-testid="select-walker">
                      <SelectValue placeholder="Any available walker" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Any available walker</SelectItem>
                      {walkers.map((walker) => (
                        <SelectItem key={walker.id} value={walker.id}>
                          {walker.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Notes (Optional)</Label>
                  <Textarea
                    placeholder="Any special instructions..."
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    data-testid="appointment-notes"
                  />
                </div>

                <Button type="submit" className="w-full rounded-full" data-testid="submit-appointment">
                  Book Appointment
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Services Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {services.map((service) => (
            <Card key={service.id} className="rounded-2xl shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-4 text-center">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  {getServiceIcon(service.service_type)}
                </div>
                <h3 className="font-medium text-sm">{service.name}</h3>
                <p className="text-lg font-bold text-primary">${service.price.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">{service.duration_minutes} min</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Appointments List */}
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle>Your Appointments</CardTitle>
            <CardDescription>All scheduled and past services</CardDescription>
          </CardHeader>
          <CardContent>
            {appointments.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <CalendarIcon className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg">No appointments yet</p>
                <p className="text-sm">Book your first service above!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {appointments.map((appt) => (
                  <div
                    key={appt.id}
                    className="flex items-center justify-between p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
                    data-testid={`appointment-item-${appt.id}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                        {getServiceIcon(appt.service_type)}
                      </div>
                      <div>
                        <p className="font-medium capitalize">{appt.service_type.replace('_', ' ')}</p>
                        <p className="text-sm text-muted-foreground">
                          {appt.scheduled_date} at {appt.scheduled_time}
                        </p>
                        {appt.notes && (
                          <p className="text-xs text-muted-foreground mt-1">Note: {appt.notes}</p>
                        )}
                      </div>
                    </div>
                    <Badge className={`${getStatusColor(appt.status)} rounded-full`}>
                      {appt.status.replace('_', ' ')}
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

export default SchedulePage;
