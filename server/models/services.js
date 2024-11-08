// Sequelize Model Code
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database'); // Ensure this path is correct


// Define the Services model
const Services = sequelize.define('services', {
    service_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
    },
    name: {
        type: DataTypes.STRING(50),
        allowNull: false,
        collation: 'utf8mb4_general_ci'
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true,
        collation: 'utf8mb4_general_ci'
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
        defaultValue: 1
    },
    created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        onUpdate: DataTypes.NOW
    }
}, {
    tableName: 'services',
    timestamps: false
});

module.exports = Services;
