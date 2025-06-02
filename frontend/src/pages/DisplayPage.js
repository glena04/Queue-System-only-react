import React, { useEffect, useState } from 'react';
import { useQueue } from '../context/QueueContext';
import '../styles/DisplayPage.css';


const DisplayPage = () => {
  const { services, counters, currentServing, loading } = useQueue();
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update current time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);


  // Format date for display
  const formatDate = (date) => {
    return date.toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Format time for display
  const formatTime = (date) => {
    return date.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get all currently serving tickets as an array
  const getCurrentlyServingTickets = () => {
    if (!currentServing || !counters || !services) return [];
    return Object.entries(currentServing)
      .filter(([counterId, ticket]) => ticket)
      .map(([counterId, ticket]) => {
        const counter = counters.find(c => c.id === counterId);
        const service = counter ? services.find(s => s.id === counter.serviceId) : null;
        return {
          ticketNumber: ticket.ticketNumber,
          customerName: ticket.customerName,
          serviceName: service ? service.name : 'Unknown Service',
          counterName: counter ? counter.name : 'Unknown Counter',
          roomNumber: counter ? counter.roomNumber : 'N/A',
          counterId
        };
      });
  };

  // Group tickets by service
  const getTicketsByService = () => {
    const tickets = getCurrentlyServingTickets();
    const serviceGroups = {};
    tickets.forEach(ticket => {
      if (!serviceGroups[ticket.serviceName]) {
        serviceGroups[ticket.serviceName] = [];
      }
      serviceGroups[ticket.serviceName].push(ticket);
    });
    return serviceGroups;
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  const ticketsByService = getTicketsByService();
  const hasTickets = Object.keys(ticketsByService).length > 0;

  return (
    <div className="display-page">
      <header className="display-header">
        <h1>Now Serving</h1>
        <div className="datetime">
          <div className="date">{formatDate(currentTime)}</div>
          <div className="time">{formatTime(currentTime)}</div>
        </div>
      </header>
      <main className="display-main">
        {hasTickets ? (
          <div className="service-sections">
            {Object.entries(ticketsByService).map(([serviceName, tickets]) => (
              <div key={serviceName} className="service-section">
                <h2 className="service-name">{serviceName}</h2>
                <div className="tickets-grid">
                  {tickets.map(ticket => (
                    <div key={ticket.counterId} className="ticket-card">
                      <div className="ticket-details-horizontal">
                        <span className="ticket-number">{ticket.ticketNumber}</span>
                        <span className="customer-name">{ticket.customerName}</span>
                        <span className="counter-name">{ticket.counterName}</span>
                        <span className="room-number">Room {ticket.roomNumber}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="no-tickets-message">
            <h2>No customers currently being served</h2>
            <p>The next ticket number will be displayed here when called</p>
          </div>
        )}
      </main>
      <footer className="display-footer">
        <div className="ticker">
          Please proceed to the designated counter when your number is called. Thank you for your patience.
        </div>
      </footer>
    </div>
  );
};

export default DisplayPage;