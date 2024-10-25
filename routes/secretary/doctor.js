const express = require('express');
const sequelize = require('../../config/database');
const Doctors = require('../../models/doctor');
const auth = require('../../middleware/auth');
const Schedule = require('../../models/schedule');
const router = express.Router();

// add a doctor and its schedule
router.post('/addDoctor', auth('Secretary'), async (req, res) => {
    const {
        FIRST_NAME,
        LAST_NAME,
        GENDER,
        HEALTH_PROFESSIONAL_ACRONYM,
        DEPARTMENT,
        YEARS_OF_EXPERIENCE,
        EXPERTISE,
        schedules // Expect an array of schedules in the request body
    } = req.body;

    // Validate required fields for doctor
    if (!FIRST_NAME || !LAST_NAME || !GENDER || !HEALTH_PROFESSIONAL_ACRONYM ||
        !DEPARTMENT || !YEARS_OF_EXPERIENCE || !EXPERTISE || !schedules || !Array.isArray(schedules)) {
        return res.status(400).json({ error: 'All fields are required, including an array of schedules' });
    }

    try {
        // Check if req.user is defined
        if (!req.user || !req.user.id) {
            return res.status(403).json({ error: 'Unauthorized: Secretary information not found' });
        }

        // Begin transaction for creating doctor and schedules together
        const result = await sequelize.transaction(async (t) => {
            // Create doctor
            const doctor = await Doctors.create({
                FIRST_NAME,
                LAST_NAME,
                GENDER,
                HEALTH_PROFESSIONAL_ACRONYM,
                DEPARTMENT,
                YEARS_OF_EXPERIENCE,
                EXPERTISE,
                DOCTOR_STATUS: 'Offline',
                SECRETARY_ID: req.user.id // Ensure req.user is defined
            }, { transaction: t });

            // Get the count of existing schedules for the doctor
            const scheduleCount = await Schedule.count({ where: { DOCTOR_ID: doctor.id }, transaction: t });

            // Iterate over the schedules array and create schedules for the newly created doctor
            const newSchedules = await Promise.all(schedules.map(async (schedule, index) => {
                const { day_of_week, start_time, end_time, slot_count } = schedule;

                // Validate schedule fields
                if (!day_of_week || !start_time || !end_time || !slot_count) {
                    throw new Error('All schedule fields are required');
                }

                // Log the schedule data
                console.log('Creating schedule:', {
                    DOCTOR_ID: doctor.id,
                    DAY_OF_WEEK: day_of_week,
                    START_TIME: start_time,
                    END_TIME: end_time,
                    SLOT_COUNT: slot_count,
                    SCHED_COUNTER: scheduleCount + index + 1
                });

                // Create each schedule with SCHED_COUNTER starting from 1
                return Schedule.create({
                    DOCTOR_ID: doctor.id, // Use doctor.id from the created doctor
                    DAY_OF_WEEK: day_of_week,
                    START_TIME: start_time,
                    END_TIME: end_time,
                    SLOT_COUNT: slot_count,
                    SCHED_COUNTER: scheduleCount + index + 1 // Increment counter
                }, { transaction: t });
            }));

            return { doctor, newSchedules };
        });

        res.status(201).json(result);
    } catch (error) {
        console.error('Error in /addDoctor:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// view all doctor
router.get('/', auth('Secretary'), async (req, res) => {
    try{
        const doctor = await Doctors.findAll();
        res.status(200).json(doctor);
    } catch(error){
        res.status(400).json({error: error.message});
    }
});

// view doctor count
router.get('/count', auth('Secretary'), async (req, res) => {
    try {
        const doctorCount = await Doctors.count(); // Directly count the doctors
        res.status(200).json({ doctorCount });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});


//view one doctor
router.get('/:id', auth('Secretary'), async (req, res) =>{
    const {id} = req.params;
    try{
        const doctor = await Doctors.findOne({where: {id}});
        const schedule = await Schedule.findAll({where: {DOCTOR_ID: id}})
        if(!doctor){
            return res.status(404).json({error: 'Doctor not found'})
        }

        res.status(200).json({ doctor, schedule });
    } catch (error){
        res.status(400).json({error: error.message});
    }
});


function safeReplacer(key, value) {
    // you might want to customize it more to fit your needs
    if (key === 'socket' || key === 'connection' || key === 'parser') return undefined;
    return value;
  }

router.put('/updateDoctor/:id', auth('Secretary'), async (req, res) => {
    const { id } = req.params; // Doctor ID
    const {
        FIRST_NAME,
        LAST_NAME,
        GENDER,
        HEALTH_PROFESSIONAL_ACRONYM,
        DEPARTMENT,
        YEARS_OF_EXPERIENCE,
        EXPERTISE,
        schedules // Expect an array of schedules in the request body
    } = req.body;

    try {
        // Validate required fields for doctor and schedules
        if (!FIRST_NAME || !LAST_NAME || !GENDER || !HEALTH_PROFESSIONAL_ACRONYM ||
            !DEPARTMENT || !YEARS_OF_EXPERIENCE || !EXPERTISE || !schedules || !Array.isArray(schedules)) {
            return res.status(400).json({ error: 'All fields are required, including an array of schedules' });
        }

        // Begin transaction for updating doctor and associated schedules
        const result = await sequelize.transaction(async (t) => {
            // Update the doctor's information
            const doctorUpdated = await Doctors.update({
                FIRST_NAME,
                LAST_NAME,
                GENDER,
                HEALTH_PROFESSIONAL_ACRONYM,
                DEPARTMENT,
                YEARS_OF_EXPERIENCE,
                EXPERTISE
            }, {
                where: { id },
                transaction: t
            });

            // If no doctor was found, return a 404 error
            // if (!doctorUpdated[0]) {
            //     return res.status(404).json({ error: 'Doctor not found' });
            // }

            // Get the current schedule count for the doctor
            const currentScheduleCount = await Schedule.count({ where: { DOCTOR_ID: id }, transaction: t });

            // Process incoming schedules
            const updatedSchedules = await Promise.all(schedules.map(async (schedule, index) => {
                const { day_of_week, start_time, end_time, slot_count } = schedule;

                // Validate schedule fields
                if (!day_of_week || !start_time || !end_time || !slot_count) {
                    throw new Error('All schedule fields are required');
                }

                // Check if the schedule exists globally (across all doctors)
                const existingSchedule = await Schedule.findOne({
                    where: {
                        DOCTOR_ID:id
                    },
                    transaction: t
                });
                console.log(id);
                if (existingSchedule) {
                    if (existingSchedule.DOCTOR_ID == id) {
                        // If the schedule ex ists and belongs to the current doctor, update the schedule
                        await Schedule.update({
                            DOCTOR_ID: id,
                            SLOT_COUNT: slot_count,
                            DAY_OF_WEEK: day_of_week,
                            START_TIME: start_time,
                            END_TIME: end_time,
                        }, {
                            where: { SCHEDULE_ID: existingSchedule.SCHEDULE_ID },
                            transaction: t
                        });

                        return existingSchedule;
                    } else {
                        // If the schedule exists globally for another doctor, throw an error
                        throw new Error(`Schedule already exists for another doctor on ${day_of_week} from ${start_time} to ${end_time}.`);
                    }
                } else {
                    // If no global match is found, create a new schedule for this doctor
                    return Schedule.create({
                        DOCTOR_ID: id,
                        DAY_OF_WEEK: day_of_week,
                        START_TIME: start_time,
                        END_TIME: end_time,
                        SLOT_COUNT: slot_count,
                        SCHED_COUNTER: currentScheduleCount + index + 1 // Increment SCHED_COUNTER for new schedules
                    }, { transaction: t });
                }
            }));

            // Return the updated result
            res.json({ doctorUpdated, updatedSchedules });

        });
    } catch (error) {
        console.error(error);
        if (!res.headersSent) {
            res.status(500).json({ error: error.message || 'Internal server error' });
        } else {
            next(error); // Correctly pass the error to the error-handling middleware if the response is already sent
        }
    }
});




//update doctor status
router.put('/updateDoctorStatus/:id', auth('Secretary'), async (req, res) => {
    const { id } = req.params; // Doctor ID
    const { DOCTOR_STATUS } = req.body; // New status to be updated

    // Validate that the status field is provided
    if (!DOCTOR_STATUS) {
        return res.status(400).json({ error: 'Doctor status is required' });
    }

    try {
        // Update only the doctor's status
        const doctorUpdated = await Doctor.update(
            { DOCTOR_STATUS },
            { where: { id } }
        );

        // If no doctor was updated, return a 404 error
        if (!doctorUpdated[0]) {
            return res.status(404).json({ error: 'Doctor not found' });
        }

        res.status(200).json({ message: 'Doctor status updated successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});



// delete doctor and its schedule
router.delete('/deleteDoctor/:id', auth('Secretary'), async (req, res) => {
    const { id } = req.params; // Doctor ID

    try {
        // Begin transaction for deleting doctor and associated schedules
        await sequelize.transaction(async (t) => {
            // Delete associated schedules first
            await Schedule.destroy({
                where: { doctor_id: id },
                transaction: t
            });

            // Delete the doctor
            const doctorDeleted = await Doctors.destroy({
                where: { id: id },
                transaction: t
            });

            // If no doctor was deleted, send a 404 response
            if (!doctorDeleted) {
                return res.status(404).json({ error: 'Doctor not found' });
            }
        });

        res.status(200).json({ message: 'Doctor and associated schedules deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


module.exports = router;
