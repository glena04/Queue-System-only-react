import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import axios from 'axios';
import io from 'socket.io-client';
import { useAuth } from './AuthContext';

// Create the context
const QueueContext = createContext();

// Custom hook to use the queue context
export const useQueue = () => useContext(QueueContext);

// Provider component
export const QueueProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  
  // State for tickets
  const [virtualTickets, setVirtualTickets] = useState([]);
  const [physicalTickets, setPhysicalTickets] = useState([]);
  const [services, setServices] = useState([]);
  const [counters, setCounters] = useState([]);
  const [currentServing, setCurrentServing] = useState({});
  const [userTicket, setUserTicket] = useState(null);
  const [statistics, setStatistics] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [socket, setSocket] = useState(null);
  
  // Initialize Socket.io connection
  useEffect(() => {
    // Connect to socket server
    const newSocket = io(process.env.REACT_APP_API_URL || 'http://localhost:5000');
    
    setSocket(newSocket);
    
    // Clean up on unmount
    return () => {
      newSocket.disconnect();
    };
  }, []);
  
  // Set up socket event listeners
  useEffect(() => {
    if (!socket) return;
    
// Listen for queue updates
socket.on('queueUpdate', (data) => {
  setVirtualTickets(data.virtualTickets || []);
  setPhysicalTickets(data.physicalTickets || []);
  setCurrentServing(data.currentServing || {});

  // Fetch user's ticket if authenticated
  if (user && isAuthenticated) {
    axios.get('/api/queue/user-ticket')
      .then(res => setUserTicket(res.data || null))
      .catch(() => setUserTicket(null));
  }
});
    
    // Listen for service updates
    socket.on('serviceUpdate', (data) => {
      setServices(data.services || []);
    });
    
    // Listen for counter updates
    socket.on('counterUpdate', (data) => {
      setCounters(data.counters || []);
    });
    
    // Listen for statistics updates
    socket.on('statisticsUpdate', (data) => {
      setStatistics(data.statistics || {});
    });
    
    // Clean up listeners on unmount
    return () => {
      socket.off('queueUpdate');
      socket.off('serviceUpdate');
      socket.off('counterUpdate');
      socket.off('statisticsUpdate');
    };
  }, [socket, user, isAuthenticated]);
  
  // Fetch initial queue data
  const fetchQueueData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch services
      const servicesRes = await axios.get('/api/services');
      setServices(servicesRes.data);
      
      // Fetch counters
      const countersRes = await axios.get('/api/counters');
      setCounters(countersRes.data);
      
      // Fetch current queue state
      const queueRes = await axios.get('/api/queue/status');
      setVirtualTickets(queueRes.data.virtualTickets);
      setPhysicalTickets(queueRes.data.physicalTickets);
      setCurrentServing(queueRes.data.currentServing);
      
      // Fetch user's ticket if authenticated
      if (isAuthenticated) {
        const userTicketRes = await axios.get('/api/queue/user-ticket');
        setUserTicket(userTicketRes.data || null);
      }
      
      // Fetch statistics (admin only)
      if (user && user.role === 'admin') {
        const statsRes = await axios.get('/api/statistics');
        setStatistics(statsRes.data);
      }
      
      setError(null);
    } catch (err) {
      console.error('Error fetching queue data:', err);
      setError('Failed to load queue data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, user]);
  
  // Fetch data when authenticated status changes
  useEffect(() => {
    fetchQueueData();
  }, [fetchQueueData]);
  
  // Get a virtual ticket
  const getVirtualTicket = async (serviceId) => {
    try {
      const response = await axios.post('/api/queue/virtual-ticket', { serviceId });
      setUserTicket(response.data);
      return response.data;
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Failed to get a ticket. Please try again.';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };
  
  // Mark virtual ticket as present (convert to physical)
  const markTicketAsPresent = async (ticketId) => {
    try {
      const response = await axios.patch(`/api/queue/tickets/${ticketId}/present`);
      setUserTicket(response.data);
      return response.data;
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Failed to update ticket status. Please try again.';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };
  
  // Call next customer (for counter staff)
  const callNextCustomer = async (counterId, serviceId) => {
    try {
      const response = await axios.post('/api/queue/next-customer', { counterId, serviceId });
      return response.data;
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Failed to call next customer. Please try again.';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };
  
  // Get estimated wait time
const getEstimatedWaitTime = (ticketId) => {
  if (!userTicket || !physicalTickets.length) return 'Unknown';
  
  const ticket = userTicket.id === ticketId ? userTicket : 
    [...virtualTickets, ...physicalTickets].find(t => t.id === ticketId);
  
  if (!ticket) return 'Unknown';
  
  // Find position in queue
  const ticketsAhead = physicalTickets.filter(
    t => t.serviceId === ticket.serviceId && 
    t.createdAt < ticket.createdAt && 
    t.status === 'physical'
  ).length;
  
  // Average time per customer (in minutes) - fix the property reference
  const avgTimePerCustomer = statistics.avgWaitTimeByService?.[ticket.serviceId] || 5;
  
  return `${ticketsAhead * avgTimePerCustomer} minutes`;
};
  
  // Add a new service (admin only)
  const addService = async (serviceName) => {
    try {
      const response = await axios.post('/api/services', { name: serviceName });
      return response.data;
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Failed to add service. Please try again.';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };
  
  // Delete a service (admin only)
  const deleteService = async (serviceId) => {
    try {
      await axios.delete(`/api/services/${serviceId}`);
      return true;
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Failed to delete service. Please try again.';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };
  
  // Add a new counter (admin only)
  const addCounter = async (counterData) => {
    try {
      const response = await axios.post('/api/counters', counterData);
      return response.data;
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Failed to add counter. Please try again.';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };
  
  // Delete a counter (admin only)
  const deleteCounter = async (counterId) => {
    try {
      await axios.delete(`/api/counters/${counterId}`);
      return true;
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Failed to delete counter. Please try again.';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };
  
  // Context value
  const value = {
    virtualTickets,
    physicalTickets,
    services,
    counters,
    currentServing,
    userTicket,
    statistics,
    loading,
    error,
    getVirtualTicket,
    markTicketAsPresent,
    callNextCustomer,
    getEstimatedWaitTime,
    addService,
    deleteService,
    addCounter,
    deleteCounter,
    refreshData: fetchQueueData
  };
  
  return <QueueContext.Provider value={value}>{children}</QueueContext.Provider>;
};

export default QueueContext;