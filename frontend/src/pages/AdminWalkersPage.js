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
    can_schedule_walks: false,
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
    can_schedule_walks: false,
  });

  useEffect(() => {
    fetchStaff();
    fetchPendingPaySetup();
  }, []);

  const fetchStaff = async () => {
    try {
      // Fetch all staff (staff, sitters, admins)
      const response = await api.get('/users/staff?include_frozen=true');
      setStaff(response.data);
    } catch (error) {
      // Fallback to staff endpoint if staff endpoint doesn't exist
      try {
        const response = await api.get('/users/staff?include_frozen=true');
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

  const initPaySetup = (member) => {
    // Initialize with existing custom rates or defaults
    const existingRates = member.custom_pay_rates || {};
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
    if (!selectedStaff) return;
    setSaving(true);
    try {
      await api.put(`/users/${selectedStaff.id}/pay-setup`, {
        custom_pay_rates: payRates
      });
      toast.success('Pay rates saved successfully!');
      setPaySetupMode(false);
      fetchStaff();
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
  const initEditMode = (member) => {
    setEditForm({
      username: member.username || '',
      email: member.email || '',
      password: '', // Don't show existing password
      full_name: member.full_name || '',
      phone: member.phone || '',
      bio: member.bio || '',
      role: member.role || 'walker',
      is_walker: member.is_walker || false,
      is_sitter: member.is_sitter || false,
      can_schedule_walks: member.can_schedule_walks || false,
    });
    setEditMode(true);
    setPaySetupMode(false);
  };

  const saveUserInfo = async () => {
    if (!selectedStaff) return;
    setSaving(true);
    try {
      const updateData = {
        full_name: editForm.full_name,
        email: editForm.email,
        phone: editForm.phone,
        bio: editForm.bio,
        role: editForm.role,
        is_walker: editForm.is_walker,
        is_sitter: editForm.is_sitter,
        can_schedule_walks: editForm.can_schedule_walks,
      };
      
      // Only include username if changed
      if (editForm.username && editForm.username !== selectedStaff.username) {
        updateData.username = editForm.username;
      }
      
      // Only include password if provided
      if (editForm.password) {
        updateData.password = editForm.password;
      }
      
      await api.put(`/users/${selectedStaff.id}`, updateData);
      toast.success('Staff info updated successfully!');
      setEditMode(false);
      fetchStaff();
      // Update selected staff with new data
      setSelectedStaff({...selectedStaff, ...updateData});
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update staff info');
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setStaffForm({
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
        ...staffForm,
        role: 'walker',
      });
      
      toast.success(`Walker "${staffForm.full_name}" created successfully!`);
      setDialogOpen(false);
      resetForm();
      fetchStaff();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create staff member');
    }
  };

  const viewStaffDetails = async (member) => {
    try {
      // Fetch member's appointment stats
      const apptsRes = await api.get('/appointments/calendar');
      const memberAppts = apptsRes.data.filter(a => a.walker_id === member.id);
      const completedWalks = memberAppts.filter(a => a.status === 'completed').length;
      const scheduledWalks = memberAppts.filter(a => a.status === 'scheduled').length;
      
      setStaffStats({
        completed: completedWalks,
        scheduled: scheduledWalks,
        total: memberAppts.length,
      });
      setSelectedStaff(member);
    } catch (error) {
      setStaffStats({ completed: 0, scheduled: 0, total: 0 });
      setSelectedStaff(member);
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
      setSelectedStaff(null);
      fetchStaff();
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
      fetchStaff();
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

  // Get role badges for display
  const getRoleBadges = (member) => {
    const badges = [];
    const role = member.role;
    
    if (role === 'admin') {
      badges.push({ label: 'Admin', color: 'bg-purple-100 text-purple-800', icon: Shield });
      if (member.is_walker) badges.push({ label: 'Walker', color: 'bg-orange-100 text-orange-800', icon: PawPrint });
      if (member.is_sitter) badges.push({ label: 'Sitter', color: 'bg-blue-100 text-blue-800', icon: Moon });
    } else if (role === 'walker') {
      badges.push({ label: 'Walker', color: 'bg-orange-100 text-orange-800', icon: PawPrint });
      if (member.is_sitter) badges.push({ label: 'Sitter', color: 'bg-blue-100 text-blue-800', icon: Moon });
    } else if (role === 'sitter') {
      badges.push({ label: 'Sitter', color: 'bg-blue-100 text-blue-800', icon: Moon });
      if (member.is_walker) badges.push({ label: 'Walker', color: 'bg-orange-100 text-orange-800', icon: PawPrint });
    }
    
    // Add scheduling permission badge for walkers
    if (member.can_schedule_walks && (role === 'walker' || member.is_walker)) {
      badges.push({ label: 'Can Schedule', color: 'bg-green-100 text-green-800', icon: Calendar });
    }
    
    return badges;
  };

  const filteredStaff = staff.filter(member =>
    member.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    member.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    member.role?.toLowerCase().includes(searchTerm.toLowerCase())
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
      <div className="space-y-8" data-testid="admin-staff-page">
        {/* Pay Setup Required Banner */}
        {pendingPaySetup.length > 0 && (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-amber-100">
                <AlertCircle className="w-5 h-5 text-amber-600" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-amber-800">
                  {pendingPaySetup.length} Staff Member{pendingPaySetup.length > 1 ? 's' : ''} Need Pay Setup
                </p>
                <p className="text-sm text-amber-600">
                  {pendingPaySetup.map(w => w.full_name || w.username).join(', ')}
                </p>
              </div>
              <Button 
                size="sm" 
                onClick={() => {
                  const firstPending = staff.find(w => !w.pay_setup_completed && (w.role === 'walker' || w.role === 'sitter' || w.is_walker || w.is_sitter));
                  if (firstPending) {
                    setSelectedStaff(firstPending);
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
            <h1 className="text-3xl font-heading font-bold">Staff</h1>
            <p className="text-muted-foreground">{staff.length} registered staff members</p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search staff..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 rounded-full"
                data-testid="search-staff"
              />
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="rounded-full" data-testid="add-staff-btn">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Staff
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Add New Staff Member</DialogTitle>
                  <DialogDescription>Create a new staff account</DialogDescription>
                </DialogHeader>
                
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Role Selection */}
                  <div className="space-y-2">
                    <Label>Role *</Label>
                    <Select value={staffForm.role} onValueChange={(val) => setStaffForm({...staffForm, role: val})}>
                      <SelectTrigger className="rounded-full">
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin - Full system access</SelectItem>
                        <SelectItem value="walker">Walker - Dog walking services</SelectItem>
                        <SelectItem value="sitter">Sitter - Pet sitting/overnight</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Additional capabilities for Admin role */}
                  {staffForm.role === 'admin' && (
                    <div className="p-3 rounded-lg bg-purple-50 border border-purple-200 space-y-2">
                      <Label className="text-sm font-medium text-purple-800">Additional Capabilities</Label>
                      <div className="flex items-center gap-2">
                        <Checkbox 
                          id="admin-walker" 
                          checked={staffForm.is_walker}
                          onCheckedChange={(checked) => setStaffForm({...staffForm, is_walker: checked})}
                        />
                        <Label htmlFor="admin-walker" className="text-sm cursor-pointer">Can do walks</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox 
                          id="admin-sitter" 
                          checked={staffForm.is_sitter}
                          onCheckedChange={(checked) => setStaffForm({...staffForm, is_sitter: checked})}
                        />
                        <Label htmlFor="admin-sitter" className="text-sm cursor-pointer">Can do pet sitting</Label>
                      </div>
                    </div>
                  )}

                  {/* Walker+Sitter combo option */}
                  {staffForm.role === 'walker' && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-50 border border-blue-200">
                      <Checkbox 
                        id="walker-sitter" 
                        checked={staffForm.is_sitter}
                        onCheckedChange={(checked) => setStaffForm({...staffForm, is_sitter: checked})}
                      />
                      <Label htmlFor="walker-sitter" className="text-sm cursor-pointer">Also does pet sitting/overnights</Label>
                    </div>
                  )}
                  
                  {staffForm.role === 'sitter' && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-orange-50 border border-orange-200">
                      <Checkbox 
                        id="sitter-walker" 
                        checked={staffForm.is_walker}
                        onCheckedChange={(checked) => setStaffForm({...staffForm, is_walker: checked})}
                      />
                      <Label htmlFor="sitter-walker" className="text-sm cursor-pointer">Also does dog walking</Label>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="staff-fullname">Full Name *</Label>
                      <Input
                        id="staff-fullname"
                        value={staffForm.full_name}
                        onChange={(e) => setStaffForm({ ...staffForm, full_name: e.target.value })}
                        placeholder="Jane Smith"
                        required
                        data-testid="staff-fullname"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="staff-username">Username *</Label>
                      <Input
                        id="staff-username"
                        value={staffForm.username}
                        onChange={(e) => setStaffForm({ ...staffForm, username: e.target.value })}
                        placeholder="janesmith"
                        required
                        data-testid="staff-username"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="staff-email">Email *</Label>
                      <Input
                        id="staff-email"
                        type="email"
                        value={staffForm.email}
                        onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })}
                        placeholder="jane@example.com"
                        required
                        data-testid="staff-email"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="staff-phone">Phone</Label>
                      <Input
                        id="staff-phone"
                        value={staffForm.phone}
                        onChange={(e) => setStaffForm({ ...staffForm, phone: e.target.value })}
                        placeholder="(555) 123-4567"
                        data-testid="staff-phone"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="staff-password">Password *</Label>
                    <Input
                      id="staff-password"
                      type="password"
                      value={staffForm.password}
                      onChange={(e) => setStaffForm({ ...staffForm, password: e.target.value })}
                      placeholder="Create a password"
                      required
                      data-testid="staff-password"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="staff-bio">Bio (Optional)</Label>
                    <Textarea
                      id="staff-bio"
                      value={staffForm.bio}
                      onChange={(e) => setStaffForm({ ...staffForm, bio: e.target.value })}
                      placeholder="Experience with pets, certifications, etc."
                      rows={3}
                      data-testid="staff-bio"
                    />
                  </div>
                  
                  <div className="flex justify-end gap-3 pt-4 border-t">
                    <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" className="rounded-full" data-testid="submit-staff">
                      Create Staff Member
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Staff Grid */}
        {filteredStaff.length === 0 ? (
          <Card className="rounded-2xl shadow-sm">
            <CardContent className="p-12 text-center">
              <User className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-lg text-muted-foreground">No staff found</p>
              <Button onClick={() => setDialogOpen(true)} className="mt-4 rounded-full">
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Staff Member
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredStaff.map((member) => (
              <Card 
                key={member.id} 
                className={`rounded-2xl shadow-sm hover:shadow-md transition-shadow cursor-pointer ${!member.is_active ? 'opacity-60 border-red-300' : ''}`}
                data-testid={`staff-card-${member.id}`}
                onClick={() => viewStaffDetails(member)}
              >
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <Avatar className="w-14 h-14">
                      <AvatarImage src={member.profile_image} />
                      <AvatarFallback className={`text-lg ${member.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-secondary/10 text-secondary'}`}>
                        {member.full_name?.charAt(0) || 'S'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold truncate">{member.full_name}</h3>
                      <div className="flex items-center gap-1 mt-1 flex-wrap">
                        {getRoleBadges(member).map((badge, idx) => (
                          <Badge key={idx} className={`${badge.color} rounded-full text-xs`}>
                            <badge.icon className="w-3 h-3 mr-1" />
                            {badge.label}
                          </Badge>
                        ))}
                        {!member.is_active && (
                          <Badge className="bg-red-100 text-red-800 rounded-full text-xs">
                            <Lock className="w-3 h-3 mr-1" />
                            Frozen
                          </Badge>
                        )}
                        {(member.role !== 'admin' || member.is_walker || member.is_sitter) && !member.pay_setup_completed && (
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
                      <span className="truncate">{member.email}</span>
                    </div>
                    {member.phone && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="w-4 h-4" />
                        <span>{member.phone}</span>
                      </div>
                    )}
                    {member.bio && (
                      <p className="text-muted-foreground text-xs mt-2 line-clamp-2">{member.bio}</p>
                    )}
                  </div>
                  {/* Quick Actions */}
                  <div className="mt-4 pt-3 border-t flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); handleFreezeUser(member.id, member.is_active !== false); }}
                      className={member.is_active === false ? 'text-green-600 hover:bg-green-50' : 'text-amber-600 hover:bg-amber-50'}
                    >
                      {member.is_active === false ? <Unlock className="w-4 h-4 mr-1" /> : <Lock className="w-4 h-4 mr-1" />}
                      {member.is_active === false ? 'Unfreeze' : 'Freeze'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        setSelectedStaff(member);
                        initPaySetup(member);
                      }}
                      className="text-green-600 hover:bg-green-50"
                    >
                      <DollarSign className="w-4 h-4 mr-1" />
                      Edit Pay
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); confirmDelete(member); }}
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

        {/* Staff Details Dialog */}
        <Dialog open={!!selectedStaff} onOpenChange={() => { setSelectedStaff(null); setPaySetupMode(false); setEditMode(false); }}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editMode ? 'Edit Staff Info' : 'Staff Details'}</DialogTitle>
            </DialogHeader>
            {selectedStaff && (
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
                    
                    {/* Role Selection */}
                    <div className="space-y-2">
                      <Label>Role</Label>
                      <Select value={editForm.role} onValueChange={(val) => setEditForm({...editForm, role: val})}>
                        <SelectTrigger className="rounded-full">
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="walker">Walker</SelectItem>
                          <SelectItem value="sitter">Sitter</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Additional Capabilities */}
                    {editForm.role === 'admin' && (
                      <div className="p-3 rounded-lg bg-purple-50 border border-purple-200 space-y-2">
                        <Label className="text-sm font-medium text-purple-800">Admin Capabilities</Label>
                        <div className="flex items-center gap-2">
                          <Checkbox 
                            id="edit-admin-walker" 
                            checked={editForm.is_walker}
                            onCheckedChange={(checked) => setEditForm({...editForm, is_walker: checked})}
                          />
                          <Label htmlFor="edit-admin-walker" className="text-sm cursor-pointer">Can do walks (appears in walker list)</Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <Checkbox 
                            id="edit-admin-sitter" 
                            checked={editForm.is_sitter}
                            onCheckedChange={(checked) => setEditForm({...editForm, is_sitter: checked})}
                          />
                          <Label htmlFor="edit-admin-sitter" className="text-sm cursor-pointer">Can do pet sitting/overnights</Label>
                        </div>
                      </div>
                    )}

                    {editForm.role === 'walker' && (
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-50 border border-blue-200">
                        <Checkbox 
                          id="edit-walker-sitter" 
                          checked={editForm.is_sitter}
                          onCheckedChange={(checked) => setEditForm({...editForm, is_sitter: checked})}
                        />
                        <Label htmlFor="edit-walker-sitter" className="text-sm cursor-pointer">Also does pet sitting/overnights</Label>
                      </div>
                    )}
                    
                    {editForm.role === 'sitter' && (
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-orange-50 border border-orange-200">
                        <Checkbox 
                          id="edit-sitter-walker" 
                          checked={editForm.is_walker}
                          onCheckedChange={(checked) => setEditForm({...editForm, is_walker: checked})}
                        />
                        <Label htmlFor="edit-sitter-walker" className="text-sm cursor-pointer">Also does dog walking</Label>
                      </div>
                    )}
                    
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
                        <AvatarImage src={selectedStaff.profile_image} />
                        <AvatarFallback className="bg-secondary/10 text-secondary text-2xl">
                          {selectedStaff.full_name?.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <h3 className="text-xl font-bold">{selectedStaff.full_name}</h3>
                        <p className="text-muted-foreground">{selectedStaff.email}</p>
                        {selectedStaff.phone && <p className="text-sm text-muted-foreground">{selectedStaff.phone}</p>}
                        <p className="text-xs text-muted-foreground mt-1">Username: {selectedStaff.username}</p>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => initEditMode(selectedStaff)}>
                        <User className="w-4 h-4 mr-1" />
                        Edit Info
                      </Button>
                    </div>
                    
                    {/* Role Badges */}
                    <div className="flex gap-2 flex-wrap">
                      {getRoleBadges(selectedStaff).map((badge, idx) => (
                        <Badge key={idx} className={`${badge.color} rounded-full`}>
                          <badge.icon className="w-3 h-3 mr-1" />
                          {badge.label}
                        </Badge>
                      ))}
                      {(selectedStaff.role !== 'admin' || selectedStaff.is_walker || selectedStaff.is_sitter) && (
                        selectedStaff.pay_setup_completed ? (
                          <Badge className="bg-green-100 text-green-700 rounded-full">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Pay Setup Complete
                          </Badge>
                        ) : (
                          <Badge className="bg-amber-100 text-amber-700 rounded-full">
                            <AlertCircle className="w-3 h-3 mr-1" />
                            Needs Pay Setup
                          </Badge>
                        )
                      )}
                    </div>

                    {/* Pay Setup Required Banner */}
                    {(selectedStaff.role !== 'admin' || selectedStaff.is_walker || selectedStaff.is_sitter) && !selectedStaff.pay_setup_completed && !paySetupMode && (
                      <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <AlertCircle className="w-5 h-5 text-amber-600" />
                            <div>
                              <p className="font-semibold text-amber-800">Pay Setup Required</p>
                              <p className="text-sm text-amber-600">Set pay rates for this staff member</p>
                            </div>
                          </div>
                          <Button size="sm" onClick={() => initPaySetup(selectedStaff)} className="bg-amber-500 hover:bg-amber-600">
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
                {selectedStaff.pay_setup_completed && !paySetupMode && !editMode && (
                  <div className="p-4 rounded-xl bg-muted/50">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium flex items-center gap-2">
                        <DollarSign className="w-4 h-4" />
                        Current Pay Rates
                      </h4>
                      <Button variant="outline" size="sm" onClick={() => initPaySetup(selectedStaff)}>
                        Edit Pay
                      </Button>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="font-medium text-xs text-muted-foreground">WALKS</div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">30 min:</span>
                          <span className="font-medium">${selectedStaff.custom_pay_rates?.walk_30 || DEFAULT_PAY_RATES.walk_30}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">45 min:</span>
                          <span className="font-medium">${selectedStaff.custom_pay_rates?.walk_45 || DEFAULT_PAY_RATES.walk_45}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">60 min:</span>
                          <span className="font-medium">${selectedStaff.custom_pay_rates?.walk_60 || DEFAULT_PAY_RATES.walk_60}</span>
                        </div>
                      </div>
                      <div className="font-medium text-xs text-muted-foreground pt-2">OVERNIGHT / PET SITTING</div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Overnight:</span>
                          <span className="font-medium">${selectedStaff.custom_pay_rates?.overnight || DEFAULT_PAY_RATES.overnight}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Our Loc:</span>
                          <span className="font-medium">${selectedStaff.custom_pay_rates?.petsit_our_location || DEFAULT_PAY_RATES.petsit_our_location}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Client Loc:</span>
                          <span className="font-medium">${selectedStaff.custom_pay_rates?.petsit_your_location || DEFAULT_PAY_RATES.petsit_your_location}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Day Care:</span>
                          <span className="font-medium">${selectedStaff.custom_pay_rates?.doggy_day_care || DEFAULT_PAY_RATES.doggy_day_care}</span>
                        </div>
                      </div>
                      <div className="font-medium text-xs text-muted-foreground pt-2">OTHER</div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Concierge:</span>
                          <span className="font-medium">${selectedStaff.custom_pay_rates?.concierge || DEFAULT_PAY_RATES.concierge}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Transport:</span>
                          <span className="font-medium">${selectedStaff.custom_pay_rates?.transport || DEFAULT_PAY_RATES.transport}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                {selectedStaff.bio && !editMode && !paySetupMode && (
                  <div className="p-3 rounded-xl bg-muted/50">
                    <p className="text-sm">{selectedStaff.bio}</p>
                  </div>
                )}
                
                {!editMode && !paySetupMode && (
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-3">Performance Stats</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-3 rounded-xl bg-green-50">
                      <CheckCircle className="w-5 h-5 mx-auto text-green-600 mb-1" />
                      <p className="text-2xl font-bold text-green-700">{staffStats.completed}</p>
                      <p className="text-xs text-green-600">Completed</p>
                    </div>
                    <div className="text-center p-3 rounded-xl bg-blue-50">
                      <Calendar className="w-5 h-5 mx-auto text-blue-600 mb-1" />
                      <p className="text-2xl font-bold text-blue-700">{staffStats.scheduled}</p>
                      <p className="text-xs text-blue-600">Scheduled</p>
                    </div>
                    <div className="text-center p-3 rounded-xl bg-purple-50">
                      <PawPrint className="w-5 h-5 mx-auto text-purple-600 mb-1" />
                      <p className="text-2xl font-bold text-purple-700">{staffStats.total}</p>
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
