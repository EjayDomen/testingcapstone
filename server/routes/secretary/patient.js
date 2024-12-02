const express = require('express');
const sequelize = require('../../config/database');
const Appointment = require('../../models/appointment');
const Schedule = require('../../models/schedule');
const Patient = require('../../models/patient');
const Doctors = require('../../models/doctor');
const { createLog } = require('../../services/logServices');
const auth = require('../../middleware/auth');

const router = express.Router();

router.get('/', auth('Secretary'), async (req, res) => {

  try {
    const patient = await Patient.findAll({ where: { is_deleted: false } });
    res.status(200).json(patient);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Endpoint for daily counts
router.get('/patients-attended/daily', async (req, res) => {
  try {
    const data = await Appointment.findAll({
      attributes: [
        [sequelize.fn('DATE', sequelize.col('APPOINTMENT_DATE')), 'date'],
        'status',
        [sequelize.fn('COUNT', sequelize.col('id')), 'appointmentCount'],  // Counting appointments
      ],
      group: ['date', 'status'],
      order: [['date', 'ASC']],
    });
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching daily data' });
  }
});



// Endpoint for weekly counts
router.get('/patients-attended/weekly', async (req, res) => {
  try {
    const data = await Appointment.findAll({
      attributes: [
        [sequelize.fn('DATE_TRUNC', 'week', sequelize.col('APPOINTMENT_DATE')), 'week'],
        'status',
        [sequelize.fn('COUNT', sequelize.col('id')), 'appointmentCount'],  // Counting appointments
      ],
      group: ['week', 'status'],
      order: [['week', 'ASC']],
    });
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching weekly data' });
  }
});

// Endpoint for weekly counts
router.get('/patients-attended/weekly', async (req, res) => {
  try {
    const data = await Appointment.findAll({
      attributes: [
        [sequelize.fn('DATE_TRUNC', 'week', sequelize.col('APPOINTMENT_DATE')), 'week'],
        'status',
        [sequelize.fn('COUNT', sequelize.col('id')), 'appointmentCount'],  // Counting appointments
      ],
      group: ['week', 'status'],
      order: [['week', 'ASC']],
    });
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching weekly data' });
  }
});


// Endpoint to get today's appointment count
router.get('/patients-attended/today', async (req, res) => {
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

// Display archived doctors
router.get('/archivedDoctor', auth('Secretary'), async (req, res) => {
  try {
    const archivedDoctors = await Doctors.findAll({
      where: { is_deleted: true }
    });

    if (archivedDoctors.length === 0) {
      return res.status(404).json({ message: 'No archived doctors found' });
    }

    res.status(200).json(archivedDoctors);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Restore archived doctor and their schedules
router.put('/restoreDoctor/:id', auth('Secretary'), async (req, res) => {
  const { id } = req.params; // Doctor ID

  try {
    // Begin transaction for restoring doctor and associated schedules
    await sequelize.transaction(async (t) => {
      // Restore associated schedules first
      await Schedule.update({
        is_deleted: false
      }, {
        where: { DOCTOR_ID: id },
        transaction: t
      });

      // Restore the doctor
      const doctorRestored = await Doctors.update({
        is_deleted: false
      }, {
        where: { id: id },
        transaction: t
      });

      // If no doctor was restored, send a 404 response
      if (!doctorRestored) {
        return res.status(404).json({ error: 'Doctor not found!' });
      }
    });

    await createLog({
      userId: req.user.id,
      userType: 'Secretary',
      action: `Restored doctor and associated schedule for doctor_id: ${id}.`
    });
    res.status(200).json({ message: 'Doctor and associated schedules restored successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


router.get('/archivedPatients', auth('Secretary'), async (req, res) => {
  try {
    const archivedPatients = await Patient.findAll({
      where: { is_deleted: true }
    });

    if (archivedPatients.length === 0) {
      return res.status(404).json({ message: 'No archived patients found' });
    }

    res.status(200).json(archivedPatients);
  } catch (error) {
    console.error('Error fetching archived patients:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.put('/restore/:id', auth('Secretary'), async (req, res) => {
  const { id } = req.params;

  try {
    // Find the patient by ID
    const patient = await Patient.findByPk(id);

    if (!patient || !patient.is_deleted) {
      return res.status(404).json({ message: 'Patient not found or not archived' });
    }

    // Restore the patient by setting is_deleted to false
    await patient.update({ is_deleted: false });

    res.status(200).json({ message: 'Patient restored successfully' });
  } catch (error) {
    console.error('Error restoring patient:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});



module.exports = router;