const {DataTypes} = require('sequelize');
const sequelize = require('../config/database');
const schedule = require('./schedule');

const queueManagement = sequelize.define('quemanagements', {
    id:{
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    SCHEDULE_ID:{
        type: DataTypes.INTEGER,
        allowNull: false
    },
    DATE:{
        type: DataTypes.DATEONLY,
        allowNull: true
    },
    START_TIME: {
        type: DataTypes.TIME,
        allowNull: true
    },
    END_TIME: {
        type: DataTypes.TIME,
        allowNull: true
    },
    STATUS: {
        type: DataTypes.STRING,
        allowNull: true
    }
});

// QueueManagement belongs to Schedule
queueManagement.belongsTo(schedule, { foreignKey: 'SCHEDULE_ID', as: 'Schedule' });

// Schedule has many QueueManagement entries
schedule.hasMany(queueManagement, {
    foreignKey: {
        name: 'SCHEDULE_ID',
        allowNull: false
    }
});

module.exports = queueManagement;