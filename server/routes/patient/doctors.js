const express = require('express');
const sequelize = require('../../config/database');
const Doctors = require('../../models/doctor');
const Secretary = require('../../models/secretary');
const auth = require('../../middleware/auth');
const router = express.Router();
const Schedule = require('../../models/schedule');
const Appointment = require('../../models/appointment');

// view all doctor
router.get('/', auth('Patient'), async (req, res) => {
    try {
        const doctors = await Doctors.findAll({
            where: { is_deleted: false },
            include: [{
                model: Schedule,
                attributes: ['DAY_OF_WEEK', 'START_TIME', 'END_TIME']
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
                model: Secretary,
                attributes: ['id'],
            }],
            attributes: ['FIRST_NAME', 'LAST_NAME', 'SECRETARY_ID']
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
        return null;
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
            const dayNumber = dayOfWeekToNumber(schedule.DAY_OF_WEEK);

            // If the conversion fails (invalid day), we can skip or handle this accordingly
            if (dayNumber === null) {
                console.error(`Invalid day_of_week value: ${schedule.DAY_OF_WEEK}`);
                return null;
            }

            return {
                schedule_id: schedule.SCHEDULE_ID,
                doctor_id: doctorId,
                day_of_week: [dayNumber],
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

// Endpoint to get the count of appointments for a specific schedule on a specific date
router.get('/appointments/count/:doctorId/:scheduleId/:appointmentDate', async (req, res) => {
    const { doctorId, scheduleId, appointmentDate } = req.params; // Extract doctorId, scheduleId, and appointmentDate from the request params

    try {
        // Ensure doctorId, scheduleId, and appointmentDate are provided
        if (!doctorId || !scheduleId || !appointmentDate) {
            return res.status(400).json({ error: 'Missing required parameters.' });
        }



        // Fetch the schedule details to get the day of the week (if needed for further logic)
        const scheduleDetails = await Schedule.findOne({
            where: { SCHEDULE_ID: scheduleId, DOCTOR_ID: doctorId },
        });

        if (!scheduleDetails) {
            return res.status(404).json({ error: 'Schedule not found.' });
        }

        // Count the number of appointments for the given scheduleId and date
        const existingAppointments = await Appointment.count({
            where: {
                DOCTOR_ID: doctorId,
                SCHEDULE_ID: scheduleId,
                APPOINTMENT_DATE: appointmentDate,
            },
        });

        // Return the appointment count
        res.json({ appointmentCount: existingAppointments });
    } catch (error) {
        console.error('Error counting appointments:', error);
        res.status(500).json({ error: 'Failed to count appointments' });
    }
});



module.exports = router;
