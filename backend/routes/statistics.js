const express = require('express');
const router = express.Router();
const { dbGet, dbAll } = require('../config/database');
const { auth } = require('./auth');

// @route   GET /api/statistics
// @desc    Get system statistics
// @access  Private (Admin only)
router.get('/', auth, async (req, res) => {
  // Check if user is admin
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied. Admin only.' });
  }
  
  try {
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
        COUNT(t.id) as served_count,
        AVG((strftime('%s', t.served_at) - strftime('%s', t.created_at)) / 60) as avg_wait_time
      FROM services s
      LEFT JOIN tickets t ON s.id = t.service_id AND t.status = 'served' AND DATE(t.served_at) = ?
      GROUP BY s.id
    `, [today]);
    
    // Format the statistics
    const servedTodayByService = {};
    const avgWaitTimeByService = {};
    
    serviceStats.forEach(stat => {
      servedTodayByService[stat.service_id] = stat.served_count || 0;
      avgWaitTimeByService[stat.service_id] = stat.avg_wait_time || 0;
    });
    
    // Get historical stats for the last 7 days
    const last7Days = await dbAll(`
      SELECT 
        date,
        SUM(total_served) as total_served,
        AVG(avg_wait_time) as avg_wait_time
      FROM statistics
      WHERE date >= date('now', '-7 days')
      GROUP BY date
      ORDER BY date ASC
    `);
    
    // Get service breakdown for the last 7 days
    const serviceTrends = await dbAll(`
      SELECT 
        service_id,
        date,
        total_served,
        avg_wait_time
      FROM statistics
      WHERE date >= date('now', '-7 days')
      ORDER BY date ASC
    `);
    
    // Format historical data by service
    const serviceHistoricalData = {};
    
    serviceTrends.forEach(record => {
      if (!serviceHistoricalData[record.service_id]) {
        serviceHistoricalData[record.service_id] = [];
      }
      
      serviceHistoricalData[record.service_id].push({
        date: record.date,
        totalServed: record.total_served,
        avgWaitTime: record.avg_wait_time
      });
    });
    
    res.json({
      totalServedToday: totalServedToday.count || 0,
      overallAvgWaitTime: overallAvgWaitTime.avg_time || 0,
      servedTodayByService,
      avgWaitTimeByService,
      historicalData: {
        overall: last7Days,
        byService: serviceHistoricalData
      }
    });
  } catch (err) {
    console.error('Error getting statistics:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/statistics/daily/:date
// @desc    Get statistics for a specific day
// @access  Private (Admin only)
router.get('/daily/:date', auth, async (req, res) => {
  // Check if user is admin
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied. Admin only.' });
  }
  
  const { date } = req.params;
  
  // Validate date format (YYYY-MM-DD)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(date)) {
    return res.status(400).json({ message: 'Invalid date format. Use YYYY-MM-DD' });
  }
  
  try {
    // Get total served on the specified date
    const totalServed = await dbGet(`
      SELECT COUNT(*) as count
      FROM tickets
      WHERE status = 'served'
      AND DATE(served_at) = ?
    `, [date]);
    
    // Get average wait time on the specified date
    const avgWaitTime = await dbGet(`
      SELECT AVG((strftime('%s', served_at) - strftime('%s', created_at)) / 60) as avg_time
      FROM tickets
      WHERE status = 'served'
      AND DATE(served_at) = ?
    `, [date]);
    
    // Get service-specific statistics
    const serviceStats = await dbAll(`
      SELECT 
        s.id as service_id,
        s.name as service_name,
        COUNT(t.id) as served_count,
        AVG((strftime('%s', t.served_at) - strftime('%s', t.created_at)) / 60) as avg_wait_time
      FROM services s
      LEFT JOIN tickets t ON s.id = t.service_id AND t.status = 'served' AND DATE(t.served_at) = ?
      GROUP BY s.id
    `, [date]);
    
    // Get hourly breakdown
    const hourlyStats = await dbAll(`
      SELECT 
        strftime('%H', served_at) as hour,
        COUNT(*) as count
      FROM tickets
      WHERE status = 'served'
      AND DATE(served_at) = ?
      GROUP BY hour
      ORDER BY hour ASC
    `, [date]);
    
    res.json({
      date,
      totalServed: totalServed.count || 0,
      avgWaitTime: avgWaitTime.avg_time || 0,
      serviceStats,
      hourlyStats
    });
  } catch (err) {
    console.error('Error getting daily statistics:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/statistics/service/:id
// @desc    Get statistics for a specific service
// @access  Private (Admin only)
router.get('/service/:id', auth, async (req, res) => {
  // Check if user is admin
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied. Admin only.' });
  }
  
  const { id } = req.params;
  
  try {
    // Check if service exists
    const service = await dbGet('SELECT * FROM services WHERE id = ?', [id]);
    
    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }
    
    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0];
    
    // Get total served today for this service
    const totalServedToday = await dbGet(`
      SELECT COUNT(*) as count
      FROM tickets
      WHERE service_id = ?
      AND status = 'served'
      AND DATE(served_at) = ?
    `, [id, today]);
    
    // Get average wait time today for this service
    const avgWaitTimeToday = await dbGet(`
      SELECT AVG((strftime('%s', served_at) - strftime('%s', created_at)) / 60) as avg_time
      FROM tickets
      WHERE service_id = ?
      AND status = 'served'
      AND DATE(served_at) = ?
    `, [id, today]);
    
    // Get historical stats for the last 30 days
    const last30Days = await dbAll(`
      SELECT 
        date,
        total_served,
        avg_wait_time
      FROM statistics
      WHERE service_id = ?
      AND date >= date('now', '-30 days')
      ORDER BY date ASC
    `, [id]);
    
    res.json({
      service,
      totalServedToday: totalServedToday.count || 0,
      avgWaitTimeToday: avgWaitTimeToday.avg_time || 0,
      last30Days
    });
  } catch (err) {
    console.error('Error getting service statistics:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;