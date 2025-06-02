const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Ensure the data directory exists
const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Create database connection
const dbPath = path.join(dataDir, 'queue_system.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error connecting to database:', err.message);
  } else {
    console.log('Connected to the SQLite database');
  }
});

// Initialize database with tables
const initializeDatabase = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Enable foreign keys
      db.run('PRAGMA foreign_keys = ON');
      
      // Create users table
      db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'user',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) {
          console.error('Error creating users table:', err.message);
          reject(err);
          return;
        }
      });
      
      // Create services table
      db.run(`
        CREATE TABLE IF NOT EXISTS services (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) {
          console.error('Error creating services table:', err.message);
          reject(err);
          return;
        }
      });
      
      // Create counters table
      db.run(`
        CREATE TABLE IF NOT EXISTS counters (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          room_number TEXT NOT NULL,
          service_id TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (service_id) REFERENCES services (id) ON DELETE CASCADE
        )
      `, (err) => {
        if (err) {
          console.error('Error creating counters table:', err.message);
          reject(err);
          return;
        }
      });
      
      // Create tickets table
      db.run(`
        CREATE TABLE IF NOT EXISTS tickets (
          id TEXT PRIMARY KEY,
          ticket_number TEXT NOT NULL,
          service_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          counter_id TEXT,
          status TEXT CHECK(status IN ('virtual', 'physical', 'served', 'missed')) NOT NULL DEFAULT 'virtual',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          served_at DATETIME,
          FOREIGN KEY (service_id) REFERENCES services (id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
          FOREIGN KEY (counter_id) REFERENCES counters (id) ON DELETE SET NULL
        )
      `, (err) => {
        if (err) {
          console.error('Error creating tickets table:', err.message);
          reject(err);
          return;
        }
      });
      
      // Create statistics table for daily statistics
      db.run(`
        CREATE TABLE IF NOT EXISTS statistics (
          id TEXT PRIMARY KEY,
          date TEXT NOT NULL,
          service_id TEXT NOT NULL,
          total_served INTEGER NOT NULL DEFAULT 0,
          avg_wait_time INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (service_id) REFERENCES services (id) ON DELETE CASCADE,
          UNIQUE(date, service_id)
        )
      `, (err) => {
        if (err) {
          console.error('Error creating statistics table:', err.message);
          reject(err);
          return;
        }
        
        // All tables created successfully
        resolve();
      });
    });
  });
};

// Helper functions for database operations
const dbRun = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) {
        console.error('Database run error:', err.message);
        reject(err);
        return;
      }
      resolve({ id: this.lastID, changes: this.changes });
    });
  });
};

const dbGet = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        console.error('Database get error:', err.message);
        reject(err);
        return;
      }
      resolve(row);
    });
  });
};

const dbAll = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        console.error('Database all error:', err.message);
        reject(err);
        return;
      }
      resolve(rows);
    });
  });
};

// Export database and helper functions
module.exports = {
  initializeDatabase,
  db,
  dbRun,
  dbGet,
  dbAll
};