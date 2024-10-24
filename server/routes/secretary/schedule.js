const express = require('express');
const Schedule = require('../../models/schedule');
const auth = require('../../middleware/auth');
const Doctor = require('../../models/doctor');
const QueueMan = require('../../models/queueManagement');

const router = express.Router();

router.put('/updateSchedule/:doctorId', auth('Secretary'), async (req, res) => {
    const { schedules } = req.body;
    const { doctorId } = req.params;

    // Validate required fields
    if (!schedules || !Array.isArray(schedules)) {
        return res.status(400).json({ error: 'An array of schedules is required' });
    }

    try {
        // Begin transaction for updating schedules
        const result = await sequelize.transaction(async (t) => {
            // Find the doctor by ID
            const doctor = await Doctor.findByPk(doctorId, { transaction: t });

            if (!doctor) {
                return res.status(404).json({ error: 'Doctor not found' });
            }

            // Get the count of existing schedules for the doctor
            const scheduleCount = await Schedule.count({ where: { DOCTOR_ID: doctorId }, transaction: t });

            // Iterate over the schedules array and update or create schedules
            const updatedSchedules = await Promise.all(schedules.map(async (schedule, index) => {
                const { schedule_id, day_of_week, start_time, end_time, slot_count } = schedule;

                // Validate schedule fields
                if (!day_of_week || !start_time || !end_time || !slot_count) {
                    throw new Error('All schedule fields are required');
                }

                if (schedule_id) {
                    // If schedule_id is provided, update the existing schedule
                    const existingSchedule = await Schedule.findOne({ where: { SCHEDULE_ID: schedule_id, DOCTOR_ID: doctorId }, transaction: t });

                    if (!existingSchedule) {
                        throw new Error('Schedule not found');
                    }

                    // Update the existing schedule
                    return existingSchedule.update({
                        DAY_OF_WEEK: day_of_week,
                        START_TIME: start_time,
                        END_TIME: end_time,
                        SLOT_COUNT: slot_count
                    }, { transaction: t });
                } else {
                    // If schedule_id is not provided, create a new schedule
                    return Schedule.create({
                        DOCTOR_ID: doctorId, // Use the doctor's ID
                        DAY_OF_WEEK: day_of_week,
                        START_TIME: start_time,
                        END_TIME: end_time,
                        SLOT_COUNT: slot_count,
                        SCHED_COUNTER: scheduleCount + index + 1 // Increment SCHED_COUNTER for new schedules
                    }, { transaction: t });
                }
            }));

            return { doctor, updatedSchedules };
        });

        res.status(200).json(result);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});



// Route to fetch schedules based on day_of_week
router.get('/getSchedulesByDay', auth('Secretary'), async (req, res) => {
    const { day_of_week } = req.query; // Example: day_of_week = 'Monday'

    // Validate input
    if (!day_of_week) {
        return res.status(400).json({ error: 'day_of_week is required' });
    }

    // Convert day_of_week string to corresponding number
    const dayNumber = dayOfWeekToNumber(day_of_week);

    if (dayNumber === null) {
        return res.status(400).json({ error: 'Invalid day_of_week' });
    }

    try {
        // Fetch schedules from the database for the given day_of_week
        const schedules = await Schedule.findAll({
            where: { DAY_OF_WEEK: dayNumber },
            include: [
                {
                    model: Doctor,
                    as: 'Doctor', // Use the alias defined in your model association
                    attributes: ['FIRST_NAME', 'LAST_NAME']
                }
            ]
        });

        if (!schedules.length) {
            return res.status(404).json({ error: 'No schedules found for the specified day' });
        }

        // Format and return the schedule data
        const formattedSchedules = schedules.map(schedule => ({
            schedule_id: schedule.SCHEDULE_ID,
            day_of_week: schedule.DAY_OF_WEEK,
            start_time: schedule.START_TIME,
            end_time: schedule.END_TIME,
            doctor_name: `${schedule.Doctor.FIRST_NAME} ${schedule.Doctor.LAST_NAME}`,
            slot_count: schedule.SLOT_COUNT
        }));

        res.status(200).json(formattedSchedules);
    } catch (error) {
        console.error('Error fetching schedules:', error);
        res.status(500).json({ error: 'Internal server error' });
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




router.get('/fetchSchedules', auth('Secretary'), async (req, res) => {
    try {
        // Fetch all schedules first, including doctor and queue management details, sorted by date and start time
        const schedules = await Schedule.findAll({
            include: [
                {
                    model: Doctor,
                    as: 'Doctor', // Use the alias defined in your model association
                    attributes: ['FIRST_NAME', 'LAST_NAME', 'EXPERTISE', 'HEALTH_PROFESSIONAL_ACRONYM']
                }
            ],
            order: [
                ['START_TIME', 'ASC'] // Sorting by start time ascending within the same date
            ],
            attributes: ['SCHEDULE_ID', 'DAY_OF_WEEK', 'START_TIME', 'END_TIME']
        });

        // Format the fetched schedules
        const formattedSchedules = await Promise.all(schedules.map(async (schedule) => {
            const dayNumber = dayOfWeekToNumber(schedule.DAY_OF_WEEK);

            // Fetch the queue management entry asynchronously
            const queueManagement = await QueueMan.findOne({ where: { SCHEDULE_ID: schedule.SCHEDULE_ID } });

            return {
                id: schedule.SCHEDULE_ID,
                title: `Dr. ${schedule.Doctor.FIRST_NAME} ${schedule.Doctor.LAST_NAME}`,
                HPA: schedule.Doctor.HEALTH_PROFESSIONAL_ACRONYM,
                date: queueManagement && queueManagement.DATE ? queueManagement.DATE : 'N/A', // Check if queueManagement exists, otherwise 'N/A'
                time: `${schedule.START_TIME} - ${schedule.END_TIME}`,
                dow: dayNumber !== null ? [dayNumber] : [], // Use the converted day number
                queueManagementId: queueManagement && queueManagement.id ? queueManagement.id : 'N/A',
                status: queueManagement && queueManagement.STATUS ? queueManagement.STATUS : 'N/A',
                expertise: schedule.Doctor.EXPERTISE,
                startTime: schedule.START_TIME,
                endTime: schedule.END_TIME,
            };
        }));

        res.status(200).json(formattedSchedules);
    } catch (error) {
        console.error('Error fetching schedules:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});



module.exports = router;
