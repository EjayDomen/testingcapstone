const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const patient = require('../../models/patient');
const { Op } = require('sequelize');
const auth = require('../../middleware/auth'); // Assuming this is the auth middleware function
const Secretary = require('../../models/secretary');
const router = express.Router();


// Patient Registration Route
router.post('/patientregister', async (req, res) => {
    const {
        FIRST_NAME,
        MIDDLE_NAME,
        LAST_NAME,
        SUFFIX,
        EMAIL,
        CONTACT_NUMBER,
        PASSWORD,
        CIVIL_STATUS,
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
            MIDDLE_NAME,
            LAST_NAME,
            SUFFIX,
            EMAIL,
            CONTACT_NUMBER,
            ADDRESS: '',
            SEX: '',
            BIRTHDAY: '',
            CIVIL_STATUS: '',
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
    const { FIRST_NAME, MIDDLE_NAME, LAST_NAME, EMAIL } = req.body;

    try {
        // Check if a patient with the same FIRST_NAME, LAST_NAME, BIRTHDAY, or EMAIL already exists
        const existingPatient = await patient.findOne({
            where: {
                [Op.or]: [
                    {
                        [Op.and]: [
                            { FIRST_NAME },
                            { MIDDLE_NAME },
                            { LAST_NAME }
                        ]
                    },

                    { EMAIL }
                ]
            }
        });

        if (existingPatient) {
            return res.status(409).json({ error: 'A patient with this name, birthday, or email already exists.' });
        }

        // If no patient is found
        res.status(200).json({ message: 'No existing patient with this name, birthday, or email.' });
    } catch (error) {
        res.status(500).json({ error: 'An error occurred while checking the patient.' });
        console.log('Error:', error.message);
    }
});

// Update Patient Details Route
router.put('/patient/update', auth('Patient'), async (req, res) => {
    const { firstName, lastName, middleName, suffix, address, gender, dateOfBirth,
        age, contactNumber, civilStatus, firstDoseBrand, secondDoseBrand,
        boosterBrand, firstDoseDate, secondDoseDate, boosterDate, email, password } = req.body;

    try {
        // const hashedPassword = await bcrypt.hash(password, 10);
        const Patient = await patient.findOne({ where: { id: req.user.id } });
        if (!Patient) {
            return res.status(404).json({ error: 'Patient not found' });
        }
        Patient.FIRST_NAME = firstName;
        Patient.LAST_NAME = lastName;
        Patient.MIDDLE_NAME = middleName;
        Patient.SUFFIX = suffix;
        Patient.ADDRESS = address;
        Patient.SEX = gender;
        Patient.BIRTHDAY = dateOfBirth;
        Patient.AGE = age;
        Patient.CIVIL_STATUS = civilStatus;
        Patient.CONTACT_NUMBER = contactNumber;
        Patient.FIRST_DOSE_BRAND = firstDoseBrand;
        Patient.SECOND_DOSE_BRAND = secondDoseBrand;
        Patient.BOOSTER_BRAND = boosterBrand;
        Patient.FIRST_DOSE_DATE = firstDoseDate;
        Patient.SECOND_DOSE_DATE = secondDoseDate;
        Patient.BOOSTER_DATE = boosterDate;

        await Patient.save();
        res.status(200).json(Patient);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});


// Update Patient Details Route
router.put('/patient/update-password', auth('Patient'), async (req, res) => {
    const { email, password } = req.body;

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const Patient = await patient.findOne({ where: { id: req.user.id } });
        if (!Patient) {
            return res.status(404).json({ error: 'Patient not found' });
        }
        Patient.EMAIL = email;
        Patient.PASSWORD = hashedPassword
        await Patient.save();
        res.status(200).json(Patient);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get Logged-in Patient Information Route
const moment = require('moment'); // Use moment.js for easier date manipulation

router.get('/patient/me', auth('Patient'), async (req, res) => {
    const patientId = req.user.id;
    try {
        const loggedInPatient = await patient.findByPk(patientId);
        if (!loggedInPatient) {
            return res.status(404).json({ error: 'Patient not found' });
        }

        // Check if patient was created within the last 10 minutes
        const isNewlyRegistered = moment().diff(moment(loggedInPatient.createdAt), 'minutes') < 1;

        res.status(200).json({ ...loggedInPatient.toJSON(), isNewlyRegistered });
    } catch (error) {
        res.status(500).json({ error: 'An error occurred while fetching the patient details.' });
    }
});


router.get('/secreSched', auth('Patient'), async (req, res) => {
    const id = 12;
    try {
        const secretary = await Secretary.findByPk(id); // Find Secretary by primary key
        if (!secretary) {
            return res.status(404).json({ error: 'Secretary not found' });
        }
        res.status(200).json(secretary);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});
module.exports = router;
