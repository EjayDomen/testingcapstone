const express = require('express');
const router = express.Router();
const sequelize = require('../../config/database');
const Queue = require('../../models/queue');
// Adjust the import to use Queue model


// Endpoint to update the status and queue number
router.post('/update-queue-status', async (req, res) => {
    const { appointmentId } = req.body;

    console.log('Scanned ID:', appointmentId);

    try {
        // Find the queue associated with the appointmentId
        const queue = await Queue.findOne({ where: { APPOINTMENT_ID: appointmentId } });

        if (!queue) {
            return res.status(404).json({ message: 'Queue entry not found for the given appointment ID.' });
        }

        // Check if the queue status is already 'attended'
        if (queue.STATUS === 'attended') {
            return res.status(400).json({ message: 'Queue has already been attended. Update not allowed.' });
        }

        // Fetch the maximum queue number for the same queue management ID
        const latestQueueNumber = await Queue.max('QUEUE_NUMBER', {
            where: { QUEUE_MANAGEMENT_ID: queue.QUEUE_MANAGEMENT_ID },
        }) || 0;

        // Set the next queue number
        const nextQueueNumber = latestQueueNumber + 1;

        // Update the queue with the new status and queue number
        const result = await Queue.update(
            {
                STATUS: 'attended',
                QUEUE_NUMBER: nextQueueNumber
            },
            { where: { APPOINTMENT_ID: appointmentId } }
        );

        if (result[0] === 1) {  // Check if the update was successful
            res.status(200).json({ message: 'Status and queue number updated successfully.', queueNumber: nextQueueNumber });
        } else {
            res.status(404).json({ message: 'Record not found.' });
        }
    } catch (error) {
        console.error('Error updating status and queue number:', error); // Log full error
        res.status(500).json({ message: 'Error updating status and queue number.' });
    }
});



module.exports = router;