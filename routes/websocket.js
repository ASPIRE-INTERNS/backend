const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const TrainingSession = require('../models/TrainingSession');
const Question = require('../models/Question');

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

router.get('/:sessionId/questions/active', protect, async (req, res) => {
  try {
    const activeQuestion = await Question.findOne({
      sessionId: req.params.sessionId,
      status: 'active'
    }).select('-correctOption'); 
    
    if (!activeQuestion) {
      return res.status(404).json({ message: 'No active question found' });
    }
    
    res.json(activeQuestion);
  } catch (error) {
    console.error('Error fetching active question:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/:sessionId/questions', protect, async (req, res) => {
  try {
    const session = await TrainingSession.findById(req.params.sessionId);
    
    if (!session) {
      return res.status(404).json({ message: 'Training session not found' });
    }
    
    if (session.instructor.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to submit questions' });
    }
    
    await Question.updateMany(
      { sessionId: req.params.sessionId, status: 'active' },
      { status: 'completed' }
    );
    
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
    
    const existingResponseIndex = question.responses.findIndex(
      response => response.userId.toString() === req.user.id
    );
    
    if (existingResponseIndex >= 0) {
      question.responses[existingResponseIndex].answer = req.body.answer;
    } else {
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

router.put('/:sessionId/questions/:questionId/end', protect, async (req, res) => {
  try {
    const session = await TrainingSession.findById(req.params.sessionId);
    
    if (!session) {
      return res.status(404).json({ message: 'Training session not found' });
    }
    
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