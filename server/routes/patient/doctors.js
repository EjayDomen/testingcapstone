const express = require('express');
const sequelize = require('../../config/database');
const Doctors = require('../../models/doctor');
const Secretary = require('../../models/secretary');
const auth = require('../../middleware/auth');
const router = express.Router();
const Schedule = require('../../models/schedule');


// view all doctor
router.get('/', auth('Patient'), async (req, res) => {
    try {
        const doctors = await Doctors.findAll({
            where:{ is_deleted: false},
            include: [{
                model: Schedule, // Assuming 'Schedules' is the model associated with Doctors
                attributes: ['DAY_OF_WEEK', 'START_TIME', 'END_TIME'] // Specify schedule fields to include
            }]
        });
        res.status(200).json(doctors);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Endpoint to fetch secretary ID and doctor's name for a specific doctor
router.get('/:doctorId', async (req, res) => {
    const { doctorId } = req.params;

    try {
        // Find the doctor associated with the given doctor ID
        const doctor = await Doctors.findOne({
            where: { id: doctorId },
            include: [{
                model: Secretary, // Assuming you have a Secretary model and association set up
                attributes: ['id'], // Fetch only the secretary ID
            }],
            attributes: ['FIRST_NAME', 'LAST_NAME', 'SECRETARY_ID'] // Fetch doctor's name and secretary ID
        });

        if (!doctor || !doctor.SECRETARY_ID) {
            return res.status(404).json({ error: 'Secretary not found for the given doctor.' });
        }

        // Return the secretary ID and doctor's name
        res.status(200).json({
            secretaryId: doctor.SECRETARY_ID,
            firstName: doctor.FIRST_NAME,
            middleName: doctor.MIDDLE_NAME,
            lastName: doctor.LAST_NAME
        });
    } catch (error) {
        console.error('Error fetching secretary ID and doctor\'s name:', error.message);
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


// Fetch the schedule of a specific doctor by doctorId
router.get('/getDoctorSchedule/:doctorId', auth('Patient'), async (req, res) => {
    const { doctorId } = req.params;

    try {
        // Find schedules associated with the specified doctor
        const schedules = await Schedule.findAll({
            where: { DOCTOR_ID: doctorId, is_deleted: false },
            include: [
                {
                    model: Doctors,
                    as: 'Doctor', // Alias used in your model association
                    attributes: ['FIRST_NAME', 'LAST_NAME', 'EXPERTISE', 'HEALTH_PROFESSIONAL_ACRONYM'],
                }
            ],
            order: [['DAY_OF_WEEK', 'ASC'], ['START_TIME', 'ASC']], // Order by day and start time
            attributes: ['SCHEDULE_ID', 'DAY_OF_WEEK', 'START_TIME', 'END_TIME', 'SLOT_COUNT']
        });

        // If no schedules are found, return a 404 response
        if (!schedules.length) {
            return res.status(404).json({ error: 'No schedules found for this doctor' });
        }

        // Format the fetched schedules
        const formattedSchedules = schedules.map(schedule => {
            // Convert the day_of_week string to a numeric value
            const dayNumber = dayOfWeekToNumber(schedule.DAY_OF_WEEK);
            
            // If the conversion fails (invalid day), we can skip or handle this accordingly
            if (dayNumber === null) {
                console.error(`Invalid day_of_week value: ${schedule.DAY_OF_WEEK}`);
                return null; // Optionally filter out invalid entries
            }

            return {
                schedule_id: schedule.SCHEDULE_ID,
                doctor_id: doctorId,
                day_of_week: [dayNumber], // Using the converted numeric day
                start_time: schedule.START_TIME,
                end_time: schedule.END_TIME,
                slot_count: schedule.SLOT_COUNT,
                title: `Dr. ${schedule.Doctor.LAST_NAME}`,
                expertise: schedule.Doctor.EXPERTISE,
                HPA: schedule.Doctor.HEALTH_PROFESSIONAL_ACRONYM,
            };
        }).filter(Boolean); // Remove any null entries if there were invalid days

        res.status(200).json(formattedSchedules);
    } catch (error) {
        console.error('Error fetching doctor schedule:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});



module.exports = router;
