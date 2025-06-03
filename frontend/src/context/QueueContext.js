// Replace your frontend/src/context/QueueContext.js with this version
// This adds lots of console.log statements to debug the socket connection

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
  const [isConnected, setIsConnected] = useState(false);
  
  // Initialize Socket.io connection
  useEffect(() => {
    console.log('🔵 QueueContext: Initializing socket connection...');
    
    const serverUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';
    console.log('🔵 QueueContext: Connecting to:', serverUrl);
    
    // Connect to socket server
    const newSocket = io(serverUrl, {
      transports: ['websocket', 'polling'],
      timeout: 10000,
      forceNew: true
    });
    
    // Handle connection events
    newSocket.on('connect', () => {
      console.log('🟢 QueueContext: Socket connected!', newSocket.id);
      setIsConnected(true);
      
      // Authenticate if user is logged in
      if (user && isAuthenticated) {
        console.log('🔵 QueueContext: Authenticating user:', user.id);
        newSocket.emit('authenticate', {
          id: user.id,
          role: user.role
        });
      }
    });
    
    newSocket.on('disconnect', (reason) => {
      console.log('🔴 QueueContext: Socket disconnected:', reason);
      setIsConnected(false);
    });
    
    newSocket.on('connect_error', (error) => {
      console.error('❌ QueueContext: Socket connection error:', error);
      setIsConnected(false);
    });
    
    setSocket(newSocket);
    
    // Clean up on unmount
    return () => {
      console.log('🔵 QueueContext: Cleaning up socket connection');
      newSocket.disconnect();
    };
  }, []); // Empty dependency array - only run once
  
  // Set up socket event listeners
  useEffect(() => {
    if (!socket || !isConnected) {
      console.log('🔵 QueueContext: Skipping event listeners - socket not ready');
      return;
    }
    
    console.log('🔵 QueueContext: Setting up socket event listeners');
    
    // Listen for service updates
    const handleServiceUpdate = (data) => {
      console.log('📡 QueueContext: Received serviceUpdate:', data);
      if (data.services) {
        setServices(data.services);
        console.log('✅ QueueContext: Updated services state:', data.services.length, 'services');
      }
    };
    
    // Listen for queue updates
    const handleQueueUpdate = (data) => {
      console.log('📡 QueueContext: Received queueUpdate:', data);
      
      if (data.virtualTickets) {
        setVirtualTickets(data.virtualTickets);
      }
      if (data.physicalTickets) {
        setPhysicalTickets(data.physicalTickets);
      }
      if (data.currentServing) {
        setCurrentServing(data.currentServing);
      }
      
      // Fetch user's ticket if authenticated
      if (user && isAuthenticated) {
        fetchUserTicket();
      }
    };
    
    // Listen for counter updates
    const handleCounterUpdate = (data) => {
      console.log('📡 QueueContext: Received counterUpdate:', data);
      if (data.counters) {
        setCounters(data.counters);
      }
    };
    
    // Listen for statistics updates
    const handleStatisticsUpdate = (data) => {
      console.log('📡 QueueContext: Received statisticsUpdate:', data);
      if (data.statistics) {
        setStatistics(data.statistics);
      }
    };
    
    // Register event listeners
    socket.on('serviceUpdate', handleServiceUpdate);
    socket.on('queueUpdate', handleQueueUpdate);
    socket.on('counterUpdate', handleCounterUpdate);
    socket.on('statisticsUpdate', handleStatisticsUpdate);
    
    console.log('✅ QueueContext: Event listeners registered');
    
    // Clean up listeners when dependencies change
    return () => {
      console.log('🔵 QueueContext: Cleaning up event listeners');
      socket.off('serviceUpdate', handleServiceUpdate);
      socket.off('queueUpdate', handleQueueUpdate);
      socket.off('counterUpdate', handleCounterUpdate);
      socket.off('statisticsUpdate', handleStatisticsUpdate);
    };
  }, [socket, isConnected, user, isAuthenticated]);
  
  // Helper function to fetch user's ticket
  const fetchUserTicket = useCallback(async () => {
    if (!isAuthenticated) return;
    
    try {
      const response = await axios.get('/api/queue/user-ticket');
      setUserTicket(response.data || null);
    } catch (err) {
      console.error('Error fetching user ticket:', err);
      setUserTicket(null);
    }
  }, [isAuthenticated]);
  
  // Fetch initial queue data
  const fetchQueueData = useCallback(async () => {
    setLoading(true);
    try {
      console.log('🔵 QueueContext: Fetching initial data...');
      
      // Fetch services
      const servicesRes = await axios.get('/api/services');
      setServices(servicesRes.data);
      console.log('✅ QueueContext: Fetched services:', servicesRes.data.length);
      
      // Fetch counters
      const countersRes = await axios.get('/api/counters');
      setCounters(countersRes.data);
      console.log('✅ QueueContext: Fetched counters:', countersRes.data.length);
      
      // Fetch current queue state
      const queueRes = await axios.get('/api/queue/status');
      setVirtualTickets(queueRes.data.virtualTickets || []);
      setPhysicalTickets(queueRes.data.physicalTickets || []);
      setCurrentServing(queueRes.data.currentServing || {});
      console.log('✅ QueueContext: Fetched queue status');
      
      // Fetch user's ticket if authenticated
      if (isAuthenticated) {
        await fetchUserTicket();
      }
      
      // Fetch statistics (admin only)
      if (user && user.role === 'admin') {
        try {
          const statsRes = await axios.get('/api/statistics');
          setStatistics(statsRes.data);
          console.log('✅ QueueContext: Fetched statistics');
        } catch (err) {
          console.warn('Could not fetch statistics:', err.message);
        }
      }
      
      setError(null);
    } catch (err) {
      console.error('❌ QueueContext: Error fetching queue data:', err);
      setError('Failed to load queue data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, user, fetchUserTicket]);
  
  // Fetch data when socket connects
  useEffect(() => {
    if (isConnected) {
      console.log('🔵 QueueContext: Socket connected, fetching initial data');
      fetchQueueData();
    }
  }, [isConnected, fetchQueueData]);
  
  // Re-authenticate socket when user changes
  useEffect(() => {
    if (socket && isConnected && user && isAuthenticated) {
      console.log('🔵 QueueContext: Re-authenticating user on socket');
      socket.emit('authenticate', {
        id: user.id,
        role: user.role
      });
    }
  }, [socket, isConnected, user, isAuthenticated]);
  
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
    
    // Average time per customer (in minutes)
    const avgTimePerCustomer = statistics.avgServiceTime?.[ticket.serviceId] || 5;
    
    return `${ticketsAhead * avgTimePerCustomer} minutes`;
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
    isConnected,
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