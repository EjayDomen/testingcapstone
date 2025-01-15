const express = require('express');
const sequelize = require('../../config/database');
const appointment = require('../../models/appointment');
const schedule = require('../../models/schedule');
const auth = require('../../middleware/auth');
const QueueManagement = require('../../models/queueManagement');
const Queue = require('../../models/queue');
const Doctor = require('../../models/doctor');
const Patient = require('../../models/patient');
const Services = require('../../models/services');
const bcrypt = require('bcryptjs');
const axios = require('axios');
const { Op, fn, col } = require('sequelize');
const router = express.Router();
const { createNotification } = require('../../services/notificationService');
const { createLog } = require('../../services/logServices');
const formatInTimeZone = require('date-fns-tz').formatInTimeZone;



const createPassword = (lastName) => {
    const timeZone = 'Asia/Manila';
    const todayDate = formatInTimeZone(new Date(), timeZone, 'yyyyMMdd'); // Formats date as YYYYMMDD
    return `${lastName}${todayDate}`;
};

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


router.post('/joinQueue', auth('Secretary'), async (req, res) => {
    const {
        PATIENT_ID = 'N/A',
        FIRST_NAME = 'N/A',
        LAST_NAME = 'N/A',
        AGE = 'N/A',
        ADDRESS = 'N/A',
        EMAIL = 'N/A',
        SEX = 'N/A',
        DATE = 'N/A',
        doctor_id = 'N/A',
        schedule_id = 'N/A',
        MIDDLE_NAME = 'N/A',
        CONTACT_NUMBER = 'N/A',
        SUFFIX = 'N/A',
        TYPE = 'walk-in', // Should be "followup" or "walkin"
        CIVIL_STATUS = 'N/A'
    } = req.body;

    if (!req.user || !req.user.id) {
        return res.status(400).json({ error: 'Secretary information is missing or incomplete' });
    }

    const transaction = await sequelize.transaction();

    try {
        // Verify Schedule
        const scheduleDetails = await schedule.findOne({
            where: { SCHEDULE_ID: schedule_id, DOCTOR_ID: doctor_id }
        });

        if (!scheduleDetails) {
            await transaction.rollback();
            return res.status(404).json({ error: 'Schedule not found' });
        }

        // Check for Existing Patient by PATIENT_ID or CONTACT_NUMBER
        let patient = null;
        if (PATIENT_ID !== 'N/A') {
            patient = await Patient.findByPk(PATIENT_ID, { transaction });
        } else if (CONTACT_NUMBER !== 'N/A') {
            patient = await Patient.findOne({
                where: { CONTACT_NUMBER },
                transaction
            });
        }

        // If no patient is found, create a new patient
        if (!patient) {
            const password = createPassword(LAST_NAME);
            const hashedPassword = await bcrypt.hash(password, 10);
            patient = await Patient.create({
                FIRST_NAME, MIDDLE_NAME, LAST_NAME, SUFFIX, AGE, ADDRESS, EMAIL,
                PASSWORD: hashedPassword, SEX: 'N/A', CONTACT_NUMBER, CIVIL_STATUS, VERIFIED: 'false',
                BIRTHDAY: '00-00-0000', PROFILE_PIC: '', USER_LEVEL_ID: '3',
                FIRST_DOSE_BRAND: '', SECOND_DOSE_BRAND: '', BOOSTER_BRAND: '',
                FIRST_DOSE_DATE: '', SECOND_DOSE_DATE: '', BOOSTER_DATE: ''
            }, { transaction });
        }

        // Appointment Creation (only for follow-up)
        let Appointment = null;
        if (TYPE.toLowerCase() === 'followup') {
            const appointmentDate = DATE;
            const appointmentTime = scheduleDetails.START_TIME;

            Appointment = await appointment.create({
                PATIENT_ID: patient.id,
                FIRST_NAME,
                MIDDLE_NAME,
                LAST_NAME,
                AGE,
                ADDRESS,
                SEX,
                CONTACT_NUMBER,
                REASON: 'Follow-Up Appointment',
                TYPE: 'FOLLOW-UP',
                STATUS: 'pending',
                APPOINTMENT_TIME: appointmentTime,
                APPOINTMENT_DATE: appointmentDate,
                SECRETARY_ID: req.user.id,
                DOCTOR_ID: doctor_id,
                SCHEDULE_ID: schedule_id
            }, { transaction });
        } else if (TYPE.toLowerCase() === 'walk-in') {
            const appointmentDate = DATE;
            const appointmentTime = scheduleDetails.START_TIME;

            Appointment = await appointment.create({
                PATIENT_ID: patient.id,
                FIRST_NAME,
                MIDDLE_NAME,
                LAST_NAME,
                AGE,
                ADDRESS,
                SEX,
                CONTACT_NUMBER,
                REASON: 'walk-in',
                TYPE: 'walk-in',
                STATUS: 'pending',
                APPOINTMENT_TIME: appointmentTime,
                APPOINTMENT_DATE: appointmentDate,
                SECRETARY_ID: req.user.id,
                DOCTOR_ID: doctor_id,
                SCHEDULE_ID: schedule_id
            }, { transaction });
        }

        // Check or Create Queue Management Entry
        const existingQueue = await QueueManagement.findOne({
            where: { SCHEDULE_ID: schedule_id, DATE: DATE || new Date() }
        });

        let queueManagementId, newQueueNumber;
        if (existingQueue) {
            queueManagementId = existingQueue.id;
            const lastQueueEntry = await Queue.findOne({
                where: { QUEUE_MANAGEMENT_ID: queueManagementId },
                order: [['QUEUE_NUMBER', 'DESC']]
            });
            newQueueNumber = lastQueueEntry ? lastQueueEntry.QUEUE_NUMBER + 1 : 1;
        } else {
            const newQueueManagement = await QueueManagement.create({
                SCHEDULE_ID: schedule_id, DATE: DATE || new Date(), STATUS: 'in-progress'
            }, { transaction });
            queueManagementId = newQueueManagement.id;
            newQueueNumber = 1;
        }

        // Create Queue Entry
        await Queue.create({
            QUEUE_NUMBER: newQueueNumber,
            APPOINTMENT_ID: Appointment ? Appointment.id : null,
            PATIENT_ID: patient.id,
            QUEUE_MANAGEMENT_ID: queueManagementId,
            MESSAGE_ID: '',
            PROGRESS: 'pending',
            STATUS: 'waiting',
            SERVED: 'no',
            TYPE: TYPE || 'WALKIN'
        }, { transaction });

        // Log the action
        await createLog({
            userId: req.user.id,
            userType: 'Secretary',
            action: `Patient added to queue${TYPE === 'followup' ? ' for follow-up appointment' : ''}.`
        });

        await transaction.commit();
        res.status(201).json({ message: 'Patient added to queue successfully', patient });

    } catch (error) {
        await transaction.rollback();
        console.error(error);
        res.status(400).json({ error: error.message });
    }
});

