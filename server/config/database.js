const {Sequelize} = require('sequelize');

const sequelize = new Sequelize('appointment', 'root', '',{
    host:'localhost',
    dialect: 'mysql'
});

module.exports = sequelize;