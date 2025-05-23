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
      if (!token) return next(new Error('Authentication required'));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-password');
      if (!user) return next(new Error('User not found'));

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

  const sessionParticipants = new Map();

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);
    let currentSession = null;

    socket.on('join-session', async ({ sessionId }) => {
      try {
        const session = await TrainingSession.findById(sessionId);
        if (!session) return socket.emit('error', { message: 'Session not found' });

        currentSession = sessionId;
        if (!sessionParticipants.has(sessionId)) sessionParticipants.set(sessionId, new Set());
        sessionParticipants.get(sessionId).add(socket.user.id);

        socket.join(sessionId);
        io.to(sessionId).emit('participant-count', {
          count: sessionParticipants.get(sessionId).size
        });

        const activeQuestion = await Question.findOne({ sessionId, status: 'active' }).select('-correctOption');
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

    socket.on('submit-question', async ({ sessionId, question }) => {
      try {
        if (!['trainer', 'admin'].includes(socket.user.role)) {
          return socket.emit('error', { message: 'Not authorized to submit questions' });
        }

        await Question.updateMany({ sessionId, status: 'active' }, { status: 'completed' });

        const newQuestion = new Question({
          sessionId,
          title: question.title,
          options: question.options,
          correctOption: question.correctOption,
          status: 'active'
        });

        const savedQuestion = await newQuestion.save();
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

    socket.on('end-question', async ({ sessionId }) => {
      try {
        if (!['trainer', 'admin'].includes(socket.user.role)) {
          return socket.emit('error', { message: 'Not authorized to end questions' });
        }

        await Question.updateMany({ sessionId, status: 'active' }, { status: 'completed' });
        io.to(sessionId).emit('question-ended');

        console.log(`Trainer ended question in session ${sessionId}`);
      } catch (error) {
        console.error('End question error:', error);
        socket.emit('error', { message: 'Error ending question' });
      }
    });

    socket.on('submit-answer', async ({ sessionId, questionId, answer }) => {
      try {
        const question = await Question.findOne({ _id: questionId, sessionId, status: 'active' });
        if (!question) return socket.emit('error', { message: 'Question not found or no longer active' });

        const existingIndex = question.responses.findIndex(r => r.userId.toString() === socket.user.id);
        if (existingIndex >= 0) question.responses[existingIndex].answer = answer;
        else question.responses.push({ userId: socket.user.id, answer });

        await question.save();
        socket.emit('answer-submitted', { questionId });

        const responseStats = calculateResponseStats(question);
        io.to(sessionId).emit('response-stats', responseStats);

        console.log(`User ${socket.user.id} submitted answer to question ${questionId}`);
      } catch (error) {
        console.error('Submit answer error:', error);
        socket.emit('error', { message: 'Error submitting answer' });
      }
    });

    socket.on('disconnect', () => {
      if (currentSession) {
        const participants = sessionParticipants.get(currentSession);
        if (participants) {
          participants.delete(socket.user.id);
          io.to(currentSession).emit('participant-count', {
            count: participants.size
          });
          if (participants.size === 0) sessionParticipants.delete(currentSession);
        }
        console.log(`${socket.user?.name || 'User'} left session ${currentSession}`);
      }
      console.log(`User disconnected: ${socket.id}`);
    });

    socket.on('chat-message', (message) => {
      const { sessionId, text, userId, username, timestamp, id } = message;
      if (!sessionId || !text || !userId || !username) {
        return socket.emit('error', { message: 'Invalid chat message format' });
      }
      io.to(sessionId).emit('chat-message', {
        id,
        sessionId,
        userId,
        username,
        text,
        timestamp
      });
      console.log(`Chat message from ${username} in session ${sessionId}: ${text}`);
    });
  });

  function calculateResponseStats(question) {
    const distribution = {};
    question.options.forEach((_, i) => { distribution[i] = 0 });
    question.responses.forEach(r => { distribution[r.answer] = (distribution[r.answer] || 0) + 1 });
    return {
      questionId: question._id,
      responseCount: question.responses.length,
      answerDistribution: distribution
    };
  }

  return io;
}

module.exports = setupSocketServer;
