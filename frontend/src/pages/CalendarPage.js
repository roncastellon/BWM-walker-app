import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuLabel,
  ContextMenuTrigger,
} from '../components/ui/context-menu';
import { 
  Clock, User, PawPrint, ChevronLeft, ChevronRight, 
  CalendarDays, CalendarRange, Calendar as CalendarIcon,
  MapPin, Phone, Mail, X, Plus, Edit, Trash2, Save,
  UserCheck, CheckCircle, PlayCircle, XCircle, RotateCcw, Users
} from 'lucide-react';
import { 
  format, addDays, subDays, addWeeks, subWeeks, addMonths, subMonths,
  startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval,
  isSameMonth, isToday
} from 'date-fns';
import { toast } from 'sonner';

// Helper function to format 24-hour time to 12-hour AM/PM format
const formatTime12Hour = (timeStr) => {
  if (!timeStr) return '';
  const [hours, minutes] = timeStr.split(':');
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
};

const CalendarPage = () => {
  const { api, isAdmin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [appointments, setAppointments] = useState([]);
  const [walkers, setWalkers] = useState([]);
  const [sitters, setSitters] = useState([]);
  const [clients, setClients] = useState([]);
  const [services, setServices] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedWalker, setSelectedWalker] = useState('all');
  const [selectedServiceCategory, setSelectedServiceCategory] = useState('all');
  const [viewMode, setViewMode] = useState('day'); // Default to day view
  const [loading, setLoading] = useState(true);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [appointmentDetail, setAppointmentDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [allPets, setAllPets] = useState([]); // All pets for search
  const [petSearchQuery, setPetSearchQuery] = useState(''); // Pet search input
  
  // Batch scheduling mode state
  const [scheduleMode, setScheduleMode] = useState(null); // null, 'single', or 'batch'
  const [batchWalkerId, setBatchWalkerId] = useState(''); // Walker for batch mode
  const [batchWalks, setBatchWalks] = useState([]); // Walks added in batch mode
  const [walkerPets, setWalkerPets] = useState([]); // Pets this walker has walked before
  const [numWalks, setNumWalks] = useState(1); // Number of walks to add
  const [walkTimes, setWalkTimes] = useState(['']); // Time for each walk
  
  // Service categories for filtering
  const SERVICE_CATEGORIES = [
    { value: 'all', label: 'All Services' },
    { value: 'walks', label: 'Walks', match: ['walk_30', 'walk_45', 'walk_60'] },
    { value: 'daycare', label: 'Day Care', match: ['doggy_day_care', 'doggy_day_camp', 'day_visit', 'concierge'] },
    { value: 'overnight', label: 'Overnights', match: ['overnight', 'stay_overnight', 'petsit_our_location', 'petsit_your_location'] },
    { value: 'transport', label: 'Transport', match: ['transport'] },
  ];
  
  // Helper functions for day/night services
  const getDurationTypeForService = (serviceType) => {
    if (!serviceType) return 'minutes';
    const st = serviceType.toLowerCase().replace(/[_\-\s]+/g, ''); // Normalize: remove underscores, dashes, spaces
    
    const dayPatterns = ['daycare', 'daycamp', 'dayvisit', 'doggyda'];
    const nightPatterns = ['overnight', 'petsit', 'boarding', 'stay', 'sitting'];
    
    if (dayPatterns.some(p => st.includes(p))) return 'days';
    if (nightPatterns.some(p => st.includes(p))) return 'nights';
    return 'minutes';
  };
  
  const isDayNightService = (serviceType) => {
    if (!serviceType) return false;
    const durationType = getDurationTypeForService(serviceType);
    return durationType === 'days' || durationType === 'nights';
  };
  
  // Check if service is a walk type (requires walker)
  const isWalkService = (serviceType) => {
    if (!serviceType) return false;
    return serviceType.toLowerCase().includes('walk');
  };
  
  // Check if service is an overnight type (can have optional sitter)
  const isOvernightService = (serviceType) => {
    if (!serviceType) return false;
    const overnightTypes = ['overnight', 'stay_overnight', 'petsit_our_location', 'petsit_your_location'];
    return overnightTypes.some(t => serviceType.toLowerCase().includes(t));
  };
  
  // Admin add/edit appointment state
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedClientPets, setSelectedClientPets] = useState([]);
  const [formData, setFormData] = useState({
    client_id: '',
    walker_id: '',
    sitter_id: '',
    pet_ids: [],
    service_type: '',
    scheduled_date: '',
    end_date: '',
    scheduled_time: '',
    notes: '',
    status: 'scheduled',
    duration_value: 1,
    duration_type: 'minutes',
    walk_count: 1  // Number of walks to create on the same day
  });

  useEffect(() => {
    fetchData();
  }, []);

  // Handle highlight parameter from URL (from dashboard clicks)
  useEffect(() => {
    const highlightId = searchParams.get('highlight');
    if (highlightId && appointments.length > 0) {
      const appt = appointments.find(a => a.id === highlightId);
      if (appt) {
        openAppointmentDetail(appt);
        // Clear the highlight param from URL
        setSearchParams({});
      }
    }
  }, [searchParams, appointments]);

  // Handle action=add parameter from URL (from "Add Appointment" dashboard card)
  useEffect(() => {
    const action = searchParams.get('action');
    if (action === 'add' && isAdmin && !loading) {
      openAddDialog();
      // Clear the action param from URL
      setSearchParams({});
    }
  }, [searchParams, isAdmin, loading]);

  const fetchData = async () => {
    try {
      const requests = [
        api.get('/appointments/calendar'),
        api.get('/users/walkers'),
        api.get('/services'),
      ];
      
      if (isAdmin) {
        requests.push(api.get('/users/clients'));
        requests.push(api.get('/users/sitters').catch(() => ({ data: [] }))); // Sitters may not exist
        requests.push(api.get('/pets')); // Fetch all pets for search
      }
      
      const responses = await Promise.all(requests);
      setAppointments(responses[0].data);
      setWalkers(responses[1].data);
      setServices(responses[2].data);
      
      if (isAdmin) {
        if (responses[3]) setClients(responses[3].data);
        if (responses[4]) setSitters(responses[4].data);
        if (responses[5]) setAllPets(responses[5].data);
      }
    } catch (error) {
      toast.error('Failed to load calendar data');
    } finally {
      setLoading(false);
    }
  };

  const fetchClientPets = async (clientId) => {
    if (!clientId) {
      setSelectedClientPets([]);
      return;
    }
    try {
      const response = await api.get(`/pets?owner_id=${clientId}`);
      setSelectedClientPets(response.data);
      // Auto-select all pets when client is selected
      if (response.data.length > 0) {
        setFormData(prev => ({
          ...prev,
          pet_ids: response.data.map(pet => pet.id)
        }));
      }
    } catch (error) {
      setSelectedClientPets([]);
    }
  };

  // Handle pet selection - auto-sets client and loads their other pets (all pre-selected)
  const handlePetSelect = async (pet) => {
    if (!pet) return;
    
    // Set client from pet's owner
    const clientId = pet.owner_id;
    
    // Fetch all pets for this client and pre-select ALL of them
    try {
      const response = await api.get(`/pets?owner_id=${clientId}`);
      const clientPets = response.data;
      setSelectedClientPets(clientPets);
      
      // Pre-select ALL pets from this owner
      setFormData(prev => ({
        ...prev,
        client_id: clientId,
        pet_ids: clientPets.map(p => p.id)
      }));
    } catch (error) {
      setSelectedClientPets([pet]);
      setFormData(prev => ({
        ...prev,
        client_id: clientId,
        pet_ids: [pet.id]
      }));
    }
    
    setPetSearchQuery(''); // Clear search
  };

  // Group pets by owner for search results - show all pet names together
  const getOwnerPetNames = (ownerId) => {
    const ownerPets = allPets.filter(p => p.owner_id === ownerId);
    return ownerPets.map(p => p.name).join(' & ');
  };

  // Filter pets based on search query
  const filteredPets = petSearchQuery.length >= 1
    ? allPets.filter(pet => 
        pet.name?.toLowerCase().includes(petSearchQuery.toLowerCase())
      )
    : [];

  const openAppointmentDetail = async (appt) => {
    setSelectedAppointment(appt);
    setDetailLoading(true);
    try {
      const response = await api.get(`/appointments/${appt.id}/detail`);
      setAppointmentDetail(response.data);
    } catch (error) {
      toast.error('Failed to load appointment details');
      setAppointmentDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const closeAppointmentDetail = () => {
    setSelectedAppointment(null);
    setAppointmentDetail(null);
    setEditMode(false);
  };

  const assignWalker = async (apptId, walkerId) => {
    try {
      await api.put(`/appointments/${apptId}`, { walker_id: walkerId });
      toast.success('Walker assigned successfully');
      fetchData();
      if (selectedAppointment?.id === apptId) {
        const response = await api.get(`/appointments/${apptId}/detail`);
        setAppointmentDetail(response.data);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to assign walker');
    }
  };

  const openAddDialog = (date = null) => {
    const initialDate = date ? format(date, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');
    setFormData({
      client_id: '',
      walker_id: '',
      sitter_id: '',
      pet_ids: [],
      service_type: '',
      scheduled_date: initialDate,
      end_date: initialDate, // Default end_date to same as start for overnight services
      scheduled_time: '',
      notes: '',
      status: 'scheduled',
      duration_value: 1,
      duration_type: 'minutes'
    });
    setSelectedClientPets([]);
    setPetSearchQuery(''); // Clear pet search
    setScheduleMode(null); // Show mode selection first
    setBatchWalkerId('');
    setBatchWalks([]);
    setWalkerPets([]); // Clear walker's pets
    setAddDialogOpen(true);
  };

  // Start batch scheduling for a specific walker - fetch their walked pets
  const startBatchScheduling = async (walkerId) => {
    setBatchWalkerId(walkerId);
    setBatchWalks([]);
    setFormData(prev => ({
      ...prev,
      walker_id: walkerId
    }));
    
    // Fetch pets this walker has walked before
    try {
      const response = await api.get('/appointments/calendar');
      const walkerAppts = response.data.filter(a => 
        a.walker_id === walkerId && 
        isWalkService(a.service_type)
      );
      
      // Extract unique pet IDs from walker's history
      const walkedPetIds = new Set();
      walkerAppts.forEach(a => {
        if (a.pet_ids) {
          a.pet_ids.forEach(id => walkedPetIds.add(id));
        }
      });
      
      // Get full pet objects that this walker has walked
      const walkedPets = allPets.filter(p => walkedPetIds.has(p.id));
      
      // Group by owner and deduplicate - only show one entry per owner
      const ownersSeen = new Set();
      const uniqueOwnerPets = [];
      
      // Sort by pet name first
      walkedPets.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      
      for (const pet of walkedPets) {
        if (!ownersSeen.has(pet.owner_id)) {
          ownersSeen.add(pet.owner_id);
          uniqueOwnerPets.push(pet);
        }
      }
      
      setWalkerPets(uniqueOwnerPets);
    } catch (error) {
      console.error('Failed to fetch walker pets:', error);
      setWalkerPets([]);
    }
  };

  // Add walk to batch (doesn't save yet, just adds to list)
  const addToBatch = () => {
    if (!formData.client_id || !formData.service_type || !formData.scheduled_time) {
      toast.error('Please fill in pet, service, and time');
      return;
    }
    
    const walk = {
      ...formData,
      walker_id: batchWalkerId,
      id: `temp-${Date.now()}`, // Temporary ID for display
      pet_names: selectedClientPets.filter(p => formData.pet_ids.includes(p.id)).map(p => p.name),
      client_name: clients.find(c => c.id === formData.client_id)?.full_name || 'Unknown'
    };
    
    setBatchWalks(prev => [...prev, walk]);
    
    // Reset form for next walk (keep date and walker)
    setFormData(prev => ({
      ...prev,
      client_id: '',
      pet_ids: [],
      service_type: '',
      scheduled_time: '',
      notes: ''
    }));
    setSelectedClientPets([]);
    setPetSearchQuery('');
    
    toast.success('Walk added to schedule');
  };

  // Save all batch walks
  const saveBatchSchedule = async () => {
    if (batchWalks.length === 0) {
      toast.error('No walks to save');
      return;
    }
    
    try {
      for (const walk of batchWalks) {
        const { id, pet_names, client_name, ...walkData } = walk;
        await api.post('/appointments/admin', {
          ...walkData,
          duration_type: 'minutes'
        });
      }
      
      const walkerName = walkers.find(w => w.id === batchWalkerId)?.full_name || 'Walker';
      toast.success(`${batchWalks.length} walks scheduled for ${walkerName}!`);
      
      setBatchWalks([]);
      setBatchWalkerId('');
      setScheduleMode(null);
      setAddDialogOpen(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save schedule');
    }
  };

  // Remove walk from batch
  const removeFromBatch = (tempId) => {
    setBatchWalks(prev => prev.filter(w => w.id !== tempId));
  };

  const openEditDialog = () => {
    if (!appointmentDetail) return;
    setFormData({
      client_id: appointmentDetail.client_id || '',
      walker_id: appointmentDetail.walker_id || '',
      sitter_id: appointmentDetail.sitter_id || '',
      pet_ids: appointmentDetail.pet_ids || [],
      service_type: appointmentDetail.service_type || '',
      scheduled_date: appointmentDetail.scheduled_date || '',
      end_date: appointmentDetail.end_date || appointmentDetail.scheduled_date || '',
      scheduled_time: appointmentDetail.scheduled_time || '',
      notes: appointmentDetail.notes || '',
      status: appointmentDetail.status || 'scheduled',
      duration_value: appointmentDetail.duration_value || 1,
      duration_type: appointmentDetail.duration_type || 'minutes'
    });
    fetchClientPets(appointmentDetail.client_id);
    setEditMode(true);
  };

  // End stay early - set end_date to today and mark as completed
  const handleEndStayEarly = async () => {
    if (!appointmentDetail) return;
    
    const today = format(new Date(), 'yyyy-MM-dd');
    const confirmMsg = `End this stay early? The stay will be marked as completed with an end date of ${today}. Any remaining days will be cancelled.`;
    
    if (!window.confirm(confirmMsg)) return;
    
    try {
      await api.put(`/appointments/${appointmentDetail.id}`, { 
        end_date: today,
        status: 'completed'
      });
      toast.success('Stay ended early and marked as completed');
      closeAppointmentDetail();
      fetchData();
    } catch (error) {
      toast.error('Failed to end stay early');
    }
  };

  // Admin force-complete a walk (for missed or unclosed appointments)
  const handleAdminComplete = async () => {
    if (!appointmentDetail) return;
    
    const confirmMsg = `Mark this walk as completed? This will close the appointment as if it was completed normally.`;
    
    if (!window.confirm(confirmMsg)) return;
    
    try {
      await api.post(`/appointments/${appointmentDetail.id}/admin-complete`);
      toast.success('Walk marked as completed');
      closeAppointmentDetail();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to complete appointment');
    }
  };

  const handleCreateAppointment = async (e) => {
    e.preventDefault();
    
    const isDayNight = isDayNightService(formData.service_type);
    
    if (!formData.client_id || !formData.service_type || !formData.scheduled_date) {
      toast.error('Please fill in all required fields');
      return;
    }
    
    // For time-based services, time is required
    if (!isDayNight && !formData.scheduled_time) {
      toast.error('Please select a time');
      return;
    }
    
    // For overnight/daycare services, end_date is required
    if (isDayNight && !formData.end_date) {
      toast.error('Please select an end date for overnight/daycare services');
      return;
    }
    
    try {
      if (isDayNight) {
        // For overnight/day services, create a SINGLE appointment with start and end dates
        // This creates ONE stay, not multiple daily appointments
        await api.post('/appointments/admin', {
          ...formData,
          scheduled_time: '',
          duration_type: getDurationTypeForService(formData.service_type)
        });
        
        const startDate = new Date(formData.scheduled_date);
        const endDate = new Date(formData.end_date);
        const nights = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
        const durationLabel = getDurationTypeForService(formData.service_type) === 'days' ? 'day' : 'night';
        toast.success(`${nights} ${durationLabel}${nights > 1 ? 's' : ''} stay created successfully`);
      } else {
        // Regular time-based appointment - check if we need multiple walks
        const walkCount = isWalkService(formData.service_type) ? (formData.walk_count || 1) : 1;
        
        if (walkCount > 1) {
          // Create multiple walks at the same time
          for (let i = 0; i < walkCount; i++) {
            await api.post('/appointments/admin', {
              ...formData,
              duration_type: 'minutes',
              notes: formData.notes ? `${formData.notes} (Walk ${i + 1} of ${walkCount})` : `Walk ${i + 1} of ${walkCount}`
            });
          }
          toast.success(`${walkCount} walks created successfully`);
        } else {
          await api.post('/appointments/admin', {
            ...formData,
            duration_type: 'minutes'
          });
          toast.success('Appointment created successfully');
        }
      }
      
      setAddDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error('Create appointment error:', error.response?.data || error.message);
      const errorMsg = error.response?.data?.detail || error.message || 'Failed to create appointment';
      toast.error(errorMsg);
    }
  };

  const handleUpdateAppointment = async () => {
    if (!appointmentDetail) return;
    
    try {
      await api.put(`/appointments/${appointmentDetail.id}`, formData);
      toast.success('Appointment updated successfully');
      setEditMode(false);
      closeAppointmentDetail();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update appointment');
    }
  };

  const handleDeleteAppointment = async () => {
    if (!appointmentDetail || !window.confirm('Are you sure you want to cancel this appointment?')) return;
    
    try {
      await api.put(`/appointments/${appointmentDetail.id}`, { status: 'cancelled' });
      toast.success('Appointment cancelled');
      closeAppointmentDetail();
      fetchData();
    } catch (error) {
      toast.error('Failed to cancel appointment');
    }
  };

  // Quick Action handlers for context menu
  const quickAssignWalker = async (apptId, walkerId) => {
    try {
      await api.put(`/appointments/${apptId}`, { walker_id: walkerId });
      toast.success('Walker assigned');
      fetchData();
    } catch (error) {
      toast.error('Failed to assign walker');
    }
  };

  const quickChangeStatus = async (apptId, newStatus) => {
    try {
      await api.put(`/appointments/${apptId}`, { status: newStatus });
      const statusLabels = {
        scheduled: 'Scheduled',
        in_progress: 'In Progress',
        completed: 'Completed',
        cancelled: 'Cancelled'
      };
      toast.success(`Status changed to ${statusLabels[newStatus]}`);
      fetchData();
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const quickReschedule = (appt) => {
    // Open the edit dialog with pre-filled data
    setFormData({
      client_id: appt.client_id || '',
      walker_id: appt.walker_id || '',
      sitter_id: appt.sitter_id || '',
      pet_ids: appt.pet_ids || [],
      service_type: appt.service_type || '',
      scheduled_date: appt.scheduled_date || '',
      end_date: appt.end_date || '',
      scheduled_time: appt.scheduled_time || '',
      notes: appt.notes || '',
      status: appt.status || 'scheduled',
      duration_value: appt.duration_value || 1,
      duration_type: appt.duration_type || 'minutes'
    });
    fetchClientPets(appt.client_id);
    openAppointmentDetail(appt);
    setTimeout(() => setEditMode(true), 100);
  };

  const getWalkerColor = (walkerId) => {
    const walker = walkers.find(w => w.id === walkerId);
    return walker?.walker_color || '#9CA3AF';
  };

  const getWalkerName = (walkerId) => {
    const walker = walkers.find(w => w.id === walkerId);
    return walker?.full_name || 'Unassigned';
  };

  // Get location label for overnight services
  const getLocationLabel = (serviceType) => {
    if (serviceType === 'petsit_our_location') return 'Our Location';
    if (serviceType === 'petsit_your_location') return "Client's Home";
    return null;
  };

  const getAppointmentStyles = (appt) => {
    const color = appt.walker_id ? getWalkerColor(appt.walker_id) : '#9CA3AF';
    return {
      backgroundColor: `${color}20`,
      borderColor: color,
      borderWidth: '2px',
      borderStyle: 'solid',
    };
  };

  const getStatusBadgeColor = (status) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-100 text-blue-800';
      case 'in_progress': return 'bg-yellow-100 text-yellow-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const filterAppointments = (date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return appointments.filter(appt => {
      // For multi-day appointments (overnights/daycare), check if date falls within range
      let dateMatch = false;
      if (appt.end_date && appt.end_date !== appt.scheduled_date) {
        // Multi-day appointment: check if date is within start and end
        dateMatch = dateStr >= appt.scheduled_date && dateStr <= appt.end_date;
      } else {
        // Single day appointment: exact match
        dateMatch = appt.scheduled_date === dateStr;
      }
      
      const walkerMatch = selectedWalker === 'all' || 
                          appt.walker_id === selectedWalker || 
                          (!appt.walker_id && selectedWalker === 'unassigned');
      const notCancelled = appt.status !== 'cancelled';
      
      // Service category filter
      let serviceMatch = true;
      if (selectedServiceCategory !== 'all') {
        const category = SERVICE_CATEGORIES.find(c => c.value === selectedServiceCategory);
        if (category && category.match) {
          serviceMatch = category.match.some(type => 
            appt.service_type?.toLowerCase().includes(type.toLowerCase()) ||
            type.toLowerCase().includes(appt.service_type?.toLowerCase())
          );
        }
      }
      
      return dateMatch && walkerMatch && notCancelled && serviceMatch;
    });
  };

  const navigate = (direction) => {
    if (viewMode === 'day') {
      setCurrentDate(direction === 'next' ? addDays(currentDate, 1) : subDays(currentDate, 1));
    } else if (viewMode === 'week') {
      setCurrentDate(direction === 'next' ? addWeeks(currentDate, 1) : subWeeks(currentDate, 1));
    } else {
      setCurrentDate(direction === 'next' ? addMonths(currentDate, 1) : subMonths(currentDate, 1));
    }
  };

  const goToToday = () => setCurrentDate(new Date());

  const getViewDates = () => {
    if (viewMode === 'day') {
      return [currentDate];
    } else if (viewMode === 'week') {
      const start = startOfWeek(currentDate, { weekStartsOn: 0 });
      const end = endOfWeek(currentDate, { weekStartsOn: 0 });
      return eachDayOfInterval({ start, end });
    } else {
      const start = startOfMonth(currentDate);
      const end = endOfMonth(currentDate);
      return eachDayOfInterval({ start, end });
    }
  };

  const getViewTitle = () => {
    if (viewMode === 'day') {
      return format(currentDate, 'EEEE, MMMM d, yyyy');
    } else if (viewMode === 'week') {
      const start = startOfWeek(currentDate, { weekStartsOn: 0 });
      const end = endOfWeek(currentDate, { weekStartsOn: 0 });
      return `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`;
    } else {
      return format(currentDate, 'MMMM yyyy');
    }
  };

  // Generate 15-minute increment time slots
  // Generate time slots with 12-hour labels but 24-hour values for API
  const generateTimeSlots = () => {
    const slots = [];
    for (let hour = 6; hour <= 20; hour++) {
      for (let min = 0; min < 60; min += 15) {
        const h24 = hour.toString().padStart(2, '0');
        const m = min.toString().padStart(2, '0');
        const value = `${h24}:${m}`;
        
        // Convert to 12-hour format for label
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const h12 = hour % 12 || 12;
        const label = `${h12}:${m} ${ampm}`;
        
        slots.push({ value, label });
      }
    }
    return slots;
  };
  
  const timeSlots = generateTimeSlots();

  const renderAppointmentCard = (appt, compact = false) => {
    const isDayNight = isDayNightService(appt.service_type);
    const isCheckInDay = isDayNight && appt.status === 'scheduled' && appt.scheduled_date === format(new Date(), 'yyyy-MM-dd');
    
    const appointmentContent = (
      <div
        className={`p-2 rounded-lg cursor-pointer hover:opacity-80 transition-opacity ${compact ? 'text-xs' : ''} ${
          isCheckInDay ? 'border-2 border-red-400' : ''
        }`}
        style={getAppointmentStyles(appt)}
        data-testid={`calendar-appt-${appt.id}`}
        onClick={() => openAppointmentDetail(appt)}
      >
        <div className="flex items-center justify-between gap-1">
          <span className="font-medium">{appt.scheduled_time ? formatTime12Hour(appt.scheduled_time) : 'All Day'}</span>
          {!compact && (
            isDayNight ? (
              // Special status display for overnight/daycare
              <div className="flex flex-col items-end gap-0.5">
                {appt.status === 'scheduled' ? (
                  <Badge className="text-[10px] rounded-full bg-red-500 text-white font-bold">
                    CHECK IN
                  </Badge>
                ) : appt.status === 'in_progress' ? (
                  <Badge className="text-[10px] rounded-full bg-green-100 text-green-800">
                    Checked In
                  </Badge>
                ) : appt.status === 'completed' ? (
                  <>
                    <Badge className="text-[9px] rounded-full bg-green-100 text-green-700 py-0">
                      Checked In
                    </Badge>
                    <Badge className="text-[9px] rounded-full bg-green-500 text-white py-0">
                      Checked Out
                    </Badge>
                  </>
                ) : (
                  <Badge className={`${getStatusBadgeColor(appt.status)} text-xs rounded-full`}>
                    {appt.status}
                  </Badge>
                )}
              </div>
            ) : (
              <Badge className={`${getStatusBadgeColor(appt.status)} text-xs rounded-full`}>
                {appt.status}
              </Badge>
            )
          )}
        </div>
        <p className={`${compact ? 'truncate' : ''}`}>
          {appt.pet_names?.length > 0 ? appt.pet_names.join(', ') : appt.client_name}
        </p>
        {!compact && (
          <p className="text-xs text-muted-foreground capitalize">
            {appt.service_type?.replace(/_/g, ' ')} • {getWalkerName(appt.walker_id)}
          </p>
        )}
      </div>
    );

    // Only show context menu for admins
    if (!isAdmin) {
      return <div key={appt.id}>{appointmentContent}</div>;
    }

    return (
      <ContextMenu key={appt.id}>
        <ContextMenuTrigger asChild>
          {appointmentContent}
        </ContextMenuTrigger>
        <ContextMenuContent className="w-56">
          <ContextMenuLabel className="flex items-center gap-2">
            <CalendarIcon className="w-4 h-4" />
            Quick Actions
          </ContextMenuLabel>
          <ContextMenuSeparator />
          
          {/* Status Changes */}
          <ContextMenuSub>
            <ContextMenuSubTrigger className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Change Status
            </ContextMenuSubTrigger>
            <ContextMenuSubContent>
              <ContextMenuItem 
                onClick={() => quickChangeStatus(appt.id, 'scheduled')}
                disabled={appt.status === 'scheduled'}
                className="flex items-center gap-2"
              >
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                Scheduled
              </ContextMenuItem>
              <ContextMenuItem 
                onClick={() => quickChangeStatus(appt.id, 'in_progress')}
                disabled={appt.status === 'in_progress'}
                className="flex items-center gap-2"
              >
                <div className="w-2 h-2 rounded-full bg-yellow-500" />
                In Progress
              </ContextMenuItem>
              <ContextMenuItem 
                onClick={() => quickChangeStatus(appt.id, 'completed')}
                disabled={appt.status === 'completed'}
                className="flex items-center gap-2"
              >
                <div className="w-2 h-2 rounded-full bg-green-500" />
                Completed
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem 
                onClick={() => quickChangeStatus(appt.id, 'cancelled')}
                disabled={appt.status === 'cancelled'}
                className="flex items-center gap-2 text-red-600"
              >
                <div className="w-2 h-2 rounded-full bg-red-500" />
                Cancelled
              </ContextMenuItem>
            </ContextMenuSubContent>
          </ContextMenuSub>

          {/* Reassign Walker */}
          {isWalkService(appt.service_type) && (
            <ContextMenuSub>
              <ContextMenuSubTrigger className="flex items-center gap-2">
                <UserCheck className="w-4 h-4" />
                Reassign Walker
              </ContextMenuSubTrigger>
              <ContextMenuSubContent>
                <ContextMenuItem 
                  onClick={() => quickAssignWalker(appt.id, null)}
                  className="flex items-center gap-2"
                >
                  <div className="w-3 h-3 rounded-full bg-gray-300" />
                  Unassigned
                </ContextMenuItem>
                <ContextMenuSeparator />
                {walkers.map((walker) => (
                  <ContextMenuItem 
                    key={walker.id}
                    onClick={() => quickAssignWalker(appt.id, walker.id)}
                    disabled={appt.walker_id === walker.id}
                    className="flex items-center gap-2"
                  >
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: walker.walker_color || '#9CA3AF' }}
                    />
                    {walker.full_name}
                    {appt.walker_id === walker.id && <span className="ml-auto text-xs">✓</span>}
                  </ContextMenuItem>
                ))}
              </ContextMenuSubContent>
            </ContextMenuSub>
          )}

          <ContextMenuSeparator />
          
          {/* Reschedule */}
          <ContextMenuItem 
            onClick={() => quickReschedule(appt)}
            className="flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Reschedule
          </ContextMenuItem>
          
          {/* View Details */}
          <ContextMenuItem 
            onClick={() => openAppointmentDetail(appt)}
            className="flex items-center gap-2"
          >
            <Edit className="w-4 h-4" />
            View Details
          </ContextMenuItem>
          
          <ContextMenuSeparator />
          
          {/* Cancel */}
          {appt.status !== 'cancelled' && (
            <ContextMenuItem 
              onClick={() => {
                if (window.confirm('Are you sure you want to cancel this appointment?')) {
                  quickChangeStatus(appt.id, 'cancelled');
                }
              }}
              className="flex items-center gap-2 text-red-600"
            >
              <XCircle className="w-4 h-4" />
              Cancel Appointment
            </ContextMenuItem>
          )}
        </ContextMenuContent>
      </ContextMenu>
    );
  };

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
      <div className="space-y-6" data-testid="calendar-page">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-heading font-bold">Calendar</h1>
            <p className="text-muted-foreground">Manage appointments and schedules</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {isAdmin && (
              <Button className="rounded-full" onClick={() => openAddDialog()} data-testid="add-appointment-btn">
                <Plus className="w-4 h-4 mr-2" />
                Add Service
              </Button>
            )}
            <Select value={selectedServiceCategory} onValueChange={setSelectedServiceCategory}>
              <SelectTrigger className="w-[160px]" data-testid="filter-service">
                <SelectValue placeholder="Filter by service" />
              </SelectTrigger>
              <SelectContent>
                {SERVICE_CATEGORIES.map((category) => (
                  <SelectItem key={category.value} value={category.value}>
                    {category.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedWalker} onValueChange={setSelectedWalker}>
              <SelectTrigger className="w-[180px]" data-testid="filter-walker">
                <SelectValue placeholder="Filter by walker" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Walkers</SelectItem>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {walkers.map((walker) => (
                  <SelectItem key={walker.id} value={walker.id}>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: walker.walker_color }}
                      />
                      {walker.full_name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* View Toggle & Navigation */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <Tabs value={viewMode} onValueChange={setViewMode}>
            <TabsList>
              <TabsTrigger value="day" data-testid="view-day">
                <CalendarDays className="w-4 h-4 mr-1" />
                Day
              </TabsTrigger>
              <TabsTrigger value="week" data-testid="view-week">
                <CalendarRange className="w-4 h-4 mr-1" />
                Week
              </TabsTrigger>
              <TabsTrigger value="month" data-testid="view-month">
                <CalendarIcon className="w-4 h-4 mr-1" />
                Month
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => navigate('prev')} data-testid="nav-prev">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" onClick={goToToday} data-testid="nav-today">
              Today
            </Button>
            <Button variant="outline" size="icon" onClick={() => navigate('next')} data-testid="nav-next">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          <h2 className="text-xl font-semibold">{getViewTitle()}</h2>
        </div>

        {/* Calendar Views */}
        {viewMode === 'day' && (
          <Card className="rounded-2xl shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{format(currentDate, 'EEEE, MMMM d')}</CardTitle>
                  <CardDescription>
                    {filterAppointments(currentDate).length} appointment(s)
                  </CardDescription>
                </div>
                {isAdmin && (
                  <Button size="sm" variant="outline" onClick={() => openAddDialog(currentDate)}>
                    <Plus className="w-4 h-4 mr-1" /> Add
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {filterAppointments(currentDate).length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Clock className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg">No appointments</p>
                  <p className="text-sm">No walks scheduled for this day</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filterAppointments(currentDate)
                    .sort((a, b) => a.scheduled_time.localeCompare(b.scheduled_time))
                    .map((appt) => renderAppointmentCard(appt))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {viewMode === 'week' && (
          <Card className="rounded-2xl shadow-sm overflow-hidden">
            <CardContent className="p-0">
              <div className="grid grid-cols-7 border-b">
                {getViewDates().map((date) => (
                  <div
                    key={date.toISOString()}
                    className={`p-3 text-center border-r last:border-r-0 ${
                      isToday(date) ? 'bg-primary/10' : ''
                    }`}
                  >
                    <p className="text-sm text-muted-foreground">{format(date, 'EEE')}</p>
                    <p className={`text-lg font-semibold ${isToday(date) ? 'text-primary' : ''}`}>
                      {format(date, 'd')}
                    </p>
                    {isAdmin && (
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="w-full mt-1 h-6 text-xs"
                        onClick={() => openAddDialog(date)}
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 min-h-[400px]">
                {getViewDates().map((date) => {
                  const dayAppts = filterAppointments(date);
                  return (
                    <div
                      key={date.toISOString()}
                      className={`p-2 border-r last:border-r-0 ${
                        isToday(date) ? 'bg-primary/5' : ''
                      }`}
                    >
                      <div className="space-y-2">
                        {dayAppts
                          .sort((a, b) => a.scheduled_time.localeCompare(b.scheduled_time))
                          .slice(0, 5)
                          .map((appt) => renderAppointmentCard(appt, true))}
                        {dayAppts.length > 5 && (
                          <p className="text-xs text-muted-foreground text-center">
                            +{dayAppts.length - 5} more
                          </p>
                        )}
                        {dayAppts.length === 0 && (
                          <p className="text-xs text-muted-foreground text-center py-4">
                            No appointments
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {viewMode === 'month' && (
          <Card className="rounded-2xl shadow-sm overflow-hidden">
            <CardContent className="p-0">
              <div className="grid grid-cols-7 border-b bg-muted/30">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                  <div key={day} className="p-3 text-center text-sm font-medium text-muted-foreground">
                    {day}
                  </div>
                ))}
              </div>
              
              <div className="grid grid-cols-7">
                {(() => {
                  const monthStart = startOfMonth(currentDate);
                  const monthEnd = endOfMonth(currentDate);
                  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
                  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
                  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
                  
                  return days.map((date) => {
                    const dayAppts = filterAppointments(date);
                    const isCurrentMonth = isSameMonth(date, currentDate);
                    
                    return (
                      <div
                        key={date.toISOString()}
                        className={`min-h-[100px] p-2 border-b border-r ${
                          !isCurrentMonth ? 'bg-muted/20 text-muted-foreground' : ''
                        } ${isToday(date) ? 'bg-primary/10' : ''}`}
                      >
                        <div className="flex items-center justify-between">
                          <p className={`text-sm font-medium mb-1 ${
                            isToday(date) ? 'text-primary' : ''
                          }`}>
                            {format(date, 'd')}
                          </p>
                          {isAdmin && isCurrentMonth && (
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="h-5 w-5 p-0"
                              onClick={() => openAddDialog(date)}
                            >
                              <Plus className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                        <div className="space-y-1">
                          {dayAppts.slice(0, 3).map((appt) => (
                            <div
                              key={appt.id}
                              className="text-xs p-1 rounded truncate cursor-pointer hover:opacity-80"
                              style={getAppointmentStyles(appt)}
                              title={`${formatTime12Hour(appt.scheduled_time)} - ${appt.pet_names?.length > 0 ? appt.pet_names.join(', ') : appt.client_name} (${getWalkerName(appt.walker_id)})`}
                              onClick={() => openAppointmentDetail(appt)}
                            >
                              {formatTime12Hour(appt.scheduled_time)} {appt.pet_names?.length > 0 ? appt.pet_names.join(', ') : appt.service_type?.replace(/_/g, ' ')}
                            </div>
                          ))}
                          {dayAppts.length > 3 && (
                            <p className="text-xs text-muted-foreground">
                              +{dayAppts.length - 3} more
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Walker Legend */}
        <Card className="rounded-2xl shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Walker Legend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              {walkers.map((walker) => (
                <div key={walker.id} className="flex items-center gap-2">
                  <div 
                    className="w-4 h-4 rounded-full border-2" 
                    style={{ 
                      backgroundColor: `${walker.walker_color}20`,
                      borderColor: walker.walker_color 
                    }}
                  />
                  <span className="text-sm">{walker.full_name}</span>
                </div>
              ))}
              <div className="flex items-center gap-2">
                <div 
                  className="w-4 h-4 rounded-full border-2" 
                  style={{ 
                    backgroundColor: '#9CA3AF20',
                    borderColor: '#9CA3AF' 
                  }}
                />
                <span className="text-sm text-muted-foreground">Unassigned</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Add Appointment Dialog (Admin) */}
        <Dialog open={addDialogOpen} onOpenChange={(open) => {
          if (!open) {
            setScheduleMode(null);
            setBatchWalkerId('');
            setBatchWalks([]);
          }
          setAddDialogOpen(open);
        }}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            {/* Mode Selection */}
            {scheduleMode === null && (
              <>
                <DialogHeader>
                  <DialogTitle>Schedule Appointments</DialogTitle>
                  <DialogDescription>Choose how you want to schedule</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-20 flex flex-col items-center justify-center gap-2"
                    onClick={() => setScheduleMode('single')}
                    data-testid="single-mode-btn"
                  >
                    <Plus className="w-6 h-6" />
                    <span>Add Single Appointment</span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-20 flex flex-col items-center justify-center gap-2 border-primary"
                    onClick={() => setScheduleMode('batch')}
                    data-testid="batch-mode-btn"
                  >
                    <Users className="w-6 h-6" />
                    <span>Build Walker's Daily Schedule</span>
                  </Button>
                </div>
              </>
            )}

            {/* Batch Mode - Walker Selection */}
            {scheduleMode === 'batch' && !batchWalkerId && (
              <>
                <DialogHeader>
                  <DialogTitle>Select Walker</DialogTitle>
                  <DialogDescription>Choose which walker's schedule to build</DialogDescription>
                </DialogHeader>
                <div className="grid gap-2 py-4">
                  {walkers.map((walker) => (
                    <Button
                      key={walker.id}
                      type="button"
                      variant="outline"
                      className="justify-start gap-3 h-14"
                      onClick={() => startBatchScheduling(walker.id)}
                      data-testid={`select-walker-${walker.id}`}
                    >
                      <div 
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: walker.walker_color || '#3B82F6' }}
                      />
                      <span>{walker.full_name}</span>
                    </Button>
                  ))}
                </div>
                <Button variant="ghost" onClick={() => setScheduleMode(null)}>
                  ← Back
                </Button>
              </>
            )}

            {/* Batch Mode - Adding Walks */}
            {scheduleMode === 'batch' && batchWalkerId && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <div 
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: walkers.find(w => w.id === batchWalkerId)?.walker_color || '#3B82F6' }}
                    />
                    {walkers.find(w => w.id === batchWalkerId)?.full_name}'s Schedule
                  </DialogTitle>
                  <DialogDescription>
                    {format(new Date(formData.scheduled_date), 'EEEE, MMMM d, yyyy')} • {batchWalks.length} walk{batchWalks.length !== 1 ? 's' : ''} added
                  </DialogDescription>
                </DialogHeader>

                {/* Walks added so far */}
                {batchWalks.length > 0 && (
                  <div className="bg-gray-50 rounded-lg p-3 space-y-2 max-h-32 overflow-y-auto">
                    {batchWalks.map((walk) => (
                      <div key={walk.id} className="flex items-center justify-between text-sm bg-white p-2 rounded">
                        <div>
                          <span className="font-medium">{formatTime12Hour(walk.scheduled_time)}</span>
                          <span className="mx-2">•</span>
                          <span>{walk.pet_names?.join(', ')}</span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFromBatch(walk.id)}
                          className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add walk form */}
                <div className="space-y-4">
                  {/* Pet Selection - Only pets this walker has walked before */}
                  <div className="space-y-2">
                    <Label>Select Pet *</Label>
                    {walkerPets.length > 0 ? (
                      <Select 
                        value={formData.pet_ids[0] || ''} 
                        onValueChange={(petId) => {
                          const pet = walkerPets.find(p => p.id === petId);
                          if (pet) {
                            handlePetSelect(pet);
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a pet..." />
                        </SelectTrigger>
                        <SelectContent>
                          {walkerPets.map((pet) => {
                            const owner = clients.find(c => c.id === pet.owner_id);
                            const ownerPets = allPets.filter(p => p.owner_id === pet.owner_id);
                            const petNames = ownerPets.map(p => p.name).join(' & ');
                            return (
                              <SelectItem key={pet.id} value={pet.id}>
                                {petNames} ({owner?.full_name || 'Unknown'})
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">
                        This walker hasn't walked any pets yet. Use "Add Single Appointment" to assign their first walk.
                      </p>
                    )}
                  </div>

                  {/* Selected Pets - allow toggling individual pets from same owner */}
                  {selectedClientPets.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {selectedClientPets.map((pet) => (
                        <Button
                          key={pet.id}
                          type="button"
                          variant={formData.pet_ids.includes(pet.id) ? 'default' : 'outline'}
                          size="sm"
                          className="rounded-full"
                          onClick={() => {
                            const ids = formData.pet_ids.includes(pet.id)
                              ? formData.pet_ids.filter(id => id !== pet.id)
                              : [...formData.pet_ids, pet.id];
                            setFormData({ ...formData, pet_ids: ids });
                          }}
                        >
                          {pet.name}
                        </Button>
                      ))}
                    </div>
                  )}

                  {/* Service & Time in row */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Service</Label>
                      <Select value={formData.service_type} onValueChange={(value) => setFormData({ ...formData, service_type: value })}>
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Service" />
                        </SelectTrigger>
                        <SelectContent>
                          {services.filter(s => isWalkService(s.service_type)).map((service) => (
                            <SelectItem key={service.id} value={service.service_type}>
                              {service.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Time</Label>
                      <Select value={formData.scheduled_time} onValueChange={(value) => setFormData({ ...formData, scheduled_time: value })}>
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Time" />
                        </SelectTrigger>
                        <SelectContent>
                          {timeSlots.map((slot) => (
                            <SelectItem key={slot.value} value={slot.value}>{slot.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Add to schedule button */}
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={addToBatch}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Walk to Schedule
                  </Button>
                </div>

                {/* Footer actions */}
                <div className="flex gap-2 pt-4 border-t">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setBatchWalkerId('');
                      setBatchWalks([]);
                    }}
                  >
                    ← Back
                  </Button>
                  <Button
                    type="button"
                    className="flex-1"
                    onClick={saveBatchSchedule}
                    disabled={batchWalks.length === 0}
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    {walkers.find(w => w.id === batchWalkerId)?.full_name}'s Schedule is Ready
                  </Button>
                </div>
              </>
            )}

            {/* Single Mode - Original Form */}
            {scheduleMode === 'single' && (
              <>
            <DialogHeader>
              <DialogTitle>Add New Appointment</DialogTitle>
              <DialogDescription>Search by pet name to schedule a service</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateAppointment} className="space-y-4">
              {/* Pet Search */}
              <div className="space-y-2">
                <Label>Search Pet *</Label>
                <div className="relative">
                  <Input
                    type="text"
                    placeholder="Type pet name to search..."
                    value={petSearchQuery}
                    onChange={(e) => setPetSearchQuery(e.target.value)}
                    className="w-full"
                    data-testid="pet-search-input"
                  />
                  {/* Search Results Dropdown */}
                  {filteredPets.length > 0 && petSearchQuery.length >= 1 && (
                    <div className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {filteredPets.slice(0, 10).map((pet) => {
                        const owner = clients.find(c => c.id === pet.owner_id);
                        const allPetNames = getOwnerPetNames(pet.owner_id);
                        const ownerPetCount = allPets.filter(p => p.owner_id === pet.owner_id).length;
                        return (
                          <div
                            key={pet.id}
                            className="px-3 py-2 hover:bg-gray-100 cursor-pointer flex items-center justify-between"
                            onClick={() => handlePetSelect(pet)}
                            data-testid={`pet-option-${pet.id}`}
                          >
                            <div>
                              <span className="font-medium">{allPetNames}</span>
                              {ownerPetCount > 1 && (
                                <span className="text-xs text-green-600 ml-2">({ownerPetCount} pets)</span>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {owner?.full_name || 'Unknown owner'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Selected Pet(s) - Show after pet is selected */}
              {selectedClientPets.length > 0 && (
                <div className="space-y-2">
                  <Label>Pet(s) for {clients.find(c => c.id === formData.client_id)?.full_name || 'Client'}</Label>
                  <div className="flex flex-wrap gap-2">
                    {selectedClientPets.map((pet) => (
                      <Button
                        key={pet.id}
                        type="button"
                        variant={formData.pet_ids.includes(pet.id) ? 'default' : 'outline'}
                        size="sm"
                        className="rounded-full"
                        onClick={() => {
                          const ids = formData.pet_ids.includes(pet.id)
                            ? formData.pet_ids.filter(id => id !== pet.id)
                            : [...formData.pet_ids, pet.id];
                          setFormData({ ...formData, pet_ids: ids });
                        }}
                      >
                        {pet.name}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Service *</Label>
                <Select 
                  value={formData.service_type} 
                  onValueChange={(value) => {
                    const durationType = getDurationTypeForService(value);
                    setFormData({ 
                      ...formData, 
                      service_type: value,
                      duration_type: durationType,
                      duration_value: 1,
                      scheduled_time: isDayNightService(value) ? '' : formData.scheduled_time
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a service" />
                  </SelectTrigger>
                  <SelectContent>
                    {services.map((service) => (
                      <SelectItem key={service.id} value={service.service_type}>
                        {service.name} - ${service.price.toFixed(2)}
                        {getDurationTypeForService(service.service_type) === 'days' ? '/day' : ''}
                        {getDurationTypeForService(service.service_type) === 'nights' ? '/night' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{isDayNightService(formData.service_type) ? 'Start Date *' : 'Date *'}</Label>
                  <Input 
                    type="date" 
                    value={formData.scheduled_date}
                    onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
                  />
                </div>
                {isDayNightService(formData.service_type) ? (
                  <div className="space-y-2">
                    <Label>End Date *</Label>
                    <Input 
                      type="date" 
                      value={formData.end_date || formData.scheduled_date}
                      min={formData.scheduled_date}
                      onChange={(e) => {
                        const startDate = new Date(formData.scheduled_date);
                        const endDate = new Date(e.target.value);
                        const diffTime = endDate - startDate;
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                        setFormData({ 
                          ...formData, 
                          end_date: e.target.value,
                          duration_value: Math.max(1, diffDays)
                        });
                      }}
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label>Time *</Label>
                    <Select value={formData.scheduled_time} onValueChange={(value) => setFormData({ ...formData, scheduled_time: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select time">{formData.scheduled_time ? formatTime12Hour(formData.scheduled_time) : "Select time"}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {timeSlots.map((slot) => (
                          <SelectItem key={slot.value} value={slot.value}>{slot.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {/* Walker selection - only for walk services */}
              {isWalkService(formData.service_type) && (
                <div className="space-y-2">
                  <Label>Assign Walker</Label>
                  <Select value={formData.walker_id || 'none'} onValueChange={(value) => setFormData({ ...formData, walker_id: value === 'none' ? '' : value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a walker (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Unassigned</SelectItem>
                      {walkers.map((walker) => (
                        <SelectItem key={walker.id} value={walker.id}>
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: walker.walker_color }} />
                            {walker.full_name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Number of walks - only for walk services (new appointments only) */}
              {isWalkService(formData.service_type) && !editMode && (
                <div className="space-y-2">
                  <Label>Number of Walks</Label>
                  <p className="text-xs text-muted-foreground">Create multiple walks for this day</p>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setFormData({ ...formData, walk_count: Math.max(1, (formData.walk_count || 1) - 1) })}
                      disabled={formData.walk_count <= 1}
                    >
                      -
                    </Button>
                    <span className="w-12 text-center font-medium text-lg">{formData.walk_count || 1}</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setFormData({ ...formData, walk_count: Math.min(5, (formData.walk_count || 1) + 1) })}
                      disabled={formData.walk_count >= 5}
                    >
                      +
                    </Button>
                  </div>
                  {formData.walk_count > 1 && (
                    <p className="text-xs text-primary font-medium">
                      Will create {formData.walk_count} separate walk appointments
                    </p>
                  )}
                </div>
              )}

              {/* Sitter selection - only for overnight services */}
              {isOvernightService(formData.service_type) && (
                <div className="space-y-2">
                  <Label>Assign Sitter (Optional)</Label>
                  <Select value={formData.sitter_id || 'none'} onValueChange={(value) => setFormData({ ...formData, sitter_id: value === 'none' ? '' : value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a sitter (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Unassigned</SelectItem>
                      {sitters.map((sitter) => (
                        <SelectItem key={sitter.id} value={sitter.id}>
                          {sitter.full_name}
                        </SelectItem>
                      ))}
                      {sitters.length === 0 && (
                        <SelectItem value="none" disabled>No sitters available</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  placeholder="Any special instructions..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>

              <Button type="submit" className="w-full rounded-full">
                Create Appointment
              </Button>
            </form>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Appointment Detail Modal */}
        <Dialog open={!!selectedAppointment} onOpenChange={closeAppointmentDetail}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-primary" />
                Appointment Details
              </DialogTitle>
              <DialogDescription>
                {selectedAppointment?.end_date && selectedAppointment?.end_date !== selectedAppointment?.scheduled_date ? (
                  // Multi-day appointment - show date range
                  <span>{selectedAppointment?.scheduled_date} → {selectedAppointment?.end_date}</span>
                ) : (
                  // Single day appointment
                  <span>{selectedAppointment?.scheduled_date} at {formatTime12Hour(selectedAppointment?.scheduled_time)}</span>
                )}
              </DialogDescription>
            </DialogHeader>
            
            {detailLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : appointmentDetail ? (
              editMode ? (
                /* Edit Mode */
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{isDayNightService(formData.service_type) ? 'Start Date' : 'Date'}</Label>
                      <Input 
                        type="date" 
                        value={formData.scheduled_date}
                        onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
                      />
                    </div>
                    {isDayNightService(formData.service_type) ? (
                      <div className="space-y-2">
                        <Label>End Date</Label>
                        <Input 
                          type="date" 
                          value={formData.end_date || formData.scheduled_date}
                          min={formData.scheduled_date}
                          onChange={(e) => {
                            const startDate = new Date(formData.scheduled_date);
                            const endDate = new Date(e.target.value);
                            const diffTime = endDate - startDate;
                            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                            setFormData({ 
                              ...formData, 
                              end_date: e.target.value,
                              duration_value: Math.max(1, diffDays)
                            });
                          }}
                        />
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Label>Time</Label>
                        <Select value={formData.scheduled_time} onValueChange={(value) => setFormData({ ...formData, scheduled_time: value })}>
                          <SelectTrigger>
                            <SelectValue>{formData.scheduled_time ? formatTime12Hour(formData.scheduled_time) : "Select time"}</SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {timeSlots.map((slot) => (
                              <SelectItem key={slot.value} value={slot.value}>{slot.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Service</Label>
                    <Select value={formData.service_type} onValueChange={(value) => setFormData({ ...formData, service_type: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {services.map((service) => (
                          <SelectItem key={service.id} value={service.service_type}>
                            {service.name} - ${service.price.toFixed(2)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Walker</Label>
                    <Select value={formData.walker_id || 'none'} onValueChange={(value) => setFormData({ ...formData, walker_id: value === 'none' ? '' : value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Unassigned</SelectItem>
                        {walkers.map((walker) => (
                          <SelectItem key={walker.id} value={walker.id}>
                            {walker.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="scheduled">Scheduled</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Notes</Label>
                    <Textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={() => setEditMode(false)}>
                      Cancel
                    </Button>
                    <Button className="flex-1" onClick={handleUpdateAppointment}>
                      <Save className="w-4 h-4 mr-2" />
                      Save Changes
                    </Button>
                  </div>
                </div>
              ) : (
                /* View Mode */
                <div className="space-y-6">
                  {/* Admin Actions */}
                  {isAdmin && appointmentDetail.status !== 'cancelled' && (
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={openEditDialog}>
                        <Edit className="w-4 h-4 mr-1" />
                        Edit
                      </Button>
                      {/* Mark as Complete button for admins - for scheduled/in_progress walks */}
                      {(appointmentDetail.status === 'scheduled' || appointmentDetail.status === 'in_progress') && 
                       !isDayNightService(appointmentDetail.service_type) && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={handleAdminComplete}
                          className="text-green-600 border-green-300 hover:bg-green-50"
                          data-testid="admin-complete-btn"
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Mark as Complete
                        </Button>
                      )}
                      {/* End Stay Early button for overnight/daycare services that are in progress */}
                      {isDayNightService(appointmentDetail.service_type) && 
                       appointmentDetail.status === 'in_progress' && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={handleEndStayEarly}
                          className="text-orange-600 border-orange-300 hover:bg-orange-50"
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          End Stay Early
                        </Button>
                      )}
                      <Button variant="destructive" size="sm" onClick={handleDeleteAppointment}>
                        <X className="w-4 h-4 mr-1" />
                        Cancel
                      </Button>
                    </div>
                  )}

                  {/* Service Info */}
                  <div className="p-4 rounded-xl bg-primary/10">
                    <h3 className="font-semibold text-lg capitalize">
                      {appointmentDetail.service?.name || appointmentDetail.service_type?.replace(/_/g, ' ')}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {appointmentDetail.service?.description}
                    </p>
                    <div className="flex items-center gap-4 mt-2">
                      <Badge className={`${getStatusBadgeColor(appointmentDetail.status)} rounded-full`}>
                        {appointmentDetail.status}
                      </Badge>
                      {appointmentDetail.service?.price && (
                        <span className="font-semibold text-primary">${appointmentDetail.service.price.toFixed(2)}</span>
                      )}
                    </div>
                  </div>

                  {/* Date Range Info - for multi-day appointments */}
                  {isDayNightService(appointmentDetail.service_type) && (
                    <div className="p-4 rounded-lg bg-purple-50 border border-purple-100">
                      <h4 className="font-medium flex items-center gap-2 text-purple-800 mb-3">
                        <CalendarRange className="w-4 h-4" /> Stay Details
                      </h4>
                      {(() => {
                        const startDate = new Date(appointmentDetail.scheduled_date);
                        const endDate = appointmentDetail.end_date ? new Date(appointmentDetail.end_date) : startDate;
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        
                        const totalNights = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
                        const daysElapsed = Math.max(0, Math.ceil((today - startDate) / (1000 * 60 * 60 * 24)));
                        const daysRemaining = Math.max(0, Math.ceil((endDate - today) / (1000 * 60 * 60 * 24)));
                        
                        return (
                          <>
                            {/* Total Stay Duration - Prominent */}
                            <div className="bg-purple-100 rounded-lg p-3 mb-3 text-center">
                              <p className="text-2xl font-bold text-purple-800">{totalNights || 1}</p>
                              <p className="text-xs text-purple-600 uppercase tracking-wide">
                                {totalNights === 1 ? 'Night' : 'Nights'} Total
                              </p>
                            </div>
                            
                            {/* Date Grid */}
                            <div className="grid grid-cols-2 gap-3 mb-3">
                              <div className="bg-white rounded-lg p-2 border border-purple-200">
                                <p className="text-[10px] text-purple-600 uppercase">Start Date</p>
                                <p className="font-semibold text-sm">{appointmentDetail.scheduled_date}</p>
                              </div>
                              <div className="bg-white rounded-lg p-2 border border-purple-200">
                                <p className="text-[10px] text-purple-600 uppercase">End Date</p>
                                <p className="font-semibold text-sm">{appointmentDetail.end_date || appointmentDetail.scheduled_date}</p>
                              </div>
                            </div>
                            
                            {/* Days Progress - only show if stay has started */}
                            {appointmentDetail.status === 'in_progress' && totalNights > 0 && (
                              <div className="bg-white rounded-lg p-3 border border-purple-200">
                                <div className="flex justify-between items-center mb-2">
                                  <span className="text-xs text-purple-600">Stay Progress</span>
                                  <span className="text-xs font-medium text-purple-800">
                                    Day {Math.min(daysElapsed + 1, totalNights)} of {totalNights}
                                  </span>
                                </div>
                                <div className="h-2 bg-purple-100 rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-purple-500 rounded-full transition-all"
                                    style={{ width: `${Math.min(100, ((daysElapsed + 1) / totalNights) * 100)}%` }}
                                  />
                                </div>
                                <p className="text-center mt-2 text-sm font-medium text-purple-700">
                                  {daysRemaining > 0 ? (
                                    <>{daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} remaining</>
                                  ) : (
                                    <>Check-out today</>
                                  )}
                                </p>
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  )}

                  {/* Client Info */}
                  {appointmentDetail.client && (
                    <div className="space-y-2">
                      <h4 className="font-medium flex items-center gap-2">
                        <User className="w-4 h-4" /> Client
                      </h4>
                      <div className="p-3 rounded-lg bg-muted/50">
                        <p className="font-medium">{appointmentDetail.client.full_name}</p>
                        {appointmentDetail.client.email && (
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <Mail className="w-3 h-3" /> {appointmentDetail.client.email}
                          </p>
                        )}
                        {appointmentDetail.client.phone && (
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <Phone className="w-3 h-3" /> {appointmentDetail.client.phone}
                          </p>
                        )}
                        {appointmentDetail.client.address && (
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <MapPin className="w-3 h-3" /> {appointmentDetail.client.address}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Walker Info */}
                  <div className="space-y-2">
                    <h4 className="font-medium flex items-center gap-2">
                      <PawPrint className="w-4 h-4" /> Walker
                    </h4>
                    {appointmentDetail.walker ? (
                      <div 
                        className="p-3 rounded-lg"
                        style={{ 
                          backgroundColor: `${appointmentDetail.walker.walker_color}15`,
                          borderLeft: `4px solid ${appointmentDetail.walker.walker_color}`
                        }}
                      >
                        <p className="font-medium">{appointmentDetail.walker.full_name}</p>
                        {appointmentDetail.walker.phone && (
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <Phone className="w-3 h-3" /> {appointmentDetail.walker.phone}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="p-3 rounded-lg bg-gray-100 text-gray-600">
                        <p>No walker assigned</p>
                        {isAdmin && (
                          <Select onValueChange={(value) => assignWalker(appointmentDetail.id, value)}>
                            <SelectTrigger className="mt-2">
                              <SelectValue placeholder="Assign a walker" />
                            </SelectTrigger>
                            <SelectContent>
                              {walkers.map((walker) => (
                                <SelectItem key={walker.id} value={walker.id}>
                                  <div className="flex items-center gap-2">
                                    <div 
                                      className="w-3 h-3 rounded-full" 
                                      style={{ backgroundColor: walker.walker_color }}
                                    />
                                    {walker.full_name}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Pets */}
                  {appointmentDetail.pets && appointmentDetail.pets.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-medium flex items-center gap-2">
                        <PawPrint className="w-4 h-4" /> Pet(s)
                      </h4>
                      <div className="grid gap-2">
                        {appointmentDetail.pets.map((pet) => (
                          <div key={pet.id} className="p-3 rounded-lg bg-muted/50 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                              <PawPrint className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium">{pet.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {pet.breed || pet.species} {pet.age && `• ${pet.age} years`} {pet.weight && `• ${pet.weight} lbs`}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  {appointmentDetail.notes && (
                    <div className="space-y-2">
                      <h4 className="font-medium">Notes</h4>
                      <p className="text-sm text-muted-foreground p-3 rounded-lg bg-muted/50">
                        {appointmentDetail.notes}
                      </p>
                    </div>
                  )}

                  {/* Completion Data - shown for completed walks */}
                  {appointmentDetail.status === 'completed' && (
                    <div className="space-y-3 border-t pt-3">
                      <h4 className="font-medium text-sm flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        Walk Completion Report
                      </h4>
                      
                      {/* Duration */}
                      {appointmentDetail.actual_duration_minutes && (
                        <div className="p-3 rounded-lg bg-green-50 text-green-800">
                          <p className="text-sm">
                            <Clock className="w-4 h-4 inline mr-1" />
                            Completed in <strong>{appointmentDetail.actual_duration_minutes} minutes</strong>
                          </p>
                          {appointmentDetail.start_time && appointmentDetail.end_time && (
                            <p className="text-xs mt-1">
                              {formatTime12Hour(appointmentDetail.start_time.split('T')[1]?.substring(0,5))} - {formatTime12Hour(appointmentDetail.end_time.split('T')[1]?.substring(0,5))}
                            </p>
                          )}
                        </div>
                      )}
                      
                      {/* Pee, Poop & Water Status */}
                      <div className="grid grid-cols-3 gap-2">
                        <div className="p-2 rounded-lg bg-yellow-50 border border-yellow-100 text-center">
                          <p className="text-lg font-bold text-yellow-700">{appointmentDetail.pee_count || 0}</p>
                          <p className="text-xs text-yellow-600">🟡 Pee</p>
                        </div>
                        <div className="p-2 rounded-lg bg-amber-50 border border-amber-100 text-center">
                          <p className="text-lg font-bold text-amber-700">{appointmentDetail.poop_count || 0}</p>
                          <p className="text-xs text-amber-600">💩 Poop</p>
                        </div>
                        <div className={`p-2 rounded-lg text-center ${appointmentDetail.water_given ? 'bg-blue-50 border border-blue-100' : 'bg-gray-50 border border-gray-100'}`}>
                          <p className={`text-lg font-bold ${appointmentDetail.water_given ? 'text-blue-700' : 'text-gray-400'}`}>
                            {appointmentDetail.water_given ? '✓' : '—'}
                          </p>
                          <p className={`text-xs ${appointmentDetail.water_given ? 'text-blue-600' : 'text-gray-400'}`}>💧 Water</p>
                        </div>
                      </div>
                      
                      {/* Walker Notes */}
                      {appointmentDetail.walker_notes && (
                        <div className="p-3 rounded-lg bg-sky-50 border border-sky-100">
                          <p className="font-medium text-xs text-sky-700 mb-1">Walker Notes:</p>
                          <p className="text-sm text-gray-700">{appointmentDetail.walker_notes}</p>
                        </div>
                      )}
                      
                      {/* GPS Route */}
                      {appointmentDetail.gps_route && appointmentDetail.gps_route.length > 0 ? (
                        <div className="p-3 rounded-lg bg-blue-50 border border-blue-100">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <MapPin className="w-4 h-4 text-blue-500" />
                              <p className="font-medium text-sm text-blue-700">GPS Route Recorded</p>
                            </div>
                            <Badge className="bg-blue-100 text-blue-700">
                              {appointmentDetail.gps_route.length} points
                            </Badge>
                          </div>
                          {appointmentDetail.distance_meters && (
                            <p className="text-xs text-blue-600 mt-1">
                              Distance: {(appointmentDetail.distance_meters / 1609.34).toFixed(2)} miles
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="p-2 rounded-lg bg-gray-50 text-center">
                          <p className="text-xs text-gray-500">No GPS route recorded</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            ) : (
              <p className="text-center py-8 text-muted-foreground">No details available</p>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default CalendarPage;
