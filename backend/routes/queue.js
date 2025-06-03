const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { dbGet, dbAll, dbRun } = require('../config/database');
const { auth } = require('./auth');

// Import socket module
const socketModule = require('../socket');


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





// @route   GET /api/queue/status
// @desc    Get current queue status
// @access  Public
router.get('/status', async (req, res) => {
  try {
    // Get virtual tickets
    const virtualTickets = await dbAll(`
      SELECT t.*, u.name as customer_name, s.name as service_name
      FROM tickets t
      JOIN users u ON t.user_id = u.id
      JOIN services s ON t.service_id = s.id
      WHERE t.status = 'virtual'
      ORDER BY t.created_at ASC
    `);
    
    // Get physical tickets
    const physicalTickets = await dbAll(`
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
      currentServing[ticket.counter_id] = ticket;
    });



    //cganged
res.json({
  virtualTickets: virtualTickets.map(mapTicketToCamelCase),
  physicalTickets: physicalTickets.map(mapTicketToCamelCase),
  currentServing: Object.fromEntries(
    Object.entries(currentServing).map(([k, v]) => [k, mapTicketToCamelCase(v)])
  )
});



  } catch (err) {
    console.error('Error getting queue status:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/queue/user-ticket
// @desc    Get current user's active ticket
// @access  Private
router.get('/user-ticket', auth, async (req, res) => {
  try {
    // Get user's active ticket (not served yet)
    const ticket = await dbGet(`
      SELECT t.*, s.name as service_name
      FROM tickets t
      JOIN services s ON t.service_id = s.id
      WHERE t.user_id = ? AND t.status != 'served'
      ORDER BY t.created_at DESC
      LIMIT 1
    `, [req.user.id]);
    
    // Transform to camelCase before sending
    const transformedTicket = ticket ? mapTicketToCamelCase(ticket) : null;
    
    res.json(transformedTicket);
  } catch (err) {
    console.error('Error getting user ticket:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/queue/virtual-ticket
// @desc    Get a virtual ticket
// @access  Private
router.post('/virtual-ticket', auth, async (req, res) => {
  const { serviceId } = req.body;
  
  if (!serviceId) {
    return res.status(400).json({ message: 'Service ID is required' });
  }
  
  try {
    // Check if service exists
    const service = await dbGet('SELECT * FROM services WHERE id = ?', [serviceId]);
    
    if (!service) {
      return res.status(400).json({ message: 'Service not found' });
    }
    
    // Check if user already has an active ticket
    const existingTicket = await dbGet(`
      SELECT * FROM tickets 
      WHERE user_id = ? AND status != 'served'
    `, [req.user.id]);
    
    if (existingTicket) {
      return res.status(400).json({ message: 'You already have an active ticket' });
    }
    
    // Generate ticket number
    // Format: Service prefix (first 2 chars) + current date (YYMMDD) + sequential number
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '').substring(2); // YYMMDD
    const servicePrefix = service.name.substring(0, 2).toUpperCase();
    
    // Get the last ticket for this service today
    const lastTicket = await dbGet(`
      SELECT ticket_number FROM tickets
      WHERE service_id = ? AND date(created_at) = date('now')
      ORDER BY created_at DESC
      LIMIT 1
    `, [serviceId]);
    
    let sequentialNumber = 1;
    if (lastTicket) {
      // Extract sequential number from last ticket and increment
      const lastSequential = parseInt(lastTicket.ticket_number.substring(8));
      if (!isNaN(lastSequential)) {
        sequentialNumber = lastSequential + 1;
      }
    }
    
    const ticketNumber = `${servicePrefix}${today}${String(sequentialNumber).padStart(3, '0')}`;
    
    // Create ticket ID
    const ticketId = uuidv4();
    
    // Insert ticket into database
    await dbRun(
      'INSERT INTO tickets (id, ticket_number, service_id, user_id, status) VALUES (?, ?, ?, ?, ?)',
      [ticketId, ticketNumber, serviceId, req.user.id, 'virtual']
    );
    
    // Get the created ticket
    const ticket = await dbGet(`
      SELECT t.*, s.name as service_name
      FROM tickets t
      JOIN services s ON t.service_id = s.id
      WHERE t.id = ?
    `, [ticketId]);
    
     // 🔥 NEW: Broadcast queue update to all clients
    const socketHandlers = req.app.get('socketHandlers');
    if (socketHandlers && socketHandlers.broadcastQueueUpdate) {
      await socketHandlers.broadcastQueueUpdate();
      console.log('✅ Broadcasted queue update after virtual ticket creation');
    }
    
    res.status(201).json(mapTicketToCamelCase(ticket));
  } catch (err) {
    console.error('Error creating virtual ticket:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PATCH /api/queue/tickets/:id/present
// @desc    Mark ticket as present (convert virtual to physical)
// @access  Private
router.patch('/tickets/:id/present', auth, async (req, res) => {
  try {
    // Get the ticket
    const ticket = await dbGet('SELECT * FROM tickets WHERE id = ?', [req.params.id]);
    
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }
    
    // Check if ticket belongs to user
    if (ticket.user_id !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    // Check if ticket is virtual
    if (ticket.status !== 'virtual') {
      return res.status(400).json({ message: 'Ticket is not in virtual status' });
    }
    
    // Update ticket status to physical
    await dbRun(
      'UPDATE tickets SET status = ?, updated_at = datetime("now") WHERE id = ?',
      ['physical', req.params.id]
    );
    
    // Get the updated ticket
    const updatedTicket = await dbGet(`
      SELECT t.*, s.name as service_name
      FROM tickets t
      JOIN services s ON t.service_id = s.id
      WHERE t.id = ?
    `, [req.params.id]);
    
// Broadcast queue update to all clients  <-- ADD THESE LINES
const socketHandlers = req.app.get('socketHandlers');
if (socketHandlers && socketHandlers.broadcastQueueUpdate) {
  await socketHandlers.broadcastQueueUpdate();
  console.log('✅ Broadcasted queue update after marking ticket as present');
}
    
    res.json(mapTicketToCamelCase(updatedTicket));
  } catch (err) {
    console.error('Error marking ticket as present:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/queue/next-customer
// @desc    Call the next customer
// @access  Private (Counter staff only)
router.post('/next-customer', auth, async (req, res) => {
  // Check if user is counter staff
  if (req.user.role !== 'counter' && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied. Counter staff only.' });
  }
  
  const { counterId, serviceId } = req.body;
  
  if (!counterId || !serviceId) {
    return res.status(400).json({ message: 'Counter ID and Service ID are required' });
  }
  
  try {
    // Check if counter exists and belongs to the service
    const counter = await dbGet('SELECT * FROM counters WHERE id = ? AND service_id = ?', [counterId, serviceId]);
    
    if (!counter) {
      return res.status(400).json({ message: 'Counter not found or does not belong to this service' });
    }
    
    // Check if counter is already serving a customer
    const currentlyServing = await dbGet('SELECT * FROM tickets WHERE counter_id = ? AND status = "serving"', [counterId]);
    
    // If already serving, mark as served
    if (currentlyServing) {
      await dbRun(
        'UPDATE tickets SET status = ?, served_at = datetime("now"), updated_at = datetime("now") WHERE id = ?',
        ['served', currentlyServing.id]
      );
      
      // Update statistics
      updateStatistics(currentlyServing.service_id, currentlyServing.created_at, new Date());
    }
    
    // Get the next physical ticket for this service
    const nextTicket = await dbGet(`
      SELECT t.*, u.name as customer_name
      FROM tickets t
      JOIN users u ON t.user_id = u.id
      WHERE t.service_id = ? AND t.status = 'physical'
      ORDER BY t.created_at ASC
      LIMIT 1
    `, [serviceId]);
    
    // If no tickets, check for missed tickets and return
    if (!nextTicket) {
      // Check for any missed tickets from previous calls
      const missedTicket = await dbGet(`
        SELECT t.*, u.name as customer_name
        FROM tickets t
        JOIN users u ON t.user_id = u.id
        WHERE t.service_id = ? AND t.status = 'missed'
        ORDER BY t.created_at ASC
        LIMIT 1
      `, [serviceId]);
      
      if (missedTicket) {
        // Update missed ticket to serving status
        await dbRun(
          'UPDATE tickets SET status = ?, counter_id = ?, updated_at = datetime("now") WHERE id = ?',
          ['serving', counterId, missedTicket.id]
        );
        
        // Get updated ticket
        const updatedTicket = await dbGet(`
          SELECT t.*, u.name as customer_name, s.name as service_name
          FROM tickets t
          JOIN users u ON t.user_id = u.id
          JOIN services s ON t.service_id = s.id
          WHERE t.id = ?
        `, [missedTicket.id]);
        
        // Broadcast queue update
        const io = req.app.get('io');
        if (io && socketModule(io).broadcastQueueUpdate) {
          socketModule(io).broadcastQueueUpdate();
        }
        
        return res.json({ ticket: mapTicketToCamelCase(updatedTicket) });
      }
      
      return res.json({ message: 'No customers waiting' });
    }
    
    // Update ticket to serving status
    await dbRun(
      'UPDATE tickets SET status = ?, counter_id = ?, updated_at = datetime("now") WHERE id = ?',
      ['serving', counterId, nextTicket.id]
    );
    
    // Get updated ticket
    const updatedTicket = await dbGet(`
      SELECT t.*, u.name as customer_name, s.name as service_name
      FROM tickets t
      JOIN users u ON t.user_id = u.id
      JOIN services s ON t.service_id = s.id
      WHERE t.id = ?
    `, [nextTicket.id]);
    
    // Broadcast queue update
    const io = req.app.get('io');
    if (io && socketModule(io).broadcastQueueUpdate) {
      socketModule(io).broadcastQueueUpdate();
    }
    
    res.json({ ticket: mapTicketToCamelCase(updatedTicket) });
  } catch (err) {
    console.error('Error calling next customer:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// Helper function to update statistics
async function updateStatistics(serviceId, createdAt, servedAt) {
  try {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    
    // Calculate wait time in minutes
    const waitTimeMinutes = Math.floor((new Date(servedAt) - new Date(createdAt)) / (1000 * 60));
    
    // Check if statistics entry exists for today and this service
    const stats = await dbGet(
      'SELECT * FROM statistics WHERE date = ? AND service_id = ?',
      [today, serviceId]
    );
    
    if (stats) {
      // Update existing stats
      const newTotalServed = stats.total_served + 1;
      const newAvgWaitTime = ((stats.avg_wait_time * stats.total_served) + waitTimeMinutes) / newTotalServed;
      
      await dbRun(
        'UPDATE statistics SET total_served = ?, avg_wait_time = ?, updated_at = datetime("now") WHERE id = ?',
        [newTotalServed, newAvgWaitTime, stats.id]
      );
    } else {
      // Create new stats entry
      const statId = uuidv4();
      
      await dbRun(
        'INSERT INTO statistics (id, date, service_id, total_served, avg_wait_time) VALUES (?, ?, ?, ?, ?)',
        [statId, today, serviceId, 1, waitTimeMinutes]
      );
    }
    
    // Broadcast statistics update
    const io = global.io;
    if (io && socketModule(io).broadcastStatisticsUpdate) {
      socketModule(io).broadcastStatisticsUpdate();
    }
  } catch (err) {
    console.error('Error updating statistics:', err.message);
  }
}

module.exports = router;