// services/notificationService.js

const Notification = require('../models/notification');
const Appointment = require('../models/appointment');

// Function to create a new notification
const createNotification = async ({ message, ENTITY_ID, status = 'unread', userId = null, USER_TYPE, ENTITY_TYPE, TYPE }) => {
  try {
    const notification = await Notification.create({
      MESSAGE: message,
      STATUS: status,
      USER_ID: userId,
      USER_TYPE,
      ENTITY_TYPE,
      ENTITY_ID,
      TYPE
    });
    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
};

// Function to fetch notifications for a specific user type (patient or secretary)
const fetchNotifications = async ({ USER_ID, USER_TYPE, limit = 10 }) => {
  try {
    // Validate USER_TYPE and USER_ID before proceeding
    if (!USER_ID || !USER_TYPE) {
      console.error('USER_ID or USER_TYPE is missing:', { USER_ID, USER_TYPE });
      throw new Error('Invalid user type or user ID.');
    }

    // Set the where condition based on user type and ID
    const whereCondition = {
      USER_ID: USER_ID,
      USER_TYPE: USER_TYPE,
    };

    // Fetch notifications directly from the Notification model based on the where condition
    const notifications = await Notification.findAll({
      where: whereCondition,
      order: [['createdAt', 'DESC']],
      limit,
    });

    return notifications;
  } catch (error) {
    console.error('Error fetching notifications:', error);
    throw error;
  }
};




// Function to update a notification's status
const updateNotificationStatus = async (notificationId, status) => {
  try {
    const notification = await Notification.findByPk(notificationId);
    if (!notification) {
      throw new Error('Notification not found');
    }

    notification.status = status;
    await notification.save();

    return notification;
  } catch (error) {
    console.error('Error updating notification status:', error);
    throw error;
  }
};

// Function to delete a notification (if needed)
const deleteNotification = async (notificationId) => {
  try {
    const notification = await Notification.findByPk(notificationId);
    if (!notification) {
      throw new Error('Notification not found');
    }

    await notification.destroy();
    return { message: 'Notification deleted successfully' };
  } catch (error) {
    console.error('Error deleting notification:', error);
    throw error;
  }
};

module.exports = {
  createNotification,
  fetchNotifications,
  updateNotificationStatus,
  deleteNotification,
};
