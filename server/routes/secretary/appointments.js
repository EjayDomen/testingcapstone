const express = require('express');
const sequelize = require('../../config/database');
const appointment = require('../../models/appointment');
const schedule = require('../../models/schedule');
const auth = require('../../middleware/auth');
const QueueManagement = require('../../models/queueManagement');
const Queue = require('../../models/queue');
const Doctor = require('../../models/doctor');
const Patient = require('../../models/patient');
const { Op, fn, col } = require('sequelize');
const router = express.Router();
const { fetchNotifications, createNotification } = require('../../services/notificationService');


router.post('/createAppointment', auth('Secretary'), async (req, res) => {
    const { fName, mName, lName, Age, ContactNumber, Reason, doctor_id, schedule_id } = req.body;

    if (!req.user || !req.user.id) {
        return res.status(400).json({ error: 'Secretary information is missing or incomplete' });
    }

    const transaction = await sequelize.transaction();

    try {
        const scheduleDetails = await schedule.findOne({
            where: {
                schedule_id: schedule_id,
                DOCTOR_ID: doctor_id
            }
        });

        if (!scheduleDetails) {
            await transaction.rollback();
            return res.status(404).json({ error: 'Schedule not found' });
        }

        const duplicateAppointment = await appointment.findOne({
            where: {
                CONTACT_NUMBER: ContactNumber,
                SCHEDULE_ID: schedule_id
            }
        });

        if (duplicateAppointment) {
            await transaction.rollback();
            return res.status(400).json({ error: 'Appointment already exists for this contact number and schedule' });
        }

        const appointmentTime = scheduleDetails.START_TIME;

        // Format the appointment date as the day of creation (today's date)
        const appointmentDate = new Date().toLocaleDateString('en-CA'); // 'en-CA' formats as 'YYYY-MM-DD'

        const existingAppointments = await appointment.count({
            where: {
                DOCTOR_ID: doctor_id,
                SCHEDULE_ID: schedule_id,
                APPOINTMENT_DATE: appointmentDate
            }
        });

        if (existingAppointments >= scheduleDetails.slot_count) {
            await transaction.rollback();
            return res.status(400).json({ error: 'No available slots' });
        }

        // Fetch doctor's full name
        const doctor = await Doctor.findByPk(doctor_id);
        const doctorName = `${doctor.FIRST_NAME} ${doctor.LAST_NAME}`;

        const newAppointment = await appointment.create({
            FIRST_NAME: fName,
            MIDDLE_NAME: mName,
            LAST_NAME: lName,
            AGE: Age,
            CONTACT_NUMBER: ContactNumber,
            REASON: Reason,
            TYPE: "walk-in",
            STATUS: "pending",
            APPOINTMENT_TIME: appointmentTime,  // Use appointment time from schedule
            APPOINTMENT_DATE: appointmentDate,  // Use today's date as appointment date
            SECRETARY_ID: req.user.id,
            DOCTOR_ID: doctor.id,
            SCHEDULE_ID: schedule_id
        }, { transaction });

        // Check if a queue already exists for the given schedule_id
        const existingQueue = await QueueManagement.findOne({
            where: { SCHEDULE_ID: schedule_id }
        });

        if (existingQueue) {
            const lastQueueEntry = await Queue.findOne({
                where: { QUEUE_MANAGEMENT_ID: existingQueue.id },
                order: [['QUEUE_NUMBER', 'DESC']]
            });

            let newQueueNumber = lastQueueEntry ? lastQueueEntry.QueueNumber : 0;
            newQueueNumber += 1;

            await Queue.create({
                QUEUE_NUMBER: newQueueNumber,
                APPOINTMENT_ID: newAppointment.id,
                QUEUE_MANAGEMENT_ID: existingQueue.id,
                MESSAGE_ID: '',  // Default value
                PROGRESS: 'pending',  // Default value
                STATUS: 'waiting',  // Default value
                SERVED: 'no',  // Default value
            }, { transaction });
        }

        await transaction.commit();
        res.status(201).json(newAppointment);
    } catch (error) {
        await transaction.rollback();
        console.error(error);
        res.status(400).json({ error: error.message });
    }
});


// show all appointments by schedule ID
router.get('/patientList/secretary/appointments/patientList/:schedId', auth('Secretary'), async (req, res) => {
    const { schedId, Date } = req.params;
    try {
        const Appointments = await appointment.findAll({
            where: { SCHEDULE_ID: schedId, APPOINTMENT_DATE: Date },
            include: [
                {
                    model: Patient,
                    attributes: ['FIRST_NAME', 'LAST_NAME', 'CONTACT_NUMBER'], // Assuming these are the relevant fields from the Patient model
                },
                {
                    model: Doctor,
                    attributes: ['FIRST_NAME', 'LAST_NAME', 'EXPERTISE', 'HEALTH_PROFESSIONAL_ACRONYM'],
                }
            ],
        });
        console.log(Appointments);
        res.status(200).json(Appointments);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});


// show all appointments
router.get('/', auth('Secretary'), async (req, res) => {
    try{
        const Appointment = await appointment.findAll();
        res.status(200).json(Appointment);
    } catch (error){
        res.status(400).json({error: error.message});
    }
});

// count all appointments
router.get('/count', auth('Secretary'), async (req, res) => {
    try{
        const appointmentCount = await appointment.count();
        res.status(200).json({ appointmentCount });
    } catch (error){
        res.status(400).json({error: error.message});
    }
});

// show one appointment by id
router.get('/:id', auth('Secretary'), async (req, res) =>{
    const {id} = req.params;
    try{
        const Appointment = await appointment.findOne({where: {id}});
        if(!Appointment){
            return res.status(404).json({error: 'Appointment not Found'});
        }
        res.status(200).json(Appointment);
    } catch (error){
        res.status(400).json({error: error.message});
    }
});

//update appointment by id
router.put('/:id', auth('Secretary'), async (req, res)=> {
    const {id} = req.params;
    const {DoctorName, AppointmentTime, Reason, ContactNumber, Type} = req.body;
    try{
        const Appointment = await appointment.findOne({ where: {id}});
        if(!Appointment){
            return res.status(404).json({error: 'Appointment not found'});
        }
        Appointment.DoctorName = DoctorName;
        Appointment.AppointmentTime = AppointmentTime;
        Appointment.Reason = Reason;
        Appointment.ContactNumber = ContactNumber;
        Appointment.Type = Type;
        await Appointment.save();
        res.status(200).json(Appointment);
    } catch (error){
        res.status(400).json({ error: error.message});
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
        res.status(204).send();
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

//update appointment status by id
router.put('/:id', auth('Secretary'), async (req, res)=> {
    const {id} = req.params;
    const {status} = req.body;
    try{
        const Appointment = await appointment.findOne({ where: { id }});
        if (!Appointment)
            {
                return res.status(404).json({ error: 'Appointment not found' });
            }
        Appointment.status = status;
        await Appointment.save();
        res.status(200).json(Appointment); 
    } catch (error){
        res.status(400).json({ error: error.message});
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
                    attributes: ['FIRST_NAME', 'LAST_NAME', 'CONTACT_NUMBER'], // Assuming these are relevant fields from the Patient model
                }
            ],
            order: [['APPOINTMENT_TIME', 'ASC']], // Order by appointment time in ascending order
            limit // Limit the number of rows returned
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

        const queueMan = await QueueManagement.findOne({where: {SCHEDULE_ID: scheduleId}});

        if(!queueMan){
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
            {STATUS: 'cancelled'},
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
                USER_TYPE: 'Patient'
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
            USER_TYPE: 'Secretary'
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


module.exports = router;