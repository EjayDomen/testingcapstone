const {DataTypes} = require('sequelize');
const sequelize = require('../config/database');
const secretary = require('./secretary');


// Define the Doctor model
const Doctor = sequelize.define('Doctor', {
    FIRST_NAME: {
        type: DataTypes.STRING,
        allowNull: false
    },
    LAST_NAME: {
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
    }
}, {
    tableName: 'doctors',
    timestamps: false
});

secretary.hasMany(Doctor,{
    foreignKey:{
        name:'SECRETARY_ID',
        allowNull:true
    }
});

Doctor.belongsTo(secretary, {
    foreignKey: {
        name: 'SECRETARY_ID',
        allowNull: true
    }
});


module.exports = Doctor;

