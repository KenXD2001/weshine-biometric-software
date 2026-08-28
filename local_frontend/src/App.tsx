import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { authService } from './services/api';
import AuthLayout from './layouts/AuthLayout';
import MainLayout from './layouts/MainLayout';
import LoginPage from './pages/LoginPage';
import BiometricSoftware from './pages/BiometricSoftware';
import BiometricCandidateList from './pages/BiometricCandidateList';

// Wrapper component to handle main layout
function MainAppWrapper({ onLogout }: { onLogout: () => void }) {
  const location = useLocation();
  
  return (
    <MainLayout onLogout={onLogout}>
      <Routes key={location.pathname}>
        <Route index element={<Navigate to="/biometric-software" />} />
        <Route path="biometric-software" element={<BiometricSoftware />} />
        <Route path="biometric-candidates" element={<BiometricCandidateList />} />
      </Routes>
    </MainLayout>
  );
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check authentication status on app load
    const checkAuth = () => {
      const authenticated = authService.isAuthenticated();
      setIsAuthenticated(authenticated);
      setIsLoading(false);
    };

    checkAuth();
  }, []);

  const handleLogin = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        {/* Auth Routes */}
        <Route 
          path="/login" 
          element={
            isAuthenticated ? 
            <Navigate to="/biometric-software" /> : 
            <AuthLayout>
              <LoginPage onLogin={handleLogin} />
            </AuthLayout>
          } 
        />

        {/* Main App Routes */}
        <Route 
          path="/*" 
          element={
            isAuthenticated ? 
            <MainAppWrapper onLogout={handleLogout} /> : 
            <Navigate to="/login" />
          } 
        />
      </Routes>
    </Router>
  );
}

export default App;
