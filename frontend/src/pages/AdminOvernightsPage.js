import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { 
  Moon, Calendar, Clock, PawPrint, CheckCircle, AlertTriangle,
  ChevronLeft, ChevronRight, LogIn, LogOut, Plus, RefreshCw, User
} from 'lucide-react';
import { toast } from 'sonner';

const AdminOvernightsPage = () => {
  const { api } = useAuth();
  const [overnights, setOvernights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedStay, setSelectedStay] = useState(null);
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [extendModalOpen, setExtendModalOpen] = useState(false);
  const [extendDays, setExtendDays] = useState(1);
  const [endingTodayPrompt, setEndingTodayPrompt] = useState([]);
  
  // Edit modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    scheduled_date: '',
    end_date: '',
    status: 'scheduled'
  });

  useEffect(() => {
    fetchOvernights();
  }, [currentDate]);

  useEffect(() => {
    // Check for stays ending today after 6 PM
    checkEndingToday();
    const interval = setInterval(checkEndingToday, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [overnights]);

  const fetchOvernights = async () => {
    setLoading(true);
    try {
      // Fetch services to get overnight service types
      const servicesRes = await api.get('/services');
      const overnightServiceTypes = servicesRes.data
        .filter(s => s.duration_type === 'nights' || 
                     s.service_type?.toLowerCase().includes('overnight') ||
                     s.service_type?.toLowerCase().includes('petsit') ||
                     s.service_type?.toLowerCase().includes('boarding') ||
                     s.service_type?.toLowerCase().includes('stay') ||
                     s.name?.toLowerCase().includes('overnight') ||
                     s.name?.toLowerCase().includes('boarding'))
        .map(s => s.service_type);
      
      const res = await api.get('/appointments/calendar');
      // Filter overnight-type appointments - include all overnight/boarding variations
      const filtered = res.data.filter(a => {
        const serviceType = (a.service_type || '').toLowerCase();
        const dType = (a.duration_type || '').toLowerCase();
        const serviceName = (a.service_name || '').toLowerCase();
        
        // Match by service type name, duration_type, or if it's in our services list
        return (
          serviceType.includes('overnight') ||
          serviceType.includes('petsit') ||
          serviceType.includes('boarding') ||
          serviceType.includes('stay') ||
          serviceName.includes('overnight') ||
          serviceName.includes('boarding') ||
          dType === 'nights' ||
          overnightServiceTypes.includes(a.service_type)
        );
      });
      setOvernights(filtered);
      console.log('Overnight appointments found:', filtered.length, filtered);
    } catch (error) {
      console.error('Failed to load overnights:', error);
      toast.error('Failed to load overnights');
    } finally {
      setLoading(false);
    }
  };

  const checkEndingToday = () => {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const hour = now.getHours();
    
    // Only show prompt after 6 PM
    if (hour < 18) {
      setEndingTodayPrompt([]);
      return;
    }
    
    // Find stays ending today that are still in progress
    const ending = overnights.filter(stay => {
      const endDate = stay.end_date || stay.scheduled_date;
      return endDate === today && stay.status === 'in_progress';
    });
    
    setEndingTodayPrompt(ending);
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const navigateDate = (days) => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + days);
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const getStaysForDate = (dateStr) => {
    return overnights.filter(stay => {
      const startDate = stay.scheduled_date;
      const endDate = stay.end_date || stay.scheduled_date;
      return dateStr >= startDate && dateStr <= endDate;
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'scheduled': return 'bg-yellow-100 text-yellow-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getServiceLabel = (type) => {
    const labels = {
      'overnight': 'Overnight Stay',
      'stay_overnight': 'Overnight Stay',
      'petsit_our_location': 'Our Location',
      'petsit_your_location': "Client's Home",
    };
    return labels[type] || type?.replace(/_/g, ' ');
  };

  // Open edit modal
  const openEditModal = (stay) => {
    setSelectedStay(stay);
    setEditForm({
      scheduled_date: stay.scheduled_date || '',
      end_date: stay.end_date || stay.scheduled_date || '',
      status: stay.status || 'scheduled'
    });
    setEditModalOpen(true);
  };

  // Save edited stay
  const handleSaveEdit = async () => {
    if (!selectedStay) return;
    try {
      await api.put(`/appointments/${selectedStay.id}`, {
        scheduled_date: editForm.scheduled_date,
        end_date: editForm.end_date,
        status: editForm.status
      });
      toast.success('Stay updated successfully!');
      fetchOvernights();
      setEditModalOpen(false);
      setActionModalOpen(false);
    } catch (error) {
      toast.error('Failed to update stay');
    }
  };

  // Check-in a stay
  const handleCheckIn = async (stay) => {
    try {
      await api.put(`/appointments/${stay.id}`, {
        status: 'in_progress',
        start_time: new Date().toISOString()
      });
      toast.success(`${stay.pet_names?.join(', ') || 'Pet'} checked in!`);
      fetchOvernights();
      setActionModalOpen(false);
    } catch (error) {
      toast.error('Failed to check in');
    }
  };

  // Check-out / Complete a stay
  const handleCheckOut = async (stay) => {
    try {
      await api.put(`/appointments/${stay.id}`, {
        status: 'completed',
        end_time: new Date().toISOString()
      });
      toast.success(`${stay.pet_names?.join(', ') || 'Pet'} checked out! Ready for billing.`);
      fetchOvernights();
      setActionModalOpen(false);
    } catch (error) {
      toast.error('Failed to check out');
    }
  };

  // Extend a stay
  const handleExtendStay = async () => {
    if (!selectedStay) return;
    try {
      const currentEnd = new Date(selectedStay.end_date || selectedStay.scheduled_date);
      currentEnd.setDate(currentEnd.getDate() + extendDays);
      const newEndDate = currentEnd.toISOString().split('T')[0];
      
      await api.put(`/appointments/${selectedStay.id}`, {
        end_date: newEndDate
      });
      toast.success(`Stay extended to ${newEndDate}`);
      fetchOvernights();
      setExtendModalOpen(false);
      setEndingTodayPrompt(prev => prev.filter(s => s.id !== selectedStay.id));
    } catch (error) {
      toast.error('Failed to extend stay');
    }
  };

  const openStayDetails = (stay) => {
    setSelectedStay(stay);
    setActionModalOpen(true);
  };

  const openExtendModal = (stay) => {
    setSelectedStay(stay);
    setExtendDays(1);
    setExtendModalOpen(true);
  };

  // Get current week dates
  const getWeekDates = () => {
    const dates = [];
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      dates.push(date);
    }
    return dates;
  };

  const weekDates = getWeekDates();
  const today = new Date().toISOString().split('T')[0];

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
      <div className="space-y-4 px-2 sm:px-0" data-testid="admin-overnights-page">
        {/* Ending Today Alert */}
        {endingTodayPrompt.length > 0 && (
          <Card className="rounded-xl border-2 border-orange-400 bg-orange-50">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-6 h-6 text-orange-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold text-orange-800">Stays Ending Today</p>
                  <p className="text-sm text-orange-700 mb-3">The following stays are scheduled to end today. Do you need to extend?</p>
                  <div className="space-y-2">
                    {endingTodayPrompt.map(stay => (
                      <div key={stay.id} className="flex items-center justify-between p-2 bg-white rounded-lg">
                        <div>
                          <p className="font-medium">{stay.pet_names?.join(', ') || 'Pet'}</p>
                          <p className="text-xs text-muted-foreground">{stay.client_name}</p>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => openExtendModal(stay)} className="rounded-full">
                            Extend
                          </Button>
                          <Button size="sm" onClick={() => { setSelectedStay(stay); handleCheckOut(stay); }} className="rounded-full bg-green-600 hover:bg-green-700">
                            Complete
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-heading font-bold flex items-center gap-2">
              <Moon className="w-6 h-6 text-purple-600" />
              Overnights Calendar
            </h1>
            <p className="text-sm text-muted-foreground">Manage overnight stays and boardings</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchOvernights} className="rounded-full">
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={goToToday} className="rounded-full">
              Today
            </Button>
          </div>
        </div>

        {/* Week Navigation */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigateDate(-7)} className="rounded-full">
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <p className="font-medium text-sm">{formatDate(weekDates[0])} - {formatDate(weekDates[6])}</p>
          <Button variant="ghost" size="sm" onClick={() => navigateDate(7)} className="rounded-full">
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>

        {/* Week View */}
        <div className="grid grid-cols-1 sm:grid-cols-7 gap-2">
          {weekDates.map((date) => {
            const dateStr = date.toISOString().split('T')[0];
            const isToday = dateStr === today;
            const stays = getStaysForDate(dateStr);
            
            return (
              <Card 
                key={dateStr} 
                className={`rounded-xl ${isToday ? 'border-2 border-purple-500 bg-purple-50/50' : ''}`}
              >
                <CardHeader className="p-2 pb-1">
                  <p className={`text-xs font-medium ${isToday ? 'text-purple-700' : 'text-muted-foreground'}`}>
                    {date.toLocaleDateString('en-US', { weekday: 'short' })}
                  </p>
                  <p className={`text-lg font-bold ${isToday ? 'text-purple-700' : ''}`}>
                    {date.getDate()}
                  </p>
                </CardHeader>
                <CardContent className="p-2 pt-0 space-y-1">
                  {stays.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-2">-</p>
                  ) : (
                    stays.map(stay => {
                      const isStart = stay.scheduled_date === dateStr;
                      const isEnd = (stay.end_date || stay.scheduled_date) === dateStr;
                      
                      return (
                        <div
                          key={stay.id}
                          onClick={() => openStayDetails(stay)}
                          className={`p-2 rounded-lg cursor-pointer text-xs transition-colors
                            ${stay.status === 'in_progress' ? 'bg-blue-100 hover:bg-blue-200' : 
                              stay.status === 'completed' ? 'bg-green-100 hover:bg-green-200' : 
                              'bg-purple-100 hover:bg-purple-200'}`}
                        >
                          <div className="flex items-center gap-1 mb-1">
                            {isStart && <LogIn className="w-3 h-3 text-green-600" />}
                            {isEnd && !isStart && <LogOut className="w-3 h-3 text-red-600" />}
                            <span className="font-medium truncate">{stay.pet_names?.[0] || 'Pet'}</span>
                          </div>
                          <p className="text-[10px] text-muted-foreground truncate">
                            {stay.client_name?.split(' ')[0]}
                          </p>
                        </div>
                      );
                    })
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Active Stays Summary */}
        <Card className="rounded-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <PawPrint className="w-5 h-5 text-purple-600" />
              Currently Staying
            </CardTitle>
          </CardHeader>
          <CardContent>
            {overnights.filter(s => s.status === 'in_progress').length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No active stays</p>
            ) : (
              <div className="space-y-2">
                {overnights.filter(s => s.status === 'in_progress').map(stay => (
                  <div
                    key={stay.id}
                    onClick={() => openStayDetails(stay)}
                    className="flex items-center justify-between p-3 rounded-lg bg-blue-50 cursor-pointer hover:bg-blue-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-200 flex items-center justify-center">
                        <PawPrint className="w-5 h-5 text-blue-700" />
                      </div>
                      <div>
                        <p className="font-medium">{stay.pet_names?.join(', ') || 'Pet'}</p>
                        <p className="text-xs text-muted-foreground">
                          {stay.client_name} • {getServiceLabel(stay.service_type)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {stay.scheduled_date} → {stay.end_date || stay.scheduled_date}
                        </p>
                      </div>
                    </div>
                    <Badge className={`${getStatusColor(stay.status)} rounded-full`}>
                      Checked In
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Stay Details Modal */}
      <Dialog open={actionModalOpen} onOpenChange={setActionModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Moon className="w-5 h-5 text-purple-600" />
              Overnight Stay Details
            </DialogTitle>
          </DialogHeader>
          {selectedStay && (
            <div className="space-y-4 py-2">
              <div className="p-4 rounded-lg bg-purple-50">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-full bg-purple-200 flex items-center justify-center">
                    <PawPrint className="w-6 h-6 text-purple-700" />
                  </div>
                  <div>
                    <p className="font-bold text-lg">{selectedStay.pet_names?.join(', ') || 'Pet'}</p>
                    <p className="text-sm text-muted-foreground">{selectedStay.client_name}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-muted-foreground">Service</p>
                    <p className="font-medium">{getServiceLabel(selectedStay.service_type)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Status</p>
                    <Badge className={`${getStatusColor(selectedStay.status)} rounded-full`}>
                      {selectedStay.status}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Check-in Date</p>
                    <p className="font-medium">{selectedStay.scheduled_date}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Check-out Date</p>
                    <p className="font-medium">{selectedStay.end_date || selectedStay.scheduled_date}</p>
                  </div>
                </div>
              </div>
              
              <div className="flex flex-col gap-2">
                {selectedStay.status === 'scheduled' && (
                  <Button onClick={() => handleCheckIn(selectedStay)} className="rounded-full bg-green-600 hover:bg-green-700">
                    <LogIn className="w-4 h-4 mr-2" />
                    Check In
                  </Button>
                )}
                {selectedStay.status === 'in_progress' && (
                  <>
                    <Button onClick={() => { setActionModalOpen(false); openExtendModal(selectedStay); }} variant="outline" className="rounded-full">
                      <Plus className="w-4 h-4 mr-2" />
                      Extend Stay
                    </Button>
                    <Button onClick={() => handleCheckOut(selectedStay)} className="rounded-full bg-green-600 hover:bg-green-700">
                      <LogOut className="w-4 h-4 mr-2" />
                      Check Out & Complete
                    </Button>
                  </>
                )}
                {selectedStay.status === 'completed' && (
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
                    <p className="font-medium text-green-800">Stay Completed</p>
                    <p className="text-sm text-green-600">Ready for billing</p>
                  </div>
                )}
                {/* Edit button - always available */}
                <Button 
                  onClick={() => { setActionModalOpen(false); openEditModal(selectedStay); }} 
                  variant="outline" 
                  className="rounded-full"
                >
                  <Calendar className="w-4 h-4 mr-2" />
                  Edit Dates
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Extend Stay Modal */}
      <Dialog open={extendModalOpen} onOpenChange={setExtendModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-blue-600" />
              Extend Stay
            </DialogTitle>
            <DialogDescription>
              Extend the stay for {selectedStay?.pet_names?.join(', ') || 'this pet'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground">Current check-out date</p>
              <p className="font-medium">{selectedStay?.end_date || selectedStay?.scheduled_date}</p>
            </div>
            <div className="space-y-2">
              <Label>Extend by</Label>
              <Select value={extendDays.toString()} onValueChange={(v) => setExtendDays(parseInt(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6, 7].map(d => (
                    <SelectItem key={d} value={d.toString()}>
                      {d} {d === 1 ? 'night' : 'nights'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExtendModalOpen(false)} className="rounded-full">
              Cancel
            </Button>
            <Button onClick={handleExtendStay} className="rounded-full">
              Extend Stay
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Stay Modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-600" />
              Edit Stay Dates
            </DialogTitle>
            <DialogDescription>
              Edit the dates for {selectedStay?.pet_names?.join(', ') || 'this pet'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-3 rounded-lg bg-purple-50">
              <p className="text-sm font-medium">{selectedStay?.pet_names?.join(', ') || 'Pet'}</p>
              <p className="text-xs text-muted-foreground">{selectedStay?.client_name} • {getServiceLabel(selectedStay?.service_type)}</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date (Check-in)</Label>
                <Input
                  type="date"
                  value={editForm.scheduled_date}
                  onChange={(e) => setEditForm({...editForm, scheduled_date: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label>End Date (Check-out)</Label>
                <Input
                  type="date"
                  value={editForm.end_date}
                  onChange={(e) => setEditForm({...editForm, end_date: e.target.value})}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={editForm.status} onValueChange={(v) => setEditForm({...editForm, status: v})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="scheduled">Scheduled (Not checked in)</SelectItem>
                  <SelectItem value="in_progress">In Progress (Checked in)</SelectItem>
                  <SelectItem value="completed">Completed (Checked out)</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditModalOpen(false)} className="rounded-full">
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} className="rounded-full">
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default AdminOvernightsPage;
