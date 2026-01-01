import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Badge } from '../components/ui/badge';
import { PawPrint, Search, Mail, Phone } from 'lucide-react';
import { toast } from 'sonner';

const AdminWalkersPage = () => {
  const { api } = useAuth();
  const [walkers, setWalkers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWalkers();
  }, []);

  const fetchWalkers = async () => {
    try {
      const response = await api.get('/users/walkers');
      setWalkers(response.data);
    } catch (error) {
      toast.error('Failed to load walkers');
    } finally {
      setLoading(false);
    }
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
        </div>

        {/* Walkers Grid */}
        {filteredWalkers.length === 0 ? (
          <Card className="rounded-2xl shadow-sm">
            <CardContent className="p-12 text-center">
              <PawPrint className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-lg text-muted-foreground">No walkers found</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredWalkers.map((walker) => (
              <Card key={walker.id} className="rounded-2xl shadow-sm hover:shadow-md transition-shadow" data-testid={`walker-card-${walker.id}`}>
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
                      <Badge className="bg-secondary/10 text-secondary rounded-full text-xs mt-1">
                        <PawPrint className="w-3 h-3 mr-1" />
                        Walker
                      </Badge>
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
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default AdminWalkersPage;
