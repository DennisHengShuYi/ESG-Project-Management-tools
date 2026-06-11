import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import { seedDatabase } from './utils/db';
import { useEffect } from 'react';

import Dashboard from './pages/Dashboard';
import Events from './pages/Events';
import EventDetail from './pages/EventDetail';
import Reporting from './pages/Reporting';
import Governance from './pages/Governance';
import SDGDashboard from './pages/SDGDashboard';
import Settings from './pages/Settings';

function App() {
  useEffect(() => {
    // Initialize mock database with seed data if empty
    seedDatabase();
  }, []);

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
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
