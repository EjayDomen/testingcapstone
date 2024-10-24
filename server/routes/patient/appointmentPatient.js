const express = require('express');
const sequelize = require('../../config/database');
const Notification = require('../../models/notification');
const appointment = require('../../models/appointment');
const schedule = require('../../models/schedule');
const Patient = require('../../models/patient');
const Doctor = require('../../models/doctor')
const auth = require('../../middleware/auth');
const { Op } = require('sequelize');
// Import the notification service
const { fetchNotifications, createNotification } = require('../../services/notificationService');




const router = express.Router();

router.post('/createAppointment', auth('Patient'), async (req, res) => {
    // Extract data from req.body, including all necessary fields based on patientInfo structure
    const {
        doctorId, // Renamed from doctor_id to match patientInfo key
        scheduleId, // Renamed from schedule_id to match patientInfo key
        additionalNotes,
        appointmentDate,
        firstName,
        middleName,
        lastName,
        age,
        contactNumber,
        civilStatus,
        firstDoseBrand,
        firstDoseDate,
        secondDoseBrand,
        secondDoseDate,
        boosterBrand,
        boosterDate,
        address,
        reason // Assuming reason is passed as part of the patientInfo object
    } = req.body;

    const patientId = req.user.id;

    if (!patientId) {
        return res.status(400).json({ error: 'Patient information is missing or incomplete' });
    }

    const transaction = await sequelize.transaction();  // Initialize the transaction here

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
        const appointmentTime = scheduleDetails.START_TIME; // Assuming scheduleDetails has this field

        // Check for duplicate appointment
        const duplicateAppointment = await appointment.findOne({
            where: {
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

        if (existingAppointments >= scheduleDetails.slot_count) {
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
            AGE: age || 'N/A',
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
            ADDITIONAL_NOTES: additionalNotes || '' // Optional field
        }, { transaction });  // Associate this operation with the transaction

        await transaction.commit();  // Commit the transaction if all operations succeed
        res.status(201).json(newAppointment);
    } catch (error) {
        await transaction.rollback();  // Rollback the transaction in case of error
        console.error(error);
        res.status(400).json({ error: error.message });
    }
});


// View appointments for the logged-in patient along with doctor details
router.get('/viewAppointments', auth('Patient'), async (req, res) => {
    const patientId = req.user.id;

    try {
        // Find all appointments for the logged-in patient where status is not 'completed' and include doctor details
        const patientAppointments = await appointment.findAll({
            where: {
                PATIENT_ID: patientId,
                STATUS: { [Op.ne]: 'completed' } // Sequelize operator to get statuses not equal to 'completed'
            },
            include: [
                {
                    model: Doctor, // Make sure this matches the model name for the doctors table
                    attributes: ['id', 'FIRST_NAME', 'LAST_NAME', 'EXPERTISE', 'HEALTH_PROFESSIONAL_ACRONYM'] // Fetch specific doctor details
                }
            ]
        });

        if (patientAppointments.length === 0) {
            return res.status(404).json({ message: 'No appointments found for this patient' });
        }

        res.status(200).json(patientAppointments);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'An error occurred while retrieving the appointments' });
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


module.exports = router;