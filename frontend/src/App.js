import "@/index.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { Toaster } from "./components/ui/sonner";
import LocationPermissionPrompt from "./components/LocationPermissionPrompt";

// Pages
import AuthPage from "./pages/AuthPage";
import ClientDashboard from "./pages/ClientDashboard";
import ClientProfilePage from "./pages/ClientProfilePage";
import WalkerDashboard from "./pages/WalkerDashboard";
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
import AdminInvoicesPage from "./pages/AdminInvoicesPage";
import AdminProfilePage from "./pages/AdminProfilePage";
import LiveTrackingPage from "./pages/LiveTrackingPage";
import MassTextPage from "./pages/MassTextPage";
import SubscriptionPage from "./pages/SubscriptionPage";

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
    // Redirect to appropriate dashboard based on role
    switch (user?.role) {
      case 'admin':
        return <Navigate to="/admin" replace />;
      case 'walker':
        return <Navigate to="/walker" replace />;
      default:
        return <Navigate to="/dashboard" replace />;
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

  switch (user?.role) {
    case 'admin':
      return <Navigate to="/admin" replace />;
    case 'walker':
      return <Navigate to="/walker" replace />;
    default:
      return <Navigate to="/dashboard" replace />;
  }
};

function AppRoutes() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      {/* Home redirect */}
      <Route path="/" element={<HomeRedirect />} />

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
        path="/walker/schedule"
        element={
          <ProtectedRoute allowedRoles={['walker']}>
            <CalendarPage />
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
        <AppRoutes />
        <Toaster richColors position="top-right" />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
