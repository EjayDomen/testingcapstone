const Notification = require('../../models/notification');
const express = require('express');

const router = express.Router();

// Fetch unread notifications for the secretary
router.get('/', async (req, res) => {
  try {
    // Fetch unread notifications ordered by latest
    const notifications = await Notification.findAll({
      where: { 
          USER_TYPE:'Secretary' },
      order: [['createdAt', 'DESC']], // Order by the latest notifications
    });

    res.status(200).json(notifications); // Send notifications to the frontend
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Mark a notification as read (optional)
router.post('/:id/read', async (req, res) => {
  const { id } = req.params;
  try {
    const notification = await Notification.findByPk(id);
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    // Update notification status to 'read'
    notification.STATUS = 'read';
    await notification.save();

    res.status(200).json({ message: 'Notification marked as read' });
  } catch (error) {
    console.error('Error updating notification status:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Delete a notification
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const notification = await Notification.findByPk(id);
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    // Delete the notification
    await notification.destroy();

    res.status(200).json({ message: 'Notification deleted successfully' });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});


module.exports = router;