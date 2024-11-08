const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Doctor = require('./doctor');

// Define the Schedule model
const schedules = sequelize.define('schedules', {
    SCHEDULE_ID: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,  // This should be set
        allowNull: false
    },
    DOCTOR_ID: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: Doctor,
            key: 'id'
        }
    },
    DAY_OF_WEEK: {
        type: DataTypes.ENUM('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'),
        allowNull: false
    },
    START_TIME: {
        type: DataTypes.TIME,
        allowNull: false
    },
    END_TIME: {
        type: DataTypes.TIME,
        allowNull: false
    },
    SLOT_COUNT: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    SCHED_COUNTER: {
        type: DataTypes.INTEGER,
        allowNull:false
    },
    is_deleted: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },
}, {
    tableName: 'schedules',
    timestamps: false
});

Doctor.hasMany(schedules, {
    foreignKey: {
        name: 'doctor_id',
        allowNull: true
    }
});
schedules.belongsTo(Doctor, { foreignKey: 'DOCTOR_ID', as: 'Doctor' });

module.exports = schedules;
