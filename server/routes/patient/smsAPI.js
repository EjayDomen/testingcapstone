const express = require('express');
const router = express.Router();
const axios = require('axios');
const cron = require('node-cron');
const randomString = require('randomstring');
const { format } = require('date-fns-tz');


const sequelize = require('../../config/database');
const { Op } = require('sequelize');
const Doctor = require('../../models/doctor');
const Appointment = require('../../models/appointment');
const Services = require('../../models/services');

// Function to send SMS
const sendSMS = async (number, message) => {
    try {
        const response = await axios.post('https://api.semaphore.co/api/v4/messages', {
            apikey: process.env.API_KEY,
            number,
            message
        });
        console.log(`SMS sent to ${number}:`, response.data);
    } catch (error) {
        console.error('Error sending SMS:', error.response ? error.response.data : error.message);
    }
};

// Define an endpoint for sending SMS
router.post('/send-sms', async (req, res) => {
    const { number, message } = req.body;
    sendSMS(number, message);
    res.status(200).send('SMS sent successfully');
});

// Function to get today's appointments and send reminders
const sendDailyReminders = async () => {
    try {
        const service = await Services.findByPk(1);
        if (!service || !service.is_active) {
            console.log('SMS service is inactive. No reminders will be sent.');
            return;
        }

        const hongKongTimeZone = 'Asia/Hong_Kong';
        const today = new Date();
        // Add one day
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate());

        const todayDate = format(tomorrow, 'yyyy-MM-dd', { timeZone: hongKongTimeZone }); // YYYY-MM-DD in Hong Kong timezone
        console.log(todayDate);

        // Get appointments scheduled for today
        const appointments = await Appointment.findAll({
            where: {
                APPOINTMENT_DATE: todayDate,
                STATUS: {
                    [Op.notIn]: ['cancelled', 'rescheduled', 'completed']
                }
            },
            include: [{ model: Doctor }]  // Include the doctor's details
        });

        // Loop through appointments and send reminders
        appointments.forEach(appointment => {
            const patientName = `${appointment.FIRST_NAME} ${appointment.LAST_NAME}`;
            const doctorName = `${appointment.doctor.FIRST_NAME} ${appointment.doctor.LAST_NAME}`;
            const appointmentTime = new Date(`1970-01-01T${appointment.APPOINTMENT_TIME}`).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });
            const contactNumber = appointment.CONTACT_NUMBER;

            // Replace placeholders in the service description with actual data
            const message = service.description
                ? eval('`' + service.description + '`')
                    .replace('PATIENT', patientName)
                    .replace('DOCTOR', doctorName)
                    .replace('APPOINTMENTTIME', appointmentTime)
                : `Hello PATIENT , you have an appointment today with Dr. DOCTOR at APPOINTMENTTIME. Please visit the website to get your QR code for easy check-in at the clinic.`
                    .replace('PATIENT', patientName)
                    .replace('DOCTOR', doctorName)
                    .replace('APPOINTMENTTIME', appointmentTime);


            // Send SMS
            sendSMS(contactNumber, message);
            console.log(message);
        });
    } catch (error) {
        console.error('Error fetching appointments or sending SMS:', error);
    }
};

// Schedule the reminder to run daily at 6 AM
cron.schedule('00 6 * * *', () => {
    console.log('Running daily reminder job at 6 AM');
    sendDailyReminders();

});

// Endpoint to get the SMS message
router.get('/getTextMessage', async (req, res) => {
    try {
        const service = await Services.findByPk(1);
        if (service) {
            res.status(200).json({
                message: service.description,
                is_active: service.is_active
            });
        } else {
            res.status(404).json({ message: 'No message found' });
        }
    } catch (error) {
        console.error('Error fetching message:', error);
        res.status(500).json({ error: 'Error fetching message' });
    }
});

// Endpoint to save the SMS message
router.post('/saveTextMessage', async (req, res) => {
    const { message } = req.body;
    try {
        const service = await Services.findByPk(1);
        if (service) {
            service.description = message;
            await service.save();
            res.status(200).json({ message: 'Message updated successfully' });
        } else {
            res.status(404).json({ error: 'Service with ID 1 not found' });
        }
    } catch (error) {
        console.error('Error saving message:', error);
        res.status(500).json({ error: 'Error saving message' });
    }
});

