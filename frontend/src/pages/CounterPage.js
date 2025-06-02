import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useQueue } from '../context/QueueContext';
import '../styles/CounterPage.css';

const CounterPage = () => {
  const { user, logout, isAuthenticated } = useAuth();
  const { 
    services, 
    counters,
    physicalTickets,
    virtualTickets,
    currentServing,
    callNextCustomer,
    loading
  } = useQueue();
  
  const [selectedService, setSelectedService] = useState('');
  const [selectedCounter, setSelectedCounter] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  const navigate = useNavigate();
  
  // Redirect to login if not authenticated or not a counter staff
  useEffect(() => {
    if (!loading && (!isAuthenticated || (user && user.role !== 'counter'))) {
      navigate('/login');
    }
  }, [isAuthenticated, loading, navigate, user]);
  
  // Filter counters by selected service
  const filteredCounters = selectedService 
    ? counters.filter(counter => counter.serviceId === selectedService)
    : [];
  
  // Get physical tickets for the selected service
  const servicePhysicalTickets = selectedService
    ? physicalTickets.filter(ticket => ticket.serviceId === selectedService)
    : [];
  
  // Get virtual tickets for the selected service
  const serviceVirtualTickets = selectedService
    ? virtualTickets.filter(ticket => ticket.serviceId === selectedService)
    : [];
  
  // Get currently serving ticket for this counter
  const currentlyServing = selectedCounter && currentServing[selectedCounter]
    ? currentServing[selectedCounter]
    : null;
  
  // Handle service selection
  const handleServiceChange = (e) => {
    setSelectedService(e.target.value);
    setSelectedCounter(''); // Reset counter selection when service changes
    setError('');
  };
  
  // Handle counter selection
  const handleCounterChange = (e) => {
    setSelectedCounter(e.target.value);
    setError('');
  };
  
  // Call next customer
  const handleCallNext = async () => {
    if (!selectedService) {
      setError('Please select a service');
      return;
    }
    
    if (!selectedCounter) {
      setError('Please select a counter/desk');
      return;
    }
    
    setIsProcessing(true);
    setError('');
    
    try {
      const result = await callNextCustomer(selectedCounter, selectedService);
      
      if (result.message === 'No customers waiting') {
        setSuccess('No customers waiting in the queue');
      } else {
        setSuccess(`Now serving ticket #${result.ticket.ticketNumber}`);
      }
      
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
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
    <div className="counter-page">
      <header className="counter-header">
        <h1>Counter Staff Portal</h1>
        <div className="counter-info">
          {user && (
            <>
              <span>Welcome, {user.name}</span>
              <button className="btn btn-secondary" onClick={handleLogout}>Logout</button>
            </>
          )}
        </div>
      </header>
      
      <main className="counter-main">
        <div className="container">
          {error && <div className="alert alert-danger">{error}</div>}
          {success && <div className="alert alert-success">{success}</div>}
          
          <div className="counter-controls">
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
            
            <div className="form-group">
              <label htmlFor="counter">Select Counter/Desk</label>
              <select
                id="counter"
                className="form-control"
                value={selectedCounter}
                onChange={handleCounterChange}
                disabled={isProcessing || !selectedService || filteredCounters.length === 0}
              >
                <option value="">Select a counter...</option>
                {filteredCounters.map((counter) => (
                  <option key={counter.id} value={counter.id}>
                    {counter.name} (Room {counter.roomNumber})
                  </option>
                ))}
              </select>
            </div>
          </div>
          
          {selectedService && selectedCounter && (
            <div className="counter-dashboard">
              <div className="counter-stats">
                <div className="stat-card">
                  <h3>Physical Tickets</h3>
                  <div className="stat-value">{servicePhysicalTickets.length}</div>
                </div>
                
                <div className="stat-card">
                  <h3>Virtual Tickets</h3>
                  <div className="stat-value">{serviceVirtualTickets.length}</div>
                </div>
                
                <div className="stat-card">
                  <h3>Total Waiting</h3>
                  <div className="stat-value">
                    {servicePhysicalTickets.length + serviceVirtualTickets.length}
                  </div>
                </div>
              </div>
              
              <div className="current-serving">
                <h2>Currently Serving</h2>
                {currentlyServing ? (
                  <div className="serving-card">
                    <div className="ticket-number">{currentlyServing.ticketNumber}</div>
                    <div className="customer-name">{currentlyServing.customerName}</div>
                  </div>
                ) : (
                  <div className="no-serving">No customer currently being served</div>
                )}
                
                <button
                  className="btn btn-primary btn-next"
                  onClick={handleCallNext}
                  disabled={isProcessing}
                >
                  {isProcessing ? 'Processing...' : 'Next Customer'}
                </button>
              </div>
              
              <div className="queue-list">
                <h2>Waiting Customers</h2>
                {servicePhysicalTickets.length > 0 ? (
                  <table className="ticket-table">
                    <thead>
                      <tr>
                        <th>Ticket #</th>
                        <th>Customer</th>
                        <th>Wait Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {servicePhysicalTickets.map((ticket) => {
                        // Calculate wait time in minutes
                        const createdAt = new Date(ticket.createdAt);
                        const now = new Date();
                        const waitMinutes = Math.floor((now - createdAt) / (1000 * 60));
                        
                        return (
                          <tr key={ticket.id}>
                            <td>{ticket.ticketNumber}</td>
                            <td>{ticket.customerName}</td>
                            <td>{waitMinutes} mins</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <div className="no-tickets">No customers waiting in the physical queue</div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default CounterPage;