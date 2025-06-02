const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { check, validationResult } = require('express-validator');
const { dbGet, dbAll, dbRun } = require('../config/database');
const { auth } = require('./auth');

// Import socket module
const socketModule = require('../socket');

// @route   GET /api/counters
// @desc    Get all counters
// @access  Public
router.get('/', async (req, res) => {
  try {
    // Get counters with service information
    const counters = await dbAll(`
      SELECT c.*, s.name as service_name
      FROM counters c
      JOIN services s ON c.service_id = s.id
      ORDER BY c.name ASC
    `);
   
    // changed
   res.json(
  counters.map(c => ({
    id: c.id,
    name: c.name,
    roomNumber: c.room_number,
    serviceId: c.service_id,
    serviceName: c.service_name
  }))


);
  } catch (err) {
    console.error('Error getting counters:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/counters/service/:serviceId
// @desc    Get counters by service ID
// @access  Public
router.get('/service/:serviceId', async (req, res) => {
  try {
    const counters = await dbAll(`
      SELECT c.*, s.name as service_name
      FROM counters c
      JOIN services s ON c.service_id = s.id
      WHERE c.service_id = ?
      ORDER BY c.name ASC
    `, [req.params.serviceId]);
    
    res.json(counters);
  } catch (err) {
    console.error('Error getting counters by service:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/counters/:id
// @desc    Get counter by ID
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const counter = await dbGet(`
      SELECT c.*, s.name as service_name
      FROM counters c
      JOIN services s ON c.service_id = s.id
      WHERE c.id = ?
    `, [req.params.id]);
    
    if (!counter) {
      return res.status(404).json({ message: 'Counter not found' });
    }
    
    //changed
    res.json({
  id: counter.id,
  name: counter.name,
  roomNumber: counter.room_number,
  serviceId: counter.service_id,
  serviceName: counter.service_name
});


  } catch (err) {
    console.error('Error getting counter:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/counters
// @desc    Create a new counter
// @access  Private (Admin only)
router.post('/', [
  auth,
  check('name', 'Counter name is required').not().isEmpty(),
  check('roomNumber', 'Room number is required').not().isEmpty(),
  check('serviceId', 'Service ID is required').not().isEmpty()
], async (req, res) => {
  // Check if user is admin
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied. Admin only.' });
  }
  
  // Check validation
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  
  const { name, roomNumber, serviceId } = req.body;
  
  try {
    // Check if service exists
    const service = await dbGet('SELECT * FROM services WHERE id = ?', [serviceId]);
    
    if (!service) {
      return res.status(400).json({ message: 'Service not found' });
    }
    
    // Create counter ID
    const counterId = uuidv4();
    
    // Insert counter into database
    await dbRun(
      'INSERT INTO counters (id, name, room_number, service_id) VALUES (?, ?, ?, ?)',
      [counterId, name, roomNumber, serviceId]
    );
    
    // Get the created counter
    const counter = await dbGet(`
      SELECT c.*, s.name as service_name
      FROM counters c
      JOIN services s ON c.service_id = s.id
      WHERE c.id = ?
    `, [counterId]);
    
    // Broadcast counter update to all clients
    const io = req.app.get('io');
    if (io && socketModule(io).broadcastCounterUpdate) {
      socketModule(io).broadcastCounterUpdate();
    }
    
  //changed  
    res.status(201).json({
  id: counter.id,
  name: counter.name,
  roomNumber: counter.room_number,
  serviceId: counter.service_id,
  serviceName: counter.service_name
});


  } catch (err) {
    console.error('Error creating counter:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/counters/:id
// @desc    Delete a counter
// @access  Private (Admin only)
router.delete('/:id', auth, async (req, res) => {
  // Check if user is admin
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied. Admin only.' });
  }
  
  try {
    // Check if counter exists
    const counter = await dbGet('SELECT * FROM counters WHERE id = ?', [req.params.id]);
    
    if (!counter) {
      return res.status(404).json({ message: 'Counter not found' });
    }
    
    // Delete counter from database
    await dbRun('DELETE FROM counters WHERE id = ?', [req.params.id]);
    
    // Broadcast counter update to all clients
    const io = req.app.get('io');
    if (io && socketModule(io).broadcastCounterUpdate) {
      socketModule(io).broadcastCounterUpdate();
      
      // Also broadcast queue update as any tickets being served at this counter will be affected
      socketModule(io).broadcastQueueUpdate();
    }
    
    res.json({ message: 'Counter deleted' });
  } catch (err) {
    console.error('Error deleting counter:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;