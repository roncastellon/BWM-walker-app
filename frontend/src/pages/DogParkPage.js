import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  Heart, MessageCircle, Share2, Plus, Image as ImageIcon, Tag, X,
  Clock, Search, Filter, Sparkles, PawPrint, Bell, Trash2, Camera
} from 'lucide-react';
import { toast } from 'sonner';

const DogParkPage = () => {
  const { user, api } = useAuth();
  const [posts, setPosts] = useState([]);
  const [featuredImages, setFeaturedImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('recent');
  const [searchName, setSearchName] = useState('');
  const [notifications, setNotifications] = useState([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  // Create post state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [postContent, setPostContent] = useState('');
  const [postImage, setPostImage] = useState(null);
  const [postImagePreview, setPostImagePreview] = useState(null);
  const [selectedPets, setSelectedPets] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [availablePets, setAvailablePets] = useState([]);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchData();
    fetchTaggables();
    fetchNotifications();
  }, []);

  useEffect(() => {
    fetchPosts();
  }, [filter, searchName]);

  const fetchData = async () => {
    try {
      const [featuredRes] = await Promise.all([
        api.get('/dog-park/featured')
      ]);
      setFeaturedImages(featuredRes.data || []);
    } catch (error) {
      console.error('Failed to load featured images');
    }
  };

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const params = { filter };
      if (searchName) params.search_name = searchName;
      
      const res = await api.get('/dog-park/posts', { params });
      setPosts(res.data || []);
    } catch (error) {
      toast.error('Failed to load posts');
    } finally {
      setLoading(false);
    }
  };

  const fetchTaggables = async () => {
    try {
      const [petsRes, usersRes] = await Promise.all([
        api.get('/dog-park/pets-to-tag'),
        api.get('/dog-park/users-to-tag')
      ]);
      setAvailablePets(petsRes.data || []);
      setAvailableUsers(usersRes.data || []);
    } catch (error) {
      console.error('Failed to load taggable items');
    }
  };

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/dog-park/notifications');
      setNotifications(res.data || []);
      setUnreadNotifications((res.data || []).filter(n => !n.read).length);
    } catch (error) {
      console.error('Failed to load notifications');
    }
  };

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image must be less than 5MB');
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (e) => {
        setPostImage(e.target.result);
        setPostImagePreview(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreatePost = async () => {
    if (!postContent.trim() && !postImage) {
      toast.error('Please add some content or an image');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/dog-park/posts', {
        content: postContent,
        image_data: postImage,
        tagged_pet_ids: selectedPets.map(p => p.id),
        tagged_user_ids: selectedUsers.map(u => u.id)
      });
      
      toast.success('Post shared to Dog Park!');
      setCreateModalOpen(false);
      resetCreateForm();
      fetchPosts();
      fetchData();
    } catch (error) {
      toast.error('Failed to create post');
    } finally {
      setSubmitting(false);
    }
  };

  const resetCreateForm = () => {
    setPostContent('');
    setPostImage(null);
    setPostImagePreview(null);
    setSelectedPets([]);
    setSelectedUsers([]);
  };

  const handleLike = async (postId) => {
    try {
      await api.post(`/dog-park/posts/${postId}/like`);
      fetchPosts();
    } catch (error) {
      toast.error('Failed to like post');
    }
  };

  const handleDeletePost = async (postId) => {
    if (!window.confirm('Are you sure you want to delete this post?')) return;
    
    try {
      await api.delete(`/dog-park/posts/${postId}`);
      toast.success('Post deleted');
      fetchPosts();
    } catch (error) {
      toast.error('Failed to delete post');
    }
  };

  const formatTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const togglePetSelection = (pet) => {
    setSelectedPets(prev => {
      const exists = prev.find(p => p.id === pet.id);
      if (exists) {
        return prev.filter(p => p.id !== pet.id);
      }
      return [...prev, pet];
    });
  };

  const toggleUserSelection = (selectedUser) => {
    setSelectedUsers(prev => {
      const exists = prev.find(u => u.id === selectedUser.id);
      if (exists) {
        return prev.filter(u => u.id !== selectedUser.id);
      }
      return [...prev, selectedUser];
    });
  };

  return (
    <Layout>
      <div className="space-y-6" data-testid="dog-park-page">
        {/* Header with Featured Images */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-green-500 to-green-600 p-6 text-white">
          <div className="relative z-10 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                {/* Dog Park Icon - Green irregular oval with balloon font */}
                <div className="w-14 h-12 bg-green-300/30 rounded-[50%_40%_45%_55%/40%_50%_45%_55%] flex items-center justify-center border-2 border-white/50 shadow-lg">
                  <PawPrint className="w-7 h-7 text-white" />
                </div>
                <h1 className="text-3xl lg:text-4xl font-bold tracking-wide" style={{ fontFamily: "'Comic Sans MS', cursive, sans-serif" }}>
                  Dog Park
                </h1>
              </div>
              <p className="text-white/80">
                Share stories and pictures of our furry friends!
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => setCreateModalOpen(true)}
                className="bg-white text-green-600 hover:bg-green-50"
              >
                <Plus className="w-4 h-4 mr-2" />
                New Post
              </Button>
            </div>
          </div>

          {/* Featured pet images carousel */}
          {featuredImages.length > 0 && (
            <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
              {featuredImages.map((img, idx) => (
                <div key={idx} className="flex-shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 border-white/50">
                  <img 
                    src={img.image_data} 
                    alt="Featured pet" 
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
              <div className="flex-shrink-0 w-16 h-16 rounded-xl bg-white/20 flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-white/70" />
              </div>
            </div>
          )}
        </div>

        {/* Filter Bar */}
        <Card className="rounded-xl">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant={filter === 'recent' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter('recent')}
                  className={filter === 'recent' ? 'bg-green-500 hover:bg-green-600' : ''}
                >
                  <Clock className="w-4 h-4 mr-1" />
                  Recent
                </Button>
                <Button
                  variant={filter === 'older' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter('older')}
                  className={filter === 'older' ? 'bg-green-500 hover:bg-green-600' : ''}
                >
                  <Clock className="w-4 h-4 mr-1" />
                  2+ Months
                </Button>
                <Button
                  variant={filter === 'my_pet' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter('my_pet')}
                  className={filter === 'my_pet' ? 'bg-green-500 hover:bg-green-600' : ''}
                >
                  <PawPrint className="w-4 h-4 mr-1" />
                  My Pet
                </Button>
              </div>
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by pet or owner name..."
                  value={searchName}
                  onChange={(e) => setSearchName(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Posts Feed */}
        <div className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
            </div>
          ) : posts.length === 0 ? (
            <Card className="rounded-xl">
              <CardContent className="p-8 text-center">
                <PawPrint className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <h3 className="text-lg font-semibold">No posts yet</h3>
                <p className="text-muted-foreground mb-4">
                  Be the first to share a moment from the Dog Park!
                </p>
                <Button onClick={() => setCreateModalOpen(true)} className="bg-green-500 hover:bg-green-600">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Post
                </Button>
              </CardContent>
            </Card>
          ) : (
            posts.map((post) => (
              <Card key={post.id} className="rounded-xl overflow-hidden">
                <CardContent className="p-0">
                  {/* Post Header */}
                  <div className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={post.author_image} />
                        <AvatarFallback className="bg-green-100 text-green-600">
                          {post.author_name?.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{post.author_name}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatTimeAgo(post.created_at)}
                          <Badge variant="outline" className="ml-1 text-xs capitalize">
                            {post.author_role}
                          </Badge>
                        </p>
                      </div>
                    </div>
                    {(post.author_id === user?.id || user?.role === 'admin') && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeletePost(post.id)}
                        className="text-muted-foreground hover:text-red-500"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>

                  {/* Post Content */}
                  <div className="px-4 pb-3">
                    <p className="whitespace-pre-wrap">{post.content}</p>
                  </div>

                  {/* Tagged Pets & Users */}
                  {(post.tagged_pets?.length > 0 || post.tagged_users?.length > 0) && (
                    <div className="px-4 pb-3 flex flex-wrap gap-2">
                      {post.tagged_pets?.map((pet, idx) => (
                        <Badge key={`pet-${idx}`} variant="secondary" className="bg-green-100 text-green-700">
                          <PawPrint className="w-3 h-3 mr-1" />
                          {pet.pet_name} ({pet.owner_name})
                        </Badge>
                      ))}
                      {post.tagged_users?.map((taggedUser, idx) => (
                        <Badge key={`user-${idx}`} variant="secondary" className="bg-blue-100 text-blue-700">
                          <Tag className="w-3 h-3 mr-1" />
                          {taggedUser.user_name}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Post Image */}
                  {post.image_data && (
                    <div className="w-full max-h-96 overflow-hidden">
                      <img 
                        src={post.image_data} 
                        alt="Post" 
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}

                  {/* Post Actions */}
                  <div className="p-4 border-t flex items-center gap-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleLike(post.id)}
                      className={post.likes?.includes(user?.id) ? 'text-red-500' : ''}
                    >
                      <Heart className={`w-4 h-4 mr-1 ${post.likes?.includes(user?.id) ? 'fill-current' : ''}`} />
                      {post.likes?.length || 0}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Create Post Modal */}
        <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <div className="w-8 h-7 bg-green-500 rounded-[50%_40%_45%_55%/40%_50%_45%_55%] flex items-center justify-center">
                  <PawPrint className="w-4 h-4 text-white" />
                </div>
                Share to Dog Park
              </DialogTitle>
              <DialogDescription>
                Share a moment, story, or photo from the Dog Park!
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Content */}
              <div className="space-y-2">
                <Label>What's happening?</Label>
                <Textarea
                  placeholder="Share a story about a pet..."
                  value={postContent}
                  onChange={(e) => setPostContent(e.target.value)}
                  rows={3}
                />
              </div>

              {/* Image Upload */}
              <div className="space-y-2">
                <Label>Add a Photo</Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                />
                {postImagePreview ? (
                  <div className="relative">
                    <img 
                      src={postImagePreview} 
                      alt="Preview" 
                      className="w-full h-48 object-cover rounded-lg"
                    />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2"
                      onClick={() => {
                        setPostImage(null);
                        setPostImagePreview(null);
                      }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full h-24 border-dashed"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Camera className="w-6 h-6 mr-2" />
                    Click to add photo
                  </Button>
                )}
              </div>

              {/* Tag Pets */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <PawPrint className="w-4 h-4" />
                  Tag Pets
                </Label>
                <div className="flex flex-wrap gap-2 p-3 border rounded-lg max-h-32 overflow-y-auto">
                  {availablePets.map(pet => (
                    <Badge
                      key={pet.id}
                      variant={selectedPets.find(p => p.id === pet.id) ? 'default' : 'outline'}
                      className={`cursor-pointer ${selectedPets.find(p => p.id === pet.id) ? 'bg-green-500' : ''}`}
                      onClick={() => togglePetSelection(pet)}
                    >
                      {pet.name} ({pet.owner_name})
                    </Badge>
                  ))}
                  {availablePets.length === 0 && (
                    <p className="text-sm text-muted-foreground">No pets available to tag</p>
                  )}
                </div>
              </div>

              {/* Tag Users */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Tag className="w-4 h-4" />
                  Tag People
                </Label>
                <div className="flex flex-wrap gap-2 p-3 border rounded-lg max-h-32 overflow-y-auto">
                  {availableUsers.map(availableUser => (
                    <Badge
                      key={availableUser.id}
                      variant={selectedUsers.find(u => u.id === availableUser.id) ? 'default' : 'outline'}
                      className={`cursor-pointer ${selectedUsers.find(u => u.id === availableUser.id) ? 'bg-blue-500' : ''}`}
                      onClick={() => toggleUserSelection(availableUser)}
                    >
                      {availableUser.full_name}
                    </Badge>
                  ))}
                  {availableUsers.length === 0 && (
                    <p className="text-sm text-muted-foreground">No users available to tag</p>
                  )}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateModalOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleCreatePost} 
                disabled={submitting || (!postContent.trim() && !postImage)}
                className="bg-green-500 hover:bg-green-600"
              >
                {submitting ? 'Posting...' : 'Post to Dog Park'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default DogParkPage;
