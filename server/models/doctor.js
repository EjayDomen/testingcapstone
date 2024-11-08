const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const secretary = require('./secretary');


// Define the Doctor model
const Doctor = sequelize.define('Doctor', {
    FIRST_NAME: {
        type: DataTypes.STRING,
        allowNull: false
    },
    MIDDLE_NAME: {
        type: DataTypes.STRING,
        allowNull: false
    },
    LAST_NAME: {
        type: DataTypes.STRING,
        allowNull: false
    },
    SUFFIX: {
        type: DataTypes.STRING,
        allowNull: false
    },
    GENDER: {
        type: DataTypes.STRING,
        allowNull: false
    },
    HEALTH_PROFESSIONAL_ACRONYM: {
        type: DataTypes.STRING,
        allowNull: false
    },
    DEPARTMENT: {
        type: DataTypes.STRING,
        allowNull: false
    },
    YEARS_OF_EXPERIENCE: {
        type: DataTypes.STRING,
        allowNull: false
    },
    EXPERTISE: {
        type: DataTypes.STRING,
        allowNull: false
    },
    DOCTOR_STATUS: {
        type: DataTypes.STRING,
        allowNull: false
    },
    is_deleted: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },
}, {
    tableName: 'doctors',
    timestamps: false
});

secretary.hasMany(Doctor, {
    foreignKey: {
        name: 'SECRETARY_ID',
        allowNull: true,
        as: 'doctors'
    }
});

Doctor.belongsTo(secretary, {
    foreignKey: {
        name: 'SECRETARY_ID',
        allowNull: true,
        as: 'secretary'
    }
});


module.exports = Doctor;

