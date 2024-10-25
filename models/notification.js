// models/Notification.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database'); // Import the Sequelize instance


const Notification = sequelize.define('notifications', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false,
  },
  MESSAGE: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  STATUS: {
    type: DataTypes.STRING,
    allowNull: true, // Make it nullable if necessary
  },
  USER_ID: {
    type: DataTypes.INTEGER,
    allowNull: true, // Make it nullable if necessary
  },
  USER_TYPE: {
    type: DataTypes.STRING,
    allowNull: true, // Make it nullable if necessary
  },
  ENTITY_TYPE: {
    type: DataTypes.STRING,
    allowNull: true, // Make it nullable if necessary
  },
  ENTITY_ID: {
    type: DataTypes.INTEGER,
    allowNull: true, // Make it nullable if necessary
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false,
  },
  updatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false,
  },
}, {
  tableName: 'notifications',
});


module.exports = Notification;
