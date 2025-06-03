import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useQueue } from '../context/QueueContext';
import '../styles/UserPage.css';

const UserPage = () => {
  const { user, logout, isAuthenticated } = useAuth();
  const { 
    services, 
    counters,        // ← Add this line
    userTicket, 
    virtualTickets,
    physicalTickets,
    currentServing,
    getVirtualTicket, 
    markTicketAsPresent,
    getEstimatedWaitTime,
    loading
  } = useQueue();
  
  const [selectedService, setSelectedService] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  const navigate = useNavigate();
  
  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isAuthenticated && !loading) {
      navigate('/login');
    }
  }, [isAuthenticated, loading, navigate]);
  
  // Handle service selection
  const handleServiceChange = (e) => {
    setSelectedService(e.target.value);
    setError('');
  };
  
  // Get a virtual ticket
  const handleGetTicket = async () => {
    if (!selectedService) {
      setError('Please select a service');
      return;
    }
    
    setIsProcessing(true);
    setError('');
    
    try {
      await getVirtualTicket(selectedService);
      setSuccess('Virtual ticket created successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Mark ticket as present (convert virtual to physical)
  const handleMarkPresent = async () => {
    if (!userTicket || userTicket.status !== 'virtual') {
      setError('No valid virtual ticket found');
      return;
    }
    
    setIsProcessing(true);
    setError('');
    
    try {
      await markTicketAsPresent(userTicket.id);
      setSuccess('Ticket marked as present! You are now in the physical queue.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Calculate position in queue
  const getPositionInQueue = () => {
    if (!userTicket) return 'N/A';
    
    if (userTicket.status === 'virtual') {
      return 'Virtual - Not yet in physical queue';
    }
    
    const ticketsAhead = physicalTickets.filter(
      t => t.serviceId === userTicket.serviceId && 
      t.createdAt < userTicket.createdAt &&
      t.status === 'physical'
    ).length;
    
    return ticketsAhead + 1; // +1 because position starts at 1, not 0
  };
  
  // Get people ahead count
  const getPeopleAhead = () => {
    if (!userTicket || userTicket.status === 'virtual') return 'N/A';
    
    return physicalTickets.filter(
      t => t.serviceId === userTicket.serviceId && 
      t.createdAt < userTicket.createdAt &&
      t.status === 'physical'
    ).length;
  };
  
// Check if user's ticket is being called
const isBeingCalled = () => {
  if (!userTicket) return false;
  
  // Check if this user's ticket is currently being served
  const servingTicket = Object.values(currentServing).find(
    ticket => ticket && ticket.id === userTicket.id
  );
  
  return !!servingTicket;
};
  
// Get the currently called number for user's service
const getCurrentlyCalledNumber = () => {
  if (!userTicket) return 'N/A';
  
  // Find any ticket currently being served for the same service
  const servingTicket = Object.values(currentServing).find(
    ticket => ticket && ticket.serviceId === userTicket.serviceId
  );
  
  return servingTicket ? servingTicket.ticketNumber : 'None';
};
  
  // Handle logout
  const handleLogout = () => {
    logout();
    navigate('/login');
  };
  
  if (loading) {
    return <div className="loading">Loading...</div>;
  }
  
  return (
    <div className="user-page">
      <header className="user-header">
        <h1>Queue Management System</h1>
        <div className="user-info">
          {user && (
            <>
              <span>Welcome, {user.name}</span>
              <button className="btn btn-secondary" onClick={handleLogout}>Logout</button>
            </>
          )}
        </div>
      </header>
      
      <main className="user-main">
        <div className="container">
          {error && <div className="alert alert-danger">{error}</div>}
          {success && <div className="alert alert-success">{success}</div>}
          
          <div className="grid">
            {/* Get Ticket Section */}
            <div className="card">
              <h2>Get a Ticket</h2>
              {!userTicket ? (
                <>
                  <div className="form-group">
                    <label htmlFor="service">Select Service</label>
                    <select
                      id="service"
                      className="form-control"
                      value={selectedService}
                      onChange={handleServiceChange}
                      disabled={isProcessing}
                    >
                      <option value="">Select a service...</option>
                      {services.map((service) => (
                        <option key={service.id} value={service.id}>
                          {service.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <button
                    className="btn btn-primary"
                    onClick={handleGetTicket}
                    disabled={isProcessing || !selectedService}
                  >
                    {isProcessing ? 'Processing...' : 'Get Virtual Ticket'}
                  </button>
                </>
              ) : (
                <>
                  <div className="ticket-info">
                    <p>
                      <strong>Ticket Number:</strong> {userTicket.ticketNumber}
                    </p>
                    <p>
                      <strong>Service:</strong>{' '}
                      {services.find(s => s.id === userTicket.serviceId)?.name || 'Unknown'}
                    </p>
                    <p>
                      <strong>Status:</strong>{' '}
                      <span className={`status status-${userTicket.status}`}>
                        {userTicket.status.charAt(0).toUpperCase() + userTicket.status.slice(1)}
                      </span>
                    </p>
                    
                    {userTicket.status === 'virtual' && (
                      <button
                        className="btn btn-success"
                        onClick={handleMarkPresent}
                        disabled={isProcessing}
                      >
                        {isProcessing ? 'Processing...' : 'Mark as Present'}
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
            
            {/* Queue Status Section */}
            {userTicket && (
              <div className="card">
                <h2>Your Queue Status</h2>
                <div className="queue-status">
                  <div className="status-item">
                    <span className="status-label">Position:</span>
                    <span className="status-value">{getPositionInQueue()}</span>
                  </div>
                  
                  <div className="status-item">
                    <span className="status-label">People Ahead:</span>
                    <span className="status-value">{getPeopleAhead()}</span>
                  </div>
                  
                  <div className="status-item">
                    <span className="status-label">Estimated Wait:</span>
                    <span className="status-value">
                      {userTicket ? getEstimatedWaitTime(userTicket.id) : 'N/A'}
                    </span>
                  </div>
                  
                  <div className="status-item">
                    <span className="status-label">Currently Called:</span>
                    <span className="status-value">{getCurrentlyCalledNumber()}</span>
                  </div>
                </div>
                
                {isBeingCalled() && (
                  <div className="now-serving">
                    <h3>Your number is being called!</h3>
                    <p>Please proceed to the service counter.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default UserPage;