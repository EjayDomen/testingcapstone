const express = require('express');
const router = express.Router();
const Appointment = require('../../models/appointment');
const Doctor = require('../../models/doctor'); // Import the Doctor model
const Sequelize = require('../../config/database'); // Import the Sequelize 
const Queue = require('../../models/queue');
const Log = require('../../models/log');
const Feedback = require('../../models/patientFeedback'); // Adjust the path as needed
const Patient = require('../../models/patient'); // Import Patient model
const { Op } = require('sequelize');



// Route to get appointment details along with doctor names
router.get('/details', async (req, res) => {
    try {
        const appointments = await Appointment.findAll({
            where: {
                STATUS: 'completed' // Only select appointments with STATUS as 'completed'
            },
            include: [{
                model: Doctor,
                attributes: ['FIRST_NAME', 'LAST_NAME'], // Get the doctor's first and last name
                required: true // Ensures only appointments with associated doctors are returned
            }],
            attributes: [
                'id',
                'CONTACT_NUMBER',
                'AGE',
                'ADDRESS',
                'SEX',
                'FIRST_NAME',
                'LAST_NAME',
                'APPOINTMENT_DATE'



            ]
        });

        // Format the response as needed
        const response = appointments.map(appointment => ({
            fullName: `${appointment.FIRST_NAME} ${appointment.LAST_NAME}`, // Use backticks for template literals
            id: appointment.id,
            contactNumber: appointment.CONTACT_NUMBER,
            age: appointment.AGE,
            address: appointment.ADDRESS,
            sex: appointment.SEX,
            date: appointment.APPOINTMENT_DATE,
            doctorFullName: `Dr. ${appointment.Doctor.FIRST_NAME} ${appointment.Doctor.LAST_NAME}` // Full name of the doctor

        }));

        res.json(response);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'An error occurred while fetching appointments.' });
    }
});

// Route to get all doctors
router.get('/doctors', async (req, res) => {
    try {
        // Query to fetch specific doctor columns
        const doctors = await Doctor.findAll({
            attributes: [
                'id',
                'FIRST_NAME',
                'LAST_NAME',
                'GENDER',
                'EXPERTISE',
                'HEALTH_PROFESSIONAL_ACRONYM',
                'DEPARTMENT',
                'YEARS_OF_EXPERIENCE',
                'createdAt',
                'updatedAt',
                'SECRETARY_ID',
                'DOCTOR_STATUS'
            ]
        });

        // Map through doctors and add fullName to each record
        const doctorsWithFullName = doctors.map(doctor => ({
            ...doctor.toJSON(),
            fullName: `${doctor.FIRST_NAME} ${doctor.LAST_NAME}`
        }));

        // Send the modified doctors data as a JSON response
        res.status(200).json(doctorsWithFullName);
    } catch (error) {
        console.error('Error fetching doctors:', error);
        res.status(500).json({ error: 'An error occurred while fetching doctors' });
    }
});

// Route to fetch logs data
router.get('/logs', async (req, res) => {
    try {
        const logs = await Log.findAll();
        res.json(logs);
    } catch (error) {
        console.error('Error fetching logs:', error);
        res.status(500).json({ error: 'Failed to fetch logs' });
    }
});




router.get('/feedback', async (req, res) => {
    try {
        const feedback = await Feedback.findAll({
            include: [
                {
                    model: Patient,
                    as: 'patient', // Alias defined in the association
                    attributes: ['FIRST_NAME', 'LAST_NAME'], // Select only these fields
                }
            ]
        });
        res.json(feedback);
    } catch (error) {
        console.error('Error fetching feedback:', error);
        res.status(500).json({ error: 'Failed to fetch feedback' });
    }
});



module.exports = router;

// // Helper function to categorize age groups
// const categorizeAgeGroup = (age) => {
//     if (age >= 0 && age <= 12) return 'Children';
//     if (age >= 13 && age <= 17) return 'Teens';
//     if (age >= 18 && age <= 39) return 'Young Adults';
//     if (age >= 40 && age <= 59) return 'Adults';
//     if (age >= 60) return 'Seniors';
//     return 'Unknown';
// };

