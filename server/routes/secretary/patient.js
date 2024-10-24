const express = require('express');
const sequelize = require('../../config/database');
const Appointment = require('../../models/appointment');
const schedule = require('../../models/schedule');
const Patient = require('../../models/patient');
const Doctor = require('../../models/doctor')
const auth = require('../../middleware/auth');

const router = express.Router();

router.get('/', auth('Secretary'), async (req, res)=> {

    try{
        const patient = await Patient.findAll();
        res.status(200).json(patient);
    } catch (error){
        res.status(400).json({error: error.message});
    }
});

// Endpoint to get the number of patients attended by day
router.get('/patients-attended', async (req, res) => {
    try {
      // Fetch the count of patients attended (with status 'attended') per day
      const attendedData = await Appointment.findAll({
        attributes: [
          [sequelize.fn('DATE', sequelize.col('APPOINTMENT_DATE')), 'date'], // Group by date
          [sequelize.fn('COUNT', sequelize.col('id')), 'patientCount'], // Count of patients
        ],
        where: {
          status: 'completed', // Assuming you have a status field that marks patients as attended
        },
        group: ['date'], // Group by the appointment date
        order: [['date', 'ASC']], // Order by date ascending
      });
  
      res.status(200).json(attendedData); // Send the data as JSON to the frontend
    } catch (error) {
      console.error('Error fetching patient attended data:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });


// Endpoint to get monthly patient attended count
router.get('/secretary/patients-attended/monthly', async (req, res) => {
    try {
      const data = await Appointment.findAll({
        attributes: [
          [sequelize.fn('DATE_TRUNC', 'month', sequelize.col('APPOINTMENT_DATE')), 'month'],
          [sequelize.fn('COUNT', sequelize.col('id')), 'patientCount'],
        ],
        where: { status: 'completed' },
        group: ['month'],
        order: [['month', 'ASC']],
      });
      res.status(200).json(data);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching monthly data' });
    }
  });
  
  // Endpoint to get weekly patient attended count
  router.get('/secretary/patients-attended/weekly', async (req, res) => {
    try {
      const data = await Appointment.findAll({
        attributes: [
          [sequelize.fn('DATE_TRUNC', 'week', sequelize.col('APPOINTMENT_DATE')), 'week'],
          [sequelize.fn('COUNT', sequelize.col('id')), 'patientCount'],
        ],
        where: { status: 'completed' },
        group: ['week'],
        order: [['week', 'ASC']],
      });
      res.status(200).json(data);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching weekly data' });
    }
  });
  
  // Endpoint to get today's patient attended count
  router.get('/secretary/patients-attended/today', async (req, res) => {
    try {
      const data = await Appointment.findAll({
        attributes: [
          [sequelize.fn('DATE', sequelize.col('APPOINTMENT_DATE')), 'date'],
          [sequelize.fn('COUNT', sequelize.col('id')), 'patientCount'],
        ],
        where: {
          status: 'completed',
          APPOINTMENT_DATE: { [Op.eq]: sequelize.fn('CURDATE') },
        },
      });
      res.status(200).json(data);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching today\'s data' });
    }
  });
  

module.exports = router;