const express = require('express');
const sequelize = require('../../config/database'); // Import the Sequelize instance
const Appointment = require('../../models/appointment');
const QueueManagement = require('../../models/queueManagement');
const Queue = require('../../models/queue');
const Schedule = require('../../models/schedule');
const Doctor = require('../../models/doctor'); // Import the Doctor model
const Secretary = require('../../models/secretary');
const auth = require('../../middleware/auth');
const cron = require('node-cron'); // Import node-cron
const router = express.Router();
const { createNotification } = require('../../services/notificationService');
const { formatInTimeZone } = require('date-fns-tz');
const {createLog} = require('../../services/logServices');


cron.schedule('0 0 * * *', async () => { // This cron job runs at midnight every day
    console.log('Running a daily check to create queues...');
    await createQueuesForWeek();
});


async function getSecretaryId() {
    // Example function to fetch the secretary ID from the database
    const secretary = await Secretary.findOne(); // Assuming you have a Secretary model
    return secretary.id;
}

// FUNCTIONS FOR CREATING A QUEUE IN A WEEK
async function createQueuesForWeek() {
    // Set the desired time zone
    const timeZone = 'Asia/Manila'; // or '+08:00'
    
    // Get the current date in the specified time zone
    const today = new Date();
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    try {
        // Loop through the next 7 days
        for (let i = 0; i < 7; i++) {
            // Calculate the date for each day in the week
            const currentDate = new Date(today);
            currentDate.setDate(today.getDate() + i);

            // Format the current date in the specified time zone
            const formattedDate = formatInTimeZone(currentDate, timeZone, 'yyyy-MM-dd');
            
            // Get the day of the week name
            const dayOfWeek = currentDate.getDay();
            const dayName = daysOfWeek[dayOfWeek];

            // Find schedules matching the current day of the week
            const schedules = await Schedule.findAll({
                where: {
                    DAY_OF_WEEK: dayName,
                    is_deleted: false
                }
            });

            // Create or update queues for each schedule
            for (const schedule of schedules) {
                await createOrUpdateQueue(schedule.SCHEDULE_ID, formattedDate);
            }
            await createLog({
                userId: 'System',
                userType: 'System',
                action: `Created queues for a week.`
              }); 
        }
    } catch (error) {
        console.error('Error automating queue creation for the week:', error);
    }
}

//FUNCTION FOR CREATING A QUEUE TODAY
async function createQueuesForToday() {
    // Set the desired time zone
    const timeZone = 'Asia/Manila'; // or '+08:00'

    // Get the current date and time in the specified time zone
    const today = formatInTimeZone(new Date(), timeZone, 'yyyy-MM-dd');
    

    const dayOfWeek = new Date(today).getDay(); // Get day of the week from the adjusted date
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    // Get the day name based on the day number
    const dayName = daysOfWeek[dayOfWeek];

    try {
        const schedules = await Schedule.findAll({
            where: {
                DAY_OF_WEEK: dayName,
                is_deleted: false
            }
        });

        for (const schedule of schedules) {
            // Directly call the function to handle queue creation
            await createOrUpdateQueue(schedule.SCHEDULE_ID, today); // Use the formatted date
        }
        await createLog({
            userId: 'System',
            userType: 'System',
            action: `Created queues for this day ${today}.`
          }); 
    } catch (error) {
        console.error('Error automating queue creation:', error);
    }
}


