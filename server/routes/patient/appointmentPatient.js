const express = require('express');
const sequelize = require('../../config/database');
const Notification = require('../../models/notification');
const appointment = require('../../models/appointment');
const schedule = require('../../models/schedule');
const Patient = require('../../models/patient');
const Doctor = require('../../models/doctor')
const auth = require('../../middleware/auth');
const Queue = require('../../models/queue');
const QueueManagement = require('../../models/queueManagement');
const { Op } = require('sequelize');
const PatientFeedback = require('../../models/patientFeedback');
// Import the notification service
const { fetchNotifications, createNotification } = require('../../services/notificationService');


const router = express.Router();

router.post('/createAppointment', auth('Patient'), async (req, res) => {
    const {
        doctorId,
        scheduleId,
        additionalNotes,
        appointmentDate,
        firstName,
        middleName,
        suffix,
        lastName,
        age,
        gender,
        contactNumber,
        civilStatus,
        firstDoseBrand,
        firstDoseDate,
        secondDoseBrand,
        secondDoseDate,
        boosterBrand,
        boosterDate,
        address,
        reason
    } = req.body;

    const patientId = req.user.id;

    if (!patientId) {
        return res.status(400).json({ error: 'Patient information is missing or incomplete' });
    }

    const transaction = await sequelize.transaction();

    try {
        // Retrieve patient details
        const patient = await Patient.findByPk(patientId);
        if (!patient) {
            await transaction.rollback();
            return res.status(404).json({ error: 'Patient not found' });
        }

        // Retrieve schedule details
        const scheduleDetails = await schedule.findOne({
            where: {
                SCHEDULE_ID: scheduleId,
                DOCTOR_ID: doctorId
            }
        });
        
        if (!scheduleDetails) {
            await transaction.rollback();
            return res.status(404).json({ error: 'Schedule not found' });
        }

        // Use the schedule's available appointment time
        const appointmentTime = scheduleDetails.START_TIME;

        // Check for duplicate appointment
        const duplicateAppointment = await appointment.findOne({
            where: {
                APPOINTMENT_DATE: appointmentDate,
                CONTACT_NUMBER: contactNumber,
                SCHEDULE_ID: scheduleId
            }
        });

        if (duplicateAppointment) {
            await transaction.rollback();
            return res.status(400).json({ error: 'Appointment already exists for this contact number and schedule' });
        }

        const existingAppointments = await appointment.count({
            where: {
                DOCTOR_ID: doctorId,
                SCHEDULE_ID: scheduleId,
            }
        });

        if (existingAppointments >= scheduleDetails.SLOT_COUNT) {
            await transaction.rollback();
            return res.status(400).json({ error: 'No available slots' });
        }

        // Fetch doctor's full name
        const doctor = await Doctor.findByPk(doctorId);
        const doctorName = `${doctor.FIRST_NAME} ${doctor.LAST_NAME}`;

        // Create the new appointment with all relevant patient details
        const newAppointment = await appointment.create({
            FIRST_NAME: firstName || 'N/A',
            MIDDLE_NAME: middleName || 'N/A',
            LAST_NAME: lastName || 'N/A',
            SUFFIX: suffix || 'N/A',
            AGE: age || 'N/A',
            SEX: gender || 'N/A',
            CONTACT_NUMBER: contactNumber || 'N/A',
            CIVIL_STATUS: civilStatus || 'N/A',
            FIRST_DOSE_BRAND: firstDoseBrand || 'N/A',
            FIRST_DOSE_DATE: firstDoseDate || 'N/A',
            SECOND_DOSE_BRAND: secondDoseBrand || 'N/A',
            SECOND_DOSE_DATE: secondDoseDate || 'N/A',
            BOOSTER_BRAND: boosterBrand || 'N/A',
            BOOSTER_DATE: boosterDate || 'N/A',
            ADDRESS: address || 'N/A',
            REASON: reason || 'N/A',
            TYPE: "Online",
            STATUS: "pending",
            APPOINTMENT_TIME: appointmentTime,
            APPOINTMENT_DATE: appointmentDate,
            PATIENT_ID: patientId,
            DOCTOR_ID: doctorId,
            SCHEDULE_ID: scheduleId,
            SECRETARY_ID: null,
            ADDITIONAL_NOTES: additionalNotes || ''
        }, { transaction });

        // Check if QueueManagement is available and create a queue
        const queueManagement = await QueueManagement.findOne({
            where: {
                SCHEDULE_ID: scheduleId,
                DATE: appointmentDate,
            }
        });

        if (queueManagement) {
            // Create queue with necessary fields
            await Queue.create({
                QUEUE_NUMBER: 0,  // Queue number logic can be implemented here
                APPOINTMENT_ID: newAppointment.id,
                QUEUE_MANAGEMENT_ID: queueManagement.id,
                MESSAGE_ID: '',
                PROGRESS: 'pending',
                STATUS: 'unattend',
                SERVED: 'no',
                TYPE: 'ONLINE'
            }, { transaction });
        }

        await transaction.commit();  // Commit the transaction if all operations succeed
        res.status(201).json(newAppointment);
    } catch (error) {
        await transaction.rollback();  // Rollback the transaction in case of error
        console.error(error);
        res.status(400).json({ error: error.message });
    }
});




