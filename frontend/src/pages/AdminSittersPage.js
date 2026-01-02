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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { PawPrint, Search, Mail, Phone, Plus, User, Calendar, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

const AdminSittersPage = () => {
  const { api } = useAuth();
  const [sitters, setSitters] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedSitter, setSelectedSitter] = useState(null);
  const [sitterStats, setSitterStats] = useState({});
  
  // Form state for new sitter
  const [sitterForm, setSitterForm] = useState({
    username: '',
    email: '',
    password: '',
    full_name: '',
    phone: '',
    bio: '',
  });

  useEffect(() => {
    fetchSitters();
  }, []);

  const fetchSitters = async () => {
    try {
      const response = await api.get('/users/sitters');
      setSitters(response.data);
    } catch (error) {
      toast.error('Failed to load sitters');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSitterForm({
      username: '',
      email: '',
      password: '',
      full_name: '',
      phone: '',
      bio: '',
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      await api.post('/auth/register', {
        ...sitterForm,
        role: 'sitter',
      });
      
      toast.success(`Sitter "${sitterForm.full_name}" created successfully!`);
      setDialogOpen(false);
      resetForm();
      fetchSitters();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create sitter');
    }
  };

  const viewSitterDetails = async (sitter) => {
    try {
      // Fetch sitter's appointment stats
      const apptsRes = await api.get('/appointments/calendar');
      const sitterAppts = apptsRes.data.filter(a => a.sitter_id === sitter.id);
      const completedWalks = sitterAppts.filter(a => a.status === 'completed').length;
      const scheduledWalks = sitterAppts.filter(a => a.status === 'scheduled').length;
      
      setSitterStats({
        completed: completedWalks,
        scheduled: scheduledWalks,
        total: sitterAppts.length,
      });
      setSelectedSitter(sitter);
    } catch (error) {
      setSitterStats({ completed: 0, scheduled: 0, total: 0 });
      setSelectedSitter(sitter);
    }
  };

  const filteredSitters = sitters.filter(sitter =>
    sitter.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    sitter.email?.toLowerCase().includes(searchTerm.toLowerCase())
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
      <div className="space-y-8" data-testid="admin-sitters-page">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-heading font-bold">Sitters</h1>
            <p className="text-muted-foreground">{sitters.length} registered sitters</p>
          </div>
          <div className="flex gap-3">
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search sitters..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 rounded-full"
                data-testid="search-sitters"
              />
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="rounded-full" data-testid="add-sitter-btn">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Sitter
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Add New Sitter</DialogTitle>
                  <DialogDescription>Create a new sitter account</DialogDescription>
                </DialogHeader>
                
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="sitter-fullname">Full Name *</Label>
                      <Input
                        id="sitter-fullname"
                        value={sitterForm.full_name}
                        onChange={(e) => setSitterForm({ ...sitterForm, full_name: e.target.value })}
                        placeholder="Jane Smith"
                        required
                        data-testid="sitter-fullname"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sitter-username">Username *</Label>
                      <Input
                        id="sitter-username"
                        value={sitterForm.username}
                        onChange={(e) => setSitterForm({ ...sitterForm, username: e.target.value })}
                        placeholder="janesmith"
                        required
                        data-testid="sitter-username"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="sitter-email">Email *</Label>
                      <Input
                        id="sitter-email"
                        type="email"
                        value={sitterForm.email}
                        onChange={(e) => setSitterForm({ ...sitterForm, email: e.target.value })}
                        placeholder="jane@example.com"
                        required
                        data-testid="sitter-email"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sitter-phone">Phone</Label>
                      <Input
                        id="sitter-phone"
                        value={sitterForm.phone}
                        onChange={(e) => setSitterForm({ ...sitterForm, phone: e.target.value })}
                        placeholder="(555) 123-4567"
                        data-testid="sitter-phone"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="sitter-password">Password *</Label>
                    <Input
                      id="sitter-password"
                      type="password"
                      value={sitterForm.password}
                      onChange={(e) => setSitterForm({ ...sitterForm, password: e.target.value })}
                      placeholder="Create a password"
                      required
                      data-testid="sitter-password"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="sitter-bio">Bio (Optional)</Label>
                    <Textarea
                      id="sitter-bio"
                      value={sitterForm.bio}
                      onChange={(e) => setSitterForm({ ...sitterForm, bio: e.target.value })}
                      placeholder="Experience with pets, certifications, etc."
                      rows={3}
                      data-testid="sitter-bio"
                    />
                    <p className="text-xs text-muted-foreground">This will be visible to clients</p>
                  </div>
                  
                  <div className="flex justify-end gap-3 pt-4 border-t">
                    <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" className="rounded-full" data-testid="submit-sitter">
                      Create Sitter
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Sitters Grid */}
        {filteredSitters.length === 0 ? (
          <Card className="rounded-2xl shadow-sm">
            <CardContent className="p-12 text-center">
              <PawPrint className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-lg text-muted-foreground">No sitters found</p>
              <Button onClick={() => setDialogOpen(true)} className="mt-4 rounded-full">
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Sitter
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSitters.map((sitter) => (
              <Card 
                key={sitter.id} 
                className="rounded-2xl shadow-sm hover:shadow-md transition-shadow cursor-pointer" 
                data-testid={`sitter-card-${sitter.id}`}
                onClick={() => viewSitterDetails(sitter)}
              >
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <Avatar className="w-14 h-14">
                      <AvatarImage src={sitter.profile_image} />
                      <AvatarFallback className="bg-secondary/10 text-secondary text-lg">
                        {sitter.full_name?.charAt(0) || 'W'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold truncate">{sitter.full_name}</h3>
                      <Badge className="bg-secondary/10 text-secondary rounded-full text-xs mt-1">
                        <PawPrint className="w-3 h-3 mr-1" />
                        Sitter
                      </Badge>
                    </div>
                  </div>
                  <div className="mt-4 space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="w-4 h-4" />
                      <span className="truncate">{sitter.email}</span>
                    </div>
                    {sitter.phone && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="w-4 h-4" />
                        <span>{sitter.phone}</span>
                      </div>
                    )}
                    {sitter.bio && (
                      <p className="text-muted-foreground text-xs mt-2 line-clamp-2">{sitter.bio}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Sitter Details Dialog */}
        <Dialog open={!!selectedSitter} onOpenChange={() => setSelectedSitter(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Sitter Details</DialogTitle>
            </DialogHeader>
            {selectedSitter && (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <Avatar className="w-16 h-16">
                    <AvatarImage src={selectedSitter.profile_image} />
                    <AvatarFallback className="bg-secondary/10 text-secondary text-2xl">
                      {selectedSitter.full_name?.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="text-xl font-bold">{selectedSitter.full_name}</h3>
                    <p className="text-muted-foreground">{selectedSitter.email}</p>
                    {selectedSitter.phone && <p className="text-sm text-muted-foreground">{selectedSitter.phone}</p>}
                  </div>
                </div>
                
                <Badge className="bg-secondary/10 text-secondary rounded-full">
                  <PawPrint className="w-3 h-3 mr-1" />
                  Sitter
                </Badge>
                
                {selectedSitter.bio && (
                  <div className="p-3 rounded-xl bg-muted/50">
                    <p className="text-sm">{selectedSitter.bio}</p>
                  </div>
                )}
                
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-3">Performance Stats</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-3 rounded-xl bg-green-50">
                      <CheckCircle className="w-5 h-5 mx-auto text-green-600 mb-1" />
                      <p className="text-2xl font-bold text-green-700">{sitterStats.completed}</p>
                      <p className="text-xs text-green-600">Completed</p>
                    </div>
                    <div className="text-center p-3 rounded-xl bg-blue-50">
                      <Calendar className="w-5 h-5 mx-auto text-blue-600 mb-1" />
                      <p className="text-2xl font-bold text-blue-700">{sitterStats.scheduled}</p>
                      <p className="text-xs text-blue-600">Scheduled</p>
                    </div>
                    <div className="text-center p-3 rounded-xl bg-purple-50">
                      <PawPrint className="w-5 h-5 mx-auto text-purple-600 mb-1" />
                      <p className="text-2xl font-bold text-purple-700">{sitterStats.total}</p>
                      <p className="text-xs text-purple-600">Total Walks</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default AdminSittersPage;