async function createOrUpdateQueue(scheduleId, date, res = null) {
    const transaction = await sequelize.transaction();
    try {
        // Check if the schedule with the given scheduleId exists
        const schedule = await Schedule.findOne({ 
            where: { SCHEDULE_ID: scheduleId, is_deleted: false },
            include: [
                {
                    model: Doctor,
                    as: 'Doctor', // Use the alias defined in your model association
                    attributes: ['FIRST_NAME', 'MIDDLE_NAME', 'LAST_NAME', 'SUFFIX']
                }
            ],
             transaction });

        // If the schedule doesn't exist, rollback and log the message
        if (!schedule) {
            console.error(`No schedule found for SCHEDULE_ID: ${scheduleId}`);
            await transaction.rollback();
            if (res) {
                return res.status(404).json({ message: 'No schedule found for the given schedule ID' });
            }
            return; // Stop further processing
        }

        // Fetch all appointments with the given scheduleId and date
        const appointments = await Appointment.findAll({
            where: { SCHEDULE_ID: scheduleId, APPOINTMENT_DATE: date },
            order: [['createdAt', 'ASC']] // Assuming `createdAt` is the field that indicates when the appointment was booked
        });

        // if (!appointments.length) {
        //     await transaction.rollback();
        //     if (res) {
        //         return res.status(404).json({ message: 'No appointments found for the given schedule ID' });
        //     }
        //     return;
        // }

        // Check if the queue management entry already exists
        let queueManagement = await QueueManagement.findOne({
            where: { SCHEDULE_ID: scheduleId, DATE: date},
            transaction
        });

        if (!queueManagement) {
            // Create QueueManagement entry for new or walk-in appointments
            queueManagement = await QueueManagement.create({
                SCHEDULE_ID: scheduleId,
                DATE: date,
                START_TIME: schedule.START_TIME,
                END_TIME: schedule.END_TIME,
                STATUS: 'OUT', // Set a default status or adjust accordingly
                createdAt: new Date(),
                updatedAt: new Date()
            }, { transaction });

            console.log(`Queue Management created for schedule ID ${scheduleId} on ${date}`);
        } else {
            console.log(`Queue Management already exists for schedule ID ${scheduleId} on ${date}`);
        }

        // Ensure that queueManagement.id is available before creating queues
        const queueManagementId = queueManagement.id;


        const STATUS = 'in-queue';  
        // Example details to be included in the message
        const doctorName = schedule.Doctor && schedule.Doctor.FIRST_NAME && schedule.Doctor.LAST_NAME
    ? `Dr. ${schedule.Doctor.FIRST_NAME} ${schedule.Doctor.MIDDLE_NAME ? schedule.Doctor.MIDDLE_NAME.charAt(0) + '.' : ''} ${schedule.Doctor.LAST_NAME}${schedule.Doctor.SUFFIX ? ', ' + schedule.Doctor.SUFFIX : ''}`
    : 'Unknown Doctor';

        const appointmentDate = date; // The date for the queue
        const startTime = schedule.START_TIME;
        for (const appointment of appointments) {

            // Create a new queue entry for the appointment with default values
            await Queue.create({
                QUEUE_NUMBER: 0,
                APPOINTMENT_ID: appointment.id,
                PATIENT_ID: appointment.PATIENT_ID,
                QUEUE_MANAGEMENT_ID: queueManagementId, // Ensure this is set correctly
                MESSAGE_ID: '',       // Default value
                PROGRESS: 'pending',  // Default value
                STATUS: 'waiting',    // Default value
                SERVED: 'no',         // Default value
                TYPE:'ONLINE'
            }, { transaction });

            const patientMessage = 'The queue for your appointment has already been created. Please proceed to the clinic to obtain your queue number.';
            await createNotification({
                message: patientMessage,
                ENTITY_ID: appointment.id,
                ENTITY_TYPE: 'Queue Management',
                status: 'unread',
                userId: appointment.PATIENT_ID,
                USER_TYPE: 'Patient',
                TYPE:'SUCCESS'
            });
        }

        const secretaryId = await getSecretaryId(); // Fetch the secretary ID

        // Update the secretary message
        const secretaryMessage = `Queue successfully created for Dr. ${doctorName} on ${appointmentDate} at ${startTime}.`;


        await createNotification({
            message: secretaryMessage,
            ENTITY_ID: queueManagementId,
            ENTITY_TYPE: 'Queue Management',
            status: 'unread',
            userId: secretaryId,
            USER_TYPE: 'Secretary',
            TYPE:'SUCCESS'
        });

        // Update the status of all appointments with the given scheduleId
        await Appointment.update({ STATUS }, { where: { SCHEDULE_ID: scheduleId }, transaction });

        // Commit the transaction
        await transaction.commit();

        // Fetch the newly created queue for the given scheduleId
        const queueEntries = await Queue.findAll({
            where: { QUEUE_MANAGEMENT_ID: queueManagementId },
            order: [['QUEUE_NUMBER', 'ASC']]
        });

        // If `res` is available, send the response; otherwise, just log the message
        if (res) {
            return res.status(200).json({
                message: 'Queue created successfully',
                queue: queueEntries
            });
        } else {
            console.log('Queue created successfully', queueEntries);
        }

    } catch (error) {
        console.error('Failed to create or update queue:', error);
        await createNotification({
            message: 'Queue creation failed. Please try again or manually create the queue if the issue persists.',
            ENTITY_ID: queueManagementId,
            ENTITY_TYPE: 'Queue Management',
            status: 'unread',
            userId: secretaryId,
            USER_TYPE: 'Secretary',
            TYPE:'FAILED'
        });
        await transaction.rollback();
        if (res) {
            return res.status(500).json({ message: 'Failed to create or update queue', error });
        }
    }
}

