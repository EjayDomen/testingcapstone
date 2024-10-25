const express = require('express');
const sequelize = require('../../config/database'); // Import the Sequelize instance
const Appointment = require('../../models/appointment');
const QueueManagement = require('../../models/queueManagement');
const Queue = require('../../models/queue');
const Schedule = require('../../models/schedule');
const Doctor = require('../../models/doctor'); // Import the Doctor model
const auth = require('../../middleware/auth');
const cron = require('node-cron'); // Import node-cron
const router = express.Router();

// Scheduled task to create queues automatically
cron.schedule('0 0 * * *', async () => { // This cron job runs at midnight every day
    console.log('Running a daily check to create queues for today\'s schedules...');
    await createQueuesForToday();
});

async function createQueuesForToday() {
    const today = new Date();
    const dayOfWeek = today.getDay(); // Sunday - 0, Monday - 1, etc.
    // Array mapping numbers to day names
        const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

        // Get the day name based on the day number
        const dayName = daysOfWeek[dayOfWeek];
    try {
        const schedules = await Schedule.findAll({
            where: {
                DAY_OF_WEEK: dayName
            }
        });
        for (const schedule of schedules) {
            // Directly call the function to handle queue creation
            await createOrUpdateQueue(schedule.SCHEDULE_ID, today.toISOString().split('T')[0]); // Format YYYY-MM-DD
        }
    } catch (error) {
        console.error('Error automating queue creation:', error);
    }
}

async function createOrUpdateQueue(scheduleId, date, res = null) {
    const transaction = await sequelize.transaction();
    try {
        // Check if the schedule with the given scheduleId exists
        const schedule = await Schedule.findOne({ where: { SCHEDULE_ID: scheduleId }, transaction });

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

        if (!appointments.length) {
            await transaction.rollback();
            if (res) {
                return res.status(404).json({ message: 'No appointments found for the given schedule ID' });
            }
            return;
        }

        // Check if the queue management entry already exists
        let queueManagement = await QueueManagement.findOne({
            where: { SCHEDULE_ID: scheduleId, DATE: date },
            transaction
        });

        if (!queueManagement) {
            // Create QueueManagement entry for new or walk-in appointments
            queueManagement = await QueueManagement.create({
                SCHEDULE_ID: scheduleId,
                DATE: date,
                START_TIME: schedule.START_TIME,
                END_TIME: schedule.END_TIME,
                STATUS: 'Pending', // Set a default status or adjust accordingly
                createdAt: new Date(),
                updatedAt: new Date()
            }, { transaction });

            console.log(`Queue Management created for schedule ID ${scheduleId} on ${date}`);
        } else {
            console.log(`Queue Management already exists for schedule ID ${scheduleId} on ${date}`);
        }

        // Ensure that queueManagement.id is available before creating queues
        const queueManagementId = queueManagement.id;

        let newQueueNumber = 0;
        const STATUS = 'in-queue';  
        for (const appointment of appointments) {
            newQueueNumber += 1; // Increment queue number for each appointment

            // Create a new queue entry for the appointment with default values
            await Queue.create({
                QUEUE_NUMBER: null,
                APPOINTMENT_ID: appointment.id,
                QUEUE_MANAGEMENT_ID: queueManagementId, // Ensure this is set correctly
                MESSAGE_ID: '',       // Default value
                PROGRESS: 'pending',  // Default value
                STATUS: 'waiting',    // Default value
                SERVED: 'no',         // Default value
            }, { transaction });
        }

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
        await transaction.rollback();
        if (res) {
            return res.status(500).json({ message: 'Failed to create or update queue', error });
        }
    }
}

