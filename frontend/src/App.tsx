import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import Auth from './pages/Auth';

import Dashboard from './pages/Dashboard';
import Events from './pages/Events';
import EventDetail from './pages/EventDetail';
import Reporting from './pages/Reporting';
import Governance from './pages/Governance';
import SDGDashboard from './pages/SDGDashboard';
import Admin from './pages/Admin';

function AppContent() {
  const { user, loading, isAdmin } = useAuth();

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        backgroundColor: '#080d0a',
        color: '#e2e8f0',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        <div style={{
          width: '36px',
          height: '36px',
          border: '3px solid rgba(16, 185, 129, 0.2)',
          borderRadius: '50%',
          borderTopColor: '#10b981',
          animation: 'spin 0.8s linear infinite'
        }}></div>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="events" element={<Events />} />
          <Route path="events/:id" element={<EventDetail />} />
          <Route path="reporting" element={<Reporting />} />
          <Route path="governance" element={<Governance />} />
          <Route path="sdg" element={<SDGDashboard />} />
          {isAdmin && <Route path="admin" element={<Admin />} />}
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