// Function for updating the status of a queue by queue number and queue management ID
async function updateQueueStatusByQueueNumber(queueNumber, queueManagementId, newStatus, res = null) {
    const transaction = await sequelize.transaction();
    try {
        // Find the queue by queue number and queue management ID
        const queue = await Queue.findOne({
            where: {
                QUEUE_NUMBER: queueNumber,
                QUEUE_MANAGEMENT_ID: queueManagementId // Filter by queue management ID as well
            },
            transaction
        });

        // If the queue doesn't exist, rollback and return a 404 response
        if (!queue) {
            console.error(`No queue found for QUEUE_NUMBER: ${queueNumber} and QUEUE_MANAGEMENT_ID: ${queueManagementId}`);
            await transaction.rollback();
            if (res) {
                return res.status(404).json({ message: 'No queue found for the given queue number and management ID' });
            }
            return; // Stop further processing
        }

        // Update the status of the found queue
        await queue.update({ STATUS: newStatus }, { transaction });

        // Commit the transaction
        await transaction.commit();

        // If `res` is available, send a success response
        if (res) {
            return res.status(200).json({
                message: 'Queue status updated successfully',
                queue: {
                    QUEUE_NUMBER: queue.QUEUE_NUMBER,
                    STATUS: queue.STATUS
                }
            });
        } else {
            console.log(`Queue status updated successfully for QUEUE_NUMBER: ${queueNumber} and QUEUE_MANAGEMENT_ID: ${queueManagementId}`);
        }

    } catch (error) {
        console.error('Failed to update queue status:', error);
        await transaction.rollback();
        if (res) {
            return res.status(500).json({ message: 'Failed to update queue status', error });
        }
    }
}


router.post('/createQueue', auth('Secretary'), async (req, res) => {
    const { scheduleId, date } = req.body;
    const secretaryId = req.user.id;


    try {
        await createOrUpdateQueue(scheduleId, date);

        const schedule = await Schedule.findByPk({where:{id : scheduleId}});
        const doctor = await Doctor.findByPk({ where: {id: schedule.DOCTOR_ID}});
        const doctorName = doctor && doctor.FIRST_NAME && doctor.LAST_NAME
        ? `Dr. ${doctor.FIRST_NAME} ${doctor.MIDDLE_NAME ? doctor.MIDDLE_NAME.charAt(0) + '.' : ''} ${doctor.LAST_NAME}${doctor.SUFFIX ? ', ' + doctor.SUFFIX : ''}`
        : 'Unknown Doctor';
        await createNotification({
            message: `Queue successfully created or updated for ${doctorName} on ${date} at ${schedule.START_TIME}.`,
            ENTITY_ID: scheduleId,
            ENTITY_TYPE: 'Making Queue Management by ScheduleId',
            status: 'unread',
            userId: secretaryId,
            USER_TYPE: 'Secretary',
            TYPE:'SUCCESS'
        });
        res.status(200).json({
            message: 'Queue created or updated successfully'
        });

    } catch (error) {
        console.error('Error in POST /createQueue:', error);
        await createNotification({
            message: 'Unable to create the queue. Please try again later.',
            ENTITY_ID: scheduleId,
            ENTITY_TYPE: 'Making Queue Management by ScheduleId',
            status: 'unread',
            userId: secretaryId,
            USER_TYPE: 'Secretary',
            TYPE:'FAIILED'
        });
        res.status(500).json({ message: 'Database error', error });
    }
});

// Endpoint to manually trigger createQueuesForToday for testing
router.get('/createQueuesForToday', auth('Secretary'), async (req, res) => {
    try {
        await createQueuesForToday();
        res.status(200).send('Queues created or updated for today\'s schedules');
    } catch (error) {
        console.error('Error triggering createQueuesForToday:', error);
        res.status(500).send('Error creating queues');
    }
});

