import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Checkbox } from '../components/ui/checkbox';
import { Textarea } from '../components/ui/textarea';
import { 
  Calendar, PawPrint, Clock, ArrowLeft, Check, User
} from 'lucide-react';
import { toast } from 'sonner';

const WalkerSchedulePage = () => {
  const navigate = useNavigate();
  const { user, api } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clients, setClients] = useState([]);
  const [services, setServices] = useState([]);
  const [selectedClientPets, setSelectedClientPets] = useState([]);
  
  const [formData, setFormData] = useState({
    client_id: '',
    pet_ids: [],
    service_type: '',
    scheduled_date: new Date().toISOString().split('T')[0],
    scheduled_time: '',
    notes: '',
    assign_to_me: true, // Default to assigning to themselves
  });

  useEffect(() => {
    // Check if user has permission
    if (!user?.can_schedule_walks) {
      toast.error('You do not have permission to schedule walks');
      navigate('/walker');
      return;
    }
    fetchData();
  }, [user]);

  const fetchData = async () => {
    try {
      const [clientsRes, servicesRes] = await Promise.all([
        api.get('/users/clients'),
        api.get('/services')
      ]);
      setClients(clientsRes.data || []);
      // Filter to only walk services
      const walkServices = (servicesRes.data || []).filter(s => 
        s.service_type?.toLowerCase().includes('walk') ||
        s.name?.toLowerCase().includes('walk')
      );
      setServices(walkServices);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const fetchClientPets = async (clientId) => {
    if (!clientId) {
      setSelectedClientPets([]);
      return;
    }
    try {
      const res = await api.get(`/pets?owner_id=${clientId}`);
      setSelectedClientPets(res.data || []);
    } catch {
      setSelectedClientPets([]);
    }
  };

  const handleClientChange = (clientId) => {
    setFormData({ ...formData, client_id: clientId, pet_ids: [] });
    fetchClientPets(clientId);
  };

  const togglePet = (petId) => {
    const newPetIds = formData.pet_ids.includes(petId)
      ? formData.pet_ids.filter(id => id !== petId)
      : [...formData.pet_ids, petId];
    setFormData({ ...formData, pet_ids: newPetIds });
  };

  const generateTimeSlots = () => {
    const slots = [];
    for (let hour = 6; hour <= 20; hour++) {
      for (let min = 0; min < 60; min += 30) {
        const timeStr = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
        const hour12 = hour % 12 || 12;
        const ampm = hour >= 12 ? 'PM' : 'AM';
        slots.push({
          value: timeStr,
          label: `${hour12}:${min.toString().padStart(2, '0')} ${ampm}`
        });
      }
    }
    return slots;
  };

  const handleSubmit = async () => {
    if (!formData.client_id || !formData.service_type || !formData.scheduled_date || !formData.scheduled_time) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (formData.pet_ids.length === 0) {
      toast.error('Please select at least one pet');
      return;
    }

    setSaving(true);
    try {
      await api.post('/appointments/admin', {
        ...formData,
        walker_id: formData.assign_to_me ? user.id : null,
      });
      toast.success('Walk scheduled successfully!');
      navigate('/walker');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to schedule walk');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate('/walker')}
            className="rounded-full"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Schedule a Walk</h1>
            <p className="text-muted-foreground">Create a new walk appointment</p>
          </div>
        </div>

        {/* Form */}
        <Card className="rounded-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              Walk Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Client Selection */}
            <div className="space-y-2">
              <Label>Client *</Label>
              <Select value={formData.client_id} onValueChange={handleClientChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4" />
                        {client.full_name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Pet Selection */}
            {selectedClientPets.length > 0 && (
              <div className="space-y-2">
                <Label>Pets *</Label>
                <div className="grid grid-cols-2 gap-2">
                  {selectedClientPets.map((pet) => (
                    <div
                      key={pet.id}
                      onClick={() => togglePet(pet.id)}
                      className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        formData.pet_ids.includes(pet.id)
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Checkbox checked={formData.pet_ids.includes(pet.id)} />
                        <PawPrint className="w-4 h-4" />
                        <span className="font-medium">{pet.name}</span>
                      </div>
                      <p className="text-xs text-muted-foreground ml-6">{pet.breed}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Service Selection */}
            <div className="space-y-2">
              <Label>Service *</Label>
              <Select 
                value={formData.service_type} 
                onValueChange={(value) => setFormData({ ...formData, service_type: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a service" />
                </SelectTrigger>
                <SelectContent>
                  {services.map((service) => (
                    <SelectItem key={service.id} value={service.service_type}>
                      {service.name} - ${service.price}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date & Time */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date *</Label>
                <Input
                  type="date"
                  value={formData.scheduled_date}
                  onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
              <div className="space-y-2">
                <Label>Time *</Label>
                <Select 
                  value={formData.scheduled_time} 
                  onValueChange={(value) => setFormData({ ...formData, scheduled_time: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select time" />
                  </SelectTrigger>
                  <SelectContent>
                    {generateTimeSlots().map((slot) => (
                      <SelectItem key={slot.value} value={slot.value}>
                        {slot.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Assign to Me */}
            <div className="flex items-center gap-3 p-4 rounded-lg bg-green-50 border border-green-200">
              <Checkbox
                id="assign-to-me"
                checked={formData.assign_to_me}
                onCheckedChange={(checked) => setFormData({ ...formData, assign_to_me: checked })}
              />
              <div>
                <Label htmlFor="assign-to-me" className="cursor-pointer font-medium">
                  Assign this walk to me
                </Label>
                <p className="text-xs text-muted-foreground">
                  Uncheck to leave unassigned for an admin to assign
                </p>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Any special instructions..."
                rows={3}
              />
            </div>

            {/* Submit */}
            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => navigate('/walker')}
                className="flex-1 rounded-full"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={saving}
                className="flex-1 rounded-full"
              >
                {saving ? (
                  <>Scheduling...</>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Schedule Walk
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default WalkerSchedulePage;
