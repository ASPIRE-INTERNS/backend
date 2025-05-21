// backend/routes/api.js
const express = require('express');
const router = express.Router();
const  {protect} = require('../middleware/authMiddleware');
const TrainingSession = require('../models/TrainingSession');
const User = require('../models/User');

// Get user's next training session
router.get('/next-training', protect, async (req, res) => {
  try {
    const now = new Date();
    
    // Find the next scheduled training session for this user
    const nextTraining = await TrainingSession.findOne({
      $or: [
        { instructor: req.user.id },
        { participants: req.user.id }
      ],
      date: { $gte: now }
    })
    .sort({ date: 1, startTime: 1 })
    .populate('courseId', 'title')
    .limit(1);
    
    res.json(nextTraining);
  } catch (error) {
    console.error('Error fetching next training:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/refresh-token', async (req, res) => {
  try {
    const refreshToken = req.headers.authorization?.split(' ')[1];
    
    if (!refreshToken) {
      return res.status(401).json({ message: 'No token provided' });
    }
    
    try {
      // Verify the expired token to extract user ID
      // This will throw an error, but we can still access the decoded data before expiration
      const decoded = jwt.decode(refreshToken);
      
      if (!decoded || !decoded.id) {
        return res.status(401).json({ message: 'Invalid token format' });
      }
      
      // Find the user
      const user = await User.findById(decoded.id).select('-password');
      
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Generate a new token
      const newToken = jwt.sign(
        { id: user._id },
        process.env.JWT_SECRET || 'your_jwt_secret',
        { expiresIn: '30d' } // You can adjust this expiration time
      );
      
      // Return the new token and user
      res.json({
        token: newToken,
        user: {
          _id: user._id,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role
        }
      });
    } catch (error) {
      // If the refresh token itself is invalid (not just expired)
      return res.status(401).json({ message: 'Invalid refresh token' });
    }
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user's training statistics
router.get('/stats', protect, async (req, res) => {
  try {
    // Count enrolled courses
    const enrolledCount = await TrainingSession.countDocuments({
      participants: req.user.id
    });
    
    // Count completed courses
    const completedCount = await TrainingSession.countDocuments({
      participants: req.user.id,
      date: { $lt: new Date() }
    });
    
    // Calculate attendance rate (placeholder logic - adjust based on your needs)
    const attendanceRate = enrolledCount > 0 ? Math.round((completedCount / enrolledCount) * 100) : 0;
    
    res.json({
      enrolledCourses: enrolledCount,
      completedCourses: completedCount,
      attendanceRate
    });
  } catch (error) {
    console.error('Error fetching user stats:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user's live sessions
router.get('/live-sessions', protect, async (req, res) => {
  try {
    const now = new Date();
    
    // Find active training sessions
    const liveSessions = await TrainingSession.find({
      $or: [
        { isLive: true }, // Sessions explicitly marked as live
        {
          // Or sessions currently in progress based on date and time
          date: {
            $gte: new Date(now.setHours(0, 0, 0, 0)), // Start of today
            $lt: new Date(now.setHours(23, 59, 59, 999)) // End of today
          },
          // Check if current time is between start and end times
          $expr: {
            $let: {
              vars: {
                currentHour: { $hour: now },
                currentMinute: { $minute: now },
                startHour: { $toInt: { $substr: ["$startTime", 0, 2] } },
                startMinute: { $toInt: { $substr: ["$startTime", 3, 2] } },
                endHour: { $toInt: { $substr: ["$endTime", 0, 2] } },
                endMinute: { $toInt: { $substr: ["$endTime", 3, 2] } }
              },
              in: {
                $and: [
                  {
                    $or: [
                      { $gt: ["$$currentHour", "$$startHour"] },
                      {
                        $and: [
                          { $eq: ["$$currentHour", "$$startHour"] },
                          { $gte: ["$$currentMinute", "$$startMinute"] }
                        ]
                      }
                    ]
                  },
                  {
                    $or: [
                      { $lt: ["$$currentHour", "$$endHour"] },
                      {
                        $and: [
                          { $eq: ["$$currentHour", "$$endHour"] },
                          { $lte: ["$$currentMinute", "$$endMinute"] }
                        ]
                      }
                    ]
                  }
                ]
              }
            }
          }
        }
      ],
      // Only include sessions where user is participant or instructor
      $or: [
        { instructor: req.user.id },
        { participants: req.user.id }
      ]
    })
    .populate('instructor', 'firstName lastName')
    .populate('courseId', 'title')
    .sort({ startTime: 1 });
    
    res.json(liveSessions);
  } catch (error) {
    console.error('Error fetching live sessions:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all user's training sessions
router.get('/my-training-sessions', protect, async (req, res) => {
  try {
    let trainingSessions;
    
    // If user is a trainer, get sessions they're instructing
    if (req.user.role === 'trainer' || req.user.role === 'admin') {
      trainingSessions = await TrainingSession.find({
        instructor: req.user.id
      })
      .populate('courseId', 'title')
      .sort({ date: -1 });
    } else {
      // Otherwise, get sessions they're participating in
      trainingSessions = await TrainingSession.find({
        participants: req.user.id
      })
      .populate('instructor', 'firstName lastName')
      .populate('courseId', 'title')
      .sort({ date: -1 });
    }
    
    res.json(trainingSessions);
  } catch (error) {
    console.error('Error fetching training sessions:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;