// backend/routes/liveSessionRoutes.js
const express = require('express');
const router = express.Router();
const {authorize} = require('../middleware/authMiddleware');
const LiveSession = require('../models/LiveSession'); // Create this model if you haven't already

// Get active sessions
router.get('/active', authorize, async (req, res) => {
  try {
    // For testing, return mock data
    res.json(mockActiveSessions);
  } catch (error) {
    console.error('Error fetching active sessions:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get scheduled sessions
router.get('/scheduled', authorize, async (req, res) => {
  try {
    // For testing, return mock data
    res.json(mockScheduledSessions);
  } catch (error) {
    console.error('Error fetching scheduled sessions:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create a new session
router.post('/', authorize, async (req, res) => {
  try {
    // For testing, just return success response
    res.status(201).json({ message: 'Session created successfully' });
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Sample data for testing
const mockActiveSessions = [
  {
    _id: '60d5ec9c734231456ed85f01',
    title: 'Advanced React Patterns',
    description: 'Learn the most powerful React design patterns used in modern applications.',
    course: {
      _id: '60d5ec9c734231456ed85f10',
      title: 'React Mastery'
    },
    instructor: {
      _id: '60d5ec9c734231456ed85f20',
      firstName: 'Varshini',
      lastName: 'Madamanchi'
    },
    isActive: true,
    startedAt: new Date(),
    scheduledFor: new Date(),
    duration: 90,
    participants: [
      '60d5ec9c734231456ed85f30',
      '60d5ec9c734231456ed85f31',
      '60d5ec9c734231456ed85f32'
    ]
  },
  {
    _id: '60d5ec9c734231456ed85f02',
    title: 'Node.js Best Practices',
    description: 'Essential practices for building robust Node.js applications.',
    course: {
      _id: '60d5ec9c734231456ed85f11',
      title: 'Backend Development'
    },
    instructor: {
      _id: '60d5ec9c734231456ed85f20',
      firstName: 'Varshini',
      lastName: 'Madamanchi'
    },
    isActive: true,
    startedAt: new Date(),
    scheduledFor: new Date(),
    duration: 60,
    participants: [
      '60d5ec9c734231456ed85f33',
      '60d5ec9c734231456ed85f34'
    ]
  }
];

const mockScheduledSessions = [
  {
    _id: '60d5ec9c734231456ed85f03',
    title: 'Introduction to TypeScript',
    description: 'Getting started with TypeScript for JavaScript developers.',
    course: {
      _id: '60d5ec9c734231456ed85f12',
      title: 'Frontend Development'
    },
    instructor: {
      _id: '60d5ec9c734231456ed85f20',
      firstName: 'Varshini',
      lastName: 'Madamanchi'
    },
    isActive: false,
    scheduledFor: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
    duration: 120
  },
  {
    _id: '60d5ec9c734231456ed85f04',
    title: 'Database Design Principles',
    description: 'Learn how to design efficient and scalable database schemas.',
    course: {
      _id: '60d5ec9c734231456ed85f13',
      title: 'Database Management'
    },
    instructor: {
      _id: '60d5ec9c734231456ed85f20',
      firstName: 'Varshini',
      lastName: 'Madamanchi'
    },
    isActive: false,
    scheduledFor: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
    duration: 90
  }
];

module.exports = router;