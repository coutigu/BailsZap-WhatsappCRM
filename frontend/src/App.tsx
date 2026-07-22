import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Contacts from './pages/Contacts';
import Users from './pages/Users';
import Groups from './pages/Groups';
import Sectors from './pages/Sectors';
import Settings from './pages/Settings';
import Statistics from './pages/Statistics';

import { useEffect } from 'react';
import { useThemeStore } from './store/themeStore';
import axios from 'axios';

// Global Axios Interceptor for 401 Unauthorized
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      const authStore = useAuthStore.getState();
      if (authStore.token) {
        authStore.logout();
        alert('Sua sessão expirou. Por favor, faça login novamente.');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

function PrivateRoute({ children }: { children: JSX.Element }) {
  const token = useAuthStore((state) => state.token);
  return token ? children : <Navigate to="/login" />;
}

function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useThemeStore((state) => state.theme);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  return <>{children}</>;
}

function App() {
  return (
    <ThemeProvider>
      <Router>
        <div className="min-h-screen font-sans selection:bg-primary/20 selection:text-primary">
          <Routes>
          <Route path="/login" element={<Login />} />
          <Route 
            path="/" 
            element={
              <PrivateRoute>
                <Dashboard />
              </PrivateRoute>
            } 
          />
          <Route 
            path="/contacts" 
            element={
              <PrivateRoute>
                <Contacts />
              </PrivateRoute>
            } 
          />
          <Route 
            path="/groups" 
            element={
              <PrivateRoute>
                <Groups />
              </PrivateRoute>
            } 
          />
          <Route 
            path="/users" 
            element={
              <PrivateRoute>
                <Users />
              </PrivateRoute>
            } 
          />
          <Route 
            path="/sectors" 
            element={
              <PrivateRoute>
                <Sectors />
              </PrivateRoute>
            } 
          />
          <Route 
            path="/settings" 
            element={
              <PrivateRoute>
                <Settings />
              </PrivateRoute>
            } 
          />
          <Route 
            path="/stats" 
            element={
              <PrivateRoute>
                <Statistics />
              </PrivateRoute>
            } 
          />
        </Routes>
      </div>
    </Router>
    </ThemeProvider>
  );
}

export default App;
