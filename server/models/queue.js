const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Appointment = require('./appointment'); // Ensure correct path to the appointment model
const QueueManagement = require('./queueManagement');

const Queue = sequelize.define('Queue', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  QUEUE_NUMBER: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  APPOINTMENT_ID: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  PATIENT_ID: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  MESSAGE_ID: {
    type: DataTypes.STRING,
    allowNull: true
  },
  PROGRESS: {
    type: DataTypes.STRING,
    allowNull: true
  },
  STATUS: {
    type: DataTypes.STRING,
    allowNull: true
  },
  TYPE: {
    type: DataTypes.STRING,
    allowNull: true
  },
  SERVED: {
    type: DataTypes.STRING,
    allowNull: true
  },
  QUEUE_MANAGEMENT_ID: {
    type: DataTypes.INTEGER,
    allowNull:false
  }
}, {
  timestamps: true
});

// Define associations
Queue.belongsTo(Appointment, {
  foreignKey: {
    name: 'APPOINTMENT_ID', // Ensure foreign key consistency
    allowNull: true
  }
});

Appointment.hasOne(Queue, {
  foreignKey: {
    name: 'APPOINTMENT_ID', // Ensure foreign key consistency
    allowNull: true
  }
});

QueueManagement.hasOne(Queue, {
  foreignKey: {
    name: 'QUEUE_MANAGEMENT_ID', // Change to a more descriptive foreign key name
    allowNull: false
  }
});

Queue.belongsTo(QueueManagement, {
  foreignKey: {
    name: 'QUEUE_MANAGEMENT_ID', // Change to a more descriptive foreign key name
    allowNull: false
  }
});

module.exports = Queue;
