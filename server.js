const express = require('express');
const http = require('http');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const setupSocketServer = require('./config/socket');
const path = require('path');
const { initializeSampleCourses } = require('./utils/sampleData');

// Load environment variables
dotenv.config();

// Connect to database
connectDB();

// Initialize Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());


// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/user', require('./routes/api'));
app.use('/api/courses', require('./routes/courses')); // Add courses route
app.use('/api/websocket', require('./routes/websocket'));

// Create HTTP server (needed for Socket.io)
const server = http.createServer(app);

// Setup WebSocket server
setupSocketServer(server);
console.log('WebSocket server initialized');

// Initialize sample data after database connection is established
const mongoose = require('mongoose');
mongoose.connection.once('open', async () => {
  console.log('MongoDB connected successfully');
  
  // Initialize sample course data
  await initializeSampleCourses();
});

app.use('/api/training-sessions', require('./routes/liveSessionRoutes'));

// Serve static assets in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend/build')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/build/index.html'));
  });
}

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Server error', error: err.message });
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server and WebSocket running on http://localhost:${PORT}`);
});

