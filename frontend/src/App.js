import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';

// Import page components (will create these next)
import UserPage from './pages/UserPage';
import CounterPage from './pages/CounterPage';
import AdminPage from './pages/AdminPage';
import DisplayPage from './pages/DisplayPage';
import LoginPage from './pages/LoginPage';

// Import context providers (will create these later)
import { AuthProvider } from './context/AuthContext';
import { QueueProvider } from './context/QueueContext';

function App() {
  return (
    <Router>
      <AuthProvider>
        <QueueProvider>
          <div className="App">
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/user" element={<UserPage />} />
              <Route path="/counter" element={<CounterPage />} />
              <Route path="/admin" element={<AdminPage />} />
              <Route path="/display" element={<DisplayPage />} />
              <Route path="/" element={<Navigate to="/user" replace />} />
            </Routes>
          </div>
        </QueueProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;