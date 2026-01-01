import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Users, Search, Mail, Phone, Plus, PawPrint, DollarSign, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const AdminClientsPage = () => {
  const { api } = useAuth();
  const [clients, setClients] = useState([]);
  const [services, setServices] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  
  // Form state for new customer
  const [customerForm, setCustomerForm] = useState({
    username: '',
    email: '',
    password: '',
    full_name: '',
    phone: '',
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

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [clientsRes, servicesRes] = await Promise.all([
        api.get('/users/clients'),
        api.get('/services'),
      ]);
      setClients(clientsRes.data);
      setServices(servicesRes.data);
      
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      // 1. Create the customer account
      const registerRes = await api.post('/auth/register', {
        ...customerForm,
        role: 'client',
      });
      
      const newClientId = registerRes.data.user.id;
      const token = registerRes.data.access_token;
      
      // 2. Set billing cycle
      await api.put(`/users/${newClientId}/billing-cycle?billing_cycle=${customerForm.billing_cycle}`);
      
      // 3. Add pets for the customer (need to use admin token to add pets for another user)
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
      
      // 4. Save custom pricing for this client
      const hasCustomPricing = Object.entries(customPricing).some(([type, price]) => {
        const defaultService = services.find(s => s.service_type === type);
        return defaultService && price !== defaultService.price;
      });
      
      if (hasCustomPricing) {
        await api.post(`/users/${newClientId}/custom-pricing`, customPricing);
      }
      
      toast.success(`Customer "${customerForm.full_name}" created successfully!`);
      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create customer');
    }
  };

  const viewClientDetails = async (client) => {
    try {
      // Fetch client's pets
      const petsRes = await api.get(`/pets?owner_id=${client.id}`);
      setSelectedClient({ ...client, pets: petsRes.data });
    } catch (error) {
      setSelectedClient({ ...client, pets: [] });
    }
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
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="rounded-full" data-testid="add-client-btn">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Customer
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Add New Customer</DialogTitle>
                  <DialogDescription>Create a new customer account with their info, pets, and pricing</DialogDescription>
                </DialogHeader>
                
                <form onSubmit={handleSubmit} className="space-y-6">
                  <Tabs defaultValue="info" className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="info">Customer Info</TabsTrigger>
                      <TabsTrigger value="pets">Pet Info</TabsTrigger>
                      <TabsTrigger value="pricing">Pricing & Billing</TabsTrigger>
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
                    <Button type="submit" className="rounded-full" data-testid="submit-customer">
                      Create Customer
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
                className="rounded-2xl shadow-sm hover:shadow-md transition-shadow cursor-pointer" 
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
                      <div className="flex items-center gap-2 mt-1">
                        <Badge className="bg-blue-100 text-blue-800 rounded-full text-xs">
                          Client
                        </Badge>
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
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Client Details Dialog */}
        <Dialog open={!!selectedClient} onOpenChange={() => setSelectedClient(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Customer Details</DialogTitle>
            </DialogHeader>
            {selectedClient && (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <Avatar className="w-16 h-16">
                    <AvatarFallback className="bg-primary/10 text-primary text-2xl">
                      {selectedClient.full_name?.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="text-xl font-bold">{selectedClient.full_name}</h3>
                    <p className="text-muted-foreground">{selectedClient.email}</p>
                    {selectedClient.phone && <p className="text-sm text-muted-foreground">{selectedClient.phone}</p>}
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Badge className="bg-blue-100 text-blue-800 rounded-full">Client</Badge>
                  <Badge variant="outline" className="rounded-full capitalize">{selectedClient.billing_cycle || 'weekly'} billing</Badge>
                </div>
                
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
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default AdminClientsPage;
