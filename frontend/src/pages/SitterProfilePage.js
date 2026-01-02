import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Badge } from '../components/ui/badge';
import { User, Mail, Phone, Bed, Save, Camera, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const SitterProfilePage = () => {
  const { user, api, refreshUser } = useAuth();
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    bio: '',
    profile_image: '',
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [stats, setStats] = useState({});
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (user) {
      setFormData({
        full_name: user.full_name || '',
        phone: user.phone || '',
        bio: user.bio || '',
        profile_image: user.profile_image || '',
      });
    }
    fetchStats();
  }, [user]);

  const fetchStats = async () => {
    try {
      const response = await api.get('/dashboard/stats');
      setStats(response.data);
    } catch (error) {
      console.error('Failed to load stats');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put(`/users/${user.id}`, formData);
      if (refreshUser) {
        await refreshUser();
      }
      toast.success('Profile updated successfully!');
    } catch (error) {
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
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
      const response = await api.post('/upload/profile', uploadFormData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      // Update local state with new image URL
      setFormData(prev => ({ ...prev, profile_image: response.data.url }));
      
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

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-8" data-testid="sitter-profile-page">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-heading font-bold">My Profile</h1>
          <p className="text-muted-foreground">Manage your public profile and information</p>
        </div>

        {/* Profile Card */}
        <Card className="rounded-2xl shadow-sm overflow-hidden">
          <div className="h-32 bg-gradient-to-r from-primary/80 to-primary" />
          <CardContent className="relative pb-8">
            <div className="absolute -top-16 left-8">
              <div 
                className="relative cursor-pointer group"
                onClick={() => fileInputRef.current?.click()}
              >
                <Avatar className="w-32 h-32 border-4 border-card">
                  <AvatarImage src={formData.profile_image || user?.profile_image} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-4xl">
                    {user?.full_name?.charAt(0) || 'W'}
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
            </div>
            <div className="pt-20">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold">{user?.full_name}</h2>
                  <p className="text-muted-foreground flex items-center gap-2 mt-1">
                    <Mail className="w-4 h-4" />
                    {user?.email}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">Click on profile picture to upload a new photo</p>
                </div>
                <Badge className="bg-secondary text-secondary-foreground w-fit rounded-full px-4 py-2">
                  <Bed className="w-4 h-4 mr-2" />
                  Pet Sitter
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="rounded-2xl shadow-sm">
            <CardContent className="p-6 text-center">
              <p className="text-3xl font-bold text-primary">{stats.completed_walks || 0}</p>
              <p className="text-sm text-muted-foreground">Completed Walks</p>
            </CardContent>
          </Card>
          <Card className="rounded-2xl shadow-sm">
            <CardContent className="p-6 text-center">
              <p className="text-3xl font-bold text-secondary">{stats.todays_appointments || 0}</p>
              <p className="text-sm text-muted-foreground">Today's Walks</p>
            </CardContent>
          </Card>
          <Card className="rounded-2xl shadow-sm">
            <CardContent className="p-6 text-center">
              <p className="text-3xl font-bold text-accent">{stats.pending_appointments || 0}</p>
              <p className="text-sm text-muted-foreground">Upcoming</p>
            </CardContent>
          </Card>
        </div>

        {/* Edit Profile Form */}
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle>Edit Profile</CardTitle>
            <CardDescription>Update your public profile information</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="full_name">Full Name</Label>
                  <Input
                    id="full_name"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    data-testid="profile-name-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    data-testid="profile-phone-input"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  placeholder="Tell clients about yourself, your experience with pets, and why you love this work..."
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  rows={4}
                  data-testid="profile-bio-input"
                />
                <p className="text-xs text-muted-foreground">
                  This will be visible to clients on your public profile
                </p>
              </div>

              <Button type="submit" disabled={saving} className="rounded-full" data-testid="save-profile-btn">
                <Save className="w-4 h-4 mr-2" />
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Public Profile Preview */}
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle>Public Profile Preview</CardTitle>
            <CardDescription>How clients see your profile</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-6 p-6 rounded-xl bg-muted/50">
              <Avatar className="w-20 h-20">
                <AvatarImage src={formData.profile_image || user?.profile_image} />
                <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
                  {formData.full_name?.charAt(0) || 'W'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h3 className="text-xl font-bold">{formData.full_name || 'Your Name'}</h3>
                <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Bed className="w-4 h-4" />
                    Professional Sitter
                  </span>
                  {formData.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="w-4 h-4" />
                      {formData.phone}
                    </span>
                  )}
                </div>
                {formData.bio && (
                  <p className="mt-4 text-muted-foreground">{formData.bio}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default SitterProfilePage;
