# Queue Management System

A full-stack web application for managing virtual and physical queues in service environments. This system enables customers to take virtual tickets online and activate them physically upon arrival.

## Features

### User Features
- Register/Login/Logout
- Get virtual queue tickets
- Mark as present upon arrival (convert virtual to physical)
- View real-time queue position and status
- See estimated wait time
- Automatic rescheduling if a number is missed

### Counter Staff Features
- Secure login with session persistency
- Select service and desk to manage
- View physical ticket queue with customer details
- Call next customer functionality
- Real-time queue updates

### Admin Features
- Add/Delete services
- Add/Delete counters (desks)
- View statistics (per day and per service)
- Monitor live queue status across all counters

### Display Screen Features
- Show currently called tickets
- Display customer name, service, and room number
- Auto-refresh with real-time updates

## Technology Stack

### Frontend
- React
- React Router
- CSS
- Socket.io Client (for real-time updates)

### Backend
- Node.js
- Express
- SQLite
- Socket.io (for WebSockets)
- JSON Web Tokens (for authentication)

## Project Structure

```
.
├── frontend/                # React frontend application
│   ├── public/              # Static files
│   ├── src/                 # Source files
│   │   ├── context/         # React context providers
│   │   ├── pages/           # Page components
│   │   ├── styles/          # CSS styles
│   │   └── ...
├── backend/                 # Node.js backend application
│   ├── config/              # Configuration files
│   ├── routes/              # API routes
│   ├── data/                # SQLite database file
│   └── ...
└── README.md               # Project documentation
```

## Setup and Installation

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn

### Backend Setup
1. Navigate to the backend directory:
   ```
   cd backend
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create .env file (or use existing one) with the following variables:
   ```
   PORT=5000
   JWT_SECRET=your_secret_key
   CLIENT_URL=http://localhost:3000
   NODE_ENV=development
   ```

4. Start the backend server:
   ```
   npm start
   ```
   For development with auto-reload:
   ```
   npm run dev
   ```

### Frontend Setup
1. Navigate to the frontend directory:
   ```
   cd frontend
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Start the frontend development server:
   ```
   npm start
   ```

4. The application will be available at `http://localhost:3000`

## API Routes

### Authentication
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login and get JWT token
- `GET /api/auth/verify` - Verify JWT token

### Services
- `GET /api/services` - Get all services
- `GET /api/services/:id` - Get service by ID
- `POST /api/services` - Create a new service (Admin only)
- `DELETE /api/services/:id` - Delete a service (Admin only)

### Counters
- `GET /api/counters` - Get all counters
- `GET /api/counters/service/:serviceId` - Get counters by service ID
- `GET /api/counters/:id` - Get counter by ID
- `POST /api/counters` - Create a new counter (Admin only)
- `DELETE /api/counters/:id` - Delete a counter (Admin only)

### Queue
- `GET /api/queue/status` - Get current queue status
- `GET /api/queue/user-ticket` - Get current user's active ticket
- `POST /api/queue/virtual-ticket` - Get a virtual ticket
- `PATCH /api/queue/tickets/:id/present` - Mark ticket as present
- `POST /api/queue/next-customer` - Call next customer (Counter staff only)

### Statistics
- `GET /api/statistics` - Get system statistics (Admin only)
- `GET /api/statistics/daily/:date` - Get statistics for a specific day (Admin only)
- `GET /api/statistics/service/:id` - Get statistics for a specific service (Admin only)

## Usage

### Accessing Different Pages
- **User Page**: `http://localhost:3000/user`
- **Counter Page**: `http://localhost:3000/counter`
- **Admin Page**: `http://localhost:3000/admin`
- **Display Page**: `http://localhost:3000/display`

### Default Users (Created on First Run)
By new database.
- **Admin**: Email: admin@example.com, Password: admin123
- **Counter Staff**: Email: counter@example.com, Password: counter123
- **User**: Register a new account through the application.
  
By using the exccted database
- **Admin**: Email: starbahadin@hotmail.com, Password: 123456
- **Counter Staff**: Email: alan@hotmail.com, Password: 123456
- **User**: Email:  solaf@hotmail.com, Password: 123456
- Register a new account for user through the application

## Real-time Updates
The system uses WebSockets (Socket.io) for real-time updates across all interfaces. This ensures that all users, counter staff, admins, and display screens have the latest information without needing to refresh the page.

## License
This project is licensed under the MIT License.