const dayOfWeekToNumber = (day) => {
    if (typeof day !== 'string') {
        console.error("Invalid or missing day:", day);
        return null; // Return null when input is not a valid string
    }
    const days = {
        'sunday': 0,
        'monday': 1,
        'tuesday': 2,
        'wednesday': 3,
        'thursday': 4,
        'friday': 5,
        'saturday': 6
    };
    const dayNormalized = day.toLowerCase().trim(); // Normalize input to lower case and trim whitespace
    return days[dayNormalized] !== undefined ? days[dayNormalized] : null;
};



// view all queue management details
router.get('/', auth('Secretary'), async (req, res) => {
    try {
        // Fetch all queue management entries with related schedule and doctor
        const queueManagements = await QueueManagement.findAll({
            include: [
                {
                    model: Schedule,
                    as: 'Schedule', // Match this with the alias defined in your model association
                    attributes: ['SCHEDULE_ID', 'START_TIME', 'END_TIME', 'DOCTOR_ID', 'DAY_OF_WEEK', 'SCHED_COUNTER'],
                    include: [
                        {
                            model: Doctor,
                            as: 'Doctor', // Match this with the alias defined in your model association
                            attributes: ['id','FIRST_NAME', 'MIDDLE_NAME', 'LAST_NAME', 'SUFFIX', 'EXPERTISE', 'HEALTH_PROFESSIONAL_ACRONYM']
                        }
                    ]
                }
            ]
        });

        // Check if any queue management entries exist
        if (!queueManagements || queueManagements.length === 0) {
            return res.status(404).json({ message: 'No queue management entries found' });
        }

        // Format the queue management details based on the fetched data
        const formattedQueues = queueManagements.map((queueManagement, index) => {
            const schedule = queueManagement.Schedule || {};
            const doctor = schedule.Doctor || {};
            const dayNumber = dayOfWeekToNumber(schedule.DAY_OF_WEEK);

            // Access fields correctly
            const doctorName = doctor && doctor.FIRST_NAME && doctor.LAST_NAME
            ? `Dr. ${doctor.FIRST_NAME} ${doctor.MIDDLE_NAME ? doctor.MIDDLE_NAME.charAt(0) + '.' : ''} ${doctor.LAST_NAME}${doctor.SUFFIX ? ', ' + doctor.SUFFIX : ''}`
            : 'Unknown Doctor';
            
            const time = schedule.START_TIME && schedule.END_TIME
                ? `${schedule.START_TIME} - ${schedule.END_TIME}`
                : 'N/A';

            return {
                id: queueManagement && queueManagement.id ? queueManagement.id : 'N/A',
                title: doctorName,
                HPA: Doctor.HEALTH_PROFESSIONAL_ACRONYM,
                date: queueManagement && queueManagement.DATE ? queueManagement.DATE : 'N/A', // Check if queueManagement exists, otherwise 'N/A'
                time: `${schedule.START_TIME} - ${schedule.END_TIME}`,
                dow: dayNumber !== null ? [dayNumber] : [], // Use the converted day number
                status: queueManagement && queueManagement.STATUS ? queueManagement.STATUS : 'N/A',
                expertise: Doctor.EXPERTISE,
                startTime: schedule.START_TIME,
                endTime: schedule.END_TIME,
                schedCount: schedule.SCHED_COUNTER,
                schedId: schedule.SCHEDULE_ID,
            };
        });

        res.status(200).json(formattedQueues);
    } catch (error) {
        console.error('Error fetching queue management details:', error);
        res.status(400).json({ error: error.message });
    }
});

async function manageQueue() {
    const timeZone = 'Asia/Manila';
    const today = formatInTimeZone(new Date(), timeZone, 'yyyy-MM-dd');
    const now = new Date(formatInTimeZone(new Date(), timeZone, 'yyyy-MM-dd\'T\'HH:mm:ss')); // Now as Date object

    let anyQueueInProgress = false; // To track if any queue was set to in-progress

    try {
        const queueManagements = await QueueManagement.findAll({
            where: { DATE: today },
            include: [
                {
                    model: Schedule,
                    as: 'Schedule',
                    attributes: ['START_TIME', 'END_TIME'],
                },
            ],
        });

        for (const queueManagement of queueManagements) {
            const schedule = queueManagement.Schedule;

            if (!schedule) {
                console.warn(`No schedule found for QueueManagement ID: ${queueManagement.id}`);
                continue;
            }

            const { START_TIME, END_TIME } = schedule;
            const startTime = new Date(`${today}T${START_TIME}`);
            const endTime = new Date(`${today}T${END_TIME}`);
            
            if (now >= startTime && now < endTime) {
                await QueueManagement.update(
                    { STATUS: 'in-progress' },
                    { where: { id: queueManagement.id } }
                );
                anyQueueInProgress = true;
            } else if (now >= endTime) {
                await QueueManagement.update(
                    { STATUS: 'completed' },
                    { where: { id: queueManagement.id } }
                );

                const nextQueue = await QueueManagement.findOne({
                    where: {
                        SCHEDULE_ID: queueManagement.SCHEDULE_ID,
                        DATE: today,
                        STATUS: 'OUT',
                    },
                    order: [['DATE', 'ASC'], ['START_TIME', 'ASC']],
                });

                if (nextQueue) {
                    await nextQueue.update(
                        { STATUS: 'in-progress' },
                        { where: { id: nextQueue.id } }
                    );
                    anyQueueInProgress = true;
                }
            }
        }

        return anyQueueInProgress ? { message: 'Queue(s) in progress' } : { message: 'No available queue' };

    } catch (error) {
        console.error('Error managing queues:', error);
        return { message: 'Error managing queues' };
    }
}




