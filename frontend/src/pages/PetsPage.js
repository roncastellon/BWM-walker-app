import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { PawPrint, Plus, Trash2, Dog, Cat, Bird } from 'lucide-react';
import { toast } from 'sonner';

const PetsPage = () => {
  const { api } = useAuth();
  const [pets, setPets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    species: 'dog',
    breed: '',
    age: '',
    weight: '',
    notes: '',
  });

  useEffect(() => {
    fetchPets();
  }, []);

  const fetchPets = async () => {
    try {
      const response = await api.get('/pets');
      setPets(response.data);
    } catch (error) {
      toast.error('Failed to load pets');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/pets', {
        ...formData,
        age: formData.age ? parseInt(formData.age) : null,
        weight: formData.weight ? parseFloat(formData.weight) : null,
      });
      toast.success('Pet added successfully!');
      setDialogOpen(false);
      setFormData({
        name: '',
        species: 'dog',
        breed: '',
        age: '',
        weight: '',
        notes: '',
      });
      fetchPets();
    } catch (error) {
      toast.error('Failed to add pet');
    }
  };

  const handleDelete = async (petId) => {
    if (!window.confirm('Are you sure you want to remove this pet?')) return;
    try {
      await api.delete(`/pets/${petId}`);
      toast.success('Pet removed');
      fetchPets();
    } catch (error) {
      toast.error('Failed to remove pet');
    }
  };

  const getSpeciesIcon = (species) => {
    switch (species?.toLowerCase()) {
      case 'cat':
        return <Cat className="w-6 h-6" />;
      case 'bird':
        return <Bird className="w-6 h-6" />;
      default:
        return <Dog className="w-6 h-6" />;
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
      <div className="space-y-8" data-testid="pets-page">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-heading font-bold">My Pets</h1>
            <p className="text-muted-foreground">Manage your furry family members</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-full" data-testid="add-pet-btn">
                <Plus className="w-4 h-4 mr-2" />
                Add Pet
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Add New Pet</DialogTitle>
                <DialogDescription>Tell us about your pet</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="pet-name">Name</Label>
                  <Input
                    id="pet-name"
                    placeholder="Pet's name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    data-testid="pet-name-input"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Species</Label>
                    <Select
                      value={formData.species}
                      onValueChange={(value) => setFormData({ ...formData, species: value })}
                    >
                      <SelectTrigger data-testid="pet-species-select">
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

                  <div className="space-y-2">
                    <Label htmlFor="pet-breed">Breed</Label>
                    <Input
                      id="pet-breed"
                      placeholder="e.g., Golden Retriever"
                      value={formData.breed}
                      onChange={(e) => setFormData({ ...formData, breed: e.target.value })}
                      data-testid="pet-breed-input"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="pet-age">Age (years)</Label>
                    <Input
                      id="pet-age"
                      type="number"
                      min="0"
                      placeholder="Age"
                      value={formData.age}
                      onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                      data-testid="pet-age-input"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="pet-weight">Weight (lbs)</Label>
                    <Input
                      id="pet-weight"
                      type="number"
                      min="0"
                      step="0.1"
                      placeholder="Weight"
                      value={formData.weight}
                      onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                      data-testid="pet-weight-input"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pet-notes">Special Notes</Label>
                  <Textarea
                    id="pet-notes"
                    placeholder="Allergies, medications, temperament, etc."
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    data-testid="pet-notes-input"
                  />
                </div>

                <Button type="submit" className="w-full rounded-full" data-testid="submit-pet-btn">
                  Add Pet
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Pets Grid */}
        {pets.length === 0 ? (
          <Card className="rounded-2xl shadow-sm">
            <CardContent className="p-12 text-center">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
                <PawPrint className="w-10 h-10 text-primary" />
              </div>
              <h2 className="text-2xl font-heading font-bold mb-2">No Pets Yet</h2>
              <p className="text-muted-foreground mb-6">Add your first pet to start booking services</p>
              <Button onClick={() => setDialogOpen(true)} className="rounded-full" data-testid="add-first-pet-btn">
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Pet
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {pets.map((pet) => (
              <Card key={pet.id} className="rounded-2xl shadow-sm hover:shadow-md transition-shadow" data-testid={`pet-card-${pet.id}`}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                      {getSpeciesIcon(pet.species)}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(pet.id)}
                      data-testid={`delete-pet-${pet.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  <h3 className="text-xl font-bold mb-1">{pet.name}</h3>
                  <p className="text-muted-foreground capitalize mb-4">
                    {pet.breed || pet.species}
                  </p>
                  <div className="space-y-2 text-sm">
                    {pet.age && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Age</span>
                        <span>{pet.age} years</span>
                      </div>
                    )}
                    {pet.weight && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Weight</span>
                        <span>{pet.weight} lbs</span>
                      </div>
                    )}
                    {pet.notes && (
                      <div className="pt-2 border-t border-border">
                        <p className="text-muted-foreground text-xs">{pet.notes}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default PetsPage;
