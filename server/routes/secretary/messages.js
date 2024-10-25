const express = require('express');
const sequelize = require('../../config/database'); // Adjust the path based on your structure
const { Sequelize } = require('sequelize');
const Message = require('../../models/message');
const Patient = require('../../models/patient');
const auth = require('../../middleware/auth');
const router = express.Router();

// Get all conversations for the secretary
router.get('/conversations', auth('Secretary'), async (req, res) => {
  try {
    // Fetch messages where the receiver is a secretary
    const messages = await Message.findAll({
      where: { receiver_type: 'secretary' },
      attributes: [
        'sender_id',
        'content',
        [Sequelize.fn('MAX', Sequelize.col('timestamp')), 'lastTimestamp']
      ],
      group: ['sender_id'],
      order: [[Sequelize.literal('lastTimestamp'), 'DESC']],
      raw: true,
    });

    // Extract patient IDs
    const patientIds = messages.map(msg => msg.sender_id);

    // Fetch patient details using the patient IDs
    const patients = await Patient.findAll({
      where: { id: patientIds },
      attributes: ['id', 'FIRST_NAME', 'LAST_NAME'],
      raw: true,
    });

    // Create a map of patients by ID for quick lookup
    const patientMap = patients.reduce((acc, patient) => {
      acc[patient.id] = patient;
      return acc;
    }, {});

    // Combine messages with patient details
    const response = messages.map((msg) => {
      const patient = patientMap[msg.sender_id];
      return {
        patientId: msg.sender_id,
        patientName: `${patient.FIRST_NAME} ${patient.LAST_NAME}`,
        lastMessage: msg.content,
        timestamp: msg.lastTimestamp,
      };
    });

    res.status(200).json(response);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ message: 'Error fetching conversations' });
  }
});


// Get messages for a specific patient
router.get('/:patientId', auth('Secretary'), async (req, res) => {
  try {
    const messages = await Message.findAll({
      where: { sender_id: req.params.patientId },
      order: [['timestamp', 'ASC']],
    });

    res.status(200).json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ message: 'Error fetching messages' });
  }
});

// Send a new message from the secretary
router.post('/sendMessage', auth('Secretary'), async (req, res) => {
  const { sender_id, content } = req.body;
  try {
    const newMessage = await Message.create({
      sender_type: 'secretary',
      receiver_type: 'patient',
      sender_id: sender_id,
      content,
      timestamp: new Date(),
    });

    // Emit the new message via socket.io
    req.app.get('io').emit('newMessage', newMessage);

    res.status(201).json(newMessage);
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ message: 'Error sending message' });
  }
});

// POST /secretary/messages/replyMessage - Reply to a message from the secretary to a patient
router.post('/replyMessage', auth('Secretary'), async (req, res) => {
  const { receiver_id, content, timestamp } = req.body;
  const loggedInUser = req.user; // Get the logged-in secretary details

  try {
    // Ensure both the sender (secretary) and receiver (patient) IDs are valid
    if (!loggedInUser || !receiver_id) {
      return res.status(400).json({ message: 'Invalid sender or receiver' });
    }

    // Create the reply message in the database
    const message = await Message.create({
      sender_id: loggedInUser.id,
      receiver_id,
      sender_type: 'secretary',
      receiver_type: 'patient', // Since it's secretary to patient communication
      content,
      timestamp,
    });

    // Emit the message using Socket.IO
    const io = req.app.get('io'); // Access the io instance from app
    if (!io) {
      return res.status(500).json({ message: 'Socket.IO instance not available' });
    }
    io.to(receiver_id).emit('newMessage', message); // Emit the message to the patient

    // Emit the message to the specific patient room
    io.to(`patient_${receiver_id}`).emit('newMessage', message);
    res.status(201).json({ message: 'Message sent successfully', data: message });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ message: 'Error sending message' });
  }
});

module.exports = router;