// // Route for Daily Queue Summary Report
// router.get('/daily-queue-summary', async (req, res) => {
//     try {
//         const today = new Date();
//         const dailyQueueSummary = await Queue.findAll({
//             where: {
//                 createdAt: {
//                     [Op.gte]: new Date(today.setHours(0, 0, 0, 0))
//                 }
//             }
//         });
//         res.json(dailyQueueSummary);
//     } catch (error) {
//         res.status(500).json({ error: 'Error generating daily queue summary' });
//     }
// });

// // Route for Monthly Trends in Appointment Volume
// router.get('/monthly-appointment-trends', async (req, res) => {
//     try {
//         const monthlyTrends = await appointment.findAll({
//             attributes: [
//                 [Sequelize.fn('DATE_FORMAT', Sequelize.col('createdAt'), '%Y-%m'), 'month'],
//                 [Sequelize.fn('COUNT', Sequelize.col('id')), 'appointment_count']
//             ],
//             group: 'month'
//         });
//         res.json(monthlyTrends);
//     } catch (error) {
//         res.status(500).json({ error: 'Error generating monthly trends report' });
//     }
// });

// // Route for Age Distribution of Patients
// router.get('/age-distribution', async (req, res) => {
//     try {
//         // Fetch ages and counts for all appointments
//         const ageData = await appointment.findAll({
//             attributes: ['AGE'],
//         });

//         // Categorize into age groups
//         const ageGroups = { Children: 0, Teens: 0, Young_Adults: 0, Adults: 0, Seniors: 0 };

//         ageData.forEach(({ AGE }) => {
//             const ageGroup = categorizeAgeGroup(AGE);
//             if (ageGroup !== 'Unknown') {
//                 ageGroups[ageGroup.replace(' ', '_')] += 1;
//             }
//         });

//         res.json(ageGroups);
//     } catch (error) {
//         console.error("Error generating age distribution report:", error);
//         res.status(500).json({ error: 'Error generating age distribution report' });
//     }
// });
// // Route for No-Show Rate Analysis
// router.get('/no-show-rate', async (req, res) => {
//     try {
//         const totalAppointments = await appointment.count();
//         const noShows = await appointment.count({
//             where: { STATUS: 'cancelled' }
//         });
//         const noShowRate = ((noShows / totalAppointments) * 100).toFixed(2);
//         res.json({ totalAppointments, noShows, noShowRate });
//     } catch (error) {
//         res.status(500).json({ error: 'Error generating no-show rate analysis' });
//     }
// });

// // Route for Appointment Mode Distribution
// router.get('/appointment-mode-distribution', async (req, res) => {
//     try {
//         const onlineAppointments = await appointment.count({
//             where: { TYPE: 'Online' }
//         });
//         const offlineAppointments = await appointment.count({
//             where: { TYPE: 'Offline' }
//         });
//         res.json({ onlineAppointments, offlineAppointments });
//     } catch (error) {
//         res.status(500).json({ error: 'Error generating appointment mode distribution report' });
//     }
// });

// // Route for No-Show Rate by Appointment Mode
// router.get('/no-show-rate-by-mode', async (req, res) => {
//     try {
//         const onlineNoShows = await appointment.count({
//             where: { STATUS: 'cancelled', TYPE: 'Online' }
//         });
//         const offlineNoShows = await appointment.count({
//             where: { STATUS: 'cancelled', TYPE: 'Offline' }
//         });
//         res.json({ onlineNoShows, offlineNoShows });
//     } catch (error) {
//         res.status(500).json({ error: 'Error generating no-show rate by mode report' });
//     }
// });

// // Route for Online Appointment Scheduling Trends
// router.get('/online-appointment-scheduling-trends', async (req, res) => {
//     try {
//         const schedulingTrends = await appointment.findAll({
//             attributes: [
//                 [Sequelize.fn('DAYOFWEEK', Sequelize.col('APPOINTMENT_DATE')), 'day_of_week'],
//                 [Sequelize.fn('COUNT', Sequelize.col('id')), 'appointment_count']
//             ],
//             where: { TYPE: 'Online' },
//             group: 'day_of_week'
//         });
//         res.json(schedulingTrends);
//     } catch (error) {
//         res.status(500).json({ error: 'Error generating online appointment scheduling trends report' });
//     }
// });

module.exports = router;
