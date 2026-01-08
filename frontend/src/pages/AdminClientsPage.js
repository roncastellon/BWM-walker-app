import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Checkbox } from '../components/ui/checkbox';
import { Users, Search, Mail, Phone, Plus, PawPrint, DollarSign, Trash2, Edit, Calendar, Clock, Save, MapPin, AlertCircle, CreditCard, CheckCircle, Lock, Unlock, UserX, Settings, Repeat, CalendarDays, AlertTriangle, CalendarPlus } from 'lucide-react';
import { toast } from 'sonner';

// Generate 15-minute increment time slots
const generateTimeSlots = () => {
  const slots = [];
  for (let hour = 6; hour <= 20; hour++) {
    for (let min = 0; min < 60; min += 15) {
      const h = hour.toString().padStart(2, '0');
      const m = min.toString().padStart(2, '0');
      slots.push(`${h}:${m}`);
    }
  }
  return slots;
};

const TIME_SLOTS = generateTimeSlots();

const DAYS_OF_WEEK = [
  { value: 'monday', label: 'Monday', short: 'Mon' },
  { value: 'tuesday', label: 'Tuesday', short: 'Tue' },
  { value: 'wednesday', label: 'Wednesday', short: 'Wed' },
  { value: 'thursday', label: 'Thursday', short: 'Thu' },
  { value: 'friday', label: 'Friday', short: 'Fri' },
  { value: 'saturday', label: 'Saturday', short: 'Sat' },
  { value: 'sunday', label: 'Sunday', short: 'Sun' },
];

