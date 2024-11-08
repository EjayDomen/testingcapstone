// services/logService.js

const Log = require('../models/log'); // Ensure the Log model matches your database schema

// Function to create a new log entry
const createLog = async ({ userId, userType, action }) => {
  try {
    const log = await Log.create({
      USER_ID: userId,
      USER_TYPE: userType,
      ACTION: action,
    });
    return log;
  } catch (error) {
    console.error('Error creating log entry:', error);
    throw error;
  }
};

// Function to fetch logs with optional filters
const fetchLogs = async ({ userId = null, userType = null, action = null, limit = 100 }) => {
  try {
    const whereCondition = {};
    if (userId) whereCondition.USER_ID = userId;
    if (userType) whereCondition.USER_TYPE = userType;
    if (action) whereCondition.ACTION = action;

    const logs = await Log.findAll({
      where: whereCondition,
      order: [['createdAt', 'DESC']],
      limit,
    });

    return logs;
  } catch (error) {
    console.error('Error fetching logs:', error);
    throw error;
  }
};

// Function to update an action for a specific log entry
const updateLogAction = async (logId, action) => {
  try {
    const log = await Log.findByPk(logId);
    if (!log) {
      throw new Error('Log entry not found');
    }

    log.ACTION = action;
    await log.save();

    return log;
  } catch (error) {
    console.error('Error updating log action:', error);
    throw error;
  }
};

// Function to delete a log entry (if needed)
const deleteLog = async (logId) => {
  try {
    const log = await Log.findByPk(logId);
    if (!log) {
      throw new Error('Log entry not found');
    }

    await log.destroy();
    return { message: 'Log entry deleted successfully' };
  } catch (error) {
    console.error('Error deleting log entry:', error);
    throw error;
  }
};

module.exports = {
  createLog,
  fetchLogs,
  updateLogAction,
  deleteLog,
};
