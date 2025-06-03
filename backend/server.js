const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Import database module
const { initializeDatabase } = require('./config/database');

// Import routes
const authRoutes = require('./routes/auth');
const servicesRoutes = require('./routes/services');
const countersRoutes = require('./routes/counters');
const queueRoutes = require('./routes/queue');
const statisticsRoutes = require('./routes/statistics');

app.set('io', io);
// Initialize express app
const app = express();
const server = http.createServer(app);

// Initialize Socket.io
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
});

app.set('io', io);

// Initialize database
initializeDatabase()
  .then(() => console.log('Database initialized successfully'))
  .catch(err => console.error('Database initialization failed:', err));

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(morgan('dev'));

// Setup Socket.io connection handler
require('./socket')(io);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/services', servicesRoutes);
app.use('/api/counters', countersRoutes);
app.use('/api/queue', queueRoutes);
app.use('/api/statistics', statisticsRoutes);

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend/build')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, '../frontend', 'build', 'index.html'));
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'production' ? {} : err
  });
});

// Set port and start server
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Export for testing
module.exports = { app, server, io };