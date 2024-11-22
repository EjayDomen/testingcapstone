const express = require('express');
const sequelize = require('../../config/database');
const Appointment = require('../../models/appointment');
const Queue = require('../../models/queue');
const QueueManagement = require('../../models/queueManagement');
const Schedule = require('../../models/schedule');
const Doctor = require('../../models/doctor');
const Secretary = require('../../models/secretary');
const auth = require('../../middleware/auth');
const router = express.Router();
const cron = require('node-cron'); // Import the cron library
const { Op } = require('sequelize');
const { formatInTimeZone } = require('date-fns-tz');



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

const getQueueForAppointment = async (patientId) => {
  try {
    // Get the current date and time in Manila time (UTC+8) using date-fns-tz
    const timeZone = 'Asia/Manila';
    const currentDateString = formatInTimeZone(new Date(), timeZone, 'yyyy-MM-dd'); // Today's date in Manila
    const currentTimeString = formatInTimeZone(new Date(), timeZone, 'HH:mm:ss'); // Current time in Manila

    // Fetch upcoming appointments for the patient, ordered by date and time
    const appointments = await Appointment.findAll({
      where: {
        PATIENT_ID: patientId,
        APPOINTMENT_DATE: {
          [Op.gte]: new Date(), // Only fetch future or today's appointments
        },
      },
      include: [
        {
          model: Doctor,
          attributes: ['FIRST_NAME', 'LAST_NAME', 'ID'],
          include: [
            {
              model: Secretary, // Assuming Secretary is associated with Doctor
              as: 'secretary',
              attributes: ['DEPARTMENT', 'FLOOR_NUMBER', 'ROOM_NUMBER'],
            },
          ],
        },
      ],
      order: [['APPOINTMENT_DATE', 'ASC'], ['APPOINTMENT_TIME', 'ASC']],
      attributes: ['id', 'APPOINTMENT_DATE', 'APPOINTMENT_TIME', 'SCHEDULE_ID'],
    });

    if (appointments.length === 0) {
      console.log('No upcoming appointments found for the patient.');
      return { queues: [], patientQueueNumber: 'N/A' };
    }

    let allQueues = [];
    let patientQueueNumber = 'N/A';

    // Loop through each appointment to get the queues associated with their schedule and time
    for (const appointment of appointments) {
      // Fetch active QueueManagement entry based on schedule, date, and time conditions in Manila time
      const queueMan = await QueueManagement.findOne({
        where: {
          SCHEDULE_ID: appointment.SCHEDULE_ID,
          DATE: currentDateString, // Ensure it's today in Manila time
        },
      });

      if (!queueMan) {
        continue; // Skip if no QueueManagement entry matches the criteria
      }

      // Fetch queues associated with the QueueManagement entry
      const queues = await Queue.findAll({
        where: { QUEUE_MANAGEMENT_ID: queueMan.id },
        order: [['QUEUE_NUMBER', 'ASC']],
      });

      // Identify the patient's queue number
      const patientQueue = queues.find(queue => queue.APPOINTMENT_ID === appointment.id);
      patientQueueNumber = patientQueue ? patientQueue.QUEUE_NUMBER : 'N/A';

      // Fetch department, floor, and room number from the doctor's secretary (assumed to be in the Secretary model)
      const doctor = appointment.doctor;
      const secretary = doctor?.secretary; // Assuming each doctor has a secretary with location details
      const department = secretary?.DEPARTMENT || 'N/A';
      const floor = secretary?.FLOOR_NUMBER || 'N/A';
      const roomNumber = secretary?.ROOM_NUMBER || 'N/A';

      // Format queue data for display
      const formattedQueues = queues.map(queue => ({
        queueNumber: queue.QUEUE_NUMBER,
        queueStatus: queue.STATUS,
        appointmentDate: appointment.APPOINTMENT_DATE,
        appointmentTime: appointment.APPOINTMENT_TIME,
        patientId: patientId,
        department,
        floor,
        roomNumber,
      }));

      // Aggregate all relevant queues
      allQueues = allQueues.concat(formattedQueues);
    }

    return { queues: allQueues, patientQueueNumber };

  } catch (error) {
    console.error('Error fetching queue:', error);
    return { queues: [], patientQueueNumber: 'N/A' };
  }
};



  
  // Array to store logged-in patient IDs
let loggedInPatientIds = new Set();

// Middleware to add the logged-in patient ID to the array
router.use(auth('Patient'), (req, res, next) => {
  const patientId = req.user.id;
  if (patientId) {
    loggedInPatientIds.add(patientId); // Add the logged-in patient ID
  }
  next();
});

// Cron job to check every minute if there's a queue list to display for logged-in patients
cron.schedule('* * * * *', async () => {
  console.log('Checking for queues to display for logged-in patients...');

  for (const patientId of loggedInPatientIds) {
    try {
      const { queues, patientQueueNumber } = await getQueueForAppointment(patientId);
      

      if (queues.length > 0) {
        console.log(`Queue list for patient ID ${patientId}:`, queues);
        console.log(`Patient Queue Number: ${patientQueueNumber}`);
      } else {
        console.log(`No queue to display for patient ID ${patientId}.`);
      }
    } catch (error) {
      console.error(`Error checking queue for patient ID ${patientId}:`, error);
    }
  }
});

  
  // API route for fetching the queue list based on the logged-in patient's appointment
  router.get('/current-queue', auth('Patient'), async (req, res) => {
    const patientId = req.user.id;
  
    try {
      const { queues, patientQueueNumber } = await getQueueForAppointment(patientId);
      if (queues.length === 0) {
        return res.status(404).json({ message: 'No current queue available.' });
      }
      res.status(200).json({ queues, patientQueueNumber });
    } catch (error) {
      console.error('Error fetching current queue:', error);
      res.status(500).json({ message: 'Error fetching current queue', error });
    }
  });
  


router.get

module.exports= router;