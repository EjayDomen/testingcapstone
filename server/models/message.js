const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Define the Message model
const Message = sequelize.define('messages', {
  sender_type: {
    type: DataTypes.ENUM('patient', 'secretary'),
    allowNull: false
  },
  sender_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  receiver_type: {
    type: DataTypes.ENUM('patient', 'secretary'),
    allowNull: false
  },
  receiver_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  is_read: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  timestamp: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'messages',
  timestamps: false // Disable automatic timestamps like 'createdAt' and 'updatedAt'
});

// Sync the model with the database (creates the table if it doesn't exist)
Message.sync();

module.exports = Message;
