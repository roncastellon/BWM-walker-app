import "@/index.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { Toaster } from "./components/ui/sonner";
import LocationPermissionPrompt from "./components/LocationPermissionPrompt";
import InstallAppBanner from "./components/InstallAppBanner";

// Pages
import AuthPage from "./pages/AuthPage";
import ClientDashboard from "./pages/ClientDashboard";
import ClientProfilePage from "./pages/ClientProfilePage";
import ClientOnboardingPage from "./pages/ClientOnboardingPage";
import StaffOnboardingPage from "./pages/StaffOnboardingPage";
import WalkerDashboard from "./pages/WalkerDashboard";
import WalkerSchedulePage from "./pages/WalkerSchedulePage";
import WalkerMySchedulePage from "./pages/WalkerMySchedulePage";
import SitterDashboard from "./pages/SitterDashboard";
import SitterProfilePage from "./pages/SitterProfilePage";
import AdminDashboard from "./pages/AdminDashboard";
import SchedulePage from "./pages/SchedulePage";
import BillingPage from "./pages/BillingPage";
import PetsPage from "./pages/PetsPage";
import MessagesPage from "./pages/MessagesPage";
import CalendarPage from "./pages/CalendarPage";
import PayrollPage from "./pages/PayrollPage";
import WalkerProfilePage from "./pages/WalkerProfilePage";
import AdminClientsPage from "./pages/AdminClientsPage";
import AdminWalkersPage from "./pages/AdminWalkersPage";
import AdminSittersPage from "./pages/AdminSittersPage";
import AdminInvoicesPage from "./pages/AdminInvoicesPage";
import AdminPayrollPage from "./pages/AdminPayrollPage";
import AdminOvernightsPage from "./pages/AdminOvernightsPage";
import AdminDaycareCalendarPage from "./pages/AdminDaycareCalendarPage";
import AdminTimeOffPage from "./pages/AdminTimeOffPage";
import AdminProfilePage from "./pages/AdminProfilePage";
import LiveTrackingPage from "./pages/LiveTrackingPage";
import MassTextPage from "./pages/MassTextPage";
import SubscriptionPage from "./pages/SubscriptionPage";
import SetupPage from "./pages/SetupPage";
import DogParkPage from "./pages/DogParkPage";

// Protected Route Component
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading, isAuthenticated } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    // Redirect to appropriate dashboard based on role (without replace to preserve history)
    switch (user?.role) {
      case 'admin':
        return <Navigate to="/admin" />;
      case 'walker':
        return <Navigate to="/walker" />;
      default:
        return <Navigate to="/dashboard" />;
    }
  }

  return children;
};

// Home redirect based on auth state
const HomeRedirect = () => {
  const { user, loading, isAuthenticated } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  // Don't use replace here so back button works properly
  switch (user?.role) {
    case 'admin':
      return <Navigate to="/admin" />;
    case 'walker':
      return <Navigate to="/walker" />;
    case 'sitter':
      return <Navigate to="/sitter" />;
    default:
      return <Navigate to="/dashboard" />;
  }
};

function AppRoutes() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      {/* Home redirect */}
      <Route path="/" element={<HomeRedirect />} />

      {/* Setup - First time admin registration */}
      <Route path="/setup" element={<SetupPage />} />

      {/* Auth */}
      <Route
        path="/auth"
        element={isAuthenticated ? <HomeRedirect /> : <AuthPage />}
      />

      {/* Client Routes */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute allowedRoles={['client']}>
            <ClientDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/schedule"
        element={
          <ProtectedRoute allowedRoles={['client']}>
            <SchedulePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/billing"
        element={
          <ProtectedRoute allowedRoles={['client']}>
            <BillingPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/pets"
        element={
          <ProtectedRoute allowedRoles={['client']}>
            <PetsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute allowedRoles={['client']}>
            <ClientProfilePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/client/onboarding"
        element={
          <ProtectedRoute allowedRoles={['client']}>
            <ClientOnboardingPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/tracking"
        element={
          <ProtectedRoute allowedRoles={['client', 'walker', 'admin']}>
            <LiveTrackingPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/messages"
        element={
          <ProtectedRoute allowedRoles={['client', 'walker', 'admin']}>
            <MessagesPage />
          </ProtectedRoute>
        }
      />

      {/* Walker Routes */}
      <Route
        path="/walker"
        element={
          <ProtectedRoute allowedRoles={['walker']}>
            <WalkerDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/walker/onboarding"
        element={
          <ProtectedRoute allowedRoles={['walker']}>
            <StaffOnboardingPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/walker/schedule"
        element={
          <ProtectedRoute allowedRoles={['walker']}>
            <WalkerMySchedulePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/walker/schedule/new"
        element={
          <ProtectedRoute allowedRoles={['walker']}>
            <WalkerSchedulePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/walker/payroll"
        element={
          <ProtectedRoute allowedRoles={['walker']}>
            <PayrollPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/walker/chat"
        element={
          <ProtectedRoute allowedRoles={['walker']}>
            <MessagesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/walker/profile"
        element={
          <ProtectedRoute allowedRoles={['walker']}>
            <WalkerProfilePage />
          </ProtectedRoute>
        }
      />

      {/* Sitter Routes */}
      <Route
        path="/sitter"
        element={
          <ProtectedRoute allowedRoles={['sitter']}>
            <SitterDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/sitter/onboarding"
        element={
          <ProtectedRoute allowedRoles={['sitter']}>
            <StaffOnboardingPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/sitter/schedule"
        element={
          <ProtectedRoute allowedRoles={['sitter']}>
            <CalendarPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/sitter/payroll"
        element={
          <ProtectedRoute allowedRoles={['sitter']}>
            <PayrollPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/sitter/chat"
        element={
          <ProtectedRoute allowedRoles={['sitter']}>
            <MessagesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/sitter/profile"
        element={
          <ProtectedRoute allowedRoles={['sitter']}>
            <SitterProfilePage />
          </ProtectedRoute>
        }
      />

      {/* Admin Routes */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/calendar"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <CalendarPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/clients"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminClientsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/walkers"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminWalkersPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/sitters"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminSittersPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/payroll"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminPayrollPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/overnights"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminOvernightsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/daycare"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminDaycareCalendarPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/time-off"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminTimeOffPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/invoices"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminInvoicesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/billing"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminInvoicesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/chat"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <MessagesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/profile"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminProfilePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/mass-text"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <MassTextPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/subscription"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <SubscriptionPage />
          </ProtectedRoute>
        }
      />

      {/* Dog Park - Available to all authenticated users */}
      <Route
        path="/dog-park"
        element={
          <ProtectedRoute allowedRoles={['admin', 'walker', 'sitter', 'client']}>
            <DogParkPage />
          </ProtectedRoute>
        }
      />

      {/* Catch all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <LocationPermissionPrompt />
        <InstallAppBanner />
        <AppRoutes />
        <Toaster richColors position="top-right" />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
