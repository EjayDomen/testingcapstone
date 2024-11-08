const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Patient = require('./patient'); // Import the Patient model


const PatientFeedback = sequelize.define('patient_feedback', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    PATIENT_ID: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'patients', // Assuming your patient table is called 'patients'
            key: 'patient_id',
        },
    },
    RATING: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
            min: 1,
            max: 5,
        },
    },
    COMMENTS: {
        type: DataTypes.TEXT,
        allowNull: true,
    }
}, {
    tableName: 'patient_feedback'
});

PatientFeedback.belongsTo(Patient, {
    foreignKey: 'PATIENT_ID',
    as: 'patient'
});

module.exports = PatientFeedback;