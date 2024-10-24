const { Sequelize } = require('sequelize');

// Create a Sequelize instance
const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
    host: process.env.DB_HOST,
    dialect: 'mysql', // Specifies the database dialect (mysql in this case)
});

module.exports = sequelize;