// show all appointments by schedule ID
router.get('/patientList/appointmentList/:schedId/:Date', auth('Secretary'), async (req, res) => {
    const { schedId, Date } = req.params;
    try {
        const Appointments = await appointment.findAll({
            where: {
                SCHEDULE_ID: schedId,
                APPOINTMENT_DATE: Date
            },
        });
        console.log(Appointments);
        await createLog({
            userId: req.user.id,
            userType: 'Secretary',
            action: 'Show all appointments by schedule ID.'
        });
        res.status(200).json(Appointments);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});


// show all appointments
router.get('/', auth('Secretary'), async (req, res) => {
    try {
        const Appointment = await appointment.findAll();
        res.status(200).json(Appointment);
        await createLog({
            userId: req.user.id,
            userType: 'Secretary',
            action: 'Show all appointments.'
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// count all appointments
router.get('/count', auth('Secretary'), async (req, res) => {
    try {
        const appointmentCount = await appointment.count();
        res.status(200).json({ appointmentCount });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// show one appointment by id
router.get('/:id', auth('Secretary'), async (req, res) => {
    const { id } = req.params;
    try {
        const Appointment = await appointment.findOne({ where: { id } });
        if (!Appointment) {
            return res.status(404).json({ error: 'Appointment not Found' });
        }
        await createLog({
            userId: req.user.id,
            userType: 'Secretary',
            action: `Viewed appointment details for Appointment ID: ${Appointment.id}.`
        });
        res.status(200).json(Appointment);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

//update appointment by id
router.put('/:id', auth('Secretary'), async (req, res) => {
    const { id } = req.params;
    const { DoctorName, AppointmentTime, Reason, ContactNumber, Type } = req.body;
    try {
        const Appointment = await appointment.findOne({ where: { id } });
        if (!Appointment) {
            return res.status(404).json({ error: 'Appointment not found' });
        }
        Appointment.DoctorName = DoctorName;
        Appointment.AppointmentTime = AppointmentTime;
        Appointment.Reason = Reason;
        Appointment.ContactNumber = ContactNumber;
        Appointment.Type = Type;
        await Appointment.save();
        await createLog({
            userId: req.user.id,
            userType: 'Secretary',
            action: `Updated appointment details for Appointment ID: ${Appointment.id}.`
        });
        res.status(200).json(Appointment);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});


//delete appointment by id
router.delete('/:id', auth('Secretary'), async (req, res) => {
    const { id } = req.params;
    try {
        const Appointment = await appointment.findOne({ where: { id } });
        if (!Appointment) {
            return res.status(404).json({ error: 'Appointment not found' });
        }
        await Appointment.destroy();
        await createLog({
            userId: req.user.id,
            userType: 'Secretary',
            action: `Deleted appointment details for Appointment ID: ${Appointment.id}.`
        });
        res.status(204).send();
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

//update appointment status by id
router.put('/:id', auth('Secretary'), async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    try {
        const Appointment = await appointment.findOne({ where: { id } });
        if (!Appointment) {
            return res.status(404).json({ error: 'Appointment not found' });
        }
        Appointment.status = status;
        await createLog({
            userId: req.user.id,
            userType: 'Secretary',
            action: `Updated appointment Status for Appointment ID: ${Appointment.id}.`
        });
        await Appointment.save();
        res.status(200).json(Appointment);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});


// show today's appointments ordered by ascending start time
router.get('/today/today', auth('Secretary'), async (req, res) => {
    try {
        // Get the limit from the query parameters, defaulting to 5 if not provided
        const limit = parseInt(req.query.limit) || 5;

        // Find all appointments for today, ordered by start time (ascending)
        const todaysAppointments = await appointment.findAll({
            where: {
                [Op.and]: [
                    sequelize.where(
                        sequelize.fn('DATE', sequelize.col('APPOINTMENT_DATE')),
                        Op.eq,
                        sequelize.fn('CURDATE')
                    )
                ]
            },
            include: [
                {
                    model: Patient,
                    attributes: ['FIRST_NAME', 'LAST_NAME', 'CONTACT_NUMBER'],
                }
            ],
            order: [['APPOINTMENT_TIME', 'ASC']], // Order by appointment time in ascending order
            limit
        });

        await createLog({
            userId: req.user.id,
            userType: 'Secretary',
            action: `Showed today's queue.`
        });
        res.status(200).json(todaysAppointments);
    } catch (error) {
        console.error(error);
        res.status(400).json({ error: error.message });
    }
});


// Update all appointments' status to 'cancelled' based on schedule ID
router.put('/cancelAppointments/:scheduleId', auth('Secretary'), async (req, res) => {
    const { scheduleId } = req.params;

    const transaction = await sequelize.transaction();

    try {
        // Find all appointments associated with the given schedule ID
        const appointments = await appointment.findAll({
            where: { SCHEDULE_ID: scheduleId },
            transaction
        });

        const queueMan = await QueueManagement.findOne({ where: { SCHEDULE_ID: scheduleId } });

        if (!queueMan) {
            await transaction.rollback();
            return res.status(404).json({ error: 'No Queue Management found for the given schedule ID' });
        }

        if (appointments.length === 0) {
            await transaction.rollback();
            return res.status(404).json({ error: 'No appointments found for the given schedule ID' });
        }

        // Update the status of all found appointments to 'cancelled'
        await appointment.update(
            { STATUS: 'cancelled' },
            { where: { SCHEDULE_ID: scheduleId }, transaction }
        );

        await QueueManagement.update(
            { STATUS: 'cancelled' },
            { where: { SCHEDULE_ID: scheduleId }, transaction }
        );

        // Create notifications for each cancelled appointment
        for (const appt of appointments) {
            const message = `Appointment for ${appt.FIRST_NAME} ${appt.LAST_NAME} on ${appt.APPOINTMENT_DATE} at ${appt.APPOINTMENT_TIME} was cancelled.`;

            await createNotification({
                message: message,
                ENTITY_ID: appt.id,
                ENTITY_TYPE: 'appointment',
                status: 'unread',
                userId: appt.PATIENT_ID, // Assuming this is the field for the patient ID
                USER_TYPE: 'Patient',
                TYPE: 'FAILED'
            });
        }

        // Fetch secretary details to create a notification for the secretary
        const secretaryId = req.user.id;
        const secretaryMessage = `All appointments for schedule ID ${scheduleId} have been successfully cancelled.`;

        await createNotification({
            message: secretaryMessage,
            ENTITY_ID: scheduleId,
            ENTITY_TYPE: 'schedule',
            status: 'unread',
            userId: secretaryId,
            USER_TYPE: 'Secretary',
            TYPE: 'FAILED'
        });
        await createLog({
            userId: req.user.id,
            userType: 'Secretary',
            action: `Cancelled all appointments for schedule ID : ${scheduleId}.`
        });

        // Commit the transaction
        await transaction.commit();
        res.status(200).json({ message: `All appointments for schedule ID ${scheduleId} have been cancelled and notifications have been sent to patients and the secretary.` });
    } catch (error) {
        await transaction.rollback();
        console.error('Error updating appointment status:', error);
        res.status(400).json({ error: error.message });
    }
});

// Reschedule appointments by schedule ID
router.put('/rescheduleAppointments/resched', auth('Secretary'), async (req, res) => {
    const { scheduleId, newDate, oldDate } = req.body;

    // Log the received data
    console.log('Received data:', { scheduleId, oldDate, newDate });

    if (!scheduleId || !oldDate || !newDate) {
        return res.status(400).json({ error: 'Schedule ID, old date, and new date are required' });
    }

    const transactionQueue = await sequelize.transaction();
    const transactionAppointment = await sequelize.transaction();

    try {
        const queueManagement = await QueueManagement.findOne({
            where: {
                SCHEDULE_ID: scheduleId,
                DATE: oldDate
            },
            transaction: transactionQueue // Fixed here to include the transaction
        });

        // Find all appointments with the specified schedule ID and old date
        const appointmentsToUpdate = await appointment.findAll({
            where: {
                SCHEDULE_ID: scheduleId,
                APPOINTMENT_DATE: oldDate
            },
            transaction: transactionAppointment // Fixed here to include the transaction
        });

        if (appointmentsToUpdate.length === 0) {
            await transactionAppointment.rollback();
            return res.status(404).json({ error: 'No appointments found for the given schedule ID and old date' });
        }

        // Update each appointment to the new date
        for (const appointment of appointmentsToUpdate) {
            appointment.APPOINTMENT_DATE = newDate; // Change to new date
            await appointment.save({ transaction: transactionAppointment }); // Save with the transaction
            const doctor = await Doctor.findOne({ where: { id: appointment.DOCTOR_ID } });
            const patient = await Patient.findOne({ where: { id: appointment.PATIENT_ID } });

            try {
                // Fetch the service with primary key 2
                const service = await Services.findByPk(2);
                if (!service) {
                    console.log('Service with ID 2 not found. No messages will be sent.');
                    return;
                }

                // Get the service description as the template for the message
                const messageTemplate = service.description;
                if (!messageTemplate) {
                    console.log('No message template found in service description. SMS cannot be sent.');
                    return;
                }

                // Check if the service is active
                if (!service.is_active) {
                    console.log('SMS service is inactive. No messages will be sent.');
                    return;
                }

                // Format the new date
                const newDateObj = new Date(appointment.APPOINTMENT_DATE);
                if (isNaN(newDateObj)) {
                    throw new Error(`Invalid NEW_DATE: ${appointment.APPOINTMENT_DATE}`);
                }
                const newDate = newDateObj.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                });


                const appointmentTime = new Date(`1970-01-01T${appointment.APPOINTMENT_TIME}`).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true,
                });

                // Extract doctor details
                const doctorName = `${doctor.FIRST_NAME} ${doctor.LAST_NAME}`;

                // Attempt to replace placeholders in the message template
                let message;
                try {
                    message = eval('`' + messageTemplate + '`')
                        .replace('DOCTOR', doctorName)
                        .replace('APPOINTMENTDATE', newDate)
                        .replace('APPOINTMENTTIME', appointmentTime);;
                } catch (error) {
                    console.error('Error creating message from template:', error);
                    // Fallback message if template processing fails
                    message = `Your appointment with Dr. ${doctorName} has been rescheduled to ${newDate} at ${appointmentTime}. Please contact us for more details.`;

                }
                console.log(message);

                // Create a notification
                await createNotification({
                    message,
                    ENTITY_ID: appointment.id,
                    ENTITY_TYPE: 'Appointment',
                    status: 'unread',
                    userId: appointment.PATIENT_ID,
                    USER_TYPE: 'Patient',
                    TYPE: 'WARNING',
                });
                console.log(message);

                // Send SMS
                if (patient && patient.CONTACT_NUMBER) {
                    // Define the regular expression for valid Philippine phone numbers
                    // Includes +639xxxxxxxxx, 09xxxxxxxxx, and 9xxxxxxxxx formats
                    const isValidPhilippineNumber = /^(\+639|09|9)\d{9}$/;

                    if (patient && patient.CONTACT_NUMBER && isValidPhilippineNumber.test(patient.CONTACT_NUMBER)) {
                        // Send SMS
                        await sendSMS(patient.CONTACT_NUMBER, message);
                        console.log(message);
                        // Log successful SMS send
                        await createLog({
                            userId: req.user.id,
                            userType: 'Secretary',
                            action: `SMS successfully sent to ${patient.CONTACT_NUMBER} for reschedule appointment`
                        });

                        console.log(`SMS sent successfully to ${patient.CONTACT_NUMBER}`);
                    } else {
                        // Log invalid phone number or missing phone number
                        const contactNumberLog = patient && patient.CONTACT_NUMBER
                            ? `Invalid phone number: ${patient.CONTACT_NUMBER}`
                            : `No phone number provided for patient ID: ${appointment.PATIENT_ID}`;

                        await createLog({
                            userId: req.user.id,
                            userType: 'Secretary',
                            action: `Failed to send SMS for reschedule appointment. Reason: ${contactNumberLog}`
                        });

                        console.warn(contactNumberLog);
                    }
                } else {
                    console.warn(`No phone number found for patient ID: ${appointment.PATIENT_ID}`);
                }
            } catch (error) {
                console.error('Error processing appointment notification:', error);
            }
        }
        await createLog({
            userId: req.user.id,
            userType: 'Secretary',
            action: `Reschedule all appointments for schedule ID ${scheduleId}, date : ${oldDate}.`
        });

        queueManagement.DATE = newDate;
        queueManagement.STATUS = 'RESCHEDULED';
        await queueManagement.save({ transaction: transactionQueue });
        // Commit the transaction if all updates are successful
        await transactionAppointment.commit();
        await transactionQueue.commit();

        res.status(200).json({ message: 'Appointments successfully rescheduled', appointments: appointmentsToUpdate, queueManagement });
    } catch (error) {
        await transactionAppointment.rollback();
        await transactionQueue.rollback();
        console.error('Error rescheduling appointments:', error);
        res.status(400).json({ error: error.message });
    }
});


module.exports = router;