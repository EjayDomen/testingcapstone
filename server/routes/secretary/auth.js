const express = require ('express');
const bcrypt = require ('bcryptjs');
const jwt = require ('jsonwebtoken');
const secretary = require('../../models/secretary');

const router = express.Router();

router.post('/register', async (req, res) => {
    const {
        FIRST_NAME,
        LAST_NAME,
        EMAIL,
        PASSWORD,
        SCHEDULE,
        ROOM_NUMBER,
        FLOOR_NUMBER,
        DEPARTMENT,
    } = req.body;

    try {
        const hashedPassword = await bcrypt.hash(PASSWORD, 10);
        
        // Create secretary with the appropriate field names
        const newSecretary = await secretary.create({
            FIRST_NAME,
            LAST_NAME,
            EMAIL,
            PASSWORD: hashedPassword,
            SCHEDULE,
            ROOM_NUMBER,
            FLOOR_NUMBER,
            DEPARTMENT,
            USER_LEVEL_ID: '1'
        });

        res.status(201).json(newSecretary);
    } catch (error) {
        res.status(400).json({ error: error.message });
        console.log('error:', error.message);
    }
});



module.exports = router;