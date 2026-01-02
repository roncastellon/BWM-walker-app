import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { User, Camera, Save, Loader2, PawPrint, Plus, Dog, Cat, Bird, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

const ClientProfilePage = () => {
  const { user, api, refreshUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pets, setPets] = useState([]);
  const [petsLoading, setPetsLoading] = useState(true);
  const [petDialogOpen, setPetDialogOpen] = useState(false);
  const [savingPet, setSavingPet] = useState(false);
  const fileInputRef = useRef(null);
  
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    address: '',
    bio: '',
  });

  const emptyPetForm = {
    name: '',
    species: 'dog',
    breed: '',
    age: '',
    weight: '',
    notes: '',
  };
  
  const [petFormData, setPetFormData] = useState(emptyPetForm);

  useEffect(() => {
    if (user) {
      setFormData({
        full_name: user.full_name || '',
        email: user.email || '',
        phone: user.phone || '',
        address: user.address || '',
        bio: user.bio || '',
      });
    }
  }, [user]);

  useEffect(() => {
    fetchPets();
  }, []);

  const fetchPets = async () => {
    try {
      const response = await api.get('/pets');
      setPets(response.data);
    } catch (error) {
      console.error('Failed to load pets');
    } finally {
      setPetsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await api.put(`/users/${user.id}`, formData);
      if (refreshUser) {
        await refreshUser();
      }
      toast.success('Profile updated successfully!');
    } catch (error) {
      console.error('Update error:', error);
      toast.error('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }

    setUploading(true);
    const uploadFormData = new FormData();
    uploadFormData.append('file', file);

    try {
      await api.post('/upload/profile', uploadFormData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      if (refreshUser) {
        await refreshUser();
      }
      toast.success('Profile picture updated!');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const handleAddPet = async (e) => {
    e.preventDefault();
    setSavingPet(true);
    
    try {
      await api.post('/pets', {
        ...petFormData,
        age: petFormData.age ? parseInt(petFormData.age) : null,
        weight: petFormData.weight ? parseFloat(petFormData.weight) : null,
      });
      toast.success('Pet added successfully!');
      setPetDialogOpen(false);
      setPetFormData(emptyPetForm);
      fetchPets();
    } catch (error) {
      console.error('Add pet error:', error);
      toast.error('Failed to add pet');
    } finally {
      setSavingPet(false);
    }
  };

  const getSpeciesIcon = (species) => {
    switch (species?.toLowerCase()) {
      case 'cat':
        return <Cat className="w-5 h-5" />;
      case 'bird':
        return <Bird className="w-5 h-5" />;
      default:
        return <Dog className="w-5 h-5" />;
    }
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-8" data-testid="client-profile-page">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-heading font-bold">My Profile</h1>
          <p className="text-muted-foreground">Manage your personal information</p>
        </div>

        {/* Profile Picture Section */}
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl">Profile Picture</CardTitle>
            <CardDescription>Click on the image to upload a new photo</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <div 
              className="relative cursor-pointer group"
              onClick={() => fileInputRef.current?.click()}
            >
              <Avatar className="w-32 h-32">
                <AvatarImage src={user?.profile_image} alt={user?.full_name} />
                <AvatarFallback className="text-4xl bg-primary/10 text-primary">
                  {user?.full_name?.charAt(0) || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                {uploading ? (
                  <Loader2 className="w-8 h-8 text-white animate-spin" />
                ) : (
                  <Camera className="w-8 h-8 text-white" />
                )}
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageUpload}
              data-testid="profile-image-input"
            />
            <p className="text-sm text-muted-foreground">
              Supported formats: JPEG, PNG, GIF, WebP (Max 5MB)
            </p>
          </CardContent>
        </Card>

        {/* Profile Form */}
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl">Personal Information</CardTitle>
            <CardDescription>Update your contact details</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="full_name">Full Name</Label>
                  <Input
                    id="full_name"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    placeholder="Your full name"
                    data-testid="profile-name-input"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="your@email.com"
                    data-testid="profile-email-input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="(555) 123-4567"
                    data-testid="profile-phone-input"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="123 Main St, City, State"
                    data-testid="profile-address-input"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">About Me (Optional)</Label>
                <Textarea
                  id="bio"
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  placeholder="Tell us a little about yourself..."
                  rows={3}
                  data-testid="profile-bio-input"
                />
              </div>

              <Button 
                type="submit" 
                className="w-full rounded-full" 
                disabled={loading}
                data-testid="save-profile-btn"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* My Pets Section */}
        <Card className="rounded-2xl shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-xl">My Pets</CardTitle>
              <CardDescription>Add and manage your furry family members</CardDescription>
            </div>
            <div className="flex gap-2">
              <Dialog open={petDialogOpen} onOpenChange={setPetDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="rounded-full" data-testid="add-pet-from-profile-btn">
                    <Plus className="w-4 h-4 mr-1" />
                    Add Pet
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Add New Pet</DialogTitle>
                    <DialogDescription>Tell us about your pet</DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleAddPet} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="pet-name">Name</Label>
                      <Input
                        id="pet-name"
                        placeholder="Pet's name"
                        value={petFormData.name}
                        onChange={(e) => setPetFormData({ ...petFormData, name: e.target.value })}
                        required
                        data-testid="pet-name-input"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Species</Label>
                        <Select
                          value={petFormData.species}
                          onValueChange={(value) => setPetFormData({ ...petFormData, species: value })}
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
                          value={petFormData.breed}
                          onChange={(e) => setPetFormData({ ...petFormData, breed: e.target.value })}
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
                          value={petFormData.age}
                          onChange={(e) => setPetFormData({ ...petFormData, age: e.target.value })}
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
                          value={petFormData.weight}
                          onChange={(e) => setPetFormData({ ...petFormData, weight: e.target.value })}
                          data-testid="pet-weight-input"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="pet-notes">Special Notes</Label>
                      <Textarea
                        id="pet-notes"
                        placeholder="Allergies, medications, temperament, etc."
                        value={petFormData.notes}
                        onChange={(e) => setPetFormData({ ...petFormData, notes: e.target.value })}
                        data-testid="pet-notes-input"
                      />
                    </div>

                    <Button 
                      type="submit" 
                      className="w-full rounded-full" 
                      disabled={savingPet}
                      data-testid="submit-pet-btn"
                    >
                      {savingPet ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Adding...
                        </>
                      ) : (
                        'Add Pet'
                      )}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {petsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : pets.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <PawPrint className="w-8 h-8 text-primary" />
                </div>
                <p className="mb-2">No pets added yet</p>
                <p className="text-sm">Click "Add Pet" to add your furry friend</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pets.slice(0, 3).map((pet) => (
                  <div
                    key={pet.id}
                    className="flex items-center gap-4 p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <Avatar className="w-12 h-12">
                      <AvatarImage src={pet.photo_url} alt={pet.name} />
                      <AvatarFallback className="bg-primary/10">
                        {getSpeciesIcon(pet.species)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{pet.name}</p>
                      <p className="text-sm text-muted-foreground capitalize truncate">
                        {pet.breed || pet.species}
                        {pet.age && ` • ${pet.age} yrs`}
                      </p>
                    </div>
                  </div>
                ))}
                
                {pets.length > 3 && (
                  <p className="text-sm text-muted-foreground text-center pt-2">
                    +{pets.length - 3} more pet{pets.length - 3 > 1 ? 's' : ''}
                  </p>
                )}
                
                <Link to="/pets">
                  <Button variant="outline" className="w-full rounded-full mt-4" data-testid="manage-all-pets-btn">
                    Manage All Pets
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default ClientProfilePage;
