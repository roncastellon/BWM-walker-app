import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Checkbox } from '../components/ui/checkbox';
import { 
  User, PawPrint, Calendar, CreditCard, ArrowRight, ArrowLeft, 
  CheckCircle, Plus, Trash2, Dog, Cat, Clock, Repeat, CalendarDays, AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const WALK_TIMES = [
  { value: '06:00', label: '6:00 AM' },
  { value: '07:00', label: '7:00 AM' },
  { value: '08:00', label: '8:00 AM' },
  { value: '09:00', label: '9:00 AM' },
  { value: '10:00', label: '10:00 AM' },
  { value: '11:00', label: '11:00 AM' },
  { value: '12:00', label: '12:00 PM' },
  { value: '13:00', label: '1:00 PM' },
  { value: '14:00', label: '2:00 PM' },
  { value: '15:00', label: '3:00 PM' },
  { value: '16:00', label: '4:00 PM' },
  { value: '17:00', label: '5:00 PM' },
  { value: '18:00', label: '6:00 PM' },
  { value: '19:00', label: '7:00 PM' },
  { value: '20:00', label: '8:00 PM' },
];

const PAYMENT_METHODS = [
  { value: 'venmo', label: 'Venmo', placeholder: '@username' },
  { value: 'zelle', label: 'Zelle', placeholder: 'Email or phone' },
  { value: 'cashapp', label: 'CashApp', placeholder: '$cashtag' },
  { value: 'apple_pay', label: 'Apple Pay', placeholder: 'Phone number or email' },
  { value: 'apple_cash', label: 'Apple Cash', placeholder: 'Phone number or email' },
  { value: 'paypal', label: 'PayPal', placeholder: 'Email' },
  { value: 'check_cash', label: 'Check/Cash', placeholder: 'No details needed' },
];

const ClientOnboardingPage = () => {
  const { user, api } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  
  // Step 1: Personal Info
  const [personalInfo, setPersonalInfo] = useState({
    full_name: user?.full_name || '',
    email: user?.email || '',
    phone: '',
    address: '',
    emergency_contact: '',
    emergency_phone: ''
  });
  
  // Step 2: Pets
  const [pets, setPets] = useState([{
    name: '',
    type: 'dog',
    breed: '',
    age: '',
    weight: '',
    notes: '',
    special_instructions: ''
  }]);
  
  // Step 3: Walk Schedule
  const [walkSchedule, setWalkSchedule] = useState({
    schedule_type: 'recurring', // 'one_time' or 'recurring' - default to recurring
    walks_per_day: 1,
    preferred_walk_times: ['09:00'],
    walk_duration: 30, // 30, 45, or 60 minutes
    days_per_week: 5,
    preferred_days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    preferred_walker_id: '' // Optional walker preference
  });
  
  // Available walkers
  const [walkers, setWalkers] = useState([]);
  
  // Time conflict state
  const [timeConflicts, setTimeConflicts] = useState([]);
  const [checkingConflicts, setCheckingConflicts] = useState(false);

  // Fetch walkers on mount
  useEffect(() => {
    const fetchWalkers = async () => {
      try {
        const res = await api.get('/users/walkers');
        setWalkers(res.data || []);
      } catch (error) {
        console.error('Failed to load walkers');
      }
    };
    fetchWalkers();
  }, [api]);

  // Conflict dialog state
  const [conflictDialog, setConflictDialog] = useState({
    open: false,
    conflicts: [],
    alternatives: [],
    selectedWalkerName: ''
  });

  // Check walker availability when walker is selected
  const checkWalkerConflicts = async (walkerId) => {
    if (!walkerId) {
      setTimeConflicts([]);
      return;
    }

    setCheckingConflicts(true);
    try {
      const walker = walkers.find(w => w.id === walkerId);
      const walkerName = walker?.full_name || walker?.username || 'Selected walker';
      
      // Determine service type from walk duration
      const serviceTypeMap = {30: "walk_30", 45: "walk_45", 60: "walk_60"};
      const serviceType = serviceTypeMap[walkSchedule.walk_duration] || "walk_30";

      const res = await api.post('/walkers/check-schedule-conflicts', {
        walker_id: walkerId,
        schedule_type: walkSchedule.schedule_type,
        preferred_days: walkSchedule.preferred_days,
        preferred_times: walkSchedule.preferred_walk_times,
        service_type: serviceType
      });

      if (res.data.has_conflicts) {
        setTimeConflicts(res.data.conflicts);
        setConflictDialog({
          open: true,
          conflicts: res.data.conflicts,
          alternatives: res.data.alternatives,
          selectedWalkerName: walkerName
        });
      } else {
        setTimeConflicts([]);
      }
    } catch (error) {
      console.error('Failed to check conflicts', error);
    } finally {
      setCheckingConflicts(false);
    }
  };

  // Handle walker selection with conflict check
  const handleWalkerSelect = (walkerId) => {
    setWalkSchedule({...walkSchedule, preferred_walker_id: walkerId});
    if (walkerId) {
      checkWalkerConflicts(walkerId);
    } else {
      setTimeConflicts([]);
    }
  };

  // Handle conflict resolution - let app assign
  const handleLetAppAssign = () => {
    setWalkSchedule({...walkSchedule, preferred_walker_id: ''});
    setTimeConflicts([]);
    setConflictDialog({...conflictDialog, open: false});
    toast.info('The admin will assign an available walker to your schedule.');
  };

  // Handle conflict resolution - choose different walker
  const handleChooseDifferent = () => {
    setWalkSchedule({...walkSchedule, preferred_walker_id: ''});
    setTimeConflicts([]);
    setConflictDialog({...conflictDialog, open: false});
  };
  
  // Step 4: Billing
  const [billing, setBilling] = useState({
    billing_frequency: 'weekly',
    payment_method: 'venmo',
    payment_details: ''
  });

  const totalSteps = 4;

  const addPet = () => {
    setPets([...pets, {
      name: '',
      type: 'dog',
      breed: '',
      age: '',
      weight: '',
      notes: '',
      special_instructions: ''
    }]);
  };

  const removePet = (index) => {
    if (pets.length > 1) {
      setPets(pets.filter((_, i) => i !== index));
    }
  };

  const updatePet = (index, field, value) => {
    const updated = [...pets];
    updated[index][field] = value;
    setPets(updated);
  };

  const toggleDay = (day) => {
    const current = walkSchedule.preferred_days;
    if (current.includes(day)) {
      if (current.length > 1) {
        setWalkSchedule({
          ...walkSchedule,
          preferred_days: current.filter(d => d !== day),
          days_per_week: current.length - 1
        });
      }
    } else {
      setWalkSchedule({
        ...walkSchedule,
        preferred_days: [...current, day],
        days_per_week: current.length + 1
      });
    }
  };

  const updateWalksPerDay = (num) => {
    const times = walkSchedule.preferred_walk_times.slice(0, num);
    while (times.length < num) {
      const lastTime = times[times.length - 1] || '09:00';
      const hour = parseInt(lastTime.split(':')[0]) + 4;
      times.push(`${Math.min(hour, 20).toString().padStart(2, '0')}:00`);
    }
    setWalkSchedule({
      ...walkSchedule,
      walks_per_day: num,
      preferred_walk_times: times
    });
  };

  const updateWalkTime = (index, time) => {
    const updated = [...walkSchedule.preferred_walk_times];
    updated[index] = time;
    setWalkSchedule({ ...walkSchedule, preferred_walk_times: updated });
  };

  const validateStep = () => {
    if (step === 1) {
      if (!personalInfo.full_name || !personalInfo.email) {
        toast.error('Please fill in your name and email');
        return false;
      }
    }
    if (step === 2) {
      if (pets.some(p => !p.name || !p.type)) {
        toast.error('Please fill in all pet names and types');
        return false;
      }
    }
    if (step === 3) {
      if (walkSchedule.preferred_days.length === 0) {
        toast.error('Please select at least one day');
        return false;
      }
    }
    return true;
  };

  const nextStep = () => {
    if (validateStep()) {
      setStep(step + 1);
    }
  };

  const prevStep = () => {
    setStep(step - 1);
  };

  const handleSubmit = async () => {
    if (!validateStep()) return;
    
    setSubmitting(true);
    try {
      const data = {
        ...personalInfo,
        pets: pets.filter(p => p.name), // Only include pets with names
        ...walkSchedule,
        ...billing
      };
      
      await api.post('/client/onboarding', data);
      toast.success('Welcome to BowWowMeow! Your profile has been set up.');
      navigate('/client');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to complete setup');
    } finally {
      setSubmitting(false);
    }
  };

  const renderStepIndicator = () => (
    <div className="flex justify-center mb-8">
      {[1, 2, 3, 4].map((s) => (
        <div key={s} className="flex items-center">
          <div 
            className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all ${
              s < step ? 'bg-green-500 text-white' :
              s === step ? 'bg-primary text-white' :
              'bg-gray-200 text-gray-500'
            }`}
          >
            {s < step ? <CheckCircle className="w-5 h-5" /> : s}
          </div>
          {s < 4 && (
            <div className={`w-12 h-1 mx-1 ${s < step ? 'bg-green-500' : 'bg-gray-200'}`} />
          )}
        </div>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-orange-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary flex items-center justify-center">
            <PawPrint className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Welcome to BowWowMeow!</h1>
          <p className="text-muted-foreground mt-2">Let's set up your profile in just a few steps</p>
        </div>

        {renderStepIndicator()}

        {/* Step 1: Personal Information */}
        {step === 1 && (
          <Card className="rounded-2xl shadow-lg">
            <CardHeader className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-t-2xl">
              <div className="flex items-center gap-3">
                <User className="w-6 h-6" />
                <div>
                  <CardTitle>Your Information</CardTitle>
                  <CardDescription className="text-blue-100">Tell us about yourself</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="full_name">Full Name *</Label>
                  <Input
                    id="full_name"
                    value={personalInfo.full_name}
                    onChange={(e) => setPersonalInfo({...personalInfo, full_name: e.target.value})}
                    placeholder="John Smith"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={personalInfo.email}
                    onChange={(e) => setPersonalInfo({...personalInfo, email: e.target.value})}
                    placeholder="john@example.com"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    value={personalInfo.phone}
                    onChange={(e) => setPersonalInfo({...personalInfo, phone: e.target.value})}
                    placeholder="(555) 123-4567"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    value={personalInfo.address}
                    onChange={(e) => setPersonalInfo({...personalInfo, address: e.target.value})}
                    placeholder="123 Main St, City, State"
                  />
                </div>
              </div>

              <div className="border-t pt-4 mt-4">
                <p className="text-sm font-medium text-gray-700 mb-3">Emergency Contact (Optional)</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="emergency_contact">Contact Name</Label>
                    <Input
                      id="emergency_contact"
                      value={personalInfo.emergency_contact}
                      onChange={(e) => setPersonalInfo({...personalInfo, emergency_contact: e.target.value})}
                      placeholder="Jane Smith"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="emergency_phone">Contact Phone</Label>
                    <Input
                      id="emergency_phone"
                      value={personalInfo.emergency_phone}
                      onChange={(e) => setPersonalInfo({...personalInfo, emergency_phone: e.target.value})}
                      placeholder="(555) 987-6543"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Pet Information */}
        {step === 2 && (
          <Card className="rounded-2xl shadow-lg">
            <CardHeader className="bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-t-2xl">
              <div className="flex items-center gap-3">
                <PawPrint className="w-6 h-6" />
                <div>
                  <CardTitle>Your Pets</CardTitle>
                  <CardDescription className="text-orange-100">Tell us about your furry friends</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {pets.map((pet, index) => (
                <div key={index} className="p-4 rounded-xl border-2 border-orange-100 bg-orange-50/50 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-orange-800 flex items-center gap-2">
                      {pet.type === 'dog' ? <Dog className="w-5 h-5" /> : <Cat className="w-5 h-5" />}
                      Pet {index + 1}
                    </h3>
                    {pets.length > 1 && (
                      <Button variant="ghost" size="sm" onClick={() => removePet(index)} className="text-red-500 hover:text-red-700">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Pet Name *</Label>
                      <Input
                        value={pet.name}
                        onChange={(e) => updatePet(index, 'name', e.target.value)}
                        placeholder="Buddy"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Type *</Label>
                      <Select value={pet.type} onValueChange={(v) => updatePet(index, 'type', v)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="dog">Dog</SelectItem>
                          <SelectItem value="cat">Cat</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Breed</Label>
                      <Input
                        value={pet.breed}
                        onChange={(e) => updatePet(index, 'breed', e.target.value)}
                        placeholder="Golden Retriever"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Age (years)</Label>
                      <Input
                        type="number"
                        value={pet.age}
                        onChange={(e) => updatePet(index, 'age', e.target.value)}
                        placeholder="3"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Weight (lbs)</Label>
                      <Input
                        type="number"
                        value={pet.weight}
                        onChange={(e) => updatePet(index, 'weight', e.target.value)}
                        placeholder="50"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Special Instructions</Label>
                    <Textarea
                      value={pet.special_instructions}
                      onChange={(e) => updatePet(index, 'special_instructions', e.target.value)}
                      placeholder="Any allergies, behavior notes, or special care instructions..."
                      rows={2}
                    />
                  </div>
                </div>
              ))}
              
              <Button variant="outline" onClick={addPet} className="w-full border-dashed border-2">
                <Plus className="w-4 h-4 mr-2" />
                Add Another Pet
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Walk Schedule */}
        {step === 3 && (
          <Card className="rounded-2xl shadow-lg">
            <CardHeader className="bg-gradient-to-r from-green-500 to-green-600 text-white rounded-t-2xl">
              <div className="flex items-center gap-3">
                <Calendar className="w-6 h-6" />
                <div>
                  <CardTitle>Walk Schedule</CardTitle>
                  <CardDescription className="text-green-100">Set your preferred walking schedule</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {/* Schedule Type - One-Time or Recurring */}
              <div className="space-y-3">
                <Label className="text-base font-semibold">Schedule Type</Label>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant={walkSchedule.schedule_type === 'one_time' ? "default" : "outline"}
                    className={`h-auto py-4 flex flex-col ${walkSchedule.schedule_type === 'one_time' ? 'bg-sky-500 hover:bg-sky-600' : ''}`}
                    onClick={() => setWalkSchedule({...walkSchedule, schedule_type: 'one_time'})}
                  >
                    <CalendarDays className="w-6 h-6 mb-1" />
                    <span className="text-lg font-bold">One-Time</span>
                    <span className="text-xs opacity-80">Single appointment</span>
                  </Button>
                  <Button
                    variant={walkSchedule.schedule_type === 'recurring' ? "default" : "outline"}
                    className={`h-auto py-4 flex flex-col ${walkSchedule.schedule_type === 'recurring' ? 'bg-orange-500 hover:bg-orange-600' : ''}`}
                    onClick={() => setWalkSchedule({...walkSchedule, schedule_type: 'recurring'})}
                  >
                    <Repeat className="w-6 h-6 mb-1" />
                    <span className="text-lg font-bold">Recurring</span>
                    <span className="text-xs opacity-80">Repeats weekly</span>
                  </Button>
                </div>
                {walkSchedule.schedule_type === 'recurring' && (
                  <div className="p-3 rounded-lg bg-orange-50 border border-orange-200 text-sm text-orange-800">
                    <p className="font-medium flex items-center gap-2">
                      <Repeat className="w-4 h-4" />
                      Your walks will repeat every week
                    </p>
                    <p className="text-xs mt-1">You can pause or stop recurring walks anytime from your dashboard.</p>
                  </div>
                )}
              </div>

              {/* Days per week */}
              <div className="space-y-3">
                <Label className="text-base font-semibold">How many days per week?</Label>
                <div className="flex flex-wrap gap-2">
                  {[7, 6, 5, 4, 3, 2, 1].map((num) => (
                    <Button
                      key={num}
                      variant={walkSchedule.days_per_week === num ? "default" : "outline"}
                      size="lg"
                      className={`w-12 h-12 rounded-full ${walkSchedule.days_per_week === num ? 'bg-green-500 hover:bg-green-600' : ''}`}
                      onClick={() => {
                        const sortedDays = DAYS_OF_WEEK.slice(0, num);
                        setWalkSchedule({
                          ...walkSchedule,
                          days_per_week: num,
                          preferred_days: sortedDays
                        });
                      }}
                    >
                      {num}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Which days */}
              <div className="space-y-3">
                <Label className="text-base font-semibold">Which days?</Label>
                <div className="flex flex-wrap gap-2">
                  {DAYS_OF_WEEK.map((day) => (
                    <Badge
                      key={day}
                      variant={walkSchedule.preferred_days.includes(day) ? "default" : "outline"}
                      className={`cursor-pointer px-3 py-2 text-sm ${
                        walkSchedule.preferred_days.includes(day) 
                          ? 'bg-green-500 hover:bg-green-600' 
                          : 'hover:bg-gray-100'
                      }`}
                      onClick={() => toggleDay(day)}
                    >
                      {day.slice(0, 3)}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Walks per day */}
              <div className="space-y-3">
                <Label className="text-base font-semibold">How many walks per day?</Label>
                <div className="flex gap-2">
                  {[1, 2, 3].map((num) => (
                    <Button
                      key={num}
                      variant={walkSchedule.walks_per_day === num ? "default" : "outline"}
                      className={walkSchedule.walks_per_day === num ? 'bg-green-500 hover:bg-green-600' : ''}
                      onClick={() => updateWalksPerDay(num)}
                    >
                      {num} walk{num > 1 ? 's' : ''}/day
                    </Button>
                  ))}
                </div>
              </div>

              {/* Walk Duration */}
              <div className="space-y-3">
                <Label className="text-base font-semibold flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Walk Duration
                </Label>
                <div className="flex gap-2">
                  {[30, 45, 60].map((duration) => (
                    <Button
                      key={duration}
                      variant={walkSchedule.walk_duration === duration ? "default" : "outline"}
                      className={`flex-1 h-auto py-3 flex flex-col ${walkSchedule.walk_duration === duration ? 'bg-green-500 hover:bg-green-600' : ''}`}
                      onClick={() => setWalkSchedule({...walkSchedule, walk_duration: duration})}
                    >
                      <span className="text-lg font-bold">{duration}</span>
                      <span className="text-xs opacity-80">minutes</span>
                    </Button>
                  ))}
                </div>
              </div>

              {/* Preferred times */}
              <div className="space-y-3">
                <Label className="text-base font-semibold flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Preferred Walk Times
                </Label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {walkSchedule.preferred_walk_times.map((time, index) => (
                    <div key={index} className="space-y-1">
                      <Label className="text-sm text-muted-foreground">Walk {index + 1}</Label>
                      <Select value={time} onValueChange={(v) => updateWalkTime(index, v)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {WALK_TIMES.map((t) => (
                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </div>

              {/* Preferred Walker (Optional) */}
              {walkers.length > 0 && (
                <div className="space-y-3">
                  <Label className="text-base font-semibold flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Preferred Walker (Optional)
                  </Label>
                  <Select 
                    value={walkSchedule.preferred_walker_id} 
                    onValueChange={(v) => setWalkSchedule({...walkSchedule, preferred_walker_id: v})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="No preference - Admin will assign" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">No preference</SelectItem>
                      {walkers.map((walker) => (
                        <SelectItem key={walker.id} value={walker.id}>
                          {walker.full_name || walker.username}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    If you don't select a walker, the admin will assign one to your schedule.
                  </p>
                </div>
              )}

              {/* Time Conflicts Warning */}
              {timeConflicts.length > 0 && (
                <div className="p-4 rounded-lg bg-amber-50 border border-amber-200">
                  <p className="font-medium text-amber-800 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Some time slots may not be available
                  </p>
                  <p className="text-sm text-amber-700 mt-1">
                    The admin will review your schedule and may suggest alternative times if needed.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 4: Billing */}
        {step === 4 && (
          <Card className="rounded-2xl shadow-lg">
            <CardHeader className="bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-t-2xl">
              <div className="flex items-center gap-3">
                <CreditCard className="w-6 h-6" />
                <div>
                  <CardTitle>Billing Preferences</CardTitle>
                  <CardDescription className="text-purple-100">How would you like to pay?</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {/* Billing Frequency */}
              <div className="space-y-3">
                <Label className="text-base font-semibold">Billing Frequency</Label>
                <div className="grid grid-cols-2 gap-4">
                  <Button
                    variant={billing.billing_frequency === 'weekly' ? "default" : "outline"}
                    className={`h-auto py-4 flex flex-col ${billing.billing_frequency === 'weekly' ? 'bg-purple-500 hover:bg-purple-600' : ''}`}
                    onClick={() => setBilling({...billing, billing_frequency: 'weekly'})}
                  >
                    <span className="text-lg font-bold">Weekly</span>
                    <span className="text-xs opacity-80">Billed every week</span>
                  </Button>
                  <Button
                    variant={billing.billing_frequency === 'monthly' ? "default" : "outline"}
                    className={`h-auto py-4 flex flex-col ${billing.billing_frequency === 'monthly' ? 'bg-purple-500 hover:bg-purple-600' : ''}`}
                    onClick={() => setBilling({...billing, billing_frequency: 'monthly'})}
                  >
                    <span className="text-lg font-bold">Monthly</span>
                    <span className="text-xs opacity-80">Billed once a month</span>
                  </Button>
                </div>
              </div>

              {/* Payment Method */}
              <div className="space-y-3">
                <Label className="text-base font-semibold">Payment Method</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {PAYMENT_METHODS.map((method) => (
                    <Button
                      key={method.value}
                      variant={billing.payment_method === method.value ? "default" : "outline"}
                      className={`h-auto py-3 ${billing.payment_method === method.value ? 'bg-purple-500 hover:bg-purple-600' : ''}`}
                      onClick={() => setBilling({...billing, payment_method: method.value, payment_details: ''})}
                    >
                      {method.label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Payment Details */}
              {billing.payment_method !== 'check_cash' && (
                <div className="space-y-2">
                  <Label>
                    {PAYMENT_METHODS.find(m => m.value === billing.payment_method)?.label} Details
                  </Label>
                  <Input
                    value={billing.payment_details}
                    onChange={(e) => setBilling({...billing, payment_details: e.target.value})}
                    placeholder={PAYMENT_METHODS.find(m => m.value === billing.payment_method)?.placeholder}
                  />
                </div>
              )}

              <div className="p-4 rounded-lg bg-amber-50 border border-amber-200">
                <p className="text-sm text-amber-800">
                  <strong>Note:</strong> Our team will review your preferences and set up your pricing. 
                  You'll be notified once your account is ready for scheduling.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Navigation Buttons */}
        <div className="flex justify-between mt-6">
          {step > 1 ? (
            <Button variant="outline" onClick={prevStep} className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
          ) : (
            <div />
          )}
          
          {step < totalSteps ? (
            <Button onClick={nextStep} className="gap-2 bg-primary hover:bg-primary/90">
              Next
              <ArrowRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button 
              onClick={handleSubmit} 
              disabled={submitting}
              className="gap-2 bg-green-500 hover:bg-green-600"
            >
              {submitting ? 'Setting up...' : 'Complete Setup'}
              <CheckCircle className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClientOnboardingPage;
