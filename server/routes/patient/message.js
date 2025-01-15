const express = require('express');
const sequelize = require('../../config/database'); // Adjust the path based on your structure
const { Sequelize, Op } = require('sequelize');
const Message = require('../../models/message');
const Doctor = require('../../models/doctor');
const Secretary = require('../../models/secretary');
const auth = require('../../middleware/auth');
const router = express.Router();

const fixedSecretaryId = 12; // Example: use a fixed secretary ID

router.post('/send', auth('Patient'), async (req, res) => {
  const { content, sender_type, timestamp } = req.body;
  const loggedInUser = req.user;

  try {
    // Determine the sender ID and sender type
    const sender_id = loggedInUser.id;
    const receiver_id = fixedSecretaryId;
    const receiver_type = 'secretary';

    // Insert new message into the database
    const message = await Message.create({
      sender_type,
      sender_id,
      receiver_type,
      receiver_id,
      content,
      timestamp,
    });

    // Emit the new message event to the relevant parties via Socket.IO
    const io = req.app.get('io'); // Access the io instance from app
    if (!io) {
      return res.status(500).json({ message: 'Socket.IO instance not available' });
    }

    io.to(`secretary-${receiver_id}`).emit('newMessage', message);

    res.status(201).json({ message: 'Message sent successfully', data: message });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ message: 'Error sending message' });
  }
});


// GET /messages/conversations - Get recent conversations for the logged-in patient
router.get('/conversations', auth('Patient'), async (req, res) => {
  const loggedInUser = req.user; // Get logged-in user from the middleware

  try {
    const patientId = loggedInUser.id; // Use logged-in user's ID as the patient ID

    // Find the latest message for each doctor the patient has interacted with
    const conversations = await Message.findAll({
      where: {
        [Op.or]: [
          { sender_id: patientId, sender_type: 'patient' },
          { receiver_id: patientId, sender_type: 'secretary' }
        ]
      },
      order: [['timestamp', 'DESC']]
    });

    if (!conversations.length) {
      return res.status(404).json({ message: 'No conversations found' });
    }

    // Map the response to include only necessary information
    const formattedConversations = conversations.map((conv) => ({
      lastMessage: conv.content,
      timestamp: conv.timestamp,
      sender_type: conv.sender_type
    }));

    res.status(200).json(formattedConversations);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ message: 'Error fetching conversations' });
  }
});


// GET /messages/conversations/:userId - Get all conversations for a specific patient
router.get('/conversations/:userId', auth('Patient'), async (req, res) => {
  const patientId = req.params.userId;

  try {
    // Fetch all distinct conversations for this patient based on receiver_id (secretary)
    const conversations = await Message.findAll({
      where: {
        sender_id: patientId,
        sender_type: 'patient',
        receiver_type: 'secretary' // Ensure we only fetch conversations with secretaries
      },
      attributes: [
        'receiver_id',
        [Sequelize.fn('MAX', Sequelize.col('timestamp')), 'lastTimestamp']
      ],
      group: ['receiver_id'], // Group by receiver (secretary) ID
      order: [[Sequelize.literal('lastTimestamp'), 'DESC']]
    });

    // Map through the conversations to fetch the last message and format the response
    const response = await Promise.all(conversations.map(async (conv) => {
      const lastMessage = await Message.findOne({
        where: {
          sender_id: patientId,
          receiver_id: conv.receiver_id,
          receiver_type: 'secretary'
        },
        order: [['timestamp', 'DESC']],
        attributes: ['content', 'timestamp'],
      });

      return {
        secretaryId: conv.receiver_id,
        lastMessage: lastMessage ? lastMessage.content : 'No messages',
        timestamp: lastMessage ? lastMessage.timestamp : null
      };
    }));

    res.status(200).json(response);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ message: 'Error fetching conversations' });
  }
});



module.exports = router;