// Schedule the queue manager to run every minute
cron.schedule('* * * * *', manageQueue);

//FETCH QUEUE IN A DAY
router.get('/today/todayQueue', auth('Secretary'), async (req, res) => {
    const today = new Date().toISOString().split('T')[0]; // Format YYYY-MM-DD

    try {
        // Get the limit from the query parameters, defaulting to 5 if not provided
        const limit = parseInt(req.query.limit) || 5;

        // Find the specific QueueManagement entry for today
        const queueManagement = await QueueManagement.findOne({
            where: { DATE: today },
            include: [
                {
                    model: Schedule,
                    as: 'Schedule', // Use the alias defined in your Sequelize association
                    include: [
                        {
                            model: Doctor,
                            as: 'Doctor', // Use the alias defined in your Sequelize association
                            attributes: ['FIRST_NAME', 'MIDDLE_NAME', 'LAST_NAME', 'SUFFIX', 'EXPERTISE'],
                        },
                    ],
                },
            ],
            order: [['START_TIME', 'ASC']]
        });

        // If no QueueManagement entry is found for today, return a 404 response
        if (!queueManagement) {
            return res.status(404).json({ message: 'No queue management available for today' });
        }

        // Fetch the queues associated with the found QueueManagement entry
        const queues = await Queue.findAll({
            where: { QUEUE_MANAGEMENT_ID: queueManagement.id },
            include: [
                {
                    model: Appointment,
                    attributes: ['FIRST_NAME', 'LAST_NAME'],
                },
            ],
            order: [['QUEUE_NUMBER', 'ASC']],
            limit // Limit the number of rows returned
        });

        // If no queues are found for the queue management entry, return a 404 response
        if (!queues.length) {
            return res.status(404).json({ message: 'No queues available for today' });
        }

        // Safely access the related models and their properties
        const schedule = queueManagement.Schedule;
        const doctor = schedule?.Doctor;

        const doctorName = doctor && doctor.FIRST_NAME && doctor.LAST_NAME
        ? `Dr. ${doctor.FIRST_NAME} ${doctor.MIDDLE_NAME ? doctor.MIDDLE_NAME.charAt(0) + '.' : ''} ${doctor.LAST_NAME}${doctor.SUFFIX ? ', ' + doctor.SUFFIX : ''}`
        : 'Unknown Doctor';
        const specialty = doctor?.EXPERTISE || 'N/A';
        const startTime = schedule?.START_TIME || 'N/A';
        const endTime = schedule?.END_TIME || 'N/A';

        // Format the queue details
        const formattedQueues = queues.map((queue, index) => ({
            queueNumber: queue.QUEUE_NUMBER,
            patientName: queue.Appointment ? `${queue.Appointment.FIRST_NAME} ${queue.Appointment.LAST_NAME}` : 'N/A',
            status: queue.STATUS,
        }));

        // Send the response with the formatted queues
        res.status(200).json({
            queueManagementId: queueManagement.id,
            doctorName,
            specialty,
            date: queueManagement.DATE,
            time: `${startTime} - ${endTime}`,
            status: queueManagement.STATUS,
            queues: formattedQueues,
        });
    } catch (error) {
        console.error('Error fetching today\'s queue:', error);
        res.status(500).json({ message: 'Database error', error });
    }
});


