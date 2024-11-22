require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const sequelize = require('./config/database');
const authRoutes = require('./routes/secretary/auth');
const appointmentsRoutes = require('./routes/secretary/appointments');
const showSecretary = require('./routes/secretary/secretary');
const doctorRoutes = require('./routes/secretary/doctor');
const scheduleRoutes = require('./routes/secretary/schedule');
const queueManagementRoutes = require('./routes/secretary/queuemanagement');
const emailVerification = require('./routes/patient/emailVerification');
const loginRoutes = require('./routes/login/login');
const messageRoutes = require('./routes/secretary/messages');
const patientMan = require('./routes/secretary/patient');
const notificationRoutes = require('./routes/secretary/notification');
const scanRoutes = require('./routes/secretary/qrScanner');
const reportRoutes = require('./routes/secretary/report');

const predefinedQuestion = require('./routes/secretary/PredefinedQuestion');

const registerPatient = require('./routes/patient/patient_auth');

const messageRoutesPat = require('./routes/patient/message');
const appointmentPatientRoutes = require('./routes/patient/appointmentPatient');
const doctorPatientRoutes = require('./routes/patient/doctors');
const forgotPasswordPatient = require('./routes/patient/forgotPassword');
const queuePatientRoutes = require('./routes/patient/queue');
const notificationPatientRoutes = require('./routes/patient/notification');
const smsRoutes = require('./routes/patient/smsAPI');

const app = express();
const port = process.env.PORT || 5000;

// Enable CORS for all routes with specific configuration
app.use(cors({
    origin: ['https://acequeue.colcap.net'], // Replace with the frontend origin
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Authorization', 'Content-Type'],
    credentials: true  // Allow credentials (cookies, headers) to be sent
}));


app.use(bodyParser.json());

// Create an HTTP server instance and bind it to the Express app
const server = require('http').createServer(app);

// Initialize Socket.IO and bind it to the server instance
const io = require('socket.io')(server, {
    cors: {
        origin: 'https://acequeue.colcap.net', // Replace with the frontend origin
        methods: ['GET', 'POST'],
        allowedHeaders: ['Authorization'],
        credentials: true // Allow credentials (cookies, headers) to be sent
    }
});


// Set the Socket.IO instance on the app object (BEFORE the routes)
app.set('io', io);

// SECRETARY ROUTES (defined after io is set)
app.use('/welcome', loginRoutes);
app.use('/secretary/auth', authRoutes);
app.use('/secretary/appointments', appointmentsRoutes);
app.use('/secretary', showSecretary);
app.use('/secretary/doctors', doctorRoutes);
app.use('/secretary/doctorSched', scheduleRoutes);
app.use('/secretary/queues', queueManagementRoutes);
app.use('/secretary/messages', messageRoutes);
app.use('/secretary/patients', patientMan);
app.use('/secretary/notifications', notificationRoutes);
app.use('/secretary/scan', scanRoutes);
app.use('/secretary/reports', reportRoutes);
app.use('/secretary/predefined', predefinedQuestion);


// PATIENT ROUTES (defined after io is set)
app.use('/messages', messageRoutesPat);
app.use('/signup', registerPatient);
app.use('/signup/verification', emailVerification);
app.use('/patient/appointment', appointmentPatientRoutes);
app.use('/patient/doctors', doctorPatientRoutes);
app.use('/patient/forgotPassword', forgotPasswordPatient);
app.use('/patient/queue', queuePatientRoutes);
app.use('/patient/notification', notificationPatientRoutes);
app.use('/patient/sms', smsRoutes);


// WebSocket setup for handling connections
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);
    // When a secretary connects, join their room based on their ID
    socket.on('joinSecretary', (secretaryId) => {
        socket.join(`secretary_${secretaryId}`);
        console.log(`Secretary joined room: secretary_${secretaryId}`);
    });
    // When a patient connects, join their room based on their ID
    socket.on('joinPatient', (patientId) => {
        socket.join(`patient_${patientId}`);
        console.log(`Patient joined room: patient_${patientId}`);
    });
    // Notify the secretary when a patient sends a message
    socket.on('sendMessage', (data) => {
        const { sender_id, receiver_id, sender_type } = data;
        // Determine the receiver room based on sender type
        const receiverRoom = sender_type === 'patient' ? `secretary_${receiver_id}` : `patient_${receiver_id}`;
        // Emit the message to the appropriate room
        io.to(receiverRoom).emit('newMessage', data);
        console.log(`Message sent to room: ${receiverRoom}`, data);
    });
    // Handle disconnection
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});
// Synchronize the database
sequelize.sync()
    .then(() => {
        console.log('Database connected and tables synchronized');
    })
    .catch(err => console.error('Unable to connect to the database', err));
// Start the Server
server.listen(port, () => {
    console.log(`Server is running on https://acequeue.colcap.net:${port}`);
});
// Error handling for the server
server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`Port ${port} is already in use. Please use a different port.`);
    } else {
        console.error('Server error:', err);
    }
    process.exit(1); // Exit the process to avoid hanging
});