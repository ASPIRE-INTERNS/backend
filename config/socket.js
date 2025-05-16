// backend/config/socket.js
const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Question = require('../models/Question');
const TrainingSession = require('../models/TrainingSession');

function setupSocketServer(server) {
  const io = socketIo(server, {
    cors: {
      origin: '*', // In production, set to your frontend URL
      methods: ['GET', 'POST']
    }
  });

  // Socket authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('Authentication required'));
      }
      
      // Verify JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Get user from database
      const user = await User.findById(decoded.id).select('-password');
      
      if (!user) {
        return next(new Error('User not found'));
      }
      
      // Attach user to socket
      socket.user = {
        id: user._id,
        name: `${user.firstName} ${user.lastName}`,
        role: user.role
      };
      
      next();
    } catch (error) {
      next(new Error('Invalid token'));
    }
  });

  // Track active sessions and users
  const sessionParticipants = new Map();

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);
    let currentSession = null;

    // Join session room
    socket.on('join-session', async ({ sessionId }) => {
      try {
        // Check if session exists
        const session = await TrainingSession.findById(sessionId);
        
        if (!session) {
          return socket.emit('error', { message: 'Session not found' });
        }
        
        // Update current session
        currentSession = sessionId;
        
        // Add user to session participants tracking
        if (!sessionParticipants.has(sessionId)) {
          sessionParticipants.set(sessionId, new Set());
        }
        
        sessionParticipants.get(sessionId).add(socket.user.id);
        
        // Join session room
        socket.join(sessionId);
        
        // Notify everyone about participant count
        io.to(sessionId).emit('participant-count', {
          count: sessionParticipants.get(sessionId).size
        });
        
        // Send active question if exists
        const activeQuestion = await Question.findOne({ 
          sessionId, 
          status: 'active' 
        }).select('-correctOption');
        
        if (activeQuestion) {
          socket.emit('question', {
            id: activeQuestion._id,
            title: activeQuestion.title,
            options: activeQuestion.options
          });
        }
        
        console.log(`${socket.user.name} joined session ${sessionId}`);
      } catch (error) {
        console.error('Join session error:', error);
        socket.emit('error', { message: 'Error joining session' });
      }
    });

    // Trainer submits question
    socket.on('submit-question', async ({ sessionId, question }) => {
      try {
        // Check if user is trainer
        if (socket.user.role !== 'trainer' && socket.user.role !== 'admin') {
          return socket.emit('error', { message: 'Not authorized to submit questions' });
        }
        
        // End any active questions
        await Question.updateMany(
          { sessionId, status: 'active' },
          { status: 'completed' }
        );
        
        // Create new question
        const newQuestion = new Question({
          sessionId,
          title: question.title,
          options: question.options,
          correctOption: question.correctOption,
          status: 'active'
        });
        
        const savedQuestion = await newQuestion.save();
        
        // Broadcast question to all participants (without correct answer)
        io.to(sessionId).emit('question', {
          id: savedQuestion._id,
          title: savedQuestion.title,
          options: savedQuestion.options
        });
        
        console.log(`Trainer submitted question in session ${sessionId}`);
      } catch (error) {
        console.error('Submit question error:', error);
        socket.emit('error', { message: 'Error submitting question' });
      }
    });

    // End active question
    socket.on('end-question', async ({ sessionId }) => {
      try {
        // Check if user is trainer
        if (socket.user.role !== 'trainer' && socket.user.role !== 'admin') {
          return socket.emit('error', { message: 'Not authorized to end questions' });
        }
        
        // End all active questions for this session
        await Question.updateMany(
          { sessionId, status: 'active' },
          { status: 'completed' }
        );
        
        // Notify all participants
        io.to(sessionId).emit('question-ended');
        
        console.log(`Trainer ended question in session ${sessionId}`);
      } catch (error) {
        console.error('End question error:', error);
        socket.emit('error', { message: 'Error ending question' });
      }
    });

    // Submit answer to question
    socket.on('submit-answer', async ({ sessionId, questionId, answer }) => {
      try {
        // Find the question
        const question = await Question.findOne({
          _id: questionId,
          sessionId,
          status: 'active'
        });
        
        if (!question) {
          return socket.emit('error', { message: 'Question not found or no longer active' });
        }
        
        // Check if user already answered
        const existingResponseIndex = question.responses.findIndex(
          response => response.userId.toString() === socket.user.id
        );
        
        if (existingResponseIndex >= 0) {
          // Update existing response
          question.responses[existingResponseIndex].answer = answer;
        } else {
          // Add new response
          question.responses.push({
            userId: socket.user.id,
            answer
          });
        }
        
        await question.save();
        
        // Acknowledge success to the user
        socket.emit('answer-submitted', { questionId });
        
        // Calculate and broadcast stats to trainers
        const responseStats = calculateResponseStats(question);
        io.to(sessionId).emit('response-stats', responseStats);
        
        console.log(`User ${socket.user.id} submitted answer to question ${questionId}`);
      } catch (error) {
        console.error('Submit answer error:', error);
        socket.emit('error', { message: 'Error submitting answer' });
      }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      if (currentSession) {
        // Remove user from session participants
        const participants = sessionParticipants.get(currentSession);
        
        if (participants) {
          participants.delete(socket.user.id);
          
          // Update participant count
          io.to(currentSession).emit('participant-count', {
            count: participants.size
          });
          
          // Clean up empty session
          if (participants.size === 0) {
            sessionParticipants.delete(currentSession);
          }
        }
        
        console.log(`${socket.user?.name || 'User'} left session ${currentSession}`);
      }
      
      console.log(`User disconnected: ${socket.id}`);
    });
  });

  // Helper function to calculate response statistics
  function calculateResponseStats(question) {
    const distribution = {};
    
    // Initialize counts for all options
    question.options.forEach((_, index) => {
      distribution[index] = 0;
    });
    
    // Count responses for each option
    question.responses.forEach(response => {
      distribution[response.answer] = (distribution[response.answer] || 0) + 1;
    });
    
    return {
      questionId: question._id,
      responseCount: question.responses.length,
      answerDistribution: distribution
    };
  }

  return io;
}

module.exports = setupSocketServer;