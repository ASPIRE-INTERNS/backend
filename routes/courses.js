const express = require('express');
const router = express.Router();
const Course = require('../models/Course');
const { protect } = require('../middleware/authMiddleware');

// @route   GET /api/courses
// @desc    Get all courses
// @access  Public
router.get('/', async (req, res) => {
  try {
    const courses = await Course.find()
      .populate('instructorId', '_id firstName lastName');

    // Transform instructorId to instructor
    const transformed = courses.map(course => {
      const c = course.toObject();
      c.instructor = c.instructorId;
      delete c.instructorId;
      return c;
    });

    res.json(transformed);
  } catch (error) {
    console.error('Error fetching courses:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/courses/:id
// @desc    Get course by ID
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const course = await Course.findById(req.params.id)
      .populate('instructorId', '_id firstName lastName email');

    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    const c = course.toObject();
    c.instructor = c.instructorId;
    delete c.instructorId;

    res.json(c);
  } catch (error) {
    console.error('Error fetching course:', error);

    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Course not found' });
    }

    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/courses
// @desc    Create a new course
// @access  Private (Trainer only)
router.post('/', protect, async (req, res) => {
  try {
    if (req.user.role !== 'trainer') {
      return res.status(403).json({ message: 'Access denied. Not authorized to create courses.' });
    }

    const { title, description, duration, level, icon } = req.body;

    const newCourse = new Course({
      title,
      description,
      duration,
      level,
      instructorId: req.user.id,
      icon: icon || '📚'
    });

    const course = await newCourse.save();
    res.status(201).json(course);
  } catch (error) {
    console.error('Error creating course:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/courses/:id
// @desc    Update a course
// @access  Private (Course owner or admin)
router.put('/:id', protect, async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);

    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    if (course.instructorId.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Not authorized to update this course.' });
    }

    const { title, description, duration, level, icon } = req.body;

    if (title) course.title = title;
    if (description) course.description = description;
    if (duration) course.duration = duration;
    if (level) course.level = level;
    if (icon) course.icon = icon;

    await course.save();
    res.json(course);
  } catch (error) {
    console.error('Error updating course:', error);

    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Course not found' });
    }

    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/courses/:id
// @desc    Delete a course
// @access  Private (Course owner or admin)
router.delete('/:id', protect, async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);

    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    if (course.instructorId.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Not authorized to delete this course.' });
    }

    await course.remove();
    res.json({ message: 'Course deleted successfully' });
  } catch (error) {
    console.error('Error deleting course:', error);

    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Course not found' });
    }

    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