router.get('/today/CurrentQueueList', auth('Secretary'), async (req, res) => {
    const timeZone = 'Asia/Manila';
    const today = formatInTimeZone(new Date(), timeZone, 'yyyy-MM-dd'); // Today's date in Manila

    try {
        // Find the specific QueueManagement entry for today
        let queueManagement = await QueueManagement.findOne({
            where: { DATE: today, STATUS: 'in-progress'},
            include: [
                {
                    model: Schedule,
                    as: 'Schedule',
                    include: [
                        {
                            model: Doctor,
                            as: 'Doctor',
                            attributes: ['id', 'FIRST_NAME', 'MIDDLE_NAME', 'LAST_NAME', 'SUFFIX', 'EXPERTISE'],
                        },
                    ],
                },
            ],
            order: [['START_TIME', 'ASC']]
        });

        // If no QueueManagement entry is found for today, return a 404 response
        if (!queueManagement) {
            return res.status(404).json({ message: 'No queue management available for today' });
        }

        // If the current queue management is completed, fetch the next one
        if (queueManagement.STATUS === 'completed') {
            queueManagement = await QueueManagement.findOne({
                where: {
                    DATE: today,
                    STATUS: 'in-progress', // Assuming this is the status for ongoing queues
                },
                include: [
                    {
                        model: Schedule,
                        as: 'Schedule',
                        include: [
                            {
                                model: Doctor,
                                as: 'Doctor',
                                attributes: ['id', 'FIRST_NAME', 'MIDDLE_NAME', 'LAST_NAME', 'SUFFIX', 'EXPERTISE'],
                            },
                        ],
                    },
                ],
                order: [['START_TIME', 'ASC']],
            });

            // If no next QueueManagement entry is found, return a 404 response
            if (!queueManagement) {
                return res.status(404).json({ message: 'No ongoing queue management available for today' });
            }
        }

        // Fetch the queues associated with the found QueueManagement entry
        const queues = await Queue.findAll({
            where: { QUEUE_MANAGEMENT_ID: queueManagement.id },
            include: [
                {
                    model: Appointment,
                    attributes: ['id', 'FIRST_NAME', 'MIDDLE_NAME', 'LAST_NAME', 'SUFFIX', 'AGE', 'ADDRESS', 'CONTACT_NUMBER', 'TYPE'],
                },
            ],
            order: [['QUEUE_NUMBER', 'ASC']]
        });

        // If no queues are found for the queue management entry, return a 404 response
        // if (!queues.length) {
        //     return res.status(404).json({ message: 'No queues available for today' });
        // }

        // Safely access the related models and their properties
        const schedule = queueManagement.Schedule;
        const scheduleId = schedule?.SCHEDULE_ID || 'N/A';
        const doctor = schedule?.Doctor;

        const doctorName = doctor && doctor.FIRST_NAME && doctor.LAST_NAME
            ? `Dr. ${doctor.FIRST_NAME} ${doctor.MIDDLE_NAME ? doctor.MIDDLE_NAME.charAt(0) + '.' : ''} ${doctor.LAST_NAME}${doctor.SUFFIX ? ', ' + doctor.SUFFIX : ''}`
            : 'Unknown Doctor';
        const specialty = doctor?.EXPERTISE || 'N/A';
        const doctorId = doctor?.id || 'N/A';
        const startTime = schedule?.START_TIME || 'N/A';
        const endTime = schedule?.END_TIME || 'N/A';

        // Format the queue details
            const formattedQueues = queues.map((queue) => ({
                queueNumber: queue.QUEUE_NUMBER,
                patientName: queue.Appointment
                    ? `${queue.Appointment.FIRST_NAME} ${queue.Appointment.MIDDLE_NAME ? queue.Appointment.MIDDLE_NAME + ' ' : ''}${queue.Appointment.LAST_NAME}${queue.Appointment.SUFFIX ? ', ' + queue.Appointment.SUFFIX : ''}`
                    : 'N/A',
                appointmentId: queue.APPOINTMENT_ID,
                status: queue.STATUS,
                age: queue.Appointment ? queue.Appointment.AGE || 'N/A' : 'N/A',
                address: queue.Appointment ? queue.Appointment.ADDRESS || 'NULL' : 'NULL',
                contactNumber: queue.Appointment ? queue.Appointment.CONTACT_NUMBER || 'NULL' : 'NULL',
                type: queue.Appointment ? queue.Appointment.TYPE : 'N/A',
            }));

        
        // Send the response with the formatted queues
        res.status(200).json({
            queueManagementId: queueManagement.id,
            doctorId,
            doctorName,
            specialty,
            scheduleId,
            date: queueManagement.DATE,
            time: `${startTime} - ${endTime}`,
            status: queueManagement.STATUS,
            queues: formattedQueues,
        });
    } catch (error) {
        console.error('Error fetching today\'s queue:', error);
        res.status(500).json({ message: 'Database error', error });
    }
});



