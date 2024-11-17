const express = require('express');
const { fetchNotifications } = require('../../services/notificationService');
const auth = require('../../middleware/auth');
const router = express.Router();

// Endpoint to fetch notifications for a user (Patient or Secretary)
router.get('/notifications', auth('Patient'), async (req, res) => {
    // Retrieve the id and role (USER_TYPE) from req.user, which is set by the auth middleware
    const USER_ID = req.user.id;
    const USER_TYPE = req.user.role;
    const limit = parseInt(req.query.limit) || 10; // Optional limit parameter, defaulting to 10
    console.log(req.user.role);
    try {
        // Use the fetchNotifications service function
        const notifications = await fetchNotifications({ USER_ID, USER_TYPE, limit });

        // Return the fetched notifications
        res.status(200).json(notifications);
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ message: 'Server error. Could not fetch notifications.' });
    }
});

module.exports = router;
