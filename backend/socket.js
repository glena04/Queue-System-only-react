const { dbGet, dbAll } = require('./config/database');

// Helper: map ticket fields to camelCase for frontend
function mapTicketToCamelCase(ticket) {
  if (!ticket) return null;
  return {
    id: ticket.id,
    ticketNumber: ticket.ticket_number,
    serviceId: ticket.service_id,
    userId: ticket.user_id,
    status: ticket.status,
    counterId: ticket.counter_id,
    createdAt: ticket.created_at,
    updatedAt: ticket.updated_at,
    servedAt: ticket.served_at,
    customerName: ticket.customer_name,
    serviceName: ticket.service_name,
    counterName: ticket.counter_name,
    roomNumber: ticket.room_number,
    // add other fields as needed
  };
}

// Socket.io handler for real-time updates
module.exports = (io) => {
  // Store active connections
  const activeConnections = new Map();

  // Handle new socket connections
  io.on('connection', (socket) => {
    console.log(`New client connected: ${socket.id}`);

    // Store socket connection
    activeConnections.set(socket.id, socket);

    // Send initial data to new client
    sendInitialData(socket);

    // Handle authentication
    socket.on('authenticate', (userData) => {
      if (userData && userData.id) {
        socket.userId = userData.id;
        socket.userRole = userData.role;
        console.log(`User authenticated: ${userData.id} (${userData.role})`);
      }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
      activeConnections.delete(socket.id);
    });
  });

  // Function to send initial data to a new client
  const sendInitialData = async (socket) => {
    try {
      // Get all queue data
      const data = await getQueueData();
      socket.emit('queueUpdate', data);

      // Get all services
      const services = await dbAll('SELECT * FROM services');
      socket.emit('serviceUpdate', { services });

      // Get all counters
      const counters = await dbAll('SELECT * FROM counters');
      socket.emit('counterUpdate', { counters });

      // Get statistics (if needed)
      const statistics = await getStatistics();
      socket.emit('statisticsUpdate', { statistics });
    } catch (err) {
      console.error('Error sending initial data:', err);
    }
  };

  // Function to broadcast queue updates to all clients
const broadcastQueueUpdate = async () => {
  try {
    const data = await getQueueData();
    console.log('Broadcasting queue update'); // <-- Add this line
    io.emit('queueUpdate', data);
  } catch (err) {
    console.error('Error broadcasting queue update:', err);
  }
};

  // Function to broadcast service updates to all clients
  const broadcastServiceUpdate = async () => {
    try {
      const services = await dbAll('SELECT * FROM services');
      io.emit('serviceUpdate', { services });
    } catch (err) {
      console.error('Error broadcasting service update:', err);
    }
  };

  // Function to broadcast counter updates to all clients
  const broadcastCounterUpdate = async () => {
    try {
      const counters = await dbAll('SELECT * FROM counters');
      io.emit('counterUpdate', { counters });
    } catch (err) {
      console.error('Error broadcasting counter update:', err);
    }
  };

  // Function to broadcast statistics updates to all clients
  const broadcastStatisticsUpdate = async () => {
    try {
      const statistics = await getStatistics();
      io.emit('statisticsUpdate', { statistics });
    } catch (err) {
      console.error('Error broadcasting statistics update:', err);
    }
  };

  // Helper function to get current queue data
  const getQueueData = async () => {
    // Get virtual tickets
    const virtualTicketsRaw = await dbAll(`
      SELECT t.*, u.name as customer_name, s.name as service_name
      FROM tickets t
      JOIN users u ON t.user_id = u.id
      JOIN services s ON t.service_id = s.id
      WHERE t.status = 'virtual'
      ORDER BY t.created_at ASC
    `);

    // Get physical tickets
    const physicalTicketsRaw = await dbAll(`
      SELECT t.*, u.name as customer_name, s.name as service_name
      FROM tickets t
      JOIN users u ON t.user_id = u.id
      JOIN services s ON t.service_id = s.id
      WHERE t.status = 'physical'
      ORDER BY t.created_at ASC
    `);

    // Get currently serving tickets by counter
    const currentServingRows = await dbAll(`
      SELECT t.*, u.name as customer_name, s.name as service_name, c.name as counter_name, c.room_number
      FROM tickets t
      JOIN users u ON t.user_id = u.id
      JOIN services s ON t.service_id = s.id
      JOIN counters c ON t.counter_id = c.id
      WHERE t.status = 'serving'
    `);

    // Convert to object with counter_id as keys
    const currentServing = {};
    currentServingRows.forEach(ticket => {
      currentServing[ticket.counter_id] = mapTicketToCamelCase(ticket);
    });

    return {
      virtualTickets: virtualTicketsRaw.map(mapTicketToCamelCase),
      physicalTickets: physicalTicketsRaw.map(mapTicketToCamelCase),
      currentServing
    };
  };

  // Helper function to get statistics
  const getStatistics = async () => {
    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0];

    // Get total served today
    const totalServedToday = await dbGet(`
      SELECT COUNT(*) as count
      FROM tickets
      WHERE status = 'served'
      AND DATE(served_at) = ?
    `, [today]);

    // Get average wait time overall
    const overallAvgWaitTime = await dbGet(`
      SELECT AVG((strftime('%s', served_at) - strftime('%s', created_at)) / 60) as avg_time
      FROM tickets
      WHERE status = 'served'
      AND DATE(served_at) = ?
    `, [today]);

    // Get service-specific statistics
    const serviceStats = await dbAll(`
      SELECT 
        s.id as service_id,
        s.name as service_name,
        COUNT(*) as served_count,
        AVG((strftime('%s', t.served_at) - strftime('%s', t.created_at)) / 60) as avg_wait_time
      FROM tickets t
      JOIN services s ON t.service_id = s.id
      WHERE t.status = 'served'
      AND DATE(t.served_at) = ?
      GROUP BY t.service_id
    `, [today]);

    // Format the statistics
    const servedTodayByService = {};
    const avgWaitTimeByService = {};

    serviceStats.forEach(stat => {
      servedTodayByService[stat.service_id] = stat.served_count;
      avgWaitTimeByService[stat.service_id] = stat.avg_wait_time;
    });

    return {
      totalServedToday: totalServedToday.count || 0,
      overallAvgWaitTime: overallAvgWaitTime.avg_time || 0,
      servedTodayByService,
      avgWaitTimeByService
    };
  };

  // Return methods for external use
  return {
    broadcastQueueUpdate,
    broadcastServiceUpdate,
    broadcastCounterUpdate,
    broadcastStatisticsUpdate
  };
};