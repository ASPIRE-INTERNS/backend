const Course = require('../models/Course');
const User = require('../models/User');

// Initialize sample courses
const initializeSampleCourses = async () => {
  try {
    // Check if courses already exist
    const courseCount = await Course.countDocuments();
    if (courseCount > 0) {
      console.log('Sample courses already exist');
      return;
    }

    // Find a trainer to assign as instructor
    const trainer = await User.findOne({ role: 'trainer' });
    if (!trainer) {
      console.log('No trainer found to assign as instructor');
      return;
    }

    // Sample course data
    const sampleCourses = [
      {
        title: 'Web Development Fundamentals',
        description: 'Learn the basics of HTML, CSS, and JavaScript for building modern websites.',
        duration: '8 weeks',
        level: 'Beginner',
        instructorId: trainer._id,
        icon: '🌐'
      },
      {
        title: 'React.js Masterclass',
        description: 'Build powerful single-page applications with React.js and modern JavaScript.',
        duration: '6 weeks',
        level: 'Intermediate',
        instructorId: trainer._id,
        icon: '⚛️'
      },
      {
        title: 'Python for Data Science',
        description: 'Learn data analysis, visualization, and machine learning with Python.',
        duration: '10 weeks',
        level: 'Intermediate',
        instructorId: trainer._id,
        icon: '🐍'
      },
      {
        title: 'Leadership & Management',
        description: 'Develop effective team management skills and leadership strategies.',
        duration: '4 weeks',
        level: 'Advanced',
        instructorId: trainer._id,
        icon: '👔'
      },
      {
        title: 'Cloud Computing Essentials',
        description: 'Master cloud services, deployment models, and AWS fundamentals.',
        duration: '6 weeks',
        level: 'Intermediate',
        instructorId: trainer._id,
        icon: '☁️'
      }
    ];

    // Insert the courses
    await Course.insertMany(sampleCourses);
    console.log('Sample courses initialized successfully');
  } catch (error) {
    console.error('Error initializing sample courses:', error);
  }
};

module.exports = {
  initializeSampleCourses
};