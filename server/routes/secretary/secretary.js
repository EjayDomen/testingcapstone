const express = require('express');
const router = express.Router();
const Secretary = require('../../models/secretary');
const auth = require('../../middleware/auth'); // Assuming auth middleware is defined correctly
const bcrypt = require('bcryptjs');

router.get('/profile', auth('Secretary'), async (req, res) => {
    const id = req.user.id;
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

router.get('/', auth('Secretary'), async (req, res) => {
    try {
        const secretary = await Secretary.findAll();
        if (!secretary) {
            return res.status(404).json({ error: 'Secretary not found' });
        }
        res.status(200).json(secretary);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// PUT endpoint to update a secretary by ID
router.put('/profileUpdate', auth('Secretary'), async (req, res) => {
    const id = req.user.id;
    const { FIRST_NAME, MIDDLE_NAME, LAST_NAME, PASSWORD, CONTACT_NUMBER, SCHEDULE, ROOMNUMBER, DATE_OF_BIRTH, GENDER, AGE, NOTES, EMAIL, DEPARTMENT } = req.body;
    
    try {
        // Find the secretary by their ID
        const secretary = await Secretary.findOne({ where: { id } });
        if (!secretary) {
            return res.status(404).json({ error: 'Secretary not found' });
        }

        // Hash the new password if it is provided
        let hashedPassword = secretary.PASSWORD; // Keep the old password if not updating
        if (PASSWORD) {
            hashedPassword = await bcrypt.hash(PASSWORD, 10);
        }

        // Update the secretary fields
        secretary.FIRST_NAME = FIRST_NAME;
        secretary.MIDDLE_NAME = MIDDLE_NAME;
        secretary.LAST_NAME = LAST_NAME;
        secretary.PASSWORD = hashedPassword; // Use the hashed password
        secretary.SCHEDULE = SCHEDULE;
        secretary.ROOMNUMBER = ROOMNUMBER;
        secretary.DATE_OF_BIRTH = DATE_OF_BIRTH;
        secretary.GENDER = GENDER;
        secretary.AGE = AGE;
        secretary.NOTES = NOTES;
        secretary.EMAIL = EMAIL;
        secretary.DEPARTMENT = DEPARTMENT;
        secretary.CONTACT_NUMBER = CONTACT_NUMBER;
        
        // Save the updated secretary
        await secretary.save();
        
        res.status(200).json(secretary);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});


module.exports = router;