//FETCH QUEUE FROM QID 5 queue
router.get('/queue/:qid', auth('Secretary'), async (req, res) => {
    const { qid } = req.params;

    try {
        // Get the limit from the query parameters, defaulting to 5 if not provided
        const limit = parseInt(req.query.limit) || 5;

        // Find the specific QueueManagement entry for today
        const queueManagement = await QueueManagement.findOne({
            where: { id: qid },
            include: [
                {
                    model: Schedule,
                    as: 'Schedule', // Use the alias defined in your Sequelize association
                    include: [
                        {
                            model: Doctor,
                            as: 'Doctor', // Use the alias defined in your Sequelize association
                            attributes: ['FIRST_NAME', 'MIDDLE_NAME', 'LAST_NAME', 'SUFFIX', 'EXPERTISE'],
                        },
                    ],
                },
            ],
            order: [['START_TIME', 'ASC']]
        });

        // If no QueueManagement entry is found for today, return a 404 response
        if (!queueManagement) {
            return res.status(404).json({ message: 'No queue management available for today' });
        }

        // Fetch the queues associated with the found QueueManagement entry
        const queues = await Queue.findAll({
            where: { QUEUE_MANAGEMENT_ID: queueManagement.id },
            include: [
                {
                    model: Appointment,
                    attributes: ['FIRST_NAME', 'MIDDLE_NAME','LAST_NAME', 'SUFFIX'],
                },
            ],
            order: [['QUEUE_NUMBER', 'ASC']],
            limit // Limit the number of rows returned
        });

        // If no queues are found for the queue management entry, return a 404 response
        if (!queues.length) {
            return res.status(404).json({ message: 'No queues available for today' });
        }

        // Safely access the related models and their properties
        const schedule = queueManagement.Schedule;
        const doctor = schedule?.Doctor;

        const doctorName = doctor && doctor.FIRST_NAME && doctor.LAST_NAME
        ? `Dr. ${doctor.FIRST_NAME} ${doctor.MIDDLE_NAME ? doctor.MIDDLE_NAME.charAt(0) + '.' : ''} ${doctor.LAST_NAME}${doctor.SUFFIX ? ', ' + doctor.SUFFIX : ''}`
        : 'Unknown Doctor';
        const specialty = doctor?.EXPERTISE || 'N/A';
        const startTime = schedule?.START_TIME || 'N/A';
        const endTime = schedule?.END_TIME || 'N/A';

        // Format the queue details
        const formattedQueues = queues.map((queue, index) => ({
            queueNumber: queue.QUEUE_NUMBER,
            patientName: queue.Appointment
            ? `${queue.Appointment.FIRST_NAME} ${queue.Appointment.MIDDLE_NAME ? queue.Appointment.MIDDLE_NAME + ' ' : ''}${queue.Appointment.LAST_NAME}${queue.Appointment.SUFFIX ? ', ' + queue.Appointment.SUFFIX : ''}`
            : 'N/A',
            status: queue.STATUS,
        }));

        // Send the response with the formatted queues
        res.status(200).json({
            queueManagementId: queueManagement.id,
            doctorName,
            specialty,
            date: queueManagement.DATE,
            time: `${startTime} - ${endTime}`,
            status: queueManagement.STATUS,
            queues: formattedQueues,
        });
    } catch (error) {
        console.error('Error fetching today\'s queue:', error);
        res.status(500).json({ message: 'Database error', error });
    }
});


