require('dotenv').config();
const jwt = require('jsonwebtoken');
const Secretary = require('../models/secretary');
const Patient = require('../models/patient');
const Doctor = require('../models/doctor');
const UserLevel = require('../models/userLevel'); // Assuming you have a UserLevel model

module.exports = (requiredRole) => {
    return async (req, res, next) => {
        try {
            // Check for Authorization header
            const authHeader = req.header('Authorization');
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                throw new Error('Authorization header is missing or malformed');
            }

            // Extract token from header
            const token = authHeader.split(' ')[1];
            console.log('Token:', token);

            // Verify token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            console.log('Decoded:', decoded);

            let user;
            switch (decoded.role) {
                case 'Secretary':
                    user = await Secretary.findByPk(decoded.id);
                    break;
                case 'Patient':
                    user = await Patient.findByPk(decoded.id);
                    break;
                case 'Doctor':
                    user = await Doctor.findByPk(decoded.id);
                    break;
                default:
                    throw new Error('Invalid role');
            }

            if (!user) {
                throw new Error('User not found');
            }

            // Fetch user's role level from the userlevel table
            const userLevel = await UserLevel.findByPk(user.USER_LEVEL_ID);
            if (!userLevel) {
                throw new Error('User level not found');
            }

            // Check if the user's role matches the required role, if specified
            if (requiredRole && userLevel.ROLE_NAME !== requiredRole) {
                throw new Error('Access denied');
            }

            // Attach user and role to request object
            req.user = {
                ...user.toJSON(), // Spread the user object to include all fields
                role: decoded.role,
                id: decoded.id,
            };
            next();
        } catch (error) {
            console.error('Authentication error:', error.message);
            res.status(401).json({ error: process.env.NODE_ENV === 'development' ? error.message : 'Please authenticate' });
        }
    };
};
