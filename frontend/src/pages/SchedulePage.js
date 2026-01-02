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
import { CalendarIcon, Clock, Plus, PawPrint, Car, Moon, Sparkles, Home, Building2, AlertCircle } from 'lucide-react';
import { format, addDays } from 'date-fns';
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
  const [endDate, setEndDate] = useState(null);
  const [priceEstimate, setPriceEstimate] = useState(null);
  const [calculatingPrice, setCalculatingPrice] = useState(false);
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

  // Calculate price when pet sitting service is selected
  useEffect(() => {
    const calculatePrice = async () => {
      const isPetSitting = formData.service_type.startsWith('petsit_');
      if (isPetSitting && formData.pet_ids.length > 0 && selectedDate) {
        setCalculatingPrice(true);
        try {
          const startDateStr = format(selectedDate, 'yyyy-MM-dd');
          const endDateStr = endDate ? format(endDate, 'yyyy-MM-dd') : startDateStr;
          
          const response = await api.post('/services/calculate-petsit-price', null, {
            params: {
              service_type: formData.service_type,
              num_dogs: formData.pet_ids.length,
              start_date: startDateStr,
              end_date: endDateStr
            }
          });
          setPriceEstimate(response.data);
        } catch (error) {
          console.error('Price calculation error:', error);
          setPriceEstimate(null);
        } finally {
          setCalculatingPrice(false);
        }
      } else {
        setPriceEstimate(null);
      }
    };
    
    calculatePrice();
  }, [formData.service_type, formData.pet_ids, selectedDate, endDate]);

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
      setEndDate(null);
      setPriceEstimate(null);
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
      case 'petsit_your_location_3':
      case 'petsit_your_location_4':
        return <Home className="w-5 h-5" />;
      case 'petsit_our_location':
        return <Building2 className="w-5 h-5" />;
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
      case 'scheduled': return 'bg-sky-100 text-sky-800';
      case 'in_progress': return 'bg-orange-100 text-orange-800';
      case 'completed': return 'bg-sky-50 text-sky-700';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const isPetSittingService = (type) => type?.startsWith('petsit_');
  const isOurLocationService = (type) => type === 'petsit_our_location';

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
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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
                    onValueChange={(value) => {
                      setFormData({ ...formData, service_type: value });
                      if (!isPetSittingService(value)) {
                        setEndDate(null);
                        setPriceEstimate(null);
                      }
                    }}
                  >
                    <SelectTrigger data-testid="select-service">
                      <SelectValue placeholder="Select a service" />
                    </SelectTrigger>
                    <SelectContent>
                      {/* Regular Services */}
                      <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">Walks & Transport</div>
                      {services.filter(s => !isPetSittingService(s.service_type)).map((service) => (
                        <SelectItem key={service.id} value={service.service_type}>
                          <div className="flex items-center gap-2">
                            {getServiceIcon(service.service_type)}
                            <span>{service.name} - ${service.price.toFixed(2)}</span>
                          </div>
                        </SelectItem>
                      ))}
                      
                      {/* Pet Sitting Services */}
                      <div className="px-2 py-1 text-xs font-semibold text-muted-foreground mt-2">Pet Sitting</div>
                      {services.filter(s => isPetSittingService(s.service_type)).map((service) => (
                        <SelectItem key={service.id} value={service.service_type}>
                          <div className="flex items-center gap-2">
                            {getServiceIcon(service.service_type)}
                            <span>{service.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  {/* Pet Sitting Pricing Info */}
                  {isPetSittingService(formData.service_type) && (
                    <div className="p-3 rounded-lg bg-primary/10 text-sm">
                      {isOurLocationService(formData.service_type) ? (
                        <div className="space-y-1">
                          <p className="font-medium">Boarding at Our Location</p>
                          <p>• $50.00 per night</p>
                          <p>• 2nd dog: +$25.00 (half price)</p>
                          <p>• Holiday surcharge: +$10.00/dog/night</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Holidays include day before, day of, and day after: New Year's, Memorial Day, July 4th, Labor Day, Thanksgiving, Christmas
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <p className="font-medium">Visits at Your Home</p>
                          <p>• {formData.service_type === 'petsit_your_location_3' ? '3 visits' : '4 visits'} per day</p>
                          <p>• ${formData.service_type === 'petsit_your_location_3' ? '50.00' : '75.00'} per day per dog</p>
                          <p>• Any part of a day counts as a full day</p>
                          <p>• Holiday surcharge: +$10.00/dog/day</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{isPetSittingService(formData.service_type) ? 'Start Date' : 'Date'}</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full justify-start text-left font-normal"
                          data-testid="select-date"
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {selectedDate ? format(selectedDate, 'PPP') : 'Pick a date'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={selectedDate}
                          onSelect={setSelectedDate}
                          initialFocus
                          disabled={(date) => date < new Date()}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  {isPetSittingService(formData.service_type) ? (
                    <div className="space-y-2">
                      <Label>End Date</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-full justify-start text-left font-normal"
                            data-testid="select-end-date"
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {endDate ? format(endDate, 'PPP') : 'Pick end date'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={endDate}
                            onSelect={setEndDate}
                            initialFocus
                            disabled={(date) => date < selectedDate}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  ) : (
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
                            <SelectItem key={time} value={time}>{time}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                {/* Price Estimate for Pet Sitting */}
                {isPetSittingService(formData.service_type) && priceEstimate && (
                  <div className="p-4 rounded-xl bg-secondary/10 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Estimated Total</span>
                      <span className="text-2xl font-bold text-primary">
                        ${priceEstimate.total.toFixed(2)}
                      </span>
                    </div>
                    
                    {priceEstimate.breakdown.length > 0 && (
                      <div className="space-y-2 text-sm">
                        <p className="text-muted-foreground">Breakdown:</p>
                        {priceEstimate.breakdown.map((day, idx) => (
                          <div key={idx} className="flex justify-between items-center p-2 rounded bg-white/50">
                            <div>
                              <span>{day.date}</span>
                              {day.holiday && (
                                <Badge className="ml-2 bg-orange-100 text-orange-800 rounded-full text-xs">
                                  Holiday
                                </Badge>
                              )}
                            </div>
                            <span className="font-medium">${day.subtotal.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {priceEstimate.breakdown.some(d => d.holiday) && (
                      <div className="flex items-start gap-2 text-xs text-orange-700 bg-orange-50 p-2 rounded">
                        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <span>Holiday surcharge applied (+$10/dog/night)</span>
                      </div>
                    )}
                  </div>
                )}

                {calculatingPrice && (
                  <div className="text-center text-sm text-muted-foreground">
                    Calculating price...
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Preferred Walker (Optional)</Label>
                  <Select
                    value={formData.walker_id || "any"}
                    onValueChange={(value) => setFormData({ ...formData, walker_id: value === "any" ? "" : value })}
                  >
                    <SelectTrigger data-testid="select-walker">
                      <SelectValue placeholder="Any available walker" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any available</SelectItem>
                      {walkers.map((walker) => (
                        <SelectItem key={walker.id} value={walker.id}>
                          {walker.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea
                    placeholder="Any special instructions or notes..."
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                  />
                </div>

                <Button type="submit" className="w-full rounded-full" data-testid="submit-booking">
                  Book Appointment
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Services Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {services.slice(0, 4).map((service) => (
            <Card key={service.id} className="rounded-2xl shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 rounded-xl bg-primary/10 text-primary">
                    {getServiceIcon(service.service_type)}
                  </div>
                  <div>
                    <p className="font-medium">{service.name}</p>
                    <p className="text-lg font-bold text-primary">
                      {isPetSittingService(service.service_type) ? 'From ' : ''}${service.price.toFixed(2)}
                    </p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">{service.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Upcoming Appointments */}
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-primary" />
              Your Appointments
            </CardTitle>
            <CardDescription>View and manage your scheduled services</CardDescription>
          </CardHeader>
          <CardContent>
            {appointments.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <PawPrint className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg">No appointments yet</p>
                <p className="text-sm">Book your first service to get started!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {appointments.map((appt) => {
                  const service = services.find(s => s.service_type === appt.service_type);
                  return (
                    <div
                      key={appt.id}
                      className="flex items-center justify-between p-4 rounded-xl bg-muted/50"
                      data-testid={`appointment-${appt.id}`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="p-2 rounded-xl bg-primary/10 text-primary">
                          {getServiceIcon(appt.service_type)}
                        </div>
                        <div>
                          <p className="font-medium">{service?.name || appt.service_type}</p>
                          <p className="text-sm text-muted-foreground">
                            {appt.scheduled_date} at {appt.scheduled_time || 'TBD'}
                          </p>
                        </div>
                      </div>
                      <Badge className={`${getStatusColor(appt.status)} rounded-full`}>
                        {appt.status}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default SchedulePage;
