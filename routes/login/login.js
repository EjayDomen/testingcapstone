require('dotenv').config();  // Load .env
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Secretary = require('../../models/secretary');
const Patient = require('../../models/patient');
const router = express.Router();

router.post('/login', async (req, res) => {
    const { EMAIL, PASSWORD } = req.body;

    try {
        let user = null;
        let role = null;

        // Check if the user is a secretary
        user = await Secretary.findOne({ where: { EMAIL } });
        if (user) {
            role = 'Secretary';
        } else {
            // If not found, check if the user is a patient
            user = await Patient.findOne({ where: { EMAIL } });
            if (user) {
                role = 'Patient';
            }
        }

        if (!user) {
            console.log('User not found');
            return res.status(404).json({ error: 'User not found' });
        }

        // Ensure that the password is a string
        if (typeof user.PASSWORD !== 'string') {
            console.log('Stored password is not a string');
            return res.status(500).json({ error: 'Password format error' });
        }

        // Check if the password matches
        const validPassword = await bcrypt.compare(PASSWORD, user.PASSWORD);
        if (!validPassword) {
            console.log('Invalid Password');
            return res.status(401).json({ error: 'Invalid Password' });
        }

        // Check user role by USER_LEVEL_ID
        if (user.USER_LEVEL_ID === 1 && role === 'Secretary') {
            console.log('Secretary logged in');
        } else if (user.USER_LEVEL_ID === 3 && role === 'Patient') {
            console.log('Patient logged in');
        } else {
            // Unauthorized role
            console.log('Unauthorized user role');
            return res.status(403).json({ error: 'Unauthorized user role' });
        }

        // Generate JWT token including both id and role
        const token = jwt.sign(
            { id: user.id, role },  // id and role should be included in the token payload
            process.env.JWT_SECRET,  // Use your environment variable for the secret
            { expiresIn: '24h' }
        );

        // Return the token and role to the frontend
        return res.status(200).json({ token, role });

    } catch (error) {
        console.error('Error during login:', error);
        res.status(400).json({ error: error.message });
    }
});

module.exports = router;
