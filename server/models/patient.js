const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const userLevel = require('./userLevel');

const patient = sequelize.define('patients', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
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
        allowNull: true
    },
    EMAIL: {
        type: DataTypes.STRING,
        allowNull: false
    },
    CONTACT_NUMBER: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    ADDRESS: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    SEX: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    CIVIL_STATUS: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    AGE: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    BIRTHDAY: {
        type: DataTypes.DATE,
        allowNull: false
    },
    PASSWORD: {
        type: DataTypes.STRING,  // Corrected type from DATE to STRING
        allowNull: false
    },
    USER_LEVEL_ID: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: false
    },
    VERIFIED: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
    },
    PROFILE_PIC: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    FIRST_DOSE_BRAND: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    SECOND_DOSE_BRAND: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    BOOSTER_BRAND: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    FIRST_DOSE_DATE: {
        type: DataTypes.DATE,
        allowNull: false,
    },
    SECOND_DOSE_DATE: {
        type: DataTypes.DATE,
        allowNull: false,
    },
    BOOSTER_DATE: {
        type: DataTypes.DATE,
        allowNull: false,
    },
    is_deleted: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    }
});

patient.belongsTo(userLevel, {
    foreignKey: {
        name: 'USER_LEVEL_ID',  // Enclosed in quotes
        allowNull: false
    }
});

userLevel.hasMany(patient, {
    foreignKey: {
        name: 'USER_LEVEL_ID',  // Enclosed in quotes
        allowNull: false
    }
});

module.exports = patient;  // Corrected from modules.exports to module.exports
