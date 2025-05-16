// backend/routes/websocket.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const TrainingSession = require('../models/TrainingSession');
const Question = require('../models/Question');

// Get all live sessions for the current user
router.get('/live-sessions', protect, async (req, res) => {
  try {
    // Get current date and time
    const now = new Date();
    
    // Find all sessions that are scheduled for today and currently active
    const liveSessions = await TrainingSession.find({
      $or: [
        // Sessions explicitly marked as live
        { isLive: true },
        // Or sessions scheduled for today and currently in progress
        {
          date: {
            $gte: new Date(now.setHours(0, 0, 0, 0)), // Start of today
            $lt: new Date(now.setHours(23, 59, 59, 999)) // End of today
          },
          // Check if current time is between start and end time
          $expr: {
            $let: {
              vars: {
                startDateTime: { 
                  $dateFromString: { 
                    dateString: { $concat: [{ $dateToString: { date: "$date", format: "%Y-%m-%d" } }, "T", "$startTime:00"] },
                    format: "%Y-%m-%dT%H:%M:%S"
                  }
                },
                endDateTime: { 
                  $dateFromString: { 
                    dateString: { $concat: [{ $dateToString: { date: "$date", format: "%Y-%m-%d" } }, "T", "$endTime:00"] },
                    format: "%Y-%m-%dT%H:%M:%S"
                  }
                }
              },
              in: {
                $and: [
                  { $lte: ["$$startDateTime", now] },
                  { $gte: ["$$endDateTime", now] }
                ]
              }
            }
          }
        }
      ],
      // Include sessions where the user is either instructor or participant
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

// Get active question for a session
router.get('/:sessionId/questions/active', protect, async (req, res) => {
  try {
    // Find active question for this session
    const activeQuestion = await Question.findOne({
      sessionId: req.params.sessionId,
      status: 'active'
    }).select('-correctOption'); // Don't send correct answer to client
    
    if (!activeQuestion) {
      return res.status(404).json({ message: 'No active question found' });
    }
    
    res.json(activeQuestion);
  } catch (error) {
    console.error('Error fetching active question:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Submit a new question (trainers only)
router.post('/:sessionId/questions', protect, async (req, res) => {
  try {
    const session = await TrainingSession.findById(req.params.sessionId);
    
    if (!session) {
      return res.status(404).json({ message: 'Training session not found' });
    }
    
    // Check if user is the instructor
    if (session.instructor.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to submit questions' });
    }
    
    // End any currently active questions
    await Question.updateMany(
      { sessionId: req.params.sessionId, status: 'active' },
      { status: 'completed' }
    );
    
    // Create new question
    const newQuestion = new Question({
      sessionId: req.params.sessionId,
      title: req.body.title,
      options: req.body.options,
      correctOption: req.body.correctOption,
      status: 'active'
    });
    
    const question = await newQuestion.save();
    
    res.status(201).json(question);
  } catch (error) {
    console.error('Error creating question:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Submit answer to a question
router.post('/:sessionId/questions/:questionId/answer', protect, async (req, res) => {
  try {
    const question = await Question.findOne({
      _id: req.params.questionId,
      sessionId: req.params.sessionId,
      status: 'active'
    });
    
    if (!question) {
      return res.status(404).json({ message: 'Active question not found' });
    }
    
    // Check if user already answered
    const existingResponseIndex = question.responses.findIndex(
      response => response.userId.toString() === req.user.id
    );
    
    if (existingResponseIndex >= 0) {
      // Update existing response
      question.responses[existingResponseIndex].answer = req.body.answer;
    } else {
      // Add new response
      question.responses.push({
        userId: req.user.id,
        answer: req.body.answer
      });
    }
    
    await question.save();
    
    res.status(200).json({ message: 'Answer submitted successfully' });
  } catch (error) {
    console.error('Error submitting answer:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// End a question (trainers only)
router.put('/:sessionId/questions/:questionId/end', protect, async (req, res) => {
  try {
    const session = await TrainingSession.findById(req.params.sessionId);
    
    if (!session) {
      return res.status(404).json({ message: 'Training session not found' });
    }
    
    // Check if user is the instructor
    if (session.instructor.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to end questions' });
    }
    
    const question = await Question.findByIdAndUpdate(
      req.params.questionId,
      { status: 'completed' },
      { new: true }
    );
    
    if (!question) {
      return res.status(404).json({ message: 'Question not found' });
    }
    
    res.json(question);
  } catch (error) {
    console.error('Error ending question:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;