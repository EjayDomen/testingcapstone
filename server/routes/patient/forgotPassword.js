const express = require('express');
const randomString = require('randomstring');
const nodeMailer = require('nodemailer');
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const patient = require('../../models/patient'); // Importing the patient model

const router = express.Router();
const OtpCache = {}; // Temporary storage for OTPs


// Check if a Patient Exists Route
router.post('/find-patient', async (req, res) => {
    const { EMAIL } = req.body;

    try {
        // Check if a patient with the same email or contact number already exists
        const existingPatient = await patient.findOne({
            where: {
                [Op.or]: [
                    { EMAIL }

                ]
            }
        });

        if (existingPatient) {
            // If a patient is found, respond with a message
            res.status(200).json({ message: 'A patient with this email or contact number already exists.' });
        } else {
            // If no patient is found, indicate that registration can continue
            res.status(404).json({ message: 'No existing patient with this email or contact number.' });
        }
    } catch (error) {
        res.status(500).json({ error: 'An error occurred while checking the patient.' });
        console.log('Error:', error.message);
    }
});
// Endpoint to reset the password after OTP verification
router.post('/reset-password', async (req, res) => {
    const { email, newPassword } = req.body;

    try {
        // Check if the email exists in the patient table
        const user = await patient.findOne({ where: { EMAIL: email } });

        if (!user) {
            return res.status(404).json({ message: 'Invalid request. Email not found.' });
        }

        // Hash the new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update the password in the database
        await patient.update({ PASSWORD: hashedPassword }, { where: { EMAIL: email } });

        console.log('Password reset successful for:', email);
        res.status(200).json({ message: 'Password reset successful.' });
    } catch (error) {
        console.log('Error resetting password:', error);
        res.status(500).json({ message: 'Internal server error. Please try again later.' });
    }
});


module.exports = router;