// Endpoint to toggle the SMS service active status
router.post('/toggleSmsService', async (req, res) => {
    const { is_active } = req.body;
    try {
        const service = await Services.findByPk(1);
        if (service) {
            service.is_active = is_active;
            await service.save();
            res.status(200).json({ message: `Service status updated to ${is_active}` });
        } else {
            res.status(404).json({ error: 'Service with ID 1 not found' });
        }
    } catch (error) {
        console.error('Error updating service status:', error);
        res.status(500).json({ error: 'Error updating service status' });
    }
});



// Endpoint to get the SMS message
router.get('/getTextMessage2', async (req, res) => {
    try {
        const service = await Services.findByPk(2);
        if (service) {
            res.status(200).json({
                message: service.description,
                is_active: service.is_active
            });
        } else {
            res.status(404).json({ message: 'No message found' });
        }
    } catch (error) {
        console.error('Error fetching message:', error);
        res.status(500).json({ error: 'Error fetching message' });
    }
});

// Endpoint to save the SMS message
router.post('/saveTextMessage2', async (req, res) => {
    const { message } = req.body;
    try {
        const service = await Services.findByPk(2);
        if (service) {
            service.description = message;
            await service.save();
            res.status(200).json({ message: 'Message updated successfully' });
        } else {
            res.status(404).json({ error: 'Service with ID 1 not found' });
        }
    } catch (error) {
        console.error('Error saving message:', error);
        res.status(500).json({ error: 'Error saving message' });
    }
});

router.post('/toggleSmsService2', async (req, res) => {
    const { is_active } = req.body;
    try {
        const service = await Services.findByPk(2);
        if (service) {
            service.is_active = is_active;
            await service.save();
            res.status(200).json({ message: `Service status updated to ${is_active}` });
        } else {
            res.status(404).json({ error: 'Service with ID 2 not found' });
        }
    } catch (error) {
        console.error('Error updating service status:', error);
        res.status(500).json({ error: 'Error updating service status' });
    }
});

const otpStore = {}; // This will store OTPs with phone numbers as keys and expiry timestamps

router.post('/send-otp', async (req, res) => {
    const { recipient } = req.body;

    try {

        const otpCode = randomString.generate({ length: 4, charset: 'numeric' });
        console.log('Generated OTP inside function:', otpCode);


        // Send OTP via Semaphore
        const response = await axios.post('https://api.semaphore.co/api/v4/otp', {
            apikey: process.env.API_KEY,
            number: recipient, // e.g., 639XXXXXXXXX
            message: `Your One Time Password is: ${otpCode}. Please use it within 5 minutes.`,

            code: otpCode
        });

        // Store OTP with expiry (e.g., 5 minutes = 300000 ms)
        const expiryTime = Date.now() + 300000;
        otpStore[recipient] = { otpCode, expiryTime };

        // Return the OTP and response data to the user
        res.json({
            message: 'OTP sent successfully!',
            data: response.data
        });
    } catch (error) {
        console.error('Error sending OTP:', error.response?.data || error.message);
        res.status(500).json({
            message: 'Error sending OTP',
            error: error.response?.data || error.message
        });
    }
});

router.post('/verify-otp', (req, res) => {
    const { recipient, otpCode } = req.body;

    const storedOtpData = otpStore[recipient];

    if (!storedOtpData) {
        return res.status(400).json({ message: 'OTP not found or expired.' });
    }

    const { otpCode: storedOtp, expiryTime } = storedOtpData;

    // Check if the OTP is expired
    if (Date.now() > expiryTime) {
        delete otpStore[recipient]; // Remove expired OTP
        return res.status(400).json({ message: 'OTP has expired. Please request a new one.' });
    }

    // Check if the provided OTP matches the stored one
    if (otpCode === storedOtp) {
        delete otpStore[recipient];
        return res.json({ message: 'OTP verified successfully!' });
    } else {
        return res.status(400).json({ message: 'Invalid OTP. Please try again.' });
    }
});

async function sendSms(phone) {
    const url = 'https://sendista.com/api/send/sms';

    // Create the payload for the request
    const data = {
        secret: '',
        mode: 'credits',
        phone: phone,
        message: 'how are you'
    };

    try {
        const response = await axios.post(url, data);
        return response.data;
    } catch (error) {
        if (error.response) {
            throw new Error(error.response.data.message);
        } else {
            throw new Error(error.message);
        }
    }
}

// Route to send SMS
router.post('/send-smssss', async (req, res) => {
    const { phone } = req.body;

    // Validate required fields
    if (!phone) {
        return res.status(400).json({ success: false, message: 'Missing required fields.' });
    }

    try {
        const result = await sendSms(phone);
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

module.exports = router;