router.get('/queue/all/:qid', auth('Secretary'), async (req, res) => {
    const { qid } = req.params;

    try {

        // Find the specific QueueManagement entry for today
        const queueManagement = await QueueManagement.findOne({
            where: { id: qid },
            include: [
                {
                    model: Schedule,
                    as: 'Schedule', // Use the alias defined in your Sequelize association
                    include: [
                        {
                            model: Doctor,
                            as: 'Doctor', // Use the alias defined in your Sequelize association
                            attributes: ['FIRST_NAME', 'MIDDLE_NAME', 'LAST_NAME', 'SUFFIX', 'EXPERTISE'],
                        },
                    ],
                },
            ],
            order: [['START_TIME', 'ASC']]
        });

        // If no QueueManagement entry is found for today, return a 404 response
        if (!queueManagement) {
            return res.status(404).json({ message: 'No queue management available for today' });
        }

        // Fetch the queues associated with the found QueueManagement entry
        const queues = await Queue.findAll({
            where: { QUEUE_MANAGEMENT_ID: queueManagement.id },
            include: [
                {
                    model: Appointment,
                    attributes: ['FIRST_NAME', 'MIDDLE_NAME', 'LAST_NAME', 'SUFFIX', 'AGE', 'ADDRESS', 'CONTACT_NUMBER', 'TYPE'],
                },
            ],
            order: [['QUEUE_NUMBER', 'ASC']]
        });

        // If no queues are found for the queue management entry, return a 404 response
        if (!queues.length) {
            return res.status(404).json({ message: 'No queues available for today' });
        }

        // Safely access the related models and their properties
        const schedule = queueManagement.Schedule;
        const doctor = schedule?.Doctor;

        const doctorName = doctor && doctor.FIRST_NAME && doctor.LAST_NAME
        ? `Dr. ${doctor.FIRST_NAME} ${doctor.MIDDLE_NAME ? doctor.MIDDLE_NAME.charAt(0) + '.' : ''} ${doctor.LAST_NAME}${doctor.SUFFIX ? ', ' + doctor.SUFFIX : ''}`
        : 'Unknown Doctor';
        const specialty = doctor?.EXPERTISE || 'N/A';
        const startTime = schedule?.START_TIME || 'N/A';
        const endTime = schedule?.END_TIME || 'N/A';

        // Format the queue details
        const formattedQueues = queues.map((queue, index) => ({
            queueNumber: queue.QUEUE_NUMBER,
            patientName: queue.Appointment
            ? `${queue.Appointment.FIRST_NAME} ${queue.Appointment.MIDDLE_NAME ? queue.Appointment.MIDDLE_NAME + ' ' : ''}${queue.Appointment.LAST_NAME}${queue.Appointment.SUFFIX ? ', ' + queue.Appointment.SUFFIX : ''}`
            : 'N/A',
            status: queue.STATUS,
            age: queue.Appointment.AGE,
            address: queue.Appointment.ADDRESS || 'NULL',
            contactNumber: queue.Appointment.CONTACT_NUMBER || 'NULL',
            type: queue.Appointment.TYPE,
        }));

        await createLog({
            userId: req.user.id,
            userType: 'Secretary',
            action: `Viewed the queue list for queue management id: ${queueManagement.id}.`
          }); 
        // Send the response with the formatted queues
        res.status(200).json({
            queueManagementId: queueManagement.id,
            doctorName,
            specialty,
            date: queueManagement.DATE,
            time: `${startTime} - ${endTime}`,
            status: queueManagement.STATUS,
            queues: formattedQueues,
        });
    } catch (error) {
        console.error('Error fetching today\'s queue:', error);
        res.status(500).json({ message: 'Database error', error });
    }
});



// Route for updating queue status
router.post('/queue/changeStatus', auth('Secretary'), async (req, res) => {
    const { queueNumber, queueManagementId, newStatus } = req.body;
    const secretary = req.user.id;
  
    try {

        if (!secretary) {
            return res.status(403).json({ error: 'Unauthorized: Secretary information not found' });
        }
      const result = await updateQueueStatusByQueueNumber(queueNumber, queueManagementId, newStatus);
      res.status(200).json(result); // Corrected line
      await createLog({
        userId: secretary,
        userType: 'Secretary',
        action: `Updated queue's status for queue number:${queueNumber}, queue management id: ${queueManagementId}.`
      }); 
    } catch (error) {
      console.error('Error updating queue status:', error);
      res.status(500).json({ message: 'Failed to update queue status' });
    }
  });
  


// Endpoint to manually trigger createQueuesForWeek for testing
router.get('/createQueuesForWeek', auth('Secretary'), async (req, res) => {
    try {
        await createQueuesForWeek();
        res.status(200).send('Queues created or updated for the week\'s schedules');
    } catch (error) {
        console.error('Error triggering createQueuesForWeek:', error);
        res.status(500).send('Error creating queues for the week');
    }
});

module.exports= router;
// module.exports = {
//     router,
//     createOrUpdateQueue
// };