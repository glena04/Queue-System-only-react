// Create this file: frontend/src/components/SocketDebugger.js

import React, { useEffect, useState } from 'react';
import { useQueue } from '../context/QueueContext';

const SocketDebugger = () => {
  const { isConnected, services } = useQueue();
  const [messages, setMessages] = useState([]);

  // Add a message to the debug log
  const addMessage = (msg) => {
    const timestamp = new Date().toLocaleTimeString();
    setMessages(prev => [...prev.slice(-4), `${timestamp}: ${msg}`]); // Keep last 5 messages
  };

  // Watch for services changes
  useEffect(() => {
    addMessage(`Services updated: ${services.length} services`);
  }, [services]);

  // Watch for connection changes
  useEffect(() => {
    addMessage(`Socket ${isConnected ? 'connected' : 'disconnected'}`);
  }, [isConnected]);

  return (
    <div style={{
      position: 'fixed',
      top: '10px',
      right: '10px',
      backgroundColor: isConnected ? '#d4edda' : '#f8d7da',
      color: isConnected ? '#155724' : '#721c24',
      padding: '10px',
      borderRadius: '5px',
      border: `1px solid ${isConnected ? '#c3e6cb' : '#f5c6cb'}`,
      fontSize: '11px',
      zIndex: 9999,
      maxWidth: '300px',
      fontFamily: 'monospace'
    }}>
      <div><strong>Socket:</strong> {isConnected ? '🟢 Connected' : '🔴 Disconnected'}</div>
      <div><strong>Services:</strong> {services.length}</div>
      <div style={{ marginTop: '5px', fontSize: '10px' }}>
        <strong>Recent messages:</strong>
        {messages.map((msg, i) => (
          <div key={i}>{msg}</div>
        ))}
      </div>
    </div>
  );
};

export default SocketDebugger;