const AdminClientsPage = () => {
  const { api } = useAuth();
  const [searchParams] = useSearchParams();
  const [clients, setClients] = useState([]);
  const [services, setServices] = useState([]);
  const [walkers, setWalkers] = useState([]);
  const [billingPlans, setBillingPlans] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [pricingMode, setPricingMode] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Delete confirmation state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  
  // Pricing setup state
  const [clientPricing, setClientPricing] = useState({
    pricing_type: 'default', // 'default' or 'custom'
    schedule_type: 'recurring', // 'one_time' or 'recurring' - default to recurring
    billing_plan_id: '',
    custom_prices: {},
    notes: ''
  });
  
  // Form state for new/edit customer
  const [customerForm, setCustomerForm] = useState({
    username: '',
    email: '',
    password: '',
    full_name: '',
    phone: '',
    address: '',
    billing_cycle: 'weekly',
  });
  
  // Pet form state (can add multiple pets)
  const [pets, setPets] = useState([{
    name: '',
    species: 'dog',
    breed: '',
    age: '',
    weight: '',
    notes: '',
  }]);
  
  // Custom pricing overrides
  const [customPricing, setCustomPricing] = useState({});
  
  // Walking schedule
  const [walkingSchedule, setWalkingSchedule] = useState({
    service_type: 'walk_30',
    walks_per_day: 1,
    days: [],
    preferred_times: [],
    preferred_walker_id: '',
    duration_value: 1,
    notes: '',
  });

  // Walker conflict state
  const [walkerConflicts, setWalkerConflicts] = useState([]);
  const [checkingWalkerConflicts, setCheckingWalkerConflicts] = useState(false);
  const [conflictDialogOpen, setConflictDialogOpen] = useState(false);
  const [conflictAlternatives, setConflictAlternatives] = useState([]);

  // Check walker conflicts when selecting walker in admin
  const checkAdminWalkerConflicts = async (walkerId, clientData) => {
    if (!walkerId || !clientData?.onboarding_data) {
      setWalkerConflicts([]);
      return;
    }

    setCheckingWalkerConflicts(true);
    try {
      const onboardingData = clientData.onboarding_data;
      const serviceTypeMap = {30: "walk_30", 45: "walk_45", 60: "walk_60"};
      const serviceType = serviceTypeMap[onboardingData.walk_duration] || "walk_30";

      const res = await api.post('/walkers/check-schedule-conflicts', {
        walker_id: walkerId,
        schedule_type: onboardingData.schedule_type || 'recurring',
        preferred_days: onboardingData.preferred_days || [],
        preferred_times: onboardingData.preferred_walk_times || [],
        service_type: serviceType
      });

      if (res.data.has_conflicts) {
        setWalkerConflicts(res.data.conflicts);
        setConflictAlternatives(res.data.alternatives);
        setConflictDialogOpen(true);
      } else {
        setWalkerConflicts([]);
      }
    } catch (error) {
      console.error('Failed to check walker conflicts', error);
    } finally {
      setCheckingWalkerConflicts(false);
    }
  };

  // Handle admin letting app assign walker
  const handleAdminLetAppAssign = () => {
    setWalkingSchedule({...walkingSchedule, preferred_walker_id: ''});
    setWalkerConflicts([]);
    setConflictDialogOpen(false);
    toast.info('Walker will be auto-assigned based on availability.');
  };

  // Handle admin choosing different walker
  const handleAdminChooseDifferent = () => {
    setWalkingSchedule({...walkingSchedule, preferred_walker_id: ''});
    setWalkerConflicts([]);
    setConflictDialogOpen(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Auto-open highlighted client from URL params
  useEffect(() => {
    const highlightClientId = searchParams.get('highlight');
    if (highlightClientId && clients.length > 0) {
      const client = clients.find(c => c.id === highlightClientId);
      if (client) {
        setSelectedClient(client);
        // If client needs pricing setup, open pricing mode
        if (!client.pricing_setup_completed) {
          setPricingMode(true);
        }
      }
    }
  }, [searchParams, clients]);

  const fetchData = async () => {
    try {
      const [clientsRes, servicesRes, walkersRes, plansRes] = await Promise.all([
        api.get('/users/clients?include_frozen=true'),
        api.get('/services'),
        api.get('/users/walkers'),
        api.get('/billing-plans').catch(() => ({ data: [] })),
      ]);
      setClients(clientsRes.data);
      setServices(servicesRes.data);
      setWalkers(walkersRes.data);
      setBillingPlans(plansRes.data || []);
      
      // Initialize custom pricing with default prices
      const defaultPricing = {};
      servicesRes.data.forEach(s => {
        defaultPricing[s.service_type] = s.price;
      });
      setCustomPricing(defaultPricing);
    } catch (error) {
      toast.error('Failed to load clients');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setCustomerForm({
      username: '',
      email: '',
      password: '',
      full_name: '',
      phone: '',
      address: '',
      billing_cycle: 'weekly',
    });
    setPets([{
      name: '',
      species: 'dog',
      breed: '',
      age: '',
      weight: '',
      notes: '',
    }]);
    const defaultPricing = {};
    services.forEach(s => {
      defaultPricing[s.service_type] = s.price;
    });
    setCustomPricing(defaultPricing);
    setWalkingSchedule({
      service_type: 'walk_30',
      walks_per_day: 1,
      days: [],
      preferred_times: [],
      preferred_walker_id: '',
      duration_value: 1,
      notes: '',
    });
  };

  const addPet = () => {
    setPets([...pets, {
      name: '',
      species: 'dog',
      breed: '',
      age: '',
      weight: '',
      notes: '',
    }]);
  };

  const removePet = (index) => {
    if (pets.length > 1) {
      setPets(pets.filter((_, i) => i !== index));
    }
  };

  const updatePet = (index, field, value) => {
    const newPets = [...pets];
    newPets[index][field] = value;
    setPets(newPets);
  };

  const toggleDay = (day) => {
    const newDays = walkingSchedule.days.includes(day)
      ? walkingSchedule.days.filter(d => d !== day)
      : [...walkingSchedule.days, day];
    setWalkingSchedule({ ...walkingSchedule, days: newDays });
  };

  const addPreferredTime = () => {
    if (walkingSchedule.preferred_times.length < walkingSchedule.walks_per_day) {
      setWalkingSchedule({
        ...walkingSchedule,
        preferred_times: [...walkingSchedule.preferred_times, '09:00']
      });
    }
  };

  const updatePreferredTime = (index, value) => {
    const newTimes = [...walkingSchedule.preferred_times];
    newTimes[index] = value;
    setWalkingSchedule({ ...walkingSchedule, preferred_times: newTimes });
  };

  const removePreferredTime = (index) => {
    const newTimes = walkingSchedule.preferred_times.filter((_, i) => i !== index);
    setWalkingSchedule({ ...walkingSchedule, preferred_times: newTimes });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      // 1. Create the customer account
      const registerRes = await api.post('/auth/register', {
        ...customerForm,
        role: 'client',
      });
      
      const newClientId = registerRes.data.user.id;
      
      // 2. Set billing cycle
      await api.put(`/users/${newClientId}/billing-cycle?billing_cycle=${customerForm.billing_cycle}`);
      
      // 3. Update address if provided
      if (customerForm.address) {
        await api.put(`/users/${newClientId}`, { address: customerForm.address });
      }
      
      // 4. Add pets for the customer
      for (const pet of pets) {
        if (pet.name.trim()) {
          await api.post('/pets/admin', {
            owner_id: newClientId,
            name: pet.name,
            species: pet.species,
            breed: pet.breed || null,
            age: pet.age ? parseInt(pet.age) : null,
            weight: pet.weight ? parseFloat(pet.weight) : null,
            notes: pet.notes || null,
          });
        }
      }
      
      // 5. Save custom pricing for this client
      const hasCustomPricing = Object.entries(customPricing).some(([type, price]) => {
        const defaultService = services.find(s => s.service_type === type);
        return defaultService && price !== defaultService.price;
      });
      
      if (hasCustomPricing) {
        await api.post(`/users/${newClientId}/custom-pricing`, customPricing);
      }
      
      // 6. Save walking schedule
      if (walkingSchedule.days.length > 0) {
        await api.post(`/users/${newClientId}/walking-schedule`, walkingSchedule);
      }
      
      toast.success(`Customer "${customerForm.full_name}" created successfully!`);
      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create customer');
    } finally {
      setSaving(false);
    }
  };

  const viewClientDetails = async (client) => {
    try {
      // Fetch client's pets and schedule
      const [petsRes, scheduleRes] = await Promise.all([
        api.get(`/pets?owner_id=${client.id}`),
        api.get(`/users/${client.id}/walking-schedule`).catch(() => ({ data: null })),
      ]);
      setSelectedClient({ 
        ...client, 
        pets: petsRes.data,
        walkingSchedule: scheduleRes.data 
      });
      setEditMode(false);
    } catch (error) {
      setSelectedClient({ ...client, pets: [], walkingSchedule: null });
    }
  };

  const startEditClient = () => {
    if (!selectedClient) return;
    
    setCustomerForm({
      username: selectedClient.username || '',
      email: selectedClient.email || '',
      password: '',
      full_name: selectedClient.full_name || '',
      phone: selectedClient.phone || '',
      address: selectedClient.address || '',
      billing_cycle: selectedClient.billing_cycle || 'weekly',
    });
    
    if (selectedClient.pets?.length > 0) {
      setPets(selectedClient.pets.map(p => ({
        id: p.id,
        name: p.name || '',
        species: p.species || 'dog',
        breed: p.breed || '',
        age: p.age?.toString() || '',
        weight: p.weight?.toString() || '',
        notes: p.notes || '',
      })));
    } else {
      setPets([{ name: '', species: 'dog', breed: '', age: '', weight: '', notes: '' }]);
    }
    
    if (selectedClient.walkingSchedule) {
      setWalkingSchedule({
        ...selectedClient.walkingSchedule,
        service_type: selectedClient.walkingSchedule.service_type || 'walk_30',
        duration_value: selectedClient.walkingSchedule.duration_value || 1,
      });
    } else {
      setWalkingSchedule({
        service_type: 'walk_30',
        walks_per_day: 1,
        days: [],
        preferred_times: [],
        preferred_walker_id: '',
        duration_value: 1,
        notes: '',
      });
    }
    
    setEditMode(true);
  };

  const saveClientEdit = async () => {
    if (!selectedClient) return;
    setSaving(true);
    
    try {
      // Update user profile
      await api.put(`/users/${selectedClient.id}`, {
        full_name: customerForm.full_name,
        email: customerForm.email,
        phone: customerForm.phone,
        address: customerForm.address,
      });
      
      // Update billing cycle
      await api.put(`/users/${selectedClient.id}/billing-cycle?billing_cycle=${customerForm.billing_cycle}`);
      
      // Update pets
      for (const pet of pets) {
        if (pet.name.trim()) {
          if (pet.id) {
            // Update existing pet
            await api.put(`/pets/${pet.id}`, {
              name: pet.name,
              species: pet.species,
              breed: pet.breed || null,
              age: pet.age ? parseInt(pet.age) : null,
              weight: pet.weight ? parseFloat(pet.weight) : null,
              notes: pet.notes || null,
            });
          } else {
            // Create new pet
            await api.post('/pets/admin', {
              owner_id: selectedClient.id,
              name: pet.name,
              species: pet.species,
              breed: pet.breed || null,
              age: pet.age ? parseInt(pet.age) : null,
              weight: pet.weight ? parseFloat(pet.weight) : null,
              notes: pet.notes || null,
            });
          }
        }
      }
      
      // Save walking schedule
      await api.post(`/users/${selectedClient.id}/walking-schedule`, walkingSchedule);
      
      toast.success('Customer updated successfully!');
      setEditMode(false);
      setSelectedClient(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update customer');
    } finally {
      setSaving(false);
    }
  };

  const saveClientPricing = async () => {
    if (!selectedClient) return;
    setSaving(true);
    try {
      // If default pricing, send empty custom_prices so it uses standard rates
      const customPricesToSave = clientPricing.pricing_type === 'default' ? {} : clientPricing.custom_prices;
      
      await api.put(`/users/${selectedClient.id}/pricing`, {
        billing_plan_id: clientPricing.billing_plan_id || null,
        custom_prices: customPricesToSave,
        pricing_notes: clientPricing.notes,
        pricing_type: clientPricing.pricing_type,
        pricing_setup_completed: true
      });
      
      toast.success('Pricing saved successfully!');
      setPricingMode(false);
      setSelectedClient(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save pricing');
    } finally {
      setSaving(false);
    }
  };

  const generateAppointmentsForClient = async () => {
    if (!selectedClient) return;
    setSaving(true);
    try {
      const response = await api.post(`/users/${selectedClient.id}/generate-appointments?weeks_ahead=4`);
      const data = response.data;
      
      if (data.appointments_created > 0) {
        toast.success(`Generated ${data.appointments_created} appointments`);
      } else {
        // Show diagnostic info when 0 appointments generated
        const d = data.diagnostic || {};
        const msg = `No appointments generated. Debug info:
• Existing schedules: ${d.existing_recurring_schedules || 0}
• Has onboarding data: ${d.onboarding_data_exists ? 'Yes' : 'No'}
• Preferred days: ${d.preferred_days?.length || 0}
• Preferred times: ${d.preferred_times?.length || 0}
• Schedule type: ${d.schedule_type || 'Not set'}`;
        alert(msg);
      }
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to generate appointments');
    } finally {
      setSaving(false);
    }
  };

  const viewScheduleDiagnostic = async () => {
    if (!selectedClient) return;
    try {
      const response = await api.get(`/users/${selectedClient.id}/schedule-diagnostic`);
      const d = response.data;
      const msg = `Diagnostic for ${d.full_name}:
• Onboarding: ${d.onboarding_completed ? 'Yes' : 'No'}
• Pricing: ${d.pricing_setup_completed ? 'Yes' : 'No'}
• Pets: ${d.pets_count}
• Recurring Schedules: ${d.recurring_schedules_count} (Active: ${d.recurring_schedules_by_status.active}, Pending: ${d.recurring_schedules_by_status.pending_assignment})
• Appointments: ${d.appointments_count} (Future: ${d.future_appointments})
• Days: ${d.onboarding_data?.preferred_days?.join(', ') || 'None'}
• Times: ${d.onboarding_data?.preferred_walk_times?.join(', ') || 'None'}`;
      alert(msg);
    } catch (error) {
      toast.error('Failed to get diagnostic info');
    }
  };

  const initPricingMode = () => {
    // Initialize pricing form with default prices
    const defaultPrices = {};
    services.forEach(s => {
      defaultPrices[s.service_type] = selectedClient?.custom_prices?.[s.service_type] || s.price;
    });
    // Check if client already has custom pricing set
    const hasCustomPricing = selectedClient?.custom_prices && Object.keys(selectedClient.custom_prices).length > 0;
    setClientPricing({
      pricing_type: hasCustomPricing ? 'custom' : 'default',
      billing_plan_id: selectedClient?.billing_plan_id || '',
      custom_prices: defaultPrices,
      notes: selectedClient?.pricing_notes || ''
    });
    setPricingMode(true);
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    setSaving(true);
    try {
      await api.delete(`/users/${userToDelete.id}`);
      toast.success(`${userToDelete.full_name} has been deleted`);
      setDeleteConfirmOpen(false);
      setUserToDelete(null);
      setSelectedClient(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete user');
    } finally {
      setSaving(false);
    }
  };

  const handleFreezeUser = async (userId, freeze = true) => {
    setSaving(true);
    try {
      await api.put(`/users/${userId}/${freeze ? 'freeze' : 'unfreeze'}`);
      toast.success(`Account ${freeze ? 'frozen' : 'unfrozen'} successfully`);
      fetchData();
      // Update selected client if viewing
      if (selectedClient?.id === userId) {
        setSelectedClient(prev => prev ? {...prev, is_active: !freeze} : null);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || `Failed to ${freeze ? 'freeze' : 'unfreeze'} account`);
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (user) => {
    setUserToDelete(user);
    setDeleteConfirmOpen(true);
  };

  const filteredClients = clients.filter(client =>
    client.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
      <div className="space-y-8" data-testid="admin-clients-page">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-heading font-bold">Clients</h1>
            <p className="text-muted-foreground">{clients.length} registered clients</p>
          </div>
          <div className="flex gap-3">
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search clients..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 rounded-full"
                data-testid="search-clients"
              />
            </div>
            <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
              <DialogTrigger asChild>
                <Button className="rounded-full" data-testid="add-client-btn">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Customer
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Add New Customer</DialogTitle>
                  <DialogDescription>Create a new customer account with their info, pets, schedule, and pricing</DialogDescription>
                </DialogHeader>
                
                <form onSubmit={handleSubmit} className="space-y-6">
                  <Tabs defaultValue="info" className="w-full">
                    <TabsList className="grid w-full grid-cols-4">
                      <TabsTrigger value="info">Info</TabsTrigger>
                      <TabsTrigger value="pets">Pets</TabsTrigger>
                      <TabsTrigger value="schedule">Schedule</TabsTrigger>
                      <TabsTrigger value="pricing">Pricing</TabsTrigger>
                    </TabsList>
                    
                    {/* Customer Info Tab */}
                    <TabsContent value="info" className="space-y-4 mt-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="full_name">Full Name *</Label>
                          <Input
                            id="full_name"
                            value={customerForm.full_name}
                            onChange={(e) => setCustomerForm({ ...customerForm, full_name: e.target.value })}
                            placeholder="John Smith"
                            required
                            data-testid="customer-fullname"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="username">Username *</Label>
                          <Input
                            id="username"
                            value={customerForm.username}
                            onChange={(e) => setCustomerForm({ ...customerForm, username: e.target.value })}
                            placeholder="johnsmith"
                            required
                            data-testid="customer-username"
                          />
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="email">Email *</Label>
                          <Input
                            id="email"
                            type="email"
                            value={customerForm.email}
                            onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })}
                            placeholder="john@example.com"
                            required
                            data-testid="customer-email"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="phone">Phone</Label>
                          <Input
                            id="phone"
                            value={customerForm.phone}
                            onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })}
                            placeholder="(555) 123-4567"
                            data-testid="customer-phone"
                          />
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="address">Address</Label>
                        <Input
                          id="address"
                          value={customerForm.address}
                          onChange={(e) => setCustomerForm({ ...customerForm, address: e.target.value })}
                          placeholder="123 Main St, City, State"
                          data-testid="customer-address"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="password">Password *</Label>
                        <Input
                          id="password"
                          type="password"
                          value={customerForm.password}
                          onChange={(e) => setCustomerForm({ ...customerForm, password: e.target.value })}
                          placeholder="Create a password"
                          required
                          data-testid="customer-password"
                        />
                      </div>
                    </TabsContent>
                    
                    {/* Pet Info Tab */}
                    <TabsContent value="pets" className="space-y-4 mt-4">
                      {pets.map((pet, index) => (
                        <Card key={index} className="p-4">
                          <div className="flex items-center justify-between mb-4">
                            <h4 className="font-medium flex items-center gap-2">
                              <PawPrint className="w-4 h-4 text-primary" />
                              Pet {index + 1}
                            </h4>
                            {pets.length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removePet(index)}
                                className="text-destructive"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>Pet Name *</Label>
                              <Input
                                value={pet.name}
                                onChange={(e) => updatePet(index, 'name', e.target.value)}
                                placeholder="Buddy"
                                data-testid={`pet-name-${index}`}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Species</Label>
                              <Select
                                value={pet.species}
                                onValueChange={(value) => updatePet(index, 'species', value)}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="dog">Dog</SelectItem>
                                  <SelectItem value="cat">Cat</SelectItem>
                                  <SelectItem value="bird">Bird</SelectItem>
                                  <SelectItem value="other">Other</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-3 gap-4 mt-4">
                            <div className="space-y-2">
                              <Label>Breed</Label>
                              <Input
                                value={pet.breed}
                                onChange={(e) => updatePet(index, 'breed', e.target.value)}
                                placeholder="Golden Retriever"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Age (years)</Label>
                              <Input
                                type="number"
                                value={pet.age}
                                onChange={(e) => updatePet(index, 'age', e.target.value)}
                                placeholder="3"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Weight (lbs)</Label>
                              <Input
                                type="number"
                                value={pet.weight}
                                onChange={(e) => updatePet(index, 'weight', e.target.value)}
                                placeholder="50"
                              />
                            </div>
                          </div>
                          
                          <div className="space-y-2 mt-4">
                            <Label>Special Notes</Label>
                            <Textarea
                              value={pet.notes}
                              onChange={(e) => updatePet(index, 'notes', e.target.value)}
                              placeholder="Allergies, medications, temperament..."
                              rows={2}
                            />
                          </div>
                        </Card>
                      ))}
                      
                      <Button type="button" variant="outline" onClick={addPet} className="w-full rounded-full">
                        <Plus className="w-4 h-4 mr-2" />
                        Add Another Pet
                      </Button>
                    </TabsContent>
                    
                    {/* Schedule Tab */}
                    <TabsContent value="schedule" className="space-y-4 mt-4">
                      <div className="space-y-4">
                        {/* Service Type Selection */}
                        <div className="space-y-2">
                          <Label className="flex items-center gap-2 text-base font-semibold">
                            <PawPrint className="w-4 h-4" />
                            Service Type
                          </Label>
                          <Select
                            value={walkingSchedule.service_type || 'walk_30'}
                            onValueChange={(value) => setWalkingSchedule({ 
                              ...walkingSchedule, 
                              service_type: value,
                              // Reset duration when changing service type
                              duration_value: 1
                            })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select service" />
                            </SelectTrigger>
                            <SelectContent>
                              {services.map((service) => {
                                const durationType = service.service_type?.includes('day') ? 'days' : 
                                                    service.service_type?.includes('overnight') || service.service_type?.includes('petsit') ? 'nights' : 'minutes';
                                let priceLabel = `$${service.price?.toFixed(2)}`;
                                if (durationType === 'days') priceLabel += '/day';
                                if (durationType === 'nights') priceLabel += '/night';
                                return (
                                  <SelectItem key={service.id} value={service.service_type}>
                                    {service.name} - {priceLabel}
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Days of Week Selection */}
                        <div className="space-y-2">
                          <Label className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            Days Per Week
                          </Label>
                          <div className="flex flex-wrap gap-2">
                            {DAYS_OF_WEEK.map((day) => (
                              <Button
                                key={day.value}
                                type="button"
                                variant={walkingSchedule.days.includes(day.value) ? 'default' : 'outline'}
                                size="sm"
                                className="rounded-full"
                                onClick={() => toggleDay(day.value)}
                              >
                                {day.short}
                              </Button>
                            ))}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {walkingSchedule.days.length} day(s) selected
                          </p>
                        </div>

                        {/* Duration - Show different options based on service type */}
                        {walkingSchedule.service_type?.includes('walk') ? (
                          <>
                            <div className="space-y-2">
                              <Label className="flex items-center gap-2">
                                <Clock className="w-4 h-4" />
                                Walks Per Day
                              </Label>
                              <Select
                                value={walkingSchedule.walks_per_day?.toString() || '1'}
                                onValueChange={(value) => setWalkingSchedule({ 
                                  ...walkingSchedule, 
                                  walks_per_day: parseInt(value),
                                  preferred_times: walkingSchedule.preferred_times?.slice(0, parseInt(value)) || []
                                })}
                              >
                                <SelectTrigger className="w-32">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="1">1 walk</SelectItem>
                                  <SelectItem value="2">2 walks</SelectItem>
                                  <SelectItem value="3">3 walks</SelectItem>
                                  <SelectItem value="4">4 walks</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            
                            <div className="space-y-2">
                              <Label>Preferred Walk Times</Label>
                              <div className="space-y-2">
                                {(walkingSchedule.preferred_times || []).map((time, index) => (
                                  <div key={index} className="flex items-center gap-2">
                                    <Select
                                      value={time}
                                      onValueChange={(value) => updatePreferredTime(index, value)}
                                    >
                                      <SelectTrigger className="w-32">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent className="max-h-60">
                                        {TIME_SLOTS.map((slot) => (
                                          <SelectItem key={slot} value={slot}>{slot}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    <span className="text-sm text-muted-foreground">Walk {index + 1}</span>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => removePreferredTime(index)}
                                      className="text-destructive"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </div>
                                ))}
                                {(walkingSchedule.preferred_times?.length || 0) < (walkingSchedule.walks_per_day || 1) && (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={addPreferredTime}
                                    className="rounded-full"
                                  >
                                    <Plus className="w-4 h-4 mr-1" />
                                    Add Time
                                  </Button>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                Time slots are in 15-minute increments
                              </p>
                            </div>
                          </>
                        ) : walkingSchedule.service_type?.includes('day') || walkingSchedule.service_type?.includes('concierge') ? (
                          <div className="space-y-2">
                            <Label className="flex items-center gap-2">
                              <Clock className="w-4 h-4" />
                              Days Per Booking
                            </Label>
                            <div className="flex flex-wrap gap-2">
                              {[1, 2, 3, 4, 5, 6, 7].map((num) => (
                                <Button
                                  key={num}
                                  type="button"
                                  variant={(walkingSchedule.duration_value || 1) === num ? 'default' : 'outline'}
                                  size="sm"
                                  className={`rounded-full w-10 h-10 ${(walkingSchedule.duration_value || 1) === num ? 'bg-purple-500 hover:bg-purple-600' : ''}`}
                                  onClick={() => setWalkingSchedule({ ...walkingSchedule, duration_value: num })}
                                >
                                  {num}
                                </Button>
                              ))}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {walkingSchedule.duration_value || 1} day(s) per booking
                            </p>
                          </div>
                        ) : (walkingSchedule.service_type?.includes('overnight') || walkingSchedule.service_type?.includes('petsit')) ? (
                          <div className="space-y-2">
                            <Label className="flex items-center gap-2">
                              <Clock className="w-4 h-4" />
                              Nights Per Booking
                            </Label>
                            <div className="flex flex-wrap gap-2">
                              {[1, 2, 3, 4, 5, 6, 7, 14].map((num) => (
                                <Button
                                  key={num}
                                  type="button"
                                  variant={(walkingSchedule.duration_value || 1) === num ? 'default' : 'outline'}
                                  size="sm"
                                  className={`rounded-full w-10 h-10 ${(walkingSchedule.duration_value || 1) === num ? 'bg-indigo-500 hover:bg-indigo-600' : ''}`}
                                  onClick={() => setWalkingSchedule({ ...walkingSchedule, duration_value: num })}
                                >
                                  {num}
                                </Button>
                              ))}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {walkingSchedule.duration_value || 1} night(s) per booking
                            </p>
                          </div>
                        ) : null}
                        
                        <div className="space-y-2">
                          <Label>Preferred Walker/Sitter (Optional)</Label>
                          <Select
                            value={walkingSchedule.preferred_walker_id || 'any'}
                            onValueChange={(value) => {
                              const walkerId = value === 'any' ? '' : value;
                              setWalkingSchedule({ 
                                ...walkingSchedule, 
                                preferred_walker_id: walkerId 
                              });
                              if (walkerId && selectedClient) {
                                checkAdminWalkerConflicts(walkerId, selectedClient);
                              }
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Any available" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="any">Any available walker</SelectItem>
                              {walkers.map((walker) => (
                                <SelectItem key={walker.id} value={walker.id}>
                                  {walker.full_name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {checkingWalkerConflicts && (
                            <p className="text-xs text-muted-foreground">Checking availability...</p>
                          )}
                        </div>
                        
                        <div className="space-y-2">
                          <Label>Schedule Notes</Label>
                          <Textarea
                            value={walkingSchedule.notes}
                            onChange={(e) => setWalkingSchedule({ ...walkingSchedule, notes: e.target.value })}
                            placeholder="Any special scheduling requirements..."
                            rows={2}
                          />
                        </div>
                      </div>
                    </TabsContent>
                    
                    {/* Pricing & Billing Tab */}
                    <TabsContent value="pricing" className="space-y-4 mt-4">
                      <div className="space-y-2">
                        <Label>Billing Cycle</Label>
                        <Select
                          value={customerForm.billing_cycle}
                          onValueChange={(value) => setCustomerForm({ ...customerForm, billing_cycle: value })}
                        >
                          <SelectTrigger data-testid="billing-cycle-select">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="daily">Daily</SelectItem>
                            <SelectItem value="weekly">Weekly</SelectItem>
                            <SelectItem value="monthly">Monthly</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">How often this customer will be invoiced</p>
                      </div>
                      
                      <div className="space-y-4">
                        <Label className="flex items-center gap-2">
                          <DollarSign className="w-4 h-4" />
                          Custom Pricing (Optional)
                        </Label>
                        <p className="text-xs text-muted-foreground">Leave as default or set custom prices for this customer</p>
                        
                        {services.map((service) => (
                          <div key={service.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
                            <div>
                              <p className="font-medium">{service.name}</p>
                              <p className="text-xs text-muted-foreground">Default: ${service.price.toFixed(2)}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground">$</span>
                              <Input
                                type="number"
                                step="0.01"
                                value={customPricing[service.service_type] || service.price}
                                onChange={(e) => setCustomPricing({
                                  ...customPricing,
                                  [service.service_type]: parseFloat(e.target.value) || service.price
                                })}
                                className="w-24"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </TabsContent>
                  </Tabs>
                  
                  <div className="flex justify-end gap-3 pt-4 border-t">
                    <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" className="rounded-full" disabled={saving} data-testid="submit-customer">
                      {saving ? 'Creating...' : 'Create Customer'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Clients Grid */}
        {filteredClients.length === 0 ? (
          <Card className="rounded-2xl shadow-sm">
            <CardContent className="p-12 text-center">
              <Users className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-lg text-muted-foreground">No clients found</p>
              <Button onClick={() => setDialogOpen(true)} className="mt-4 rounded-full">
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Customer
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredClients.map((client) => (
              <Card 
                key={client.id} 
                className={`rounded-2xl shadow-sm hover:shadow-md transition-shadow cursor-pointer ${!client.is_active ? 'opacity-60 border-red-300' : ''}`}
                data-testid={`client-card-${client.id}`}
                onClick={() => viewClientDetails(client)}
              >
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <Avatar className="w-14 h-14">
                      <AvatarImage src={client.profile_image} />
                      <AvatarFallback className="bg-primary/10 text-primary text-lg">
                        {client.full_name?.charAt(0) || 'C'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold truncate">{client.full_name}</h3>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge className="bg-blue-100 text-blue-800 rounded-full text-xs">
                          Client
                        </Badge>
                        {!client.is_active && (
                          <Badge className="bg-red-100 text-red-800 rounded-full text-xs">
                            <Lock className="w-3 h-3 mr-1" />
                            Frozen
                          </Badge>
                        )}
                        <Badge variant="outline" className="rounded-full text-xs capitalize">
                          {client.billing_cycle || 'weekly'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="w-4 h-4" />
                      <span className="truncate">{client.email}</span>
                    </div>
                    {client.phone && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="w-4 h-4" />
                        <span>{client.phone}</span>
                      </div>
                    )}
                  </div>
                  {/* Quick Actions */}
                  <div className="mt-4 pt-3 border-t flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); handleFreezeUser(client.id, client.is_active !== false); }}
                      className={client.is_active === false ? 'text-green-600 hover:bg-green-50' : 'text-amber-600 hover:bg-amber-50'}
                    >
                      {client.is_active === false ? <Unlock className="w-4 h-4 mr-1" /> : <Lock className="w-4 h-4 mr-1" />}
                      {client.is_active === false ? 'Unfreeze' : 'Freeze'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); confirmDelete(client); }}
                      className="text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Client Details/Edit Dialog */}
        <Dialog open={!!selectedClient} onOpenChange={(open) => { if (!open) { setSelectedClient(null); setEditMode(false); setPricingMode(false); } }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editMode ? 'Edit Customer' : pricingMode ? 'Set Up Pricing' : 'Customer Details'}</DialogTitle>
            </DialogHeader>
            
            {/* Pricing Setup Mode */}
            {selectedClient && pricingMode && (
              <div className="space-y-6">
                {/* Client Info Summary */}
                <div className="flex items-center gap-4 p-4 rounded-xl bg-blue-50 border border-blue-200">
                  <Avatar className="w-12 h-12">
                    <AvatarImage src={selectedClient.profile_image} />
                    <AvatarFallback className="bg-blue-100 text-blue-600">
                      {selectedClient.full_name?.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-bold">{selectedClient.full_name}</h3>
                    <p className="text-sm text-muted-foreground">{selectedClient.email}</p>
                  </div>
                </div>

                {/* Onboarding Preferences Summary */}
                {selectedClient.onboarding_data && (
                  <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
                    <h4 className="font-semibold text-amber-800 mb-3 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      Client&apos;s Requested Schedule
                    </h4>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-muted-foreground">Days per week:</span>
                        <span className="ml-2 font-medium">{selectedClient.onboarding_data.days_per_week}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Walks per day:</span>
                        <span className="ml-2 font-medium">{selectedClient.onboarding_data.walks_per_day}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Walk duration:</span>
                        <span className="ml-2 font-medium">{selectedClient.onboarding_data.walk_duration || 30} minutes</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-muted-foreground">Preferred days:</span>
                        <span className="ml-2 font-medium">{selectedClient.onboarding_data.preferred_days?.join(', ')}</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-muted-foreground">Preferred times:</span>
                        <span className="ml-2 font-medium">
                          {selectedClient.onboarding_data.preferred_walk_times?.map(t => {
                            const [h, m] = t.split(':');
                            const hour = parseInt(h);
                            return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`;
                          }).join(', ')}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Billing:</span>
                        <span className="ml-2 font-medium capitalize">{selectedClient.onboarding_data.billing_frequency}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Payment:</span>
                        <span className="ml-2 font-medium capitalize">{selectedClient.onboarding_data.payment_method?.replace('_', '/')}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Schedule Type Selection - One-Time or Recurring */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Schedule Type
                  </Label>
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      variant={clientPricing.schedule_type === 'one_time' ? "default" : "outline"}
                      className={`h-auto py-4 flex flex-col ${clientPricing.schedule_type === 'one_time' ? 'bg-sky-500 hover:bg-sky-600' : ''}`}
                      onClick={() => setClientPricing({...clientPricing, schedule_type: 'one_time'})}
                    >
                      <CalendarDays className="w-5 h-5 mb-1" />
                      <span className="text-lg font-bold">One-Time</span>
                      <span className="text-xs opacity-80">Single appointment</span>
                    </Button>
                    <Button
                      variant={clientPricing.schedule_type === 'recurring' ? "default" : "outline"}
                      className={`h-auto py-4 flex flex-col ${clientPricing.schedule_type === 'recurring' ? 'bg-orange-500 hover:bg-orange-600' : ''}`}
                      onClick={() => setClientPricing({...clientPricing, schedule_type: 'recurring'})}
                    >
                      <Repeat className="w-5 h-5 mb-1" />
                      <span className="text-lg font-bold">Recurring</span>
                      <span className="text-xs opacity-80">Repeats weekly</span>
                    </Button>
                  </div>
                  {clientPricing.schedule_type === 'recurring' && (
                    <div className="p-3 rounded-lg bg-orange-50 border border-orange-200 text-sm text-orange-800">
                      <p className="font-medium flex items-center gap-2">
                        <Repeat className="w-4 h-4" />
                        Weekly recurring schedule
                      </p>
                      <p className="text-xs mt-1">Walks will repeat every week on the selected days until paused or stopped.</p>
                    </div>
                  )}
                  {clientPricing.schedule_type === 'one_time' && (
                    <div className="p-3 rounded-lg bg-sky-50 border border-sky-200 text-sm text-sky-800">
                      <p className="font-medium flex items-center gap-2">
                        <CalendarDays className="w-4 h-4" />
                        One-time appointment
                      </p>
                      <p className="text-xs mt-1">This will create a single appointment that does not repeat.</p>
                    </div>
                  )}
                </div>

                {/* Pricing Type Selection */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    Pricing Type
                  </Label>
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      variant={clientPricing.pricing_type === 'default' ? "default" : "outline"}
                      className={`h-auto py-4 flex flex-col ${clientPricing.pricing_type === 'default' ? 'bg-green-500 hover:bg-green-600' : ''}`}
                      onClick={() => {
                        // Reset to default prices when switching to default
                        const defaultPrices = {};
                        services.forEach(s => {
                          defaultPrices[s.service_type] = s.price;
                        });
                        setClientPricing({...clientPricing, pricing_type: 'default', custom_prices: defaultPrices});
                      }}
                    >
                      <span className="text-lg font-bold">Default Pricing</span>
                      <span className="text-xs opacity-80">Use standard rates</span>
                    </Button>
                    <Button
                      variant={clientPricing.pricing_type === 'custom' ? "default" : "outline"}
                      className={`h-auto py-4 flex flex-col ${clientPricing.pricing_type === 'custom' ? 'bg-amber-500 hover:bg-amber-600' : ''}`}
                      onClick={() => setClientPricing({...clientPricing, pricing_type: 'custom'})}
                    >
                      <span className="text-lg font-bold">Custom Pricing</span>
                      <span className="text-xs opacity-80">Set specific rates</span>
                    </Button>
                  </div>
                </div>

                {/* Default Pricing Summary */}
                {clientPricing.pricing_type === 'default' && (
                  <div className="p-4 rounded-xl bg-green-50 border border-green-200">
                    <h4 className="font-semibold text-green-800 mb-3 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" />
                      Default Pricing Applied
                    </h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {services.map(service => (
                        <div key={service.service_type} className="flex justify-between">
                          <span className="text-muted-foreground capitalize">{service.service_type.replace(/_/g, ' ')}:</span>
                          <span className="font-medium">${service.price}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Custom Pricing per Service */}
                {clientPricing.pricing_type === 'custom' && (
                  <div className="space-y-3">
                    <Label className="text-base font-semibold flex items-center gap-2">
                      <Settings className="w-4 h-4" />
                      Custom Service Pricing
                    </Label>
                    <div className="grid grid-cols-2 gap-3">
                      {services.map(service => (
                        <div key={service.service_type} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                          <Label className="text-sm flex-1 capitalize">{service.service_type.replace(/_/g, ' ')}</Label>
                          <div className="relative w-24">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder={service.price.toString()}
                              value={clientPricing.custom_prices[service.service_type] || ''}
                              onChange={(e) => setClientPricing({
                                ...clientPricing,
                                custom_prices: {
                                  ...clientPricing.custom_prices,
                                  [service.service_type]: parseFloat(e.target.value) || 0
                                }
                              })}
                              className="pl-6"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Default price shown as placeholder. Leave blank to use default.
                    </p>
                  </div>
                )}

                {/* Billing Plan Selection (Optional) */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold flex items-center gap-2">
                    <CreditCard className="w-4 h-4" />
                    Billing Plan (Optional)
                  </Label>
                  <Select 
                    value={clientPricing.billing_plan_id || "none"} 
                    onValueChange={(v) => setClientPricing({...clientPricing, billing_plan_id: v === "none" ? "" : v})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a billing plan (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Plan</SelectItem>
                      {billingPlans.map(plan => (
                        <SelectItem key={plan.id} value={plan.id}>{plan.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Pricing Notes */}
                <div className="space-y-2">
                  <Label>Pricing Notes (optional)</Label>
                  <Textarea
                    placeholder="Any special pricing arrangements or notes..."
                    value={clientPricing.notes}
                    onChange={(e) => setClientPricing({...clientPricing, notes: e.target.value})}
                    rows={2}
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4 border-t">
                  <Button variant="outline" onClick={() => setPricingMode(false)} className="flex-1">
                    Cancel
                  </Button>
                  <Button onClick={saveClientPricing} disabled={saving} className="flex-1 bg-green-500 hover:bg-green-600">
                    {saving ? 'Saving...' : 'Save Pricing'}
                    <CheckCircle className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}
            
            {selectedClient && !editMode && !pricingMode && (
              <div className="space-y-4">
                {/* Needs Pricing Setup Alert */}
                {!selectedClient.pricing_setup_completed && selectedClient.onboarding_completed && (
                  <div className="p-4 rounded-xl bg-amber-50 border-2 border-amber-400">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <AlertCircle className="w-6 h-6 text-amber-600" />
                        <div>
                          <p className="font-semibold text-amber-800">Pricing Setup Required</p>
                          <p className="text-sm text-amber-600">This client completed onboarding and needs pricing configured.</p>
                        </div>
                      </div>
                      <Button onClick={initPricingMode} className="bg-amber-500 hover:bg-amber-600">
                        <DollarSign className="w-4 h-4 mr-1" />
                        Set Pricing
                      </Button>
                    </div>
                  </div>
                )}
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Avatar className="w-16 h-16">
                      <AvatarImage src={selectedClient.profile_image} />
                      <AvatarFallback className="bg-primary/10 text-primary text-2xl">
                        {selectedClient.full_name?.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="text-xl font-bold">{selectedClient.full_name}</h3>
                      <p className="text-muted-foreground">{selectedClient.email}</p>
                      {selectedClient.phone && <p className="text-sm text-muted-foreground">{selectedClient.phone}</p>}
                      {selectedClient.address && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {selectedClient.address}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {selectedClient.pricing_setup_completed && (
                      <Button variant="outline" size="sm" onClick={initPricingMode}>
                        <DollarSign className="w-4 h-4 mr-1" />
                        Pricing
                      </Button>
                    )}
                    {selectedClient.pricing_setup_completed && (
                      <Button variant="outline" size="sm" onClick={generateAppointmentsForClient} disabled={saving}>
                        <CalendarPlus className="w-4 h-4 mr-1" />
                        {saving ? 'Generating...' : 'Generate Appointments'}
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={viewScheduleDiagnostic} title="View schedule diagnostic info">
                      <AlertCircle className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={startEditClient} data-testid="edit-client-btn">
                      <Edit className="w-4 h-4 mr-1" />
                      Edit
                    </Button>
                  </div>
                </div>
                
                <div className="flex gap-2 flex-wrap">
                  <Badge className="bg-blue-100 text-blue-800 rounded-full">Client</Badge>
                  <Badge variant="outline" className="rounded-full capitalize">{selectedClient.billing_cycle || 'weekly'} billing</Badge>
                  {selectedClient.pricing_setup_completed && (
                    <Badge className="bg-green-100 text-green-800 rounded-full">Pricing Set</Badge>
                  )}
                  {selectedClient.onboarding_data?.payment_method && (
                    <Badge variant="outline" className="rounded-full capitalize">
                      {selectedClient.onboarding_data.payment_method.replace('_', '/')}
                    </Badge>
                  )}
                </div>
                
                {/* Walking Schedule */}
                {selectedClient.walkingSchedule && selectedClient.walkingSchedule.days?.length > 0 && (
                  <div className="border-t pt-4">
                    <h4 className="font-medium flex items-center gap-2 mb-3">
                      <Calendar className="w-4 h-4 text-primary" />
                      Walking Schedule
                    </h4>
                    <div className="p-3 rounded-xl bg-muted/50 space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground">Days:</span>
                        <span className="capitalize">{selectedClient.walkingSchedule.days.join(', ')}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground">Walks per day:</span>
                        <span>{selectedClient.walkingSchedule.walks_per_day}</span>
                      </div>
                      {selectedClient.walkingSchedule.preferred_times?.length > 0 && (
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-muted-foreground">Preferred times:</span>
                          <span>{selectedClient.walkingSchedule.preferred_times.join(', ')}</span>
                        </div>
                      )}
                      {selectedClient.walkingSchedule.preferred_walker_id && (
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-muted-foreground">Preferred walker:</span>
                          <span>{walkers.find(w => w.id === selectedClient.walkingSchedule.preferred_walker_id)?.full_name || 'Unknown'}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Pets */}
                <div className="border-t pt-4">
                  <h4 className="font-medium flex items-center gap-2 mb-3">
                    <PawPrint className="w-4 h-4 text-primary" />
                    Pets ({selectedClient.pets?.length || 0})
                  </h4>
                  {selectedClient.pets?.length > 0 ? (
                    <div className="space-y-2">
                      {selectedClient.pets.map((pet) => (
                        <div key={pet.id} className="p-3 rounded-xl bg-muted/50">
                          <p className="font-medium">{pet.name}</p>
                          <p className="text-sm text-muted-foreground capitalize">
                            {pet.breed || pet.species} {pet.age && `• ${pet.age} years`} {pet.weight && `• ${pet.weight} lbs`}
                          </p>
                          {pet.notes && <p className="text-xs text-muted-foreground mt-1">{pet.notes}</p>}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm">No pets added</p>
                  )}
                </div>
              </div>
            )}
            
            {/* Edit Mode */}
            {selectedClient && editMode && (
              <div className="space-y-6">
                <Tabs defaultValue="info" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="info">Info</TabsTrigger>
                    <TabsTrigger value="pets">Pets</TabsTrigger>
                    <TabsTrigger value="schedule">Schedule</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="info" className="space-y-4 mt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Full Name</Label>
                        <Input
                          value={customerForm.full_name}
                          onChange={(e) => setCustomerForm({ ...customerForm, full_name: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Email</Label>
                        <Input
                          type="email"
                          value={customerForm.email}
                          onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Phone</Label>
                        <Input
                          value={customerForm.phone}
                          onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Billing Cycle</Label>
                        <Select
                          value={customerForm.billing_cycle}
                          onValueChange={(value) => setCustomerForm({ ...customerForm, billing_cycle: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="daily">Daily</SelectItem>
                            <SelectItem value="weekly">Weekly</SelectItem>
                            <SelectItem value="monthly">Monthly</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Address</Label>
                      <Input
                        value={customerForm.address}
                        onChange={(e) => setCustomerForm({ ...customerForm, address: e.target.value })}
                        placeholder="123 Main St, City, State"
                      />
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="pets" className="space-y-4 mt-4">
                    {pets.map((pet, index) => (
                      <Card key={index} className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-medium">Pet {index + 1}</h4>
                          {pets.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removePet(index)}
                              className="text-destructive"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <Input
                            value={pet.name}
                            onChange={(e) => updatePet(index, 'name', e.target.value)}
                            placeholder="Name"
                          />
                          <Select
                            value={pet.species}
                            onValueChange={(value) => updatePet(index, 'species', value)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="dog">Dog</SelectItem>
                              <SelectItem value="cat">Cat</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid grid-cols-3 gap-3 mt-3">
                          <Input
                            value={pet.breed}
                            onChange={(e) => updatePet(index, 'breed', e.target.value)}
                            placeholder="Breed"
                          />
                          <Input
                            type="number"
                            value={pet.age}
                            onChange={(e) => updatePet(index, 'age', e.target.value)}
                            placeholder="Age"
                          />
                          <Input
                            type="number"
                            value={pet.weight}
                            onChange={(e) => updatePet(index, 'weight', e.target.value)}
                            placeholder="Weight"
                          />
                        </div>
                      </Card>
                    ))}
                    <Button type="button" variant="outline" onClick={addPet} className="w-full rounded-full" size="sm">
                      <Plus className="w-4 h-4 mr-1" />
                      Add Pet
                    </Button>
                  </TabsContent>
                  
                  <TabsContent value="schedule" className="space-y-4 mt-4">
                    {/* Service Type Selection */}
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2 text-base font-semibold">
                        <PawPrint className="w-4 h-4" />
                        Service Type
                      </Label>
                      <Select
                        value={walkingSchedule.service_type || 'walk_30'}
                        onValueChange={(value) => setWalkingSchedule({ 
                          ...walkingSchedule, 
                          service_type: value,
                          duration_value: 1
                        })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select service" />
                        </SelectTrigger>
                        <SelectContent>
                          {services.map((service) => {
                            const durationType = service.service_type?.includes('day') ? 'days' : 
                                                service.service_type?.includes('overnight') || service.service_type?.includes('petsit') ? 'nights' : 'minutes';
                            let priceLabel = `$${service.price?.toFixed(2)}`;
                            if (durationType === 'days') priceLabel += '/day';
                            if (durationType === 'nights') priceLabel += '/night';
                            return (
                              <SelectItem key={service.id} value={service.service_type}>
                                {service.name} - {priceLabel}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Days of Week Selection */}
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        Days Per Week
                      </Label>
                      <div className="flex flex-wrap gap-2">
                        {DAYS_OF_WEEK.map((day) => (
                          <Button
                            key={day.value}
                            type="button"
                            variant={walkingSchedule.days.includes(day.value) ? 'default' : 'outline'}
                            size="sm"
                            className="rounded-full"
                            onClick={() => toggleDay(day.value)}
                          >
                            {day.short}
                          </Button>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {walkingSchedule.days.length} day(s) selected
                      </p>
                    </div>

                    {/* Duration - Show different options based on service type */}
                    {walkingSchedule.service_type?.includes('walk') || !walkingSchedule.service_type ? (
                      <>
                        <div className="space-y-2">
                          <Label className="flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            Walks Per Day
                          </Label>
                          <Select
                            value={walkingSchedule.walks_per_day?.toString() || '1'}
                            onValueChange={(value) => setWalkingSchedule({ 
                              ...walkingSchedule, 
                              walks_per_day: parseInt(value),
                              preferred_times: walkingSchedule.preferred_times?.slice(0, parseInt(value)) || []
                            })}
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1">1 walk</SelectItem>
                              <SelectItem value="2">2 walks</SelectItem>
                              <SelectItem value="3">3 walks</SelectItem>
                              <SelectItem value="4">4 walks</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div className="space-y-2">
                          <Label>Preferred Walk Times</Label>
                          <div className="space-y-2">
                            {(walkingSchedule.preferred_times || []).map((time, index) => (
                              <div key={index} className="flex items-center gap-2">
                                <Select
                                  value={time}
                                  onValueChange={(value) => updatePreferredTime(index, value)}
                                >
                                  <SelectTrigger className="w-32">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent className="max-h-60">
                                    {TIME_SLOTS.map((slot) => (
                                      <SelectItem key={slot} value={slot}>{slot}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <span className="text-sm text-muted-foreground">Walk {index + 1}</span>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removePreferredTime(index)}
                                  className="text-destructive"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            ))}
                            {(walkingSchedule.preferred_times?.length || 0) < (walkingSchedule.walks_per_day || 1) && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={addPreferredTime}
                                className="rounded-full"
                              >
                                <Plus className="w-4 h-4 mr-1" />
                                Add Time
                              </Button>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Time slots are in 15-minute increments
                          </p>
                        </div>
                      </>
                    ) : walkingSchedule.service_type?.includes('day') || walkingSchedule.service_type?.includes('concierge') ? (
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          Days Per Booking
                        </Label>
                        <div className="flex flex-wrap gap-2">
                          {[1, 2, 3, 4, 5, 6, 7].map((num) => (
                            <Button
                              key={num}
                              type="button"
                              variant={(walkingSchedule.duration_value || 1) === num ? 'default' : 'outline'}
                              size="sm"
                              className={`rounded-full w-10 h-10 ${(walkingSchedule.duration_value || 1) === num ? 'bg-purple-500 hover:bg-purple-600' : ''}`}
                              onClick={() => setWalkingSchedule({ ...walkingSchedule, duration_value: num })}
                            >
                              {num}
                            </Button>
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {walkingSchedule.duration_value || 1} day(s) per booking
                        </p>
                      </div>
                    ) : (walkingSchedule.service_type?.includes('overnight') || walkingSchedule.service_type?.includes('petsit')) ? (
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          Nights Per Booking
                        </Label>
                        <div className="flex flex-wrap gap-2">
                          {[1, 2, 3, 4, 5, 6, 7, 14].map((num) => (
                            <Button
                              key={num}
                              type="button"
                              variant={(walkingSchedule.duration_value || 1) === num ? 'default' : 'outline'}
                              size="sm"
                              className={`rounded-full w-10 h-10 ${(walkingSchedule.duration_value || 1) === num ? 'bg-indigo-500 hover:bg-indigo-600' : ''}`}
                              onClick={() => setWalkingSchedule({ ...walkingSchedule, duration_value: num })}
                            >
                              {num}
                            </Button>
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {walkingSchedule.duration_value || 1} night(s) per booking
                        </p>
                      </div>
                    ) : null}
                    
                    <div className="space-y-2">
                      <Label>Preferred Walker/Sitter (Optional)</Label>
                      <Select
                        value={walkingSchedule.preferred_walker_id || 'any'}
                        onValueChange={(value) => {
                          const walkerId = value === 'any' ? '' : value;
                          setWalkingSchedule({ 
                            ...walkingSchedule, 
                            preferred_walker_id: walkerId 
                          });
                          if (walkerId && selectedClient) {
                            checkAdminWalkerConflicts(walkerId, selectedClient);
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Any available" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="any">Any available walker</SelectItem>
                          {walkers.map((walker) => (
                            <SelectItem key={walker.id} value={walker.id}>
                              {walker.full_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {checkingWalkerConflicts && (
                        <p className="text-xs text-muted-foreground">Checking availability...</p>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Schedule Notes</Label>
                      <Textarea
                        value={walkingSchedule.notes || ''}
                        onChange={(e) => setWalkingSchedule({ ...walkingSchedule, notes: e.target.value })}
                        placeholder="Any special scheduling requirements..."
                        rows={2}
                      />
                    </div>
                  </TabsContent>
                </Tabs>
                
                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button type="button" variant="outline" onClick={() => setEditMode(false)}>
                    Cancel
                  </Button>
                  <Button onClick={saveClientEdit} disabled={saving} className="rounded-full">
                    {saving ? 'Saving...' : (
                      <>
                        <Save className="w-4 h-4 mr-1" />
                        Save Changes
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <UserX className="w-5 h-5" />
                Delete User
              </DialogTitle>
              <DialogDescription>
                Are you sure you want to delete <strong>{userToDelete?.full_name}</strong>? This action cannot be undone and will also delete:
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                <li>All their pets</li>
                <li>All their appointments</li>
                <li>All their messages</li>
                <li>All their payment history</li>
              </ul>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>
                Cancel
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleDeleteUser}
                disabled={saving}
              >
                {saving ? 'Deleting...' : 'Delete Permanently'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Walker Conflict Dialog */}
        <Dialog open={conflictDialogOpen} onOpenChange={setConflictDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-amber-600">
                <AlertTriangle className="w-5 h-5" />
                Walker Schedule Conflict
              </DialogTitle>
              <DialogDescription>
                The selected walker is not available for some of the requested times.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              {/* Show conflicts */}
              {walkerConflicts.length > 0 && (
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                  <p className="font-medium text-amber-800 text-sm mb-2">Conflicting times:</p>
                  <ul className="space-y-1">
                    {walkerConflicts.map((conflict, idx) => (
                      <li key={idx} className="text-sm text-amber-700">
                        • {conflict.day} at {conflict.time}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Options */}
              <div className="space-y-3">
                <p className="font-medium text-gray-800">What would you like to do?</p>
                
                <Button
                  variant="outline"
                  className="w-full justify-start h-auto py-3 px-4"
                  onClick={handleAdminChooseDifferent}
                >
                  <div className="text-left">
                    <p className="font-medium">Choose a different walker</p>
                    <p className="text-xs text-muted-foreground">Select another walker from the list</p>
                  </div>
                </Button>

                <Button
                  className="w-full justify-start h-auto py-3 px-4 bg-green-500 hover:bg-green-600"
                  onClick={handleAdminLetAppAssign}
                >
                  <div className="text-left">
                    <p className="font-medium">Auto-assign available walker(s)</p>
                    <p className="text-xs opacity-80">System will assign the next available walker</p>
                  </div>
                </Button>
              </div>

              {/* Show alternatives if available */}
              {conflictAlternatives.length > 0 && (
                <div className="pt-3 border-t">
                  <p className="text-sm text-muted-foreground mb-2">
                    Available walkers for conflicting times:
                  </p>
                  {conflictAlternatives.map((alt, idx) => (
                    <div key={idx} className="text-sm">
                      <span className="font-medium">{alt.day} {alt.time}:</span>{' '}
                      {alt.available_walkers.map(w => w.name).join(', ')}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default AdminClientsPage;
