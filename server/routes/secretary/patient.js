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
        const patient = await Patient.findAll({where: {is_deleted: false}});
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
  
// Endpoint to update patient information, excluding email and password
router.put('/update/:id', auth('Secretary'), async (req, res) => {
  const { id } = req.params;
  const {
      FIRST_NAME,
      MIDDLE_NAME,
      LAST_NAME,
      EMAIL,
      CONTACT_NUMBER,
      ADDRESS,
      SEX,
      AGE,
      BIRTHDAY,
      USER_LEVEL_ID,
      VERIFIED,
      FIRST_DOSE_BRAND,
      SECOND_DOSE_BRAND,
      BOOSTER_BRAND,
      FIRST_DOSE_DATE,
      SECOND_DOSE_DATE,
      BOOSTER_DATE
  } = req.body;

  try {
      // Fetch the patient by ID
      const patient = await Patient.findByPk(id);
      
      if (!patient) {
          return res.status(404).json({ message: 'Patient not found' });
      }

      // Update patient details, excluding email and password
      await patient.update({
          FIRST_NAME,
          MIDDLE_NAME,
          LAST_NAME,
          EMAIL,
          CONTACT_NUMBER,
          ADDRESS,
          SEX,
          AGE,
          BIRTHDAY,
          USER_LEVEL_ID,
          VERIFIED,
          FIRST_DOSE_BRAND,
          SECOND_DOSE_BRAND,
          BOOSTER_BRAND,
          FIRST_DOSE_DATE,
          SECOND_DOSE_DATE,
          BOOSTER_DATE
      });

      res.status(200).json({ message: 'Patient information updated successfully', patient });
  } catch (error) {
      console.error('Error updating patient information:', error);
      res.status(500).json({ message: 'Internal server error' });
  }
});

// Soft delete endpoint for a patient
router.delete('/delete/:id', auth('Secretary'), async (req, res) => {
  const { id } = req.params;

  try {
    // Find the patient by ID
    const patient = await Patient.findByPk(id);

    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    // Perform a soft delete by setting is_deleted to true
    await patient.update({ is_deleted: true });

    res.status(200).json({ message: 'Patient has been soft-deleted successfully' });
  } catch (error) {
    console.error('Error soft-deleting patient:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});




module.exports = router;