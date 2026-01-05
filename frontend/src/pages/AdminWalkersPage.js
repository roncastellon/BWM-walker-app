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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '../components/ui/dialog';
import { PawPrint, Search, Mail, Phone, Plus, User, Calendar, CheckCircle, Lock, Unlock, Trash2, UserX, DollarSign, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

// Default pay rates
const DEFAULT_WALKER_PAY = {
  walk_30: 15.00,
  walk_45: 22.00,
  walk_60: 30.00,
};

const DEFAULT_SITTER_PAY = {
  petsit_walker_location: 40.00,
  petsit_client_location: 50.00,
};

const AdminWalkersPage = () => {
  const { api } = useAuth();
  const [walkers, setWalkers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedWalker, setSelectedWalker] = useState(null);
  const [walkerStats, setWalkerStats] = useState({});
  const [saving, setSaving] = useState(false);
  
  // Pay setup state
  const [paySetupMode, setPaySetupMode] = useState(false);
  const [payRates, setPayRates] = useState({...DEFAULT_WALKER_PAY, ...DEFAULT_SITTER_PAY});
  const [pendingPaySetup, setPendingPaySetup] = useState([]);
  
  // Delete confirmation state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  
  // Form state for new walker
  const [walkerForm, setWalkerForm] = useState({
    username: '',
    email: '',
    password: '',
    full_name: '',
    phone: '',
    bio: '',
  });

  useEffect(() => {
    fetchWalkers();
    fetchPendingPaySetup();
  }, []);

  const fetchWalkers = async () => {
    try {
      const response = await api.get('/users/walkers?include_frozen=true');
      setWalkers(response.data);
    } catch (error) {
      toast.error('Failed to load walkers');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setWalkerForm({
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
        ...walkerForm,
        role: 'walker',
      });
      
      toast.success(`Walker "${walkerForm.full_name}" created successfully!`);
      setDialogOpen(false);
      resetForm();
      fetchWalkers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create walker');
    }
  };

  const viewWalkerDetails = async (walker) => {
    try {
      // Fetch walker's appointment stats
      const apptsRes = await api.get('/appointments/calendar');
      const walkerAppts = apptsRes.data.filter(a => a.walker_id === walker.id);
      const completedWalks = walkerAppts.filter(a => a.status === 'completed').length;
      const scheduledWalks = walkerAppts.filter(a => a.status === 'scheduled').length;
      
      setWalkerStats({
        completed: completedWalks,
        scheduled: scheduledWalks,
        total: walkerAppts.length,
      });
      setSelectedWalker(walker);
    } catch (error) {
      setWalkerStats({ completed: 0, scheduled: 0, total: 0 });
      setSelectedWalker(walker);
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    setSaving(true);
    try {
      await api.delete(`/users/${userToDelete.id}`);
      toast.success(`${userToDelete.full_name} has been deleted`);
      setDeleteConfirmOpen(false);
      setUserToDelete(null);
      setSelectedWalker(null);
      fetchWalkers();
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
      fetchWalkers();
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

  const filteredWalkers = walkers.filter(walker =>
    walker.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    walker.email?.toLowerCase().includes(searchTerm.toLowerCase())
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
      <div className="space-y-8" data-testid="admin-walkers-page">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-heading font-bold">Walkers</h1>
            <p className="text-muted-foreground">{walkers.length} registered walkers</p>
          </div>
          <div className="flex gap-3">
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search walkers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 rounded-full"
                data-testid="search-walkers"
              />
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="rounded-full" data-testid="add-walker-btn">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Walker
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Add New Walker</DialogTitle>
                  <DialogDescription>Create a new walker account</DialogDescription>
                </DialogHeader>
                
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="walker-fullname">Full Name *</Label>
                      <Input
                        id="walker-fullname"
                        value={walkerForm.full_name}
                        onChange={(e) => setWalkerForm({ ...walkerForm, full_name: e.target.value })}
                        placeholder="Jane Smith"
                        required
                        data-testid="walker-fullname"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="walker-username">Username *</Label>
                      <Input
                        id="walker-username"
                        value={walkerForm.username}
                        onChange={(e) => setWalkerForm({ ...walkerForm, username: e.target.value })}
                        placeholder="janesmith"
                        required
                        data-testid="walker-username"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="walker-email">Email *</Label>
                      <Input
                        id="walker-email"
                        type="email"
                        value={walkerForm.email}
                        onChange={(e) => setWalkerForm({ ...walkerForm, email: e.target.value })}
                        placeholder="jane@example.com"
                        required
                        data-testid="walker-email"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="walker-phone">Phone</Label>
                      <Input
                        id="walker-phone"
                        value={walkerForm.phone}
                        onChange={(e) => setWalkerForm({ ...walkerForm, phone: e.target.value })}
                        placeholder="(555) 123-4567"
                        data-testid="walker-phone"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="walker-password">Password *</Label>
                    <Input
                      id="walker-password"
                      type="password"
                      value={walkerForm.password}
                      onChange={(e) => setWalkerForm({ ...walkerForm, password: e.target.value })}
                      placeholder="Create a password"
                      required
                      data-testid="walker-password"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="walker-bio">Bio (Optional)</Label>
                    <Textarea
                      id="walker-bio"
                      value={walkerForm.bio}
                      onChange={(e) => setWalkerForm({ ...walkerForm, bio: e.target.value })}
                      placeholder="Experience with pets, certifications, etc."
                      rows={3}
                      data-testid="walker-bio"
                    />
                    <p className="text-xs text-muted-foreground">This will be visible to clients</p>
                  </div>
                  
                  <div className="flex justify-end gap-3 pt-4 border-t">
                    <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" className="rounded-full" data-testid="submit-walker">
                      Create Walker
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Walkers Grid */}
        {filteredWalkers.length === 0 ? (
          <Card className="rounded-2xl shadow-sm">
            <CardContent className="p-12 text-center">
              <PawPrint className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-lg text-muted-foreground">No walkers found</p>
              <Button onClick={() => setDialogOpen(true)} className="mt-4 rounded-full">
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Walker
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredWalkers.map((walker) => (
              <Card 
                key={walker.id} 
                className={`rounded-2xl shadow-sm hover:shadow-md transition-shadow cursor-pointer ${!walker.is_active ? 'opacity-60 border-red-300' : ''}`}
                data-testid={`walker-card-${walker.id}`}
                onClick={() => viewWalkerDetails(walker)}
              >
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <Avatar className="w-14 h-14">
                      <AvatarImage src={walker.profile_image} />
                      <AvatarFallback className="bg-secondary/10 text-secondary text-lg">
                        {walker.full_name?.charAt(0) || 'W'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold truncate">{walker.full_name}</h3>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge className="bg-secondary/10 text-secondary rounded-full text-xs">
                          <PawPrint className="w-3 h-3 mr-1" />
                          Walker
                        </Badge>
                        {!walker.is_active && (
                          <Badge className="bg-red-100 text-red-800 rounded-full text-xs">
                            <Lock className="w-3 h-3 mr-1" />
                            Frozen
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="w-4 h-4" />
                      <span className="truncate">{walker.email}</span>
                    </div>
                    {walker.phone && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="w-4 h-4" />
                        <span>{walker.phone}</span>
                      </div>
                    )}
                    {walker.bio && (
                      <p className="text-muted-foreground text-xs mt-2 line-clamp-2">{walker.bio}</p>
                    )}
                  </div>
                  {/* Quick Actions */}
                  <div className="mt-4 pt-3 border-t flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); handleFreezeUser(walker.id, walker.is_active !== false); }}
                      className={walker.is_active === false ? 'text-green-600 hover:bg-green-50' : 'text-amber-600 hover:bg-amber-50'}
                    >
                      {walker.is_active === false ? <Unlock className="w-4 h-4 mr-1" /> : <Lock className="w-4 h-4 mr-1" />}
                      {walker.is_active === false ? 'Unfreeze' : 'Freeze'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); confirmDelete(walker); }}
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

        {/* Walker Details Dialog */}
        <Dialog open={!!selectedWalker} onOpenChange={() => setSelectedWalker(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Walker Details</DialogTitle>
            </DialogHeader>
            {selectedWalker && (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <Avatar className="w-16 h-16">
                    <AvatarImage src={selectedWalker.profile_image} />
                    <AvatarFallback className="bg-secondary/10 text-secondary text-2xl">
                      {selectedWalker.full_name?.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="text-xl font-bold">{selectedWalker.full_name}</h3>
                    <p className="text-muted-foreground">{selectedWalker.email}</p>
                    {selectedWalker.phone && <p className="text-sm text-muted-foreground">{selectedWalker.phone}</p>}
                  </div>
                </div>
                
                <Badge className="bg-secondary/10 text-secondary rounded-full">
                  <PawPrint className="w-3 h-3 mr-1" />
                  Walker
                </Badge>
                
                {selectedWalker.bio && (
                  <div className="p-3 rounded-xl bg-muted/50">
                    <p className="text-sm">{selectedWalker.bio}</p>
                  </div>
                )}
                
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-3">Performance Stats</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-3 rounded-xl bg-green-50">
                      <CheckCircle className="w-5 h-5 mx-auto text-green-600 mb-1" />
                      <p className="text-2xl font-bold text-green-700">{walkerStats.completed}</p>
                      <p className="text-xs text-green-600">Completed</p>
                    </div>
                    <div className="text-center p-3 rounded-xl bg-blue-50">
                      <Calendar className="w-5 h-5 mx-auto text-blue-600 mb-1" />
                      <p className="text-2xl font-bold text-blue-700">{walkerStats.scheduled}</p>
                      <p className="text-xs text-blue-600">Scheduled</p>
                    </div>
                    <div className="text-center p-3 rounded-xl bg-purple-50">
                      <PawPrint className="w-5 h-5 mx-auto text-purple-600 mb-1" />
                      <p className="text-2xl font-bold text-purple-700">{walkerStats.total}</p>
                      <p className="text-xs text-purple-600">Total Walks</p>
                    </div>
                  </div>
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
                Delete Walker
              </DialogTitle>
              <DialogDescription>
                Are you sure you want to delete <strong>{userToDelete?.full_name}</strong>? This action cannot be undone and will also delete all their appointments and paysheets.
              </DialogDescription>
            </DialogHeader>
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
      </div>
    </Layout>
  );
};

export default AdminWalkersPage;
