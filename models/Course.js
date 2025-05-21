const mongoose = require('mongoose');

const CourseSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  duration: {
    type: String,
    required: true
  },
  level: {
    type: String,
    required: true,
    enum: ['Beginner', 'Intermediate', 'Advanced']
  },
  instructorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  enrollmentCount: {
    type: Number,
    default: 0
  },
  icon: {
    type: String,
    default: '📚'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Course', CourseSchema);