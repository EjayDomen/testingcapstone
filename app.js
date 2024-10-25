require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const sequelize = require('./config/database');
const http = require('http');
const socketIo = require('socket.io');

// Import Routes
const authRoutes = require('./routes/secretary/auth');
const appointmentsRoutes = require('./routes/secretary/appointments');
const showSecretary = require('./routes/secretary/secretary');
const doctorRoutes = require('./routes/secretary/doctor');
const scheduleRoutes = require('./routes/secretary/schedule');
const queueManagementRoutes = require('./routes/secretary/queuemanagement');
const registerPatient = require('./routes/patient/patient_auth');
const emailVerification = require('./routes/patient/emailVerification');
const loginRoutes = require('./routes/login/login');
const messageRoutes = require('./routes/secretary/messages');
const patientMan = require('./routes/secretary/patient');
const notificationRoutes = require('./routes/secretary/notification');
const scanRoutes = require('./routes/secretary/qrScanner');
const messageRoutesPat = require('./routes/patient/message');
const appointmentPatientRoutes = require('./routes/patient/appointmentPatient');
const doctorPatientRoutes = require('./routes/patient/doctors');
const forgotPasswordPatient = require('./routes/patient/forgotPassword');
const queuePatientRoutes = require('./routes/patient/queue');
const notificationPatientRoutes = require('./routes/patient/notification');

// Initialize Express App
const app = express();
const port = process.env.PORT || 5000;

// Middleware Setup
app.use(cors({
    origin: ['https://acequeue.colcap.net'], // Replace with your frontend origin
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Authorization', 'Content-Type'],
    credentials: true  // Allow credentials (cookies, headers) to be sent
}));
app.use(bodyParser.json());

// HTTP and Socket.IO Server Setup
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: 'https://acequeue.colcap.net', // Replace with your frontend origin
        methods: ['GET', 'POST'],
        allowedHeaders: ['Authorization'],
        credentials: true // Allow credentials (cookies, headers) to be sent
    }
});

// Attach Socket.IO instance to the app (if needed elsewhere)
app.set('io', io);

// Routes Setup
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

// Patient Routes
app.use('/messages', messageRoutesPat);
app.use('/signup', registerPatient);
app.use('/signup/verification', emailVerification);
app.use('/patient/appointment', appointmentPatientRoutes);
app.use('/patient/doctors', doctorPatientRoutes);
app.use('/patient/forgotPassword', forgotPasswordPatient);
app.use('/patient/queue', queuePatientRoutes);
app.use('/patient/notification', notificationPatientRoutes);

// WebSocket Setup
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('joinSecretary', (secretaryId) => {
        socket.join(`secretary_${secretaryId}`);
        console.log(`Secretary joined room: secretary_${secretaryId}`);
    });

    socket.on('joinPatient', (patientId) => {
        socket.join(`patient_${patientId}`);
        console.log(`Patient joined room: patient_${patientId}`);
    });

    socket.on('sendMessage', (data) => {
        const { sender_id, receiver_id, sender_type } = data;
        const receiverRoom = sender_type === 'patient' ? `secretary_${receiver_id}` : `patient_${receiver_id}`;
        io.to(receiverRoom).emit('newMessage', data);
        console.log(`Message sent to room: ${receiverRoom}`, data);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

// Database Synchronization
sequelize.sync()
    .then(() => {
        console.log('Database connected and tables synchronized');
    })
    .catch(err => {
        console.error('Unable to connect to the database:', err);
        process.exit(1); // Exit process if the database connection fails
    });

// Start the Server
server.listen(port, () => {
    console.log(`Server is running on https://acequeue.colcap.net:${port}`);
});


// Error Handling
server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`Port ${port} is already in use. Please use a different port.`);
    } else {
        console.error('Server error:', err);
    }
    process.exit(1); // Exit the process on server errors to avoid hanging
});