//completed should not be excluded in end point, it should be filterize in frontend

// View appointments for the logged-in patient along with doctor and queue details

router.get('/viewAppointments', auth('Patient'), async (req, res) => {
    const patientId = req.user.id;

    try {
        // Query to find all appointments for the logged-in patient where status is not 'completed'
        const patientAppointments = await appointment.findAll({
            where: {
                PATIENT_ID: patientId,
                STATUS: { [Op.ne]: 'completed' }
            },
            include: [
                {
                    model: Doctor,
                    attributes: ['id', 'FIRST_NAME', 'LAST_NAME', 'EXPERTISE', 'HEALTH_PROFESSIONAL_ACRONYM']
                },
                {
                    model: Queue,
                    attributes: ['QUEUE_NUMBER'],
                    required: false
                }
            ]
        });

        // Check if there are any non-completed appointments
        if (patientAppointments.length === 0) {
            return res.status(404).json({ message: 'No active appointments found for this patient.' });
        }

        // Handle cases where queue details may be null and include the complete Doctor Name
        const appointmentsWithQueue = patientAppointments.map(appointment => {
            const doctor = appointment.Doctor;
            const doctorName = doctor 
                ? `${doctor.FIRST_NAME} ${doctor.LAST_NAME}${doctor.HEALTH_PROFESSIONAL_ACRONYM ? `, ${doctor.HEALTH_PROFESSIONAL_ACRONYM}` : ''}`
                : 'N/A';

            return {
                ...appointment.toJSON(),
                Queue: appointment.Queue ? appointment.Queue : { QUEUE_NUMBER: 'Not assigned' },
                DoctorName: doctorName // Add the complete Doctor Name here
            };
        });

        res.status(200).json(appointmentsWithQueue);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'An error occurred while retrieving the appointments.' });
    }
});






router.post('/:appointmentId/cancel', auth('Patient'), async (req, res) => {
    const { appointmentId } = req.params;
    try {
      // Find the appointment to cancel
      const Appointment = await appointment.findByPk(appointmentId);
      if (!appointment) {
        return res.status(404).json({ message: 'Appointment not found' });
      }
  
      // Check if the appointment is already canceled
      if (Appointment.STATUS.toLowerCase() === 'cancelled') {
        return res.status(400).json({ message: 'The appointment is already cancelled.' });
    }
      // Update appointment status to 'canceled'
      Appointment.STATUS = 'cancelled';
      await Appointment.save();
  
      // Create a new notification for the secretary dashboard
      const notification = await createNotification({
        message: `Appointment for ${Appointment.FIRST_NAME} ${Appointment.LAST_NAME} on ${Appointment.APPOINTMENT_DATE} at ${Appointment.APPOINTMENT_TIME} was canceled.`,
        ENTITY_ID: appointmentId,
        status: 'unread',
        userId: Appointment.PATIENT_ID,
        ENTITY_TYPE: 'Appointment',
        USER_TYPE: 'Patient'});
  
        console.log('Notification created:', notification);
        res.status(200).json({ message: 'Notification created', notification });
    } catch (error) {
      console.error('Error canceling appointment:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  

// Route to create patient feedback
router.post('/feedback', auth('Patient'), async (req, res) => {
    const { rating, comments } = req.body;
    const patientId = req.user.id;

    if (!comments || !rating) {
        return res.status(400).json({ error: 'Feedback and rating are required' });
    }

    try {
        // Create a new feedback entry
        const newFeedback = await PatientFeedback.create({
            PATIENT_ID: patientId,
            COMMENTS: comments,
            RATING: rating,
        });

        res.status(201).json(newFeedback);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'An error occurred while submitting feedback' });
    }
});


module.exports = router;