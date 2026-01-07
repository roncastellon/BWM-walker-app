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
import { CalendarIcon, Clock, Plus, PawPrint, Car, Moon, Sparkles, Home, Building2, AlertCircle, Repeat, Pause, Play, StopCircle, Pencil, X } from 'lucide-react';
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
    is_recurring: false,
    day_of_week: null,
    selected_days: [], // For multi-day scheduling (day care, overnight, etc.)
    duration_value: 1, // Number of days/nights
    duration_type: 'minutes', // 'minutes', 'days', or 'nights'
  });
  const [recurringSchedules, setRecurringSchedules] = useState([]);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [changeType, setChangeType] = useState('one_time'); // 'one_time' or 'future'

  const ALL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  
  // Determine duration type based on service type
  const getDurationTypeForService = (serviceType) => {
    if (!serviceType) return 'minutes';
    const dayServices = ['doggy_day_care', 'doggy_day_camp', 'day_care', 'day_camp', 'stay_day'];
    const nightServices = ['overnight', 'stay_overnight', 'stay_extended', 'petsit_our_location', 'petsit_your_location'];
    
    if (dayServices.some(s => serviceType.toLowerCase().includes(s))) return 'days';
    if (nightServices.some(s => serviceType.toLowerCase().includes(s))) return 'nights';
    return 'minutes';
  };
  
  // Check if service uses days or nights (not minutes)
  const isDayNightService = (serviceType) => {
    if (!serviceType) return false;
    const durationType = getDurationTypeForService(serviceType);
    return durationType === 'days' || durationType === 'nights';
  };
  
  // Check if service allows multi-day scheduling (legacy function)
  const isMultiDayService = (serviceType) => {
    if (!serviceType) return false;
    return serviceType.includes('day') || 
           serviceType.includes('overnight') || 
           serviceType.includes('stay') || 
           serviceType.includes('petsit') ||
           serviceType.includes('camp') ||
           serviceType.includes('care');
  };

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
      const [servicesRes, apptsRes, petsRes, walkersRes, recurringRes] = await Promise.all([
        api.get('/services'),
        api.get('/appointments'),
        api.get('/pets'),
        api.get('/users/walkers'),
        api.get('/recurring-schedules'),
      ]);
      setServices(servicesRes.data);
      setAppointments(apptsRes.data);
      setPets(petsRes.data);
      setWalkers(walkersRes.data);
      setRecurringSchedules(recurringRes.data || []);
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
    
    const durationType = getDurationTypeForService(formData.service_type);
    const isDayNight = durationType === 'days' || durationType === 'nights';
    
    try {
      if (formData.is_recurring) {
        // Create recurring schedule
        const dayOfWeek = selectedDate.getDay();
        // Convert Sunday (0) to 6, and shift others down by 1 for Monday=0 format
        const adjustedDay = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        await api.post('/recurring-schedules', {
          pet_ids: formData.pet_ids,
          service_type: formData.service_type,
          scheduled_time: isDayNight ? '' : formData.scheduled_time,
          day_of_week: adjustedDay,
          walker_id: formData.walker_id || null,
          notes: formData.notes || null,
        });
        toast.success('Recurring schedule created! Services will repeat weekly.');
      } else {
        // Create one-time appointment
        const appointmentData = {
          pet_ids: formData.pet_ids,
          service_type: formData.service_type,
          scheduled_date: format(selectedDate, 'yyyy-MM-dd'),
          scheduled_time: isDayNight ? '' : formData.scheduled_time,
          walker_id: formData.walker_id || null,
          notes: formData.notes || null,
          is_recurring: false,
          duration_value: formData.duration_value || 1,
          duration_type: durationType,
        };
        
        // Add end_date for multi-day bookings
        if (isDayNight && endDate) {
          appointmentData.end_date = format(endDate, 'yyyy-MM-dd');
        }
        
        await api.post('/appointments', appointmentData);
        toast.success('Appointment booked successfully!');
      }
      setDialogOpen(false);
      setFormData({
        pet_ids: [],
        service_type: '',
        scheduled_date: '',
        scheduled_time: '',
        walker_id: '',
        notes: '',
        is_recurring: false,
        day_of_week: null,
        selected_days: [],
        duration_value: 1,
        duration_type: 'minutes',
      });
      setEndDate(null);
      setPriceEstimate(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to book appointment');
    }
  };

  const handlePauseSchedule = async (scheduleId) => {
    try {
      await api.put(`/recurring-schedules/${scheduleId}/pause`);
      toast.success('Schedule paused');
      fetchData();
    } catch (error) {
      toast.error('Failed to pause schedule');
    }
  };

  const handleResumeSchedule = async (scheduleId) => {
    try {
      await api.put(`/recurring-schedules/${scheduleId}/resume`);
      toast.success('Schedule resumed');
      fetchData();
    } catch (error) {
      toast.error('Failed to resume schedule');
    }
  };

  const handleStopSchedule = async (scheduleId) => {
    try {
      await api.put(`/recurring-schedules/${scheduleId}/stop`);
      toast.success('Schedule stopped');
      fetchData();
    } catch (error) {
      toast.error('Failed to stop schedule');
    }
  };

  const handleCancelAppointment = async (appointmentId, cancelType = 'one_time') => {
    try {
      await api.put(`/appointments/${appointmentId}/cancel?cancel_type=${cancelType}`);
      if (cancelType === 'future') {
        toast.success('Appointment cancelled and recurring schedule stopped');
      } else {
        toast.success('Appointment cancelled');
      }
      setEditModalOpen(false);
      setSelectedAppointment(null);
      fetchData();
    } catch (error) {
      toast.error('Failed to cancel appointment');
    }
  };

  const getDayName = (dayNum) => {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    return days[dayNum] || 'Unknown';
  };

  const getServiceIcon = (type) => {
    switch (type) {
      case 'walk_30':
      case 'walk_45':
      case 'walk_60':
        return <PawPrint className="w-5 h-5" />;
      case 'petsit_your_location_3':
      case 'petsit_your_location_4':
      case 'petsit_your_location':
        return <Home className="w-5 h-5" />;
      case 'petsit_our_location':
      case 'stay_day':
      case 'doggy_day_camp':
      case 'doggy_day_care':
        return <Building2 className="w-5 h-5" />;
      case 'overnight':
      case 'stay_overnight':
      case 'stay_extended':
        return <Moon className="w-5 h-5" />;
      case 'transport':
        return <Car className="w-5 h-5" />;
      case 'concierge':
        return <Sparkles className="w-5 h-5" />;
      case 'day_visit':
        return <Clock className="w-5 h-5" />;
      default:
        return <PawPrint className="w-5 h-5" />;
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
                      const durationType = getDurationTypeForService(value);
                      setFormData({ 
                        ...formData, 
                        service_type: value,
                        duration_type: durationType,
                        duration_value: 1, // Reset to 1 when changing service
                      });
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
                      {/* Walks */}
                      <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">Walks</div>
                      {services.filter(s => s.service_type?.includes('walk')).map((service) => (
                        <SelectItem key={service.id} value={service.service_type}>
                          <div className="flex items-center gap-2">
                            {getServiceIcon(service.service_type)}
                            <span>{service.name} - ${service.price?.toFixed(2)}</span>
                          </div>
                        </SelectItem>
                      ))}
                      
                      {/* Day Care / Day Visits */}
                      <div className="px-2 py-1 text-xs font-semibold text-muted-foreground mt-2">Day Care (# of Days)</div>
                      {services.filter(s => 
                        s.service_type?.includes('day') || 
                        s.service_type?.includes('visit') ||
                        s.service_type?.includes('concierge')
                      ).map((service) => (
                        <SelectItem key={service.id} value={service.service_type}>
                          <div className="flex items-center gap-2">
                            {getServiceIcon(service.service_type)}
                            <span>{service.name} - ${service.price?.toFixed(2)}{getDurationTypeForService(service.service_type) === 'days' ? '/day' : ''}</span>
                          </div>
                        </SelectItem>
                      ))}
                      
                      {/* Overnight / Extended Stays */}
                      <div className="px-2 py-1 text-xs font-semibold text-muted-foreground mt-2">Overnight & Stays (# of Nights)</div>
                      {services.filter(s => 
                        s.service_type?.includes('overnight') || 
                        s.service_type?.includes('stay') ||
                        s.service_type?.includes('petsit')
                      ).map((service) => (
                        <SelectItem key={service.id} value={service.service_type}>
                          <div className="flex items-center gap-2">
                            {getServiceIcon(service.service_type)}
                            <span>{service.name} - ${service.price?.toFixed(2)}{getDurationTypeForService(service.service_type) === 'nights' ? '/night' : ''}</span>
                          </div>
                        </SelectItem>
                      ))}
                      
                      {/* Transport */}
                      <div className="px-2 py-1 text-xs font-semibold text-muted-foreground mt-2">Transport</div>
                      {services.filter(s => s.service_type?.includes('transport')).map((service) => (
                        <SelectItem key={service.id} value={service.service_type}>
                          <div className="flex items-center gap-2">
                            {getServiceIcon(service.service_type)}
                            <span>{service.name} - ${service.price?.toFixed(2)}</span>
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

                  {/* Show different inputs based on service type */}
                  {isDayNightService(formData.service_type) ? (
                    <div className="space-y-2">
                      <Label>
                        {getDurationTypeForService(formData.service_type) === 'days' 
                          ? 'Number of Days' 
                          : 'Number of Nights'}
                      </Label>
                      <Select
                        value={formData.duration_value?.toString() || '1'}
                        onValueChange={(value) => setFormData({ ...formData, duration_value: parseInt(value) })}
                      >
                        <SelectTrigger data-testid="select-duration">
                          <SelectValue placeholder="Select duration" />
                        </SelectTrigger>
                        <SelectContent>
                          {[1, 2, 3, 4, 5, 6, 7, 14, 21, 30].map((num) => (
                            <SelectItem key={num} value={num.toString()}>
                              {num} {getDurationTypeForService(formData.service_type) === 'days' 
                                ? (num === 1 ? 'Day' : 'Days') 
                                : (num === 1 ? 'Night' : 'Nights')}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : isPetSittingService(formData.service_type) ? (
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

                {/* One-Time vs Recurring Toggle */}
                <div className="space-y-3 p-4 rounded-xl bg-secondary/10">
                  <Label className="text-base font-medium">Schedule Type</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      type="button"
                      variant={!formData.is_recurring ? 'default' : 'outline'}
                      className="rounded-full h-auto py-3 flex flex-col items-center gap-1"
                      onClick={() => setFormData({ ...formData, is_recurring: false, selected_days: [] })}
                    >
                      <CalendarIcon className="w-5 h-5" />
                      <span className="font-medium">One-Time</span>
                      <span className="text-xs opacity-70">Single appointment</span>
                    </Button>
                    <Button
                      type="button"
                      variant={formData.is_recurring ? 'default' : 'outline'}
                      className="rounded-full h-auto py-3 flex flex-col items-center gap-1"
                      onClick={() => setFormData({ ...formData, is_recurring: true })}
                    >
                      <Repeat className="w-5 h-5" />
                      <span className="font-medium">Recurring</span>
                      <span className="text-xs opacity-70">Repeats weekly</span>
                    </Button>
                  </div>
                  
                  {/* Multi-day selection for recurring */}
                  {formData.is_recurring && (
                    <div className="mt-3 space-y-2">
                      <Label className="text-sm font-medium">Select Days</Label>
                      <div className="flex flex-wrap gap-2">
                        {ALL_DAYS.map((day) => (
                          <Button
                            key={day}
                            type="button"
                            variant={formData.selected_days.includes(day) ? 'default' : 'outline'}
                            size="sm"
                            className="rounded-full"
                            onClick={() => {
                              const newDays = formData.selected_days.includes(day)
                                ? formData.selected_days.filter(d => d !== day)
                                : [...formData.selected_days, day];
                              setFormData({ ...formData, selected_days: newDays });
                            }}
                          >
                            {day.slice(0, 3)}
                          </Button>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Select the days you want this service scheduled
                      </p>
                    </div>
                  )}
                  
                  {formData.is_recurring && formData.selected_days.length > 0 && (
                    <div className="mt-2 p-3 rounded-lg bg-sky-50 text-sm text-sky-800">
                      <p className="font-medium flex items-center gap-2">
                        <Repeat className="w-4 h-4" />
                        Weekly on {formData.selected_days.join(', ')}
                        </p>
                        <p className="text-xs mt-1 text-sky-600">
                          This will create a recurring schedule that repeats every week until paused or stopped.
                        </p>
                      </div>
                    )}
                  </div>
                )}
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
                          <p className="font-medium flex items-center gap-2">
                            {service?.name || appt.service_type}
                            {appt.is_recurring && (
                              <Badge variant="outline" className="rounded-full text-xs">
                                <Repeat className="w-3 h-3 mr-1" />
                                Recurring
                              </Badge>
                            )}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {appt.scheduled_date} at {appt.scheduled_time || 'TBD'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={`${getStatusColor(appt.status)} rounded-full`}>
                          {appt.status}
                        </Badge>
                        {appt.status === 'scheduled' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="rounded-full"
                            onClick={() => {
                              setSelectedAppointment(appt);
                              setChangeType('one_time');
                              setEditModalOpen(true);
                            }}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recurring Schedules Section */}
        {recurringSchedules.length > 0 && (
          <Card className="rounded-2xl shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Repeat className="w-5 h-5 text-primary" />
                Recurring Schedules
              </CardTitle>
              <CardDescription>Weekly repeating appointments</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recurringSchedules.map((schedule) => {
                  const service = services.find(s => s.service_type === schedule.service_type);
                  return (
                    <div
                      key={schedule.id}
                      className={`flex items-center justify-between p-4 rounded-xl ${
                        schedule.status === 'active' ? 'bg-sky-50 border border-sky-200' :
                        schedule.status === 'paused' ? 'bg-amber-50 border border-amber-200' :
                        'bg-gray-50 border border-gray-200'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-xl ${
                          schedule.status === 'active' ? 'bg-sky-100 text-sky-600' :
                          schedule.status === 'paused' ? 'bg-amber-100 text-amber-600' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {getServiceIcon(schedule.service_type)}
                        </div>
                        <div>
                          <p className="font-medium">{service?.name || schedule.service_type}</p>
                          <p className="text-sm text-muted-foreground">
                            Every {getDayName(schedule.day_of_week)} at {schedule.scheduled_time}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge 
                          className={`rounded-full ${
                            schedule.status === 'active' ? 'bg-sky-100 text-sky-800' :
                            schedule.status === 'paused' ? 'bg-amber-100 text-amber-800' :
                            'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {schedule.status}
                        </Badge>
                        {schedule.status === 'active' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-full"
                            onClick={() => handlePauseSchedule(schedule.id)}
                          >
                            <Pause className="w-4 h-4 mr-1" />
                            Pause
                          </Button>
                        )}
                        {schedule.status === 'paused' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-full"
                            onClick={() => handleResumeSchedule(schedule.id)}
                          >
                            <Play className="w-4 h-4 mr-1" />
                            Resume
                          </Button>
                        )}
                        {schedule.status !== 'stopped' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-full text-red-600 hover:bg-red-50"
                            onClick={() => handleStopSchedule(schedule.id)}
                          >
                            <StopCircle className="w-4 h-4 mr-1" />
                            Stop
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Edit/Cancel Appointment Modal */}
        <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Manage Appointment</DialogTitle>
              <DialogDescription>
                {selectedAppointment?.is_recurring ? 
                  'This is part of a recurring schedule' : 
                  'Choose an action for this appointment'}
              </DialogDescription>
            </DialogHeader>
            
            {selectedAppointment && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-muted/50">
                  <p className="font-medium">{services.find(s => s.service_type === selectedAppointment.service_type)?.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedAppointment.scheduled_date} at {selectedAppointment.scheduled_time}
                  </p>
                </div>

                {selectedAppointment.is_recurring && (
                  <div className="space-y-3">
                    <Label className="text-base font-medium">Cancel Type</Label>
                    <div className="space-y-2">
                      <Button
                        variant={changeType === 'one_time' ? 'default' : 'outline'}
                        className="w-full justify-start rounded-full"
                        onClick={() => setChangeType('one_time')}
                      >
                        <X className="w-4 h-4 mr-2" />
                        One-Time Cancel (just this appointment)
                      </Button>
                      <Button
                        variant={changeType === 'future' ? 'default' : 'outline'}
                        className="w-full justify-start rounded-full"
                        onClick={() => setChangeType('future')}
                      >
                        <StopCircle className="w-4 h-4 mr-2" />
                        Stop All Future (cancel recurring schedule)
                      </Button>
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-4 border-t">
                  <Button
                    variant="outline"
                    className="flex-1 rounded-full"
                    onClick={() => setEditModalOpen(false)}
                  >
                    Keep Appointment
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1 rounded-full"
                    onClick={() => handleCancelAppointment(selectedAppointment.id, changeType)}
                  >
                    Cancel Appointment
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default SchedulePage;
