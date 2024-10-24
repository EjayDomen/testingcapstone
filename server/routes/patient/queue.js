const express = require('express');
const sequelize = require('../../config/database'); // Import the Sequelize instance
const Appointment = require('../../models/appointment');
const QueueManagement = require('../../models/queueManagement');
const Queue = require('../../models/queue');
const Schedule = require('../../models/schedule');
const Doctor = require('../../models/doctor'); // Import the Doctor model
const auth = require('../../middleware/auth');
const router = express.Router();


router.get('/queue', auth('Patient'), async (req, res) => {
    const patientId = req.user.id; // Get the logged-in patient's ID

    try {
        // Fetch all appointments for the logged-in patient
        const appointments = await Appointment.findAll({
            where: { PATIENT_ID: patientId },
            attributes: ['id', 'FIRST_NAME', 'LAST_NAME', 'APPOINTMENT_DATE', 'APPOINTMENT_TIME', 'SCHEDULE_ID'],
            order: [['APPOINTMENT_DATE', 'ASC'], ['APPOINTMENT_TIME', 'ASC']],
        });

        if (!appointments || appointments.length === 0) {
            return res.status(404).json({ message: 'No appointments found for the logged-in patient' });
        }

        // Initialize an array to store formatted queues
        const formattedQueues = [];

        // Loop through each appointment and fetch related details separately
        for (const appointment of appointments) {
            // Fetch the queue associated with the appointment
            const queue = await Queue.findOne({
                where: { APPOINTMENT_ID: appointment.id },
            });

            if (!queue) {
                formattedQueues.push({
                    appointmentId: appointment.id,
                    patientName: `${appointment.FIRST_NAME} ${appointment.LAST_NAME}`,
                    appointmentDate: appointment.APPOINTMENT_DATE,
                    appointmentTime: appointment.APPOINTMENT_TIME,
                    queueNumber: 'N/A',
                    queueStatus: 'N/A',
                    doctorName: 'N/A',
                    specialty: 'N/A',
                    scheduleTime: 'N/A',
                    queueDate: 'N/A',
                });
                continue;
            }

            // Fetch the queue management entry associated with the queue
            const queueManagement = await QueueManagement.findOne({
                where: { id: queue.QUEUE_MANAGEMENT_ID },
            });

            if (!queueManagement) {
                formattedQueues.push({
                    appointmentId: appointment.id,
                    patientName: `${appointment.FIRST_NAME} ${appointment.LAST_NAME}`,
                    appointmentDate: appointment.APPOINTMENT_DATE,
                    appointmentTime: appointment.APPOINTMENT_TIME,
                    queueNumber: queue.QUEUE_NUMBER,
                    queueStatus: queue.STATUS,
                    doctorName: 'N/A',
                    specialty: 'N/A',
                    scheduleTime: 'N/A',
                    queueDate: queueManagement ? queueManagement.DATE : 'N/A',
                });
                continue;
            }

            // Fetch the schedule associated with the queue management entry
            const schedule = await Schedule.findOne({
                where: { SCHEDULE_ID: queueManagement.SCHEDULE_ID },
            });

            if (!schedule) {
                formattedQueues.push({
                    appointmentId: appointment.id,
                    patientName: `${appointment.FIRST_NAME} ${appointment.LAST_NAME}`,
                    appointmentDate: appointment.APPOINTMENT_DATE,
                    appointmentTime: appointment.APPOINTMENT_TIME,
                    queueNumber: queue.QUEUE_NUMBER,
                    queueStatus: queue.STATUS,
                    doctorName: 'N/A',
                    specialty: 'N/A',
                    scheduleTime: 'N/A',
                    queueDate: queueManagement.DATE,
                });
                continue;
            }

            // Fetch the doctor associated with the schedule
            const doctor = await Doctor.findOne({
                where: { id: schedule.DOCTOR_ID },
                attributes: ['FIRST_NAME', 'LAST_NAME', 'EXPERTISE'],
            });

            const doctorName = doctor ? `${doctor.FIRST_NAME} ${doctor.LAST_NAME}` : 'N/A';
            const specialty = doctor ? doctor.EXPERTISE : 'N/A';
            const scheduleTime = `${schedule.START_TIME} - ${schedule.END_TIME}`;

            // Add the formatted queue details to the array
            formattedQueues.push({
                appointmentId: appointment.id,
                patientName: `${appointment.FIRST_NAME} ${appointment.LAST_NAME}`,
                appointmentDate: appointment.APPOINTMENT_DATE,
                appointmentTime: appointment.APPOINTMENT_TIME,
                queueNumber: queue.QUEUE_NUMBER,
                queueStatus: queue.STATUS,
                doctorName,
                specialty,
                scheduleTime,
                queueDate: queueManagement.DATE,
            });
        }

        // Send the response with the formatted queues
        res.status(200).json({ queues: formattedQueues });
    } catch (error) {
        console.error('Error fetching patient queue details:', error);
        res.status(500).json({ message: 'Error fetching patient queue details', error });
    }
});


module.exports= router;