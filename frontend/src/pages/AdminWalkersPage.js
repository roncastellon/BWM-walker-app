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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Checkbox } from '../components/ui/checkbox';
import { PawPrint, Search, Mail, Phone, Plus, User, Calendar, CheckCircle, Lock, Unlock, Trash2, UserX, DollarSign, AlertCircle, Shield, Moon } from 'lucide-react';
import { toast } from 'sonner';

// Role configurations
const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin', description: 'Full system access', color: 'bg-purple-100 text-purple-800' },
  { value: 'walker', label: 'Walker', description: 'Dog walking services', color: 'bg-orange-100 text-orange-800' },
  { value: 'sitter', label: 'Sitter', description: 'Pet sitting/overnight', color: 'bg-blue-100 text-blue-800' },
];

// Default pay rates - all service types
const DEFAULT_PAY_RATES = {
  // Walks
  walk_30: 15.00,
  walk_45: 22.00,
  walk_60: 30.00,
  standard_walk: 15.00,
  // Overnight/Pet Sitting
  overnight: 30.00,
  stay_overnight: 30.00,
  petsit_our_location: 40.00,
  petsit_your_location: 50.00,
  // Day Care
  doggy_day_care: 25.00,
  doggy_day_camp: 25.00,
  day_visit: 20.00,
  // Concierge/Transport
  concierge: 30.00,
  transport: 20.00,
};

const AdminWalkersPage = () => {
  const { api } = useAuth();
  const [staff, setStaff] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [staffStats, setStaffStats] = useState({});
  const [saving, setSaving] = useState(false);
  const [roleFilter, setRoleFilter] = useState('all');
  
  // Edit mode state
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({
    username: '',
    email: '',
    password: '',
    full_name: '',
    phone: '',
    bio: '',
    role: 'walker',
    is_walker: false,
    is_sitter: false,
  });
  
  // Pay setup state
  const [paySetupMode, setPaySetupMode] = useState(false);
  const [payRates, setPayRates] = useState({...DEFAULT_PAY_RATES});
  const [pendingPaySetup, setPendingPaySetup] = useState([]);
  
  // Delete confirmation state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  
  // Form state for new staff
  const [staffForm, setStaffForm] = useState({
    username: '',
    email: '',
    password: '',
    full_name: '',
    phone: '',
    bio: '',
    role: 'walker',
    is_walker: false,
    is_sitter: false,
  });

  useEffect(() => {
    fetchStaff();
    fetchPendingPaySetup();
  }, []);

  const fetchStaff = async () => {
    try {
      // Fetch all staff (walkers, sitters, admins)
      const response = await api.get('/users/staff?include_frozen=true');
      setStaff(response.data);
    } catch (error) {
      // Fallback to walkers endpoint if staff endpoint doesn't exist
      try {
        const response = await api.get('/users/walkers?include_frozen=true');
        setStaff(response.data);
      } catch (e) {
        toast.error('Failed to load staff');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingPaySetup = async () => {
    try {
      const response = await api.get('/users/pending-pay-setup');
      setPendingPaySetup(response.data);
    } catch (error) {
      console.error('Failed to fetch pending pay setup:', error);
    }
  };

  const initPaySetup = (walker) => {
    // Initialize with existing custom rates or defaults
    const existingRates = walker.custom_pay_rates || {};
    setPayRates({
      // Walks
      walk_30: existingRates.walk_30 ?? DEFAULT_PAY_RATES.walk_30,
      walk_45: existingRates.walk_45 ?? DEFAULT_PAY_RATES.walk_45,
      walk_60: existingRates.walk_60 ?? DEFAULT_PAY_RATES.walk_60,
      standard_walk: existingRates.standard_walk ?? DEFAULT_PAY_RATES.standard_walk,
      // Overnight/Pet Sitting
      overnight: existingRates.overnight ?? DEFAULT_PAY_RATES.overnight,
      stay_overnight: existingRates.stay_overnight ?? DEFAULT_PAY_RATES.stay_overnight,
      petsit_our_location: existingRates.petsit_our_location ?? DEFAULT_PAY_RATES.petsit_our_location,
      petsit_your_location: existingRates.petsit_your_location ?? DEFAULT_PAY_RATES.petsit_your_location,
      // Day Care
      doggy_day_care: existingRates.doggy_day_care ?? DEFAULT_PAY_RATES.doggy_day_care,
      doggy_day_camp: existingRates.doggy_day_camp ?? DEFAULT_PAY_RATES.doggy_day_camp,
      day_visit: existingRates.day_visit ?? DEFAULT_PAY_RATES.day_visit,
      // Concierge/Transport
      concierge: existingRates.concierge ?? DEFAULT_PAY_RATES.concierge,
      transport: existingRates.transport ?? DEFAULT_PAY_RATES.transport,
    });
    setPaySetupMode(true);
    setEditMode(false);
  };

  const savePayRates = async () => {
    if (!selectedWalker) return;
    setSaving(true);
    try {
      await api.put(`/users/${selectedWalker.id}/pay-setup`, {
        custom_pay_rates: payRates
      });
      toast.success('Pay rates saved successfully!');
      setPaySetupMode(false);
      fetchWalkers();
      fetchPendingPaySetup();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save pay rates');
    } finally {
      setSaving(false);
    }
  };

  const useDefaultRates = () => {
    setPayRates({...DEFAULT_PAY_RATES});
    toast.info('Default rates applied');
  };

  // Edit user info
  const initEditMode = (walker) => {
    setEditForm({
      username: walker.username || '',
      email: walker.email || '',
      password: '', // Don't show existing password
      full_name: walker.full_name || '',
      phone: walker.phone || '',
      bio: walker.bio || '',
    });
    setEditMode(true);
    setPaySetupMode(false);
  };

  const saveUserInfo = async () => {
    if (!selectedWalker) return;
    setSaving(true);
    try {
      const updateData = {
        full_name: editForm.full_name,
        email: editForm.email,
        phone: editForm.phone,
        bio: editForm.bio,
      };
      
      // Only include username if changed
      if (editForm.username && editForm.username !== selectedWalker.username) {
        updateData.username = editForm.username;
      }
      
      // Only include password if provided
      if (editForm.password) {
        updateData.password = editForm.password;
      }
      
      await api.put(`/users/${selectedWalker.id}`, updateData);
      toast.success('User info updated successfully!');
      setEditMode(false);
      fetchWalkers();
      // Update selected walker
      setSelectedWalker({...selectedWalker, ...updateData});
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update user info');
    } finally {
      setSaving(false);
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
        {/* Pay Setup Required Banner */}
        {pendingPaySetup.length > 0 && (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-amber-100">
                <AlertCircle className="w-5 h-5 text-amber-600" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-amber-800">
                  {pendingPaySetup.length} Walker{pendingPaySetup.length > 1 ? 's' : ''} Need Pay Setup
                </p>
                <p className="text-sm text-amber-600">
                  {pendingPaySetup.map(w => w.full_name || w.username).join(', ')}
                </p>
              </div>
              <Button 
                size="sm" 
                onClick={() => {
                  const firstPending = walkers.find(w => !w.pay_setup_completed);
                  if (firstPending) {
                    setSelectedWalker(firstPending);
                    initPaySetup(firstPending);
                  }
                }}
                className="bg-amber-500 hover:bg-amber-600"
              >
                <DollarSign className="w-4 h-4 mr-1" />
                Set Up Pay
              </Button>
            </div>
          </div>
        )}

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
                        {!walker.pay_setup_completed && (
                          <Badge className="bg-amber-100 text-amber-700 rounded-full text-xs">
                            <DollarSign className="w-3 h-3 mr-1" />
                            Needs Pay Setup
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
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        setSelectedWalker(walker);
                        initPaySetup(walker);
                      }}
                      className="text-green-600 hover:bg-green-50"
                    >
                      <DollarSign className="w-4 h-4 mr-1" />
                      Edit Pay
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
        <Dialog open={!!selectedWalker} onOpenChange={() => { setSelectedWalker(null); setPaySetupMode(false); setEditMode(false); }}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editMode ? 'Edit Walker Info' : 'Walker Details'}</DialogTitle>
            </DialogHeader>
            {selectedWalker && (
              <div className="space-y-4">
                {/* Edit Mode - User Info */}
                {editMode ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Username</Label>
                        <Input
                          value={editForm.username}
                          onChange={(e) => setEditForm({...editForm, username: e.target.value})}
                          placeholder="Username"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>New Password</Label>
                        <Input
                          type="password"
                          value={editForm.password}
                          onChange={(e) => setEditForm({...editForm, password: e.target.value})}
                          placeholder="Leave blank to keep current"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Full Name</Label>
                      <Input
                        value={editForm.full_name}
                        onChange={(e) => setEditForm({...editForm, full_name: e.target.value})}
                        placeholder="Full name"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Email</Label>
                        <Input
                          type="email"
                          value={editForm.email}
                          onChange={(e) => setEditForm({...editForm, email: e.target.value})}
                          placeholder="Email"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Phone</Label>
                        <Input
                          value={editForm.phone}
                          onChange={(e) => setEditForm({...editForm, phone: e.target.value})}
                          placeholder="Phone"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Bio</Label>
                      <Textarea
                        value={editForm.bio}
                        onChange={(e) => setEditForm({...editForm, bio: e.target.value})}
                        placeholder="Short bio..."
                        rows={3}
                      />
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button variant="outline" onClick={() => setEditMode(false)} className="flex-1">
                        Cancel
                      </Button>
                      <Button onClick={saveUserInfo} disabled={saving} className="flex-1">
                        {saving ? 'Saving...' : 'Save Changes'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* View Mode - User Info */}
                    <div className="flex items-center gap-4">
                      <Avatar className="w-16 h-16">
                        <AvatarImage src={selectedWalker.profile_image} />
                        <AvatarFallback className="bg-secondary/10 text-secondary text-2xl">
                          {selectedWalker.full_name?.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <h3 className="text-xl font-bold">{selectedWalker.full_name}</h3>
                        <p className="text-muted-foreground">{selectedWalker.email}</p>
                        {selectedWalker.phone && <p className="text-sm text-muted-foreground">{selectedWalker.phone}</p>}
                        <p className="text-xs text-muted-foreground mt-1">Username: {selectedWalker.username}</p>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => initEditMode(selectedWalker)}>
                        <User className="w-4 h-4 mr-1" />
                        Edit Info
                      </Button>
                    </div>
                    
                    <div className="flex gap-2">
                      <Badge className="bg-secondary/10 text-secondary rounded-full">
                        <PawPrint className="w-3 h-3 mr-1" />
                        Walker
                      </Badge>
                      {selectedWalker.pay_setup_completed ? (
                        <Badge className="bg-green-100 text-green-700 rounded-full">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Pay Setup Complete
                        </Badge>
                      ) : (
                        <Badge className="bg-amber-100 text-amber-700 rounded-full">
                          <AlertCircle className="w-3 h-3 mr-1" />
                          Needs Pay Setup
                        </Badge>
                      )}
                    </div>

                    {/* Pay Setup Required Banner */}
                    {!selectedWalker.pay_setup_completed && !paySetupMode && (
                      <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <AlertCircle className="w-5 h-5 text-amber-600" />
                            <div>
                              <p className="font-semibold text-amber-800">Pay Setup Required</p>
                              <p className="text-sm text-amber-600">Set pay rates for this walker</p>
                            </div>
                          </div>
                          <Button size="sm" onClick={() => initPaySetup(selectedWalker)} className="bg-amber-500 hover:bg-amber-600">
                            <DollarSign className="w-4 h-4 mr-1" />
                            Set Pay
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Pay Setup Mode */}
                {paySetupMode && !editMode && (
                  <div className="space-y-4 p-4 rounded-xl bg-green-50 border border-green-200">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-green-800 flex items-center gap-2">
                        <DollarSign className="w-5 h-5" />
                        Pay Rate Setup
                      </h4>
                      <Button variant="outline" size="sm" onClick={useDefaultRates}>
                        Use Defaults
                      </Button>
                    </div>

                    {/* Walk Services */}
                    <div className="space-y-3">
                      <Label className="text-sm font-medium text-green-800">Walk Services</Label>
                      <div className="grid grid-cols-4 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">30 min</Label>
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                            <Input
                              type="number"
                              step="0.01"
                              value={payRates.walk_30}
                              onChange={(e) => setPayRates({...payRates, walk_30: parseFloat(e.target.value) || 0})}
                              className="pl-6"
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">45 min</Label>
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                            <Input
                              type="number"
                              step="0.01"
                              value={payRates.walk_45}
                              onChange={(e) => setPayRates({...payRates, walk_45: parseFloat(e.target.value) || 0})}
                              className="pl-6"
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">60 min</Label>
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                            <Input
                              type="number"
                              step="0.01"
                              value={payRates.walk_60}
                              onChange={(e) => setPayRates({...payRates, walk_60: parseFloat(e.target.value) || 0})}
                              className="pl-6"
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Standard</Label>
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                            <Input
                              type="number"
                              step="0.01"
                              value={payRates.standard_walk}
                              onChange={(e) => setPayRates({...payRates, standard_walk: parseFloat(e.target.value) || 0})}
                              className="pl-6"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Overnight/Pet Sitting Services */}
                    <div className="space-y-3">
                      <Label className="text-sm font-medium text-green-800">Overnight / Pet Sitting</Label>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Overnight Stay</Label>
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                            <Input
                              type="number"
                              step="0.01"
                              value={payRates.overnight}
                              onChange={(e) => setPayRates({...payRates, overnight: parseFloat(e.target.value) || 0, stay_overnight: parseFloat(e.target.value) || 0})}
                              className="pl-6"
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Our Location</Label>
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                            <Input
                              type="number"
                              step="0.01"
                              value={payRates.petsit_our_location}
                              onChange={(e) => setPayRates({...payRates, petsit_our_location: parseFloat(e.target.value) || 0})}
                              className="pl-6"
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Client's Location</Label>
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                            <Input
                              type="number"
                              step="0.01"
                              value={payRates.petsit_your_location}
                              onChange={(e) => setPayRates({...payRates, petsit_your_location: parseFloat(e.target.value) || 0})}
                              className="pl-6"
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Day Care</Label>
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                            <Input
                              type="number"
                              step="0.01"
                              value={payRates.doggy_day_care}
                              onChange={(e) => setPayRates({...payRates, doggy_day_care: parseFloat(e.target.value) || 0, doggy_day_camp: parseFloat(e.target.value) || 0, day_visit: parseFloat(e.target.value) || 0})}
                              className="pl-6"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Concierge/Transport Services */}
                    <div className="space-y-3">
                      <Label className="text-sm font-medium text-green-800">Concierge / Transport</Label>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Concierge</Label>
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                            <Input
                              type="number"
                              step="0.01"
                              value={payRates.concierge}
                              onChange={(e) => setPayRates({...payRates, concierge: parseFloat(e.target.value) || 0})}
                              className="pl-6"
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Transport</Label>
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                            <Input
                              type="number"
                              step="0.01"
                              value={payRates.transport}
                              onChange={(e) => setPayRates({...payRates, transport: parseFloat(e.target.value) || 0})}
                              className="pl-6"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Button variant="outline" onClick={() => setPaySetupMode(false)} className="flex-1">
                        Cancel
                      </Button>
                      <Button onClick={savePayRates} disabled={saving} className="flex-1 bg-green-500 hover:bg-green-600">
                        {saving ? 'Saving...' : 'Save Pay Rates'}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Show Current Pay Rates if setup complete and not in edit/pay mode */}
                {selectedWalker.pay_setup_completed && !paySetupMode && !editMode && (
                  <div className="p-4 rounded-xl bg-muted/50">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium flex items-center gap-2">
                        <DollarSign className="w-4 h-4" />
                        Current Pay Rates
                      </h4>
                      <Button variant="outline" size="sm" onClick={() => initPaySetup(selectedWalker)}>
                        Edit Pay
                      </Button>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="font-medium text-xs text-muted-foreground">WALKS</div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">30 min:</span>
                          <span className="font-medium">${selectedWalker.custom_pay_rates?.walk_30 || DEFAULT_PAY_RATES.walk_30}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">45 min:</span>
                          <span className="font-medium">${selectedWalker.custom_pay_rates?.walk_45 || DEFAULT_PAY_RATES.walk_45}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">60 min:</span>
                          <span className="font-medium">${selectedWalker.custom_pay_rates?.walk_60 || DEFAULT_PAY_RATES.walk_60}</span>
                        </div>
                      </div>
                      <div className="font-medium text-xs text-muted-foreground pt-2">OVERNIGHT / PET SITTING</div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Overnight:</span>
                          <span className="font-medium">${selectedWalker.custom_pay_rates?.overnight || DEFAULT_PAY_RATES.overnight}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Our Loc:</span>
                          <span className="font-medium">${selectedWalker.custom_pay_rates?.petsit_our_location || DEFAULT_PAY_RATES.petsit_our_location}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Client Loc:</span>
                          <span className="font-medium">${selectedWalker.custom_pay_rates?.petsit_your_location || DEFAULT_PAY_RATES.petsit_your_location}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Day Care:</span>
                          <span className="font-medium">${selectedWalker.custom_pay_rates?.doggy_day_care || DEFAULT_PAY_RATES.doggy_day_care}</span>
                        </div>
                      </div>
                      <div className="font-medium text-xs text-muted-foreground pt-2">OTHER</div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Concierge:</span>
                          <span className="font-medium">${selectedWalker.custom_pay_rates?.concierge || DEFAULT_PAY_RATES.concierge}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Transport:</span>
                          <span className="font-medium">${selectedWalker.custom_pay_rates?.transport || DEFAULT_PAY_RATES.transport}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                {selectedWalker.bio && !editMode && !paySetupMode && (
                  <div className="p-3 rounded-xl bg-muted/50">
                    <p className="text-sm">{selectedWalker.bio}</p>
                  </div>
                )}
                
                {!editMode && !paySetupMode && (
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
                )}
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
