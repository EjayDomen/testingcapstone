const { DataTypes } = require('sequelize');
const sequelize = require('../config/database'); // Adjust the path as needed

const Log = sequelize.define('Log', {
    LOG_ID: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    USER_ID: {
        type: DataTypes.INTEGER,
        allowNull: false,
        onDelete: 'CASCADE',
    },
    USER_TYPE: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    ACTION: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    timestamp: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
    },
}, {
    tableName: 'logs',
    timestamps: false, // Disables Sequelize's automatic timestamps fields
});

module.exports = Log;
