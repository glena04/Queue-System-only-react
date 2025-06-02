const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { check, validationResult } = require('express-validator');
const { dbGet, dbAll, dbRun } = require('../config/database');
const { auth } = require('./auth');

// Import socket module
const socketModule = require('../socket');

// @route   GET /api/services
// @desc    Get all services
// @access  Public
router.get('/', async (req, res) => {
  try {
    const services = await dbAll('SELECT * FROM services ORDER BY name ASC');
    res.json(services);
  } catch (err) {
    console.error('Error getting services:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/services/:id
// @desc    Get service by ID
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const service = await dbGet('SELECT * FROM services WHERE id = ?', [req.params.id]);
    
    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }
    
    res.json(service);
  } catch (err) {
    console.error('Error getting service:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/services
// @desc    Create a new service
// @access  Private (Admin only)
router.post('/', [
  auth,
  check('name', 'Service name is required').not().isEmpty()
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
  
  const { name } = req.body;
  
  try {
    // Check if service already exists
    const existingService = await dbGet('SELECT * FROM services WHERE name = ?', [name]);
    
    if (existingService) {
      return res.status(400).json({ message: 'Service already exists' });
    }
    
    // Create service ID
    const serviceId = uuidv4();
    
    // Insert service into database
    await dbRun(
      'INSERT INTO services (id, name) VALUES (?, ?)',
      [serviceId, name]
    );
    
    // Get the created service
    const service = await dbGet('SELECT * FROM services WHERE id = ?', [serviceId]);
    
    // Broadcast service update to all clients
    const io = req.app.get('io');
    if (io && socketModule(io).broadcastServiceUpdate) {
      socketModule(io).broadcastServiceUpdate();
    }
    
    res.status(201).json(service);
  } catch (err) {
    console.error('Error creating service:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/services/:id
// @desc    Delete a service
// @access  Private (Admin only)
router.delete('/:id', auth, async (req, res) => {
  // Check if user is admin
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied. Admin only.' });
  }
  
  try {
    // Check if service exists
    const service = await dbGet('SELECT * FROM services WHERE id = ?', [req.params.id]);
    
    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }
    
    // Delete service from database
    await dbRun('DELETE FROM services WHERE id = ?', [req.params.id]);
    
    // Broadcast service update to all clients
    const io = req.app.get('io');
    if (io && socketModule(io).broadcastServiceUpdate) {
      socketModule(io).broadcastServiceUpdate();
      
      // Also broadcast queue update as tickets for this service will be deleted
      socketModule(io).broadcastQueueUpdate();
    }
    
    res.json({ message: 'Service deleted' });
  } catch (err) {
    console.error('Error deleting service:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;