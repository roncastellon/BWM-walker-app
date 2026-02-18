import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../components/ui/dialog';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { 
  Sun, Calendar, Clock, PawPrint, CheckCircle, 
  ChevronLeft, ChevronRight, LogIn, LogOut, RefreshCw, User
} from 'lucide-react';
import { toast } from 'sonner';

const AdminDaycareCalendarPage = () => {
  const { api } = useAuth();
  const [daycareAppts, setDaycareAppts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedAppt, setSelectedAppt] = useState(null);
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [checkoutNotes, setCheckoutNotes] = useState('');

  useEffect(() => {
    fetchDaycare();
  }, [currentDate]);

  const fetchDaycare = async () => {
    setLoading(true);
    try {
      const res = await api.get('/appointments/calendar');
      // Filter daycare appointments - match multiple daycare service types
      const daycareTypes = ['doggy_day_care', 'doggy_day_camp', 'day_care', 'day_camp', 'day_visit'];
      const filtered = res.data.filter(a => 
        daycareTypes.some(type => 
          a.service_type?.toLowerCase().includes(type.toLowerCase()) ||
          type.toLowerCase().includes(a.service_type?.toLowerCase())
        )
      );
      setDaycareAppts(filtered);
    } catch (error) {
      console.error('Failed to load daycare:', error);
      toast.error('Failed to load daycare appointments');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return '';
    try {
      const date = new Date(timeStr);
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    } catch {
      // Handle HH:MM format
      const [hours, minutes] = timeStr.split(':');
      const hour = parseInt(hours);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const hour12 = hour % 12 || 12;
      return `${hour12}:${minutes} ${ampm}`;
    }
  };

  const navigateDate = (days) => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + days);
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const getApptsForDate = (dateStr) => {
    return daycareAppts.filter(appt => appt.scheduled_date === dateStr);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'scheduled': return 'bg-yellow-100 text-yellow-800';
      case 'in_progress': return 'bg-orange-100 text-orange-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Check-in for daycare
  const handleCheckIn = async (appt) => {
    try {
      await api.put(`/appointments/${appt.id}`, {
        status: 'in_progress',
        start_time: new Date().toISOString()
      });
      toast.success(`${appt.pet_names?.join(', ') || 'Pet'} checked in for daycare!`);
      fetchDaycare();
      setActionModalOpen(false);
    } catch (error) {
      toast.error('Failed to check in');
    }
  };

  // Pick-up / Complete daycare
  const handlePickup = async () => {
    if (!selectedAppt) return;
    try {
      await api.put(`/appointments/${selectedAppt.id}`, {
        status: 'completed',
        end_time: new Date().toISOString(),
        walker_notes: checkoutNotes || undefined
      });
      toast.success(`${selectedAppt.pet_names?.join(', ') || 'Pet'} picked up! Daycare complete.`);
      fetchDaycare();
      setActionModalOpen(false);
      setCheckoutNotes('');
    } catch (error) {
      toast.error('Failed to complete pickup');
    }
  };

  const openApptDetails = (appt) => {
    setSelectedAppt(appt);
    setCheckoutNotes('');
    setActionModalOpen(true);
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
  const todayAppts = getApptsForDate(today);
  const checkedIn = todayAppts.filter(a => a.status === 'in_progress');
  const awaitingCheckIn = todayAppts.filter(a => a.status === 'scheduled');

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
      <div className="space-y-4 px-2 sm:px-0" data-testid="admin-daycare-page">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-heading font-bold flex items-center gap-2">
              <Sun className="w-6 h-6 text-orange-500" />
              Daycare Calendar
            </h1>
            <p className="text-sm text-muted-foreground">Manage daily daycare check-ins and pick-ups</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchDaycare} className="rounded-full">
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={goToToday} className="rounded-full">
              Today
            </Button>
          </div>
        </div>

        {/* Today's Summary */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="rounded-xl border-orange-200 bg-orange-50/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-orange-200 flex items-center justify-center">
                  <LogIn className="w-5 h-5 text-orange-700" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-orange-700">{checkedIn.length}</p>
                  <p className="text-xs text-orange-600">Currently Here</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-xl border-yellow-200 bg-yellow-50/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-yellow-200 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-yellow-700" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-yellow-700">{awaitingCheckIn.length}</p>
                  <p className="text-xs text-yellow-600">Awaiting Check-in</p>
                </div>
              </div>
            </CardContent>
          </Card>
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
            const appts = getApptsForDate(dateStr);
            
            return (
              <Card 
                key={dateStr} 
                className={`rounded-xl ${isToday ? 'border-2 border-orange-500 bg-orange-50/50' : ''}`}
              >
                <CardHeader className="p-2 pb-1">
                  <p className={`text-xs font-medium ${isToday ? 'text-orange-700' : 'text-muted-foreground'}`}>
                    {date.toLocaleDateString('en-US', { weekday: 'short' })}
                  </p>
                  <p className={`text-lg font-bold ${isToday ? 'text-orange-700' : ''}`}>
                    {date.getDate()}
                  </p>
                </CardHeader>
                <CardContent className="p-2 pt-0 space-y-1">
                  {appts.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-2">-</p>
                  ) : (
                    appts.map(appt => (
                      <div
                        key={appt.id}
                        onClick={() => openApptDetails(appt)}
                        className={`p-2 rounded-lg cursor-pointer text-xs transition-colors
                          ${appt.status === 'in_progress' ? 'bg-orange-100 hover:bg-orange-200' : 
                            appt.status === 'completed' ? 'bg-green-100 hover:bg-green-200' : 
                            'bg-yellow-100 hover:bg-yellow-200'}`}
                      >
                        <div className="flex items-center gap-1 mb-1">
                          <PawPrint className="w-3 h-3" />
                          <span className="font-medium truncate">{appt.pet_names?.[0] || 'Pet'}</span>
                        </div>
                        <Badge className={`${getStatusColor(appt.status)} rounded-full text-[10px] py-0`}>
                          {appt.status === 'in_progress' ? 'Here' : 
                           appt.status === 'completed' ? 'Done' : 'Expected'}
                        </Badge>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Today's Daycare List */}
        <Card className="rounded-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Sun className="w-5 h-5 text-orange-500" />
              Today's Daycare
            </CardTitle>
          </CardHeader>
          <CardContent>
            {todayAppts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No daycare scheduled for today</p>
            ) : (
              <div className="space-y-2">
                {todayAppts.map(appt => (
                  <div
                    key={appt.id}
                    onClick={() => openApptDetails(appt)}
                    className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors
                      ${appt.status === 'in_progress' ? 'bg-orange-50 hover:bg-orange-100' : 
                        appt.status === 'completed' ? 'bg-green-50 hover:bg-green-100' : 
                        'bg-yellow-50 hover:bg-yellow-100'}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center
                        ${appt.status === 'in_progress' ? 'bg-orange-200' : 
                          appt.status === 'completed' ? 'bg-green-200' : 'bg-yellow-200'}`}>
                        <PawPrint className={`w-5 h-5 
                          ${appt.status === 'in_progress' ? 'text-orange-700' : 
                            appt.status === 'completed' ? 'text-green-700' : 'text-yellow-700'}`} />
                      </div>
                      <div>
                        <p className="font-medium">{appt.pet_names?.join(', ') || 'Pet'}</p>
                        <p className="text-xs text-muted-foreground">{appt.client_name}</p>
                        {appt.start_time && (
                          <p className="text-xs text-muted-foreground">
                            Checked in: {formatTime(appt.start_time)}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={`${getStatusColor(appt.status)} rounded-full`}>
                        {appt.status === 'in_progress' ? 'Checked In' : 
                         appt.status === 'completed' ? 'Picked Up' : 'Expected'}
                      </Badge>
                      {appt.status === 'scheduled' && (
                        <Button 
                          size="sm" 
                          onClick={(e) => { e.stopPropagation(); handleCheckIn(appt); }}
                          className="rounded-full bg-green-600 hover:bg-green-700 h-8"
                        >
                          <LogIn className="w-3 h-3 mr-1" />
                          Check In
                        </Button>
                      )}
                      {appt.status === 'in_progress' && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={(e) => { e.stopPropagation(); openApptDetails(appt); }}
                          className="rounded-full h-8"
                        >
                          <LogOut className="w-3 h-3 mr-1" />
                          Pick Up
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Appointment Details / Pickup Modal */}
      <Dialog open={actionModalOpen} onOpenChange={setActionModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sun className="w-5 h-5 text-orange-500" />
              Daycare Details
            </DialogTitle>
          </DialogHeader>
          {selectedAppt && (
            <div className="space-y-4 py-2">
              <div className="p-4 rounded-lg bg-orange-50">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-full bg-orange-200 flex items-center justify-center">
                    <PawPrint className="w-6 h-6 text-orange-700" />
                  </div>
                  <div>
                    <p className="font-bold text-lg">{selectedAppt.pet_names?.join(', ') || 'Pet'}</p>
                    <p className="text-sm text-muted-foreground">{selectedAppt.client_name}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-muted-foreground">Date</p>
                    <p className="font-medium">{selectedAppt.scheduled_date}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Status</p>
                    <Badge className={`${getStatusColor(selectedAppt.status)} rounded-full`}>
                      {selectedAppt.status}
                    </Badge>
                  </div>
                  {selectedAppt.start_time && (
                    <div>
                      <p className="text-muted-foreground">Checked In</p>
                      <p className="font-medium">{formatTime(selectedAppt.start_time)}</p>
                    </div>
                  )}
                  {selectedAppt.end_time && (
                    <div>
                      <p className="text-muted-foreground">Picked Up</p>
                      <p className="font-medium">{formatTime(selectedAppt.end_time)}</p>
                    </div>
                  )}
                </div>
              </div>
              
              {selectedAppt.status === 'scheduled' && (
                <Button onClick={() => handleCheckIn(selectedAppt)} className="w-full rounded-full bg-green-600 hover:bg-green-700">
                  <LogIn className="w-4 h-4 mr-2" />
                  Check In
                </Button>
              )}
              
              {selectedAppt.status === 'in_progress' && (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>Pickup Notes (optional)</Label>
                    <Textarea
                      placeholder="How was their day? Any notes for the owner..."
                      value={checkoutNotes}
                      onChange={(e) => setCheckoutNotes(e.target.value)}
                      rows={2}
                    />
                  </div>
                  <Button onClick={handlePickup} className="w-full rounded-full bg-blue-600 hover:bg-blue-700">
                    <LogOut className="w-4 h-4 mr-2" />
                    Complete Pick Up
                  </Button>
                </div>
              )}
              
              {selectedAppt.status === 'completed' && (
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
                  <p className="font-medium text-green-800">Daycare Complete</p>
                  <p className="text-sm text-green-600">Pet has been picked up</p>
                  {selectedAppt.walker_notes && (
                    <p className="text-sm mt-2 text-muted-foreground">Notes: {selectedAppt.walker_notes}</p>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default AdminDaycareCalendarPage;
