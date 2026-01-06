import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { X, Download, Smartphone } from 'lucide-react';

const InstallAppBanner = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if already installed or dismissed
    const dismissed = localStorage.getItem('installBannerDismissed');
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    
    if (dismissed || isStandalone) {
      return;
    }

    // Check if iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(isIOSDevice);

    if (isIOSDevice) {
      // Show iOS instructions after a delay
      setTimeout(() => setShowBanner(true), 2000);
      return;
    }

    // Android/Chrome - listen for install prompt
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setTimeout(() => setShowBanner(true), 1500);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Check if prompt was already captured
    if (window.deferredPrompt) {
      setDeferredPrompt(window.deferredPrompt);
      setTimeout(() => setShowBanner(true), 1500);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setShowBanner(false);
      localStorage.setItem('installBannerDismissed', 'true');
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem('installBannerDismissed', 'true');
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-gradient-to-r from-orange-500 to-sky-500 text-white shadow-lg animate-in slide-in-from-bottom duration-300">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white/20 rounded-xl">
            <Smartphone className="w-8 h-8" />
          </div>
          <div className="flex-1">
            <p className="font-bold text-lg">Install BowWowMeow</p>
            {isIOS ? (
              <p className="text-sm text-white/90">
                Tap <span className="inline-block px-1 bg-white/20 rounded">Share</span> then "Add to Home Screen"
              </p>
            ) : (
              <p className="text-sm text-white/90">Add to your home screen for quick access</p>
            )}
          </div>
          <div className="flex gap-2">
            {!isIOS && deferredPrompt && (
              <Button 
                onClick={handleInstall}
                className="bg-white text-orange-600 hover:bg-white/90 font-bold rounded-full"
              >
                <Download className="w-4 h-4 mr-1" />
                Install
              </Button>
            )}
            <Button 
              variant="ghost" 
              size="icon"
              onClick={handleDismiss}
              className="text-white hover:bg-white/20 rounded-full"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InstallAppBanner;
