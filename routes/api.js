const express = require('express');
const router = express.Router();
const  {protect} = require('../middleware/authMiddleware');
const TrainingSession = require('../models/TrainingSession');
const User = require('../models/User');

router.get('/next-training', protect, async (req, res) => {
  try {
    const now = new Date();
    
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
    
      const decoded = jwt.decode(refreshToken);
      
      if (!decoded || !decoded.id) {
        return res.status(401).json({ message: 'Invalid token format' });
      }
      const user = await User.findById(decoded.id).select('-password');
      
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
    
      const newToken = jwt.sign(
        { id: user._id },
        process.env.JWT_SECRET || 'your_jwt_secret',
        { expiresIn: '30d' } 
      );
      
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
      return res.status(401).json({ message: 'Invalid refresh token' });
    }
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/stats', protect, async (req, res) => {
  try {
    const enrolledCount = await TrainingSession.countDocuments({
      participants: req.user.id
    });
    
    const completedCount = await TrainingSession.countDocuments({
      participants: req.user.id,
      date: { $lt: new Date() }
    });
    
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

router.get('/live-sessions', protect, async (req, res) => {
  try {
    const now = new Date();
    
    const liveSessions = await TrainingSession.find({
      $or: [
        { isLive: true }, 
        {
          date: {
            $gte: new Date(now.setHours(0, 0, 0, 0)), // Start of today
            $lt: new Date(now.setHours(23, 59, 59, 999)) // End of today
          },
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

router.get('/my-training-sessions', protect, async (req, res) => {
  try {
    let trainingSessions;
    
    if (req.user.role === 'trainer' || req.user.role === 'admin') {
      trainingSessions = await TrainingSession.find({
        instructor: req.user.id
      })
      .populate('courseId', 'title')
      .sort({ date: -1 });
    } else {
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