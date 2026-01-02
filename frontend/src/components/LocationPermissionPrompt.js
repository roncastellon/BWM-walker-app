import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { MapPin, Navigation, Smartphone, CheckCircle, AlertTriangle, X } from 'lucide-react';

const LocationPermissionPrompt = ({ onComplete }) => {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState('checking'); // checking, prompt, granted, denied, unavailable

  useEffect(() => {
    checkLocationPermission();
  }, []);

  const checkLocationPermission = async () => {
    // Check if we've already prompted the user
    const hasPrompted = localStorage.getItem('locationPermissionPrompted');
    
    // Check if geolocation is available
    if (!navigator.geolocation) {
      setStatus('unavailable');
      if (!hasPrompted) {
        setOpen(true);
        localStorage.setItem('locationPermissionPrompted', 'true');
      }
      return;
    }

    // Check current permission status
    if (navigator.permissions) {
      try {
        const permission = await navigator.permissions.query({ name: 'geolocation' });
        
        if (permission.state === 'granted') {
          setStatus('granted');
          // Don't show dialog if already granted
          if (onComplete) onComplete(true);
          return;
        } else if (permission.state === 'denied') {
          setStatus('denied');
          if (!hasPrompted) {
            setOpen(true);
            localStorage.setItem('locationPermissionPrompted', 'true');
          }
          return;
        }
        
        // Permission is 'prompt' - show our dialog
        if (!hasPrompted) {
          setStatus('prompt');
          setOpen(true);
        }
      } catch (e) {
        // Fallback if permissions API not supported
        if (!hasPrompted) {
          setStatus('prompt');
          setOpen(true);
        }
      }
    } else {
      // No permissions API - show prompt anyway
      if (!hasPrompted) {
        setStatus('prompt');
        setOpen(true);
      }
    }
  };

  const requestPermission = () => {
    setStatus('requesting');
    localStorage.setItem('locationPermissionPrompted', 'true');
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setStatus('granted');
        setTimeout(() => {
          setOpen(false);
          if (onComplete) onComplete(true);
        }, 1500);
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          setStatus('denied');
        } else {
          setStatus('error');
        }
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleClose = () => {
    localStorage.setItem('locationPermissionPrompted', 'true');
    setOpen(false);
    if (onComplete) onComplete(false);
  };

  const handleLater = () => {
    localStorage.setItem('locationPermissionPrompted', 'true');
    setOpen(false);
    if (onComplete) onComplete(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Navigation className="w-5 h-5 text-primary" />
            </div>
            Enable Location Services
          </DialogTitle>
          <DialogDescription className="text-base">
            WagWalk uses your location to provide the best experience
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Benefits */}
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <MapPin className="w-5 h-5 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-sm">Track Walk Routes</p>
                <p className="text-xs text-muted-foreground">Record your walking path for clients to see</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <Smartphone className="w-5 h-5 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-sm">Real-Time Updates</p>
                <p className="text-xs text-muted-foreground">Let pet owners follow their pet's walk live</p>
              </div>
            </div>
          </div>

          {/* Status Messages */}
          {status === 'checking' && (
            <div className="flex items-center justify-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            </div>
          )}

          {status === 'requesting' && (
            <div className="p-4 rounded-xl bg-blue-50 border border-blue-200">
              <div className="flex items-center gap-3">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
                <p className="text-sm text-blue-700">Please allow location access when prompted by your browser...</p>
              </div>
            </div>
          )}

          {status === 'granted' && (
            <div className="p-4 rounded-xl bg-green-50 border border-green-200">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <div>
                  <p className="font-medium text-green-800">Location Enabled!</p>
                  <p className="text-sm text-green-600">You're all set for walk tracking</p>
                </div>
              </div>
            </div>
          )}

          {status === 'denied' && (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-amber-800">Location Access Blocked</p>
                  <p className="text-sm text-amber-600 mt-1">To enable location, update your settings:</p>
                  <ul className="text-xs text-amber-600 mt-2 space-y-1">
                    <li><strong>iPhone:</strong> Settings → Privacy → Location Services</li>
                    <li><strong>Android:</strong> Settings → Apps → Browser → Permissions</li>
                    <li><strong>Browser:</strong> Click lock icon in address bar</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {status === 'unavailable' && (
            <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-gray-500 mt-0.5" />
                <div>
                  <p className="font-medium text-gray-800">Location Not Available</p>
                  <p className="text-sm text-gray-600">Your device doesn't support location services. Walk tracking will be limited.</p>
                </div>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5" />
                <div>
                  <p className="font-medium text-red-800">Unable to Get Location</p>
                  <p className="text-sm text-red-600">Please make sure you're in an area with GPS signal and try again.</p>
                </div>
              </div>
            </div>
          )}
        </div>
        
        <DialogFooter className="flex gap-2 sm:gap-2">
          {(status === 'prompt' || status === 'error') && (
            <>
              <Button variant="ghost" onClick={handleLater} className="flex-1">
                Maybe Later
              </Button>
              <Button onClick={requestPermission} className="flex-1 rounded-full">
                <MapPin className="w-4 h-4 mr-2" />
                Allow Location
              </Button>
            </>
          )}
          
          {status === 'denied' && (
            <Button variant="outline" onClick={handleClose} className="w-full">
              I'll Update Settings Later
            </Button>
          )}
          
          {status === 'unavailable' && (
            <Button variant="outline" onClick={handleClose} className="w-full">
              Continue Without Location
            </Button>
          )}
          
          {status === 'granted' && (
            <Button onClick={handleClose} className="w-full rounded-full">
              <CheckCircle className="w-4 h-4 mr-2" />
              Continue
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default LocationPermissionPrompt;
