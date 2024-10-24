const { Sequelize, DataTypes } = require('sequelize');
const sequelize = require('../config/database');  // Ensure this path is correct

const userLevel = sequelize.define('userLevel', {
    ROLE_ID: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    ROLE_NAME: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    }
}, {
    tableName: 'userlevel',  // Ensure this matches your actual table name
    timestamps: false  // Adjust this as needed
});

module.exports = userLevel;