router.post('/createQueue', auth('Secretary'), async (req, res) => {
    const { scheduleId, date } = req.body;

    try {
        await createOrUpdateQueue(scheduleId, date);
        res.status(200).json({
            message: 'Queue created or updated successfully'
        });
    } catch (error) {
        console.error('Error in POST /createQueue:', error);
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


// view all queue management details
router.get('/', auth('Secretary'), async (req, res) => {
    try {
        // Fetch all queue management entries with related schedule and doctor
        const queueManagements = await QueueManagement.findAll({
            include: [
                {
                    model: Schedule,
                    as: 'Schedule', // Match this with the alias defined in your model association
                    attributes: ['SCHEDULE_ID', 'START_TIME', 'END_TIME', 'DOCTOR_ID'],
                    include: [
                        {
                            model: Doctor,
                            as: 'Doctor', // Match this with the alias defined in your model association
                            attributes: ['FIRST_NAME', 'LAST_NAME', 'EXPERTISE', 'HEALTH_PROFESSIONAL_ACRONYM']
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

            // Access fields correctly
            const doctorName = doctor.FIRST_NAME && doctor.LAST_NAME
                ? `${doctor.FIRST_NAME} ${doctor.LAST_NAME}, ${doctor.HEALTH_PROFESSIONAL_ACRONYM || ''}`.trim()
                : 'N/A';
            
            const time = schedule.START_TIME && schedule.END_TIME
                ? `${schedule.START_TIME} - ${schedule.END_TIME}`
                : 'N/A';

            return {
                no: index + 1,
                qid: queueManagement.id,
                doctorName,
                date: queueManagement.DATE,
                specialty: doctor.EXPERTISE || 'N/A',
                time,
                status: queueManagement.STATUS || 'N/A'
            };
        });

        res.status(200).json(formattedQueues);
    } catch (error) {
        console.error('Error fetching queue management details:', error);
        res.status(400).json({ error: error.message });
    }
});

// Function to manage and update the queue based on the time
async function manageQueue() {
    const now = new Date();
    const today = now.toISOString().split('T')[0]; // Format YYYY-MM-DD

    try {
        // Fetch all queue management entries for today
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

            // Check if schedule is available before accessing its properties
            if (!schedule) {
                console.warn(`No schedule found for QueueManagement ID: ${queueManagement.id}`);
                continue; // Skip to the next entry
            }

            const { START_TIME, END_TIME } = schedule;
            const startTime = new Date(`${today}T${START_TIME}`);
            const endTime = new Date(`${today}T${END_TIME}`);

            if (now >= startTime && now < endTime) {
                // If current time is within the active queue time range, set status to "in-progress"
                await QueueManagement.update(
                    { STATUS: 'in-progress' },
                    { where: { id: queueManagement.id } }
                );
            } else if (now >= endTime) {
                // If current time has passed the end time, set status to "completed" and start the next queue
                await QueueManagement.update(
                    { STATUS: 'completed' },
                    { where: { id: queueManagement.id } }
                );

                // Fetch next queue if exists and update its status to "in-progress"
                const nextQueue = await QueueManagement.findOne({
                    where: {
                        SCHEDULE_ID: queueManagement.SCHEDULE_ID,
                        DATE: today,
                        STATUS: 'Pending', // Find the next pending queue for today
                    },
                    order: [['START_TIME', 'ASC']],
                });

                if (nextQueue) {
                    await QueueManagement.update(
                        { STATUS: 'in-progress' },
                        { where: { id: nextQueue.id } }
                    );
                }
            }
        }
    } catch (error) {
        console.error('Error managing queues:', error);
    }
}


// Schedule the queue manager to run every minute
cron.schedule('* * * * *', manageQueue);


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
                            attributes: ['FIRST_NAME', 'LAST_NAME', 'EXPERTISE'],
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
            ? `${doctor.FIRST_NAME} ${doctor.LAST_NAME}`
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
                            attributes: ['FIRST_NAME', 'LAST_NAME', 'EXPERTISE'],
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
            ? `${doctor.FIRST_NAME} ${doctor.LAST_NAME}`
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




module.exports= router;
// module.exports = {
//     router,
//     createOrUpdateQueue
// };