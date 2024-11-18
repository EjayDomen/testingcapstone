const express = require('express');
const sequelize = require('../../config/database');
const Doctors = require('../../models/doctor');
const auth = require('../../middleware/auth');
const Schedule = require('../../models/schedule');
const router = express.Router();
const {createLog} = require('../../services/logServices');
const { Op } = require('sequelize');


router.post('/addDoctor', auth('Secretary'), async (req, res) => {
    const {
        FIRST_NAME,
        MIDDLE_NAME,
        LAST_NAME,
        SUFFIX,
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
        const result = await sequelize.transaction(async (t) => {
            // Create doctor
            const doctor = await Doctors.create({
                FIRST_NAME,
                MIDDLE_NAME,
                LAST_NAME,
                SUFFIX,
                GENDER,
                HEALTH_PROFESSIONAL_ACRONYM,
                DEPARTMENT,
                YEARS_OF_EXPERIENCE,
                EXPERTISE,
                DOCTOR_STATUS: 'Offline',
                SECRETARY_ID: req.user.id // Ensure req.user is defined
            }, { transaction: t });
    
            // Get the count of existing schedules for the doctor
            const scheduleCount = await Schedule.count({ where: { DOCTOR_ID: doctor.id, is_deleted: false }, transaction: t });
    
            // Iterate over the schedules array and create schedules for the newly created doctor
            for (const schedule of schedules) {
                const { day_of_week, start_time, end_time, slot_count } = schedule;
    
                // Validate schedule fields
                if (!day_of_week || !start_time || !end_time || !slot_count) {
                    throw new Error('All schedule fields are required');
                }
    
                // Check if a schedule already exists with overlapping time for the doctor
                const overlappingSchedule = await Schedule.findOne({
                    where: {
                        DAY_OF_WEEK: day_of_week,
                        is_deleted: false,
                        [Op.or]: [
                            {
                                START_TIME: { [Op.lte]: start_time },
                                END_TIME: { [Op.gt]: start_time }
                            },
                            {
                                START_TIME: { [Op.lt]: end_time },
                                END_TIME: { [Op.gte]: end_time }
                            },
                            {
                                START_TIME: { [Op.gte]: start_time },
                                END_TIME: { [Op.lte]: end_time }
                            }
                        ]
                    },
                    transaction: t
                });
    
                if (overlappingSchedule) {
                    // Throw an error with custom message for overlapping schedule
                    throw new Error(`Schedule conflict: The doctor has been created, but the schedule conflicts with an existing one on ${day_of_week} from ${start_time} to ${end_time}. You can modify the schedule by editing the doctor's details.`);
                }
    
                // Log the schedule data
                console.log('Creating schedule:', {
                    DOCTOR_ID: doctor.id,
                    DAY_OF_WEEK: day_of_week,
                    START_TIME: start_time,
                    END_TIME: end_time,
                    SLOT_COUNT: slot_count,
                    SCHED_COUNTER: scheduleCount + 1
                });
    
                // Create each schedule with SCHED_COUNTER starting from 1
                await Schedule.create({
                    DOCTOR_ID: doctor.id,
                    DAY_OF_WEEK: day_of_week,
                    START_TIME: start_time,
                    END_TIME: end_time,
                    SLOT_COUNT: slot_count,
                    SCHED_COUNTER: scheduleCount + 1
                }, { transaction: t });
            }
    
            return { doctor, newSchedules: schedules };
        });
    
        // Log the action outside the transaction
        await createLog({
            userId: req.user.id,
            userType: 'Secretary',
            action: `Doctor added and associated schedule.`
        });
    
        // Send successful response
        res.status(201).json(result);
    } catch (error) {
        // Check for the custom error message for overlapping schedules
        if (error.message.startsWith("Schedule conflict")) {
            res.status(409).json({ error: error.message });
        } else {
            console.error('Error in /addDoctor:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
});    


// view all doctor
router.get('/', auth('Secretary'), async (req, res) => {
    try{
        const doctor = await Doctors.findAll( {where: {is_deleted: false}});
        await createLog({
            userId: req.user.id,
            userType: 'Secretary',
            action: `Viewed all doctors.`
          }); 
        res.status(200).json(doctor);
    } catch(error){
        res.status(400).json({error: error.message});
    }
});

// view doctor count
router.get('/count', auth('Secretary'), async (req, res) => {
    try {
        const doctorCount = await Doctors.count({where:{is_deleted: false}}); // Directly count the doctors
        res.status(200).json({ doctorCount });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});


//view one doctor
router.get('/:id', auth('Secretary'), async (req, res) =>{
    const {id} = req.params;
    try{
        const doctor = await Doctors.findOne({where: {id: id, is_deleted: false}});
        const schedule = await Schedule.findAll({where: {DOCTOR_ID: id, is_deleted: false}})
        if(!doctor){
            return res.status(404).json({error: 'Doctor not found'})
        }

        await createLog({
            userId: req.user.id,
            userType: 'Secretary',
            action: `Viewed doctor id: ${doctor.id}.`
          }); 

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

  router.put('/updateDoctor/:id', auth('Secretary'), async (req, res, next) => {
    const { id } = req.params;
    const {
        FIRST_NAME,
        MIDDLE_NAME,
        LAST_NAME,
        SUFFIX,
        GENDER,
        HEALTH_PROFESSIONAL_ACRONYM,
        DEPARTMENT,
        YEARS_OF_EXPERIENCE,
        EXPERTISE,
        schedules
    } = req.body;

    try {
        // Basic validation for doctor details
        if (!FIRST_NAME || !LAST_NAME || !GENDER || !HEALTH_PROFESSIONAL_ACRONYM ||
            !DEPARTMENT || !YEARS_OF_EXPERIENCE || !EXPERTISE) {
            return res.status(400).json({ error: 'All doctor fields are required' });
        }

        const result = await sequelize.transaction(async (t) => {
            // Update doctor's information
            await Doctors.update({
                FIRST_NAME,
                MIDDLE_NAME,
                LAST_NAME,
                SUFFIX,
                GENDER,
                HEALTH_PROFESSIONAL_ACRONYM,
                DEPARTMENT,
                YEARS_OF_EXPERIENCE,
                EXPERTISE
            }, {
                where: { id },
                transaction: t
            });
             // Get the count of existing schedules for the doctor
             const scheduleCount = await Schedule.count({ where: { DOCTOR_ID: id, is_deleted: false }, transaction: t });

            if (schedules && schedules.length) {
                // Fetch current schedules for comparison
                const existingSchedules = await Schedule.findAll({
                    where: { DOCTOR_ID: id, is_deleted: false },
                    transaction: t
                });

                const existingSchedulesMap = new Map(
                    existingSchedules.map(s => [s.SCHEDULE_ID, s])
                );

                // Update only if schedules have changes
                await Promise.all(schedules.map(async (schedule) => {
                    const { scheduleId = null, day_of_week, start_time, end_time, slot_count } = schedule;
                    const existing = existingSchedulesMap.get(scheduleId);

                    // Check for changes
                    const isChanged = !existing || existing.DAY_OF_WEEK !== day_of_week ||
                        existing.START_TIME !== start_time ||
                        existing.END_TIME !== end_time ||
                        existing.SLOT_COUNT !== slot_count;

                    // Only update or create if there are changes
                    if (isChanged) {
                        // Check for conflicts only if changes are made
                        const overlappingSchedule = await Schedule.findOne({
                            where: {
                                DOCTOR_ID: id,
                                DAY_OF_WEEK: day_of_week,
                                is_deleted: false,
                                [Op.or]: [
                                    { START_TIME: { [Op.lte]: start_time }, END_TIME: { [Op.gt]: start_time } },
                                    { START_TIME: { [Op.lt]: end_time }, END_TIME: { [Op.gte]: end_time } },
                                    { START_TIME: { [Op.gte]: start_time }, END_TIME: { [Op.lte]: end_time } }
                                ]
                            },
                            transaction: t
                        });

                        if (overlappingSchedule) {
                            throw new Error(`Schedule conflict on ${day_of_week} from ${start_time} to ${end_time}.`);
                        }

                        // Update or create schedule
                        if (existing) {
                            await existing.update({
                                DAY_OF_WEEK: day_of_week,
                                START_TIME: start_time,
                                END_TIME: end_time,
                                SLOT_COUNT: slot_count
                            }, { transaction: t });
                        } else {
                            // Create each schedule with SCHED_COUNTER starting from 1
                            await Schedule.create({
                                DOCTOR_ID: id,
                                DAY_OF_WEEK: day_of_week,
                                START_TIME: start_time,
                                END_TIME: end_time,
                                SLOT_COUNT: slot_count,
                                SCHED_COUNTER: scheduleCount + 1
                            }, { transaction: t });
                        }
                    }
                }));
            }

            // Log the update action
            await createLog({
                userId: req.user.id,
                userType: 'Secretary',
                action: `Updated doctor details for doctor_Id: ${id}, schedules updated or created.`
            });

            return { message: 'Doctor and schedules updated successfully' };
        });

        res.json(result);
    } catch (error) {
        console.error(error);
        if (error.message.startsWith('Schedule conflict')) {
            res.status(409).json({ error: error.message });
        } else {
            res.status(500).json({ error: 'Internal server error' });
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
        await createLog({
            userId: req.user.id,
            userType: 'Secretary',
            action: `Updated doctor's status for doctor_Id: ${id}.`
          }); 
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
            await Schedule.update({
                is_deleted: true
            },{
                where: { DOCTOR_ID: id },
                transaction: t
            });

            // Delete the doctor
            const doctorDeleted = await Doctors.update({
                is_deleted: true
            },{
                where: { id: id },
                transaction: t
            });

            // If no doctor was deleted, send a 404 response
            if (!doctorDeleted) {
                return res.status(404).json({ error: 'Doctor not found' });
            }
        });

        await createLog({
            userId: req.user.id,
            userType: 'Secretary',
            action: `Deleted doctor and associated schedule for doctor_id: ${id}.`
          }); 
        res.status(200).json({ message: 'Doctor and associated schedules deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});




module.exports = router;
