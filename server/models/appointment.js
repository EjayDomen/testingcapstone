const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const secretary = require('./secretary');
const patient = require('./patient');
const schedule = require('./schedule');
const doctor = require('./doctor');

const Appointment = sequelize.define('appointments', {
    FIRST_NAME: {
        type: DataTypes.STRING,
        allowNull: false
    },
    MIDDLE_NAME: {
        type: DataTypes.STRING,
        allowNull: true
    },
    LAST_NAME: {
        type: DataTypes.STRING,
        allowNull: false
    },
    SUFFIX: {
        type: DataTypes.STRING,
        allowNull: true
    },
    AGE: {
        type: DataTypes.STRING,
        allowNull: true
    },
    ADDRESS: {
        type: DataTypes.STRING,
        allowNull: false
    },
    SEX: {
        type: DataTypes.STRING,
        allowNull: false
    },
    APPOINTMENT_TIME: {  // Corrected typo from AppoinmentTime to AppointmentTime
        type: DataTypes.STRING,
        allowNull: false,
    },
    APPOINTMENT_DATE: {
        type: DataTypes.DATEONLY,
        allowNull: false
    },
    REASON: {
        type: DataTypes.STRING,
        allowNull: true
    },
    CONTACT_NUMBER: {
        type: DataTypes.STRING,
        allowNull: true
    },
    TYPE: {
        type: DataTypes.STRING,
        defaultValue: false
    },
    STATUS: {
        type: DataTypes.STRING,
        allowNull: false
    },
    SCHEDULE_ID: {
        type: DataTypes.INTEGER,
        allowNull: false
    }
});

secretary.hasMany(Appointment, {
    foreignKey: {
        name: 'SECRETARY_ID',
        allowNull: true
    }
});
Appointment.belongsTo(secretary, {
    foreignKey: {
        name: 'SECRETARY_ID',
        allowNull: true
    }
});

Appointment.belongsTo(schedule, {
    foreignKey: {
        name: 'SCHEDULE_ID',
        allowNull: false
    }
});
schedule.hasMany(Appointment, {
    foreignKey: {
        name: 'SCHEDULE_ID',
        allowNull: false
    }
});


Appointment.belongsTo(doctor, {
    foreignKey: {
        name: 'DOCTOR_ID',
        allowNull: false
    }
});
doctor.hasMany(Appointment, {
    foreignKey: {
        name: 'DOCTOR_ID',
        allowNull: false
    }
});


// A patient can have many appointments
patient.hasMany(Appointment, {
    foreignKey: {
        name: 'PATIENT_ID',
        allowNull: true
    }
});

// An appointment belongs to one patient
Appointment.belongsTo(patient, {
    foreignKey: {
        name: 'PATIENT_ID',
        allowNull: true
    }
});



module.exports = Appointment;  // Corrected from modules.exports to module.exports
