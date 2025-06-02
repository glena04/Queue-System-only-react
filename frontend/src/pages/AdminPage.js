import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useQueue } from '../context/QueueContext';
import '../styles/AdminPage.css';

const AdminPage = () => {
  const { user, logout, isAuthenticated } = useAuth();
  const { 
    services, 
    counters,
    virtualTickets,
    physicalTickets,
    currentServing,
    statistics,
    addService,
    deleteService,
    addCounter,
    deleteCounter,
    loading
  } = useQueue();
  
  const [newServiceName, setNewServiceName] = useState('');
  const [newCounterData, setNewCounterData] = useState({
    name: '',
    roomNumber: '',
    serviceId: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState('services');
  
  const navigate = useNavigate();
  
  // Redirect to login if not authenticated or not an admin
  useEffect(() => {
    if (!loading && (!isAuthenticated || (user && user.role !== 'admin'))) {
      navigate('/login');
    }
  }, [isAuthenticated, loading, navigate, user]);
  
  // Handle service form input
  const handleServiceNameChange = (e) => {
    setNewServiceName(e.target.value);
    setError('');
  };
  
  // Handle counter form input
  const handleCounterInputChange = (e) => {
    const { name, value } = e.target;
    setNewCounterData(prev => ({
      ...prev,
      [name]: value
    }));
    setError('');
  };
  
  // Add new service
  const handleAddService = async (e) => {
    e.preventDefault();
    
    if (!newServiceName.trim()) {
      setError('Service name is required');
      return;
    }
    
    setIsProcessing(true);
    setError('');
    
    try {
      await addService(newServiceName);
      setSuccess(`Service "${newServiceName}" added successfully`);
      setNewServiceName('');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Delete a service
  const handleDeleteService = async (serviceId, serviceName) => {
    if (!window.confirm(`Are you sure you want to delete "${serviceName}"? This will remove all associated tickets and counters.`)) {
      return;
    }
    
    setIsProcessing(true);
    setError('');
    
    try {
      await deleteService(serviceId);
      setSuccess(`Service "${serviceName}" deleted successfully`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Add new counter/desk
  const handleAddCounter = async (e) => {
    e.preventDefault();
    
    if (!newCounterData.name.trim()) {
      setError('Counter name is required');
      return;
    }
    
    if (!newCounterData.roomNumber.trim()) {
      setError('Room number is required');
      return;
    }
    
    if (!newCounterData.serviceId) {
      setError('Please select a service');
      return;
    }
    
    setIsProcessing(true);
    setError('');
    
    try {
      await addCounter(newCounterData);
      setSuccess(`Counter "${newCounterData.name}" added successfully`);
      setNewCounterData({
        name: '',
        roomNumber: '',
        serviceId: ''
      });
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Delete a counter
  const handleDeleteCounter = async (counterId, counterName) => {
    if (!window.confirm(`Are you sure you want to delete counter "${counterName}"?`)) {
      return;
    }
    
    setIsProcessing(true);
    setError('');
    
    try {
      await deleteCounter(counterId);
      setSuccess(`Counter "${counterName}" deleted successfully`);
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
  
  // Get total virtual tickets count
  const getTotalVirtualTickets = () => {
    return virtualTickets.length;
  };
  
  // Get total physical tickets count
  const getTotalPhysicalTickets = () => {
    return physicalTickets.length;
  };
  
  // Get tickets count per service
  const getServiceTicketCounts = (serviceId) => {
    const virtual = virtualTickets.filter(ticket => ticket.serviceId === serviceId).length;
    const physical = physicalTickets.filter(ticket => ticket.serviceId === serviceId).length;
    return { virtual, physical };
  };
  
  // Get counters for a service
  const getServiceCounters = (serviceId) => {
    return counters.filter(counter => counter.serviceId === serviceId);
  };
  
  if (loading) {
    return <div className="loading">Loading...</div>;
  }
  
  return (
    <div className="admin-page">
      <header className="admin-header">
        <h1>Admin Dashboard</h1>
        <div className="admin-info">
          {user && (
            <>
              <span>Welcome, {user.name}</span>
              <button className="btn btn-secondary" onClick={handleLogout}>Logout</button>
            </>
          )}
        </div>
      </header>
      
      <main className="admin-main">
        <div className="container">
          {error && <div className="alert alert-danger">{error}</div>}
          {success && <div className="alert alert-success">{success}</div>}
          
          <div className="admin-tabs">
            <button 
              className={`tab-btn ${activeTab === 'services' ? 'active' : ''}`}
              onClick={() => setActiveTab('services')}
            >
              Services
            </button>
            <button 
              className={`tab-btn ${activeTab === 'counters' ? 'active' : ''}`}
              onClick={() => setActiveTab('counters')}
            >
              Counters
            </button>
            <button 
              className={`tab-btn ${activeTab === 'statistics' ? 'active' : ''}`}
              onClick={() => setActiveTab('statistics')}
            >
              Statistics
            </button>
            <button 
              className={`tab-btn ${activeTab === 'live' ? 'active' : ''}`}
              onClick={() => setActiveTab('live')}
            >
              Live Status
            </button>
          </div>
          
          <div className="admin-content">
            {/* Services Tab */}
            {activeTab === 'services' && (
              <div className="services-tab">
                <h2>Manage Services</h2>
                
                <div className="add-service-form">
                  <form onSubmit={handleAddService}>
                    <div className="form-group">
                      <label htmlFor="serviceName">Service Name</label>
                      <input
                        type="text"
                        id="serviceName"
                        className="form-control"
                        value={newServiceName}
                        onChange={handleServiceNameChange}
                        disabled={isProcessing}
                        placeholder="Enter service name"
                      />
                    </div>
                    
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={isProcessing || !newServiceName.trim()}
                    >
                      {isProcessing ? 'Adding...' : 'Add Service'}
                    </button>
                  </form>
                </div>
                
                <div className="services-list">
                  <h3>Current Services</h3>
                  
                  {services.length > 0 ? (
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Service Name</th>
                          <th>Counters</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {services.map((service) => (
                          <tr key={service.id}>
                            <td>{service.name}</td>
                            <td>{getServiceCounters(service.id).length}</td>
                            <td>
                              <button
                                className="btn btn-danger btn-sm"
                                onClick={() => handleDeleteService(service.id, service.name)}
                                disabled={isProcessing}
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="no-data">No services available</div>
                  )}
                </div>
              </div>
            )}
            
            {/* Counters Tab */}
            {activeTab === 'counters' && (
              <div className="counters-tab">
                <h2>Manage Counters</h2>
                
                <div className="add-counter-form">
                  <form onSubmit={handleAddCounter}>
                    <div className="form-row">
                      <div className="form-group">
                        <label htmlFor="counterName">Counter Name</label>
                        <input
                          type="text"
                          id="counterName"
                          name="name"
                          className="form-control"
                          value={newCounterData.name}
                          onChange={handleCounterInputChange}
                          disabled={isProcessing}
                          placeholder="Enter counter name"
                        />
                      </div>
                      
                      <div className="form-group">
                        <label htmlFor="roomNumber">Room Number</label>
                        <input
                          type="text"
                          id="roomNumber"
                          name="roomNumber"
                          className="form-control"
                          value={newCounterData.roomNumber}
                          onChange={handleCounterInputChange}
                          disabled={isProcessing}
                          placeholder="Enter room number"
                        />
                      </div>
                      
                      <div className="form-group">
                        <label htmlFor="counterService">Service</label>
                        <select
                          id="counterService"
                          name="serviceId"
                          className="form-control"
                          value={newCounterData.serviceId}
                          onChange={handleCounterInputChange}
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
                    </div>
                    
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={
                        isProcessing || 
                        !newCounterData.name.trim() || 
                        !newCounterData.roomNumber.trim() || 
                        !newCounterData.serviceId
                      }
                    >
                      {isProcessing ? 'Adding...' : 'Add Counter'}
                    </button>
                  </form>
                </div>
                
                <div className="counters-list">
                  <h3>Current Counters</h3>
                  
                  {counters.length > 0 ? (
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Counter Name</th>
                          <th>Room Number</th>
                          <th>Service</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {counters.map((counter) => (
                          <tr key={counter.id}>
                            <td>{counter.name}</td>
                            <td>{counter.roomNumber}</td>
                            <td>{services.find(s => s.id === counter.serviceId)?.name || 'Unknown'}</td>
                            <td>
                              <button
                                className="btn btn-danger btn-sm"
                                onClick={() => handleDeleteCounter(counter.id, counter.name)}
                                disabled={isProcessing}
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="no-data">No counters available</div>
                  )}
                </div>
              </div>
            )}
            
            {/* Statistics Tab */}
            {activeTab === 'statistics' && (
              <div className="statistics-tab">
                <h2>System Statistics</h2>
                
                <div className="stats-overview">
                  <div className="stats-card">
                    <h3>Total Served Today</h3>
                    <div className="stat-value">{statistics.totalServedToday || 0}</div>
                  </div>
                  
                  <div className="stats-card">
                    <h3>Average Wait Time</h3>
                    <div className="stat-value">
                      {statistics.overallAvgWaitTime 
                        ? `${Math.round(statistics.overallAvgWaitTime)} mins` 
                        : 'N/A'}
                    </div>
                  </div>
                  
                  <div className="stats-card">
                    <h3>Current Queue Size</h3>
                    <div className="stat-value">
                      {getTotalPhysicalTickets() + getTotalVirtualTickets()}
                    </div>
                  </div>
                </div>
                
                <div className="service-stats">
                  <h3>Service Breakdown</h3>
                  
                  {services.length > 0 ? (
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Service</th>
                          <th>Avg. Wait Time</th>
                          <th>Served Today</th>
                          <th>Current Queue</th>
                        </tr>
                      </thead>
                      <tbody>
                        {services.map((service) => {
                          const ticketCounts = getServiceTicketCounts(service.id);
                          return (
                            <tr key={service.id}>
                              <td>{service.name}</td>
                              <td>
                                {statistics.avgWaitTimeByService?.[service.id] 
                                  ? `${Math.round(statistics.avgWaitTimeByService[service.id])} mins` 
                                  : 'N/A'}
                              </td>
                              <td>{statistics.servedTodayByService?.[service.id] || 0}</td>
                              <td>
                                {ticketCounts.physical} physical, {ticketCounts.virtual} virtual
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  ) : (
                    <div className="no-data">No services available</div>
                  )}
                </div>
              </div>
            )}
            
            {/* Live Status Tab */}
            {activeTab === 'live' && (
              <div className="live-status-tab">
                <h2>Live Queue Status</h2>
                
                <div className="queue-overview">
                  <div className="overview-card">
                    <h3>Virtual Tickets</h3>
                    <div className="overview-value">{getTotalVirtualTickets()}</div>
                  </div>
                  
                  <div className="overview-card">
                    <h3>Physical Tickets</h3>
                    <div className="overview-value">{getTotalPhysicalTickets()}</div>
                  </div>
                  
                  <div className="overview-card">
                    <h3>Active Counters</h3>
                    <div className="overview-value">
                      {Object.keys(currentServing).filter(key => currentServing[key]).length}
                    </div>
                  </div>
                </div>
                
                <div className="active-counters">
                  <h3>Currently Serving</h3>
                  
                  {counters.length > 0 ? (
                    <div className="counter-grid">
                      {counters.map((counter) => {
                        const currentTicket = currentServing[counter.id];
                        const service = services.find(s => s.id === counter.serviceId);
                        
                        return (
                          <div 
                            key={counter.id} 
                            className={`counter-status-card ${currentTicket ? 'active' : 'inactive'}`}
                          >
                            <div className="counter-title">
                              <h4>{counter.name}</h4>
                              <span className="room-number">Room {counter.roomNumber}</span>
                            </div>
                            
                            <div className="counter-service">
                              {service ? service.name : 'Unknown Service'}
                            </div>
                            
                            {currentTicket ? (
                              <div className="current-ticket">
                                <div className="ticket-number">{currentTicket.ticketNumber}</div>
                                <div className="customer-name">{currentTicket.customerName}</div>
                              </div>
                            ) : (
                              <div className="no-ticket">Not currently serving</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="no-data">No counters available</div>
                  )}
                </div>
                
                <div className="service-queue-status">
                  <h3>Service Queue Status</h3>
                  
                  {services.length > 0 ? (
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Service</th>
                          <th>Physical Queue</th>
                          <th>Virtual Queue</th>
                          <th>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {services.map((service) => {
                          const ticketCounts = getServiceTicketCounts(service.id);
                          return (
                            <tr key={service.id}>
                              <td>{service.name}</td>
                              <td>{ticketCounts.physical}</td>
                              <td>{ticketCounts.virtual}</td>
                              <td>{ticketCounts.physical + ticketCounts.virtual}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  ) : (
                    <div className="no-data">No services available</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminPage;