import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { X, Download, Smartphone, Share, PlusSquare, CheckCircle } from 'lucide-react';

const InstallAppBanner = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showBanner, setShowBanner] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isSafari, setIsSafari] = useState(false);

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

    // Check if Safari
    const isSafariBrowser = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    setIsSafari(isSafariBrowser);

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
    setShowIOSInstructions(false);
    localStorage.setItem('installBannerDismissed', 'true');
  };

  const handleShowIOSInstructions = () => {
    setShowIOSInstructions(true);
  };

  if (!showBanner) return null;

  // iOS Detailed Instructions Modal
  if (showIOSInstructions && isIOS) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-orange-500 to-sky-500 p-4 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smartphone className="w-6 h-6" />
                <h2 className="font-bold text-lg">Install BowWowMeow</h2>
              </div>
              <Button 
                variant="ghost" 
                size="icon"
                onClick={handleDismiss}
                className="text-white hover:bg-white/20 rounded-full h-8 w-8"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
          </div>

          {/* Instructions */}
          <div className="p-4 space-y-4">
            {!isSafari && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-800 text-sm">
                <strong>⚠️ Open in Safari</strong>
                <p className="mt-1">You must use Safari to install this app on your iPhone or iPad.</p>
              </div>
            )}

            <div className="space-y-3">
              {/* Step 1 */}
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-sky-500 text-white rounded-full flex items-center justify-center font-bold text-sm">
                  1
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-800">Tap the Share button</p>
                  <p className="text-sm text-gray-500 flex items-center gap-1">
                    Look for the <Share className="w-4 h-4 inline text-sky-500" /> icon at the bottom of Safari
                  </p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-sky-500 text-white rounded-full flex items-center justify-center font-bold text-sm">
                  2
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-800">Scroll down in the menu</p>
                  <p className="text-sm text-gray-500">Find "Add to Home Screen"</p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-sky-500 text-white rounded-full flex items-center justify-center font-bold text-sm">
                  3
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-800 flex items-center gap-1">
                    Tap <PlusSquare className="w-4 h-4 inline text-sky-500" /> Add to Home Screen
                  </p>
                  <p className="text-sm text-gray-500">Then tap "Add" in the top right corner</p>
                </div>
              </div>

              {/* Step 4 */}
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center">
                  <CheckCircle className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-800">Done!</p>
                  <p className="text-sm text-gray-500">BowWowMeow will appear on your home screen</p>
                </div>
              </div>
            </div>

            {/* Visual hint */}
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500 mb-2">The app icon will look like this:</p>
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl overflow-hidden shadow-md">
                <img src="/icons/icon-192x192.png" alt="BowWowMeow icon" className="w-full h-full" />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t bg-gray-50">
            <Button 
              onClick={handleDismiss}
              className="w-full bg-gradient-to-r from-orange-500 to-sky-500 hover:from-orange-600 hover:to-sky-600 text-white rounded-full"
            >
              Got it!
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Standard Banner
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
                Add to your home screen for quick access
              </p>
            ) : (
              <p className="text-sm text-white/90">Add to your home screen for quick access</p>
            )}
          </div>
          <div className="flex gap-2">
            {isIOS ? (
              <Button 
                onClick={handleShowIOSInstructions}
                className="bg-white text-orange-600 hover:bg-white/90 font-bold rounded-full"
              >
                How to Install
              </Button>
            ) : deferredPrompt ? (
              <Button 
                onClick={handleInstall}
                className="bg-white text-orange-600 hover:bg-white/90 font-bold rounded-full"
              >
                <Download className="w-4 h-4 mr-1" />
                Install
              </Button>
            ) : null}
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
