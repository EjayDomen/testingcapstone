const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const patient = require('../../models/patient');
const { Op } = require('sequelize');
const auth = require('../../middleware/auth'); // Assuming this is the auth middleware function

const router = express.Router();


// Patient Registration Route
router.post('/patientregister', async (req, res) => {
    const {
        FIRST_NAME,
        LAST_NAME,
        EMAIL,
        CONTACT_NUMBER,
        PASSWORD,
    } = req.body;

    try {
        // Check if a patient with the same email or contact number already exists
        const existingPatient = await patient.findOne({
            where: {
                [Op.or]: [
                    { EMAIL },
                    { CONTACT_NUMBER }
                ]
            }
        });

        if (existingPatient) {
            return res.status(409).json({ error: 'A patient with this email or contact number already exists.' });
        }

        const hashedPassword = await bcrypt.hash(PASSWORD, 10);
        const newPatient = await patient.create({
            FIRST_NAME,
            MIDDLE_NAME: '',
            LAST_NAME,
            EMAIL,
            CONTACT_NUMBER,
            ADDRESS: '',
            SEX: '',
            BIRTHDAY: '',
            AGE: '',
            USER_LEVEL_ID: '3',
            PASSWORD: hashedPassword,
            VERIFIED: 'false',
            PROFILE_PIC: '',
            FIRST_DOSE_BRAND: '', // Default or provided value
            SECOND_DOSE_BRAND: '', // Default or provided value
            BOOSTER_BRAND: '', // Default or provided value
            FIRST_DOSE_DATE: '', // Default or provided value
            SECOND_DOSE_DATE: '', // Default or provided value
            BOOSTER_DATE: '' // Default or provided value
        });


        res.status(201).json(newPatient);
    } catch (error) {
        res.status(400).json({ error: error.message });
        console.log('error:', error.message);
    }
});

// Check if a Patient Exists Route
router.post('/check-patient', async (req, res) => {
    const { EMAIL, CONTACT_NUMBER } = req.body;

    try {
        // Check if a patient with the same email or contact number already exists
        const existingPatient = await patient.findOne({
            where: {
                [Op.or]: [
                    { EMAIL },
                    { CONTACT_NUMBER }
                ]
            }
        });

        if (existingPatient) {
            return res.status(409).json({ error: 'A patient with this email or contact number already exists.' });
        }

        // If no patient is found
        res.status(200).json({ message: 'No existing patient with this email or contact number.' });
    } catch (error) {
        res.status(500).json({ error: 'An error occurred while checking the patient.' });
        console.log('Error:', error.message);
    }
});

// Update Patient Details Route
router.put('/update', auth('Patient'), async (req, res) => {
    const { FIRST_NAME, LAST_NAME, MIDDLE_NAME, ADDRESS, SEX, BIRTHDAY, AGE, CONTACT_NUMBER, FIRST_DOSE_BRAND, SECOND_DOSE_BRAND, BOOSTER_BRAND, FIRST_DOSE_DATE, SECOND_DOSE_DATE, BOOSTER_DATE } = req.body;

    try {
        const Patient = await patient.findOne({ where: { id: req.user.id } });
        if (!Patient) {
            return res.status(404).json({ error: 'Patient not found' });
        }
        Patient.FIRST_NAME = FIRST_NAME;
        Patient.LAST_NAME = LAST_NAME;
        Patient.MIDDLE_NAME = MIDDLE_NAME;
        Patient.ADDRESS = ADDRESS;
        Patient.SEX = SEX;
        Patient.BIRTHDAY = BIRTHDAY;
        Patient.AGE = AGE;
        Patient.CONTACT_NUMBER = CONTACT_NUMBER;
        Patient.FIRST_DOSE_BRAND = FIRST_DOSE_BRAND;
        Patient.SECOND_DOSE_BRAND = SECOND_DOSE_BRAND;
        Patient.BOOSTER_BRAND = BOOSTER_BRAND;
        Patient.FIRST_DOSE_DATE = FIRST_DOSE_DATE;
        Patient.SECOND_DOSE_DATE = SECOND_DOSE_DATE;
        Patient.BOOSTER_DATE = BOOSTER_DATE;

        await Patient.save();
        res.status(200).json(Patient);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get Logged-in Patient Information Route
router.get('/patient/me', auth('Patient'), async (req, res) => {
    const patientId = req.user.id;
    try {
        // Return the logged-in patient's details
        const loggedInPatient = await patient.findByPk(patientId);
        if (!loggedInPatient) {
            return res.status(404).json({ error: 'Patient not found' });
        }
        console.log(loggedInPatient.id);
        res.status(200).json(loggedInPatient);
    } catch (error) {
        res.status(500).json({ error: 'An error occurred while fetching the patient details.' });
    }
});

module.exports = router;
