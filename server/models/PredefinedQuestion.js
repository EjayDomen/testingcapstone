const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PredefinedQuestion = sequelize.define('PredefinedQuestion', {
  question: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  reply: {
    type: DataTypes.STRING,
    allowNull: false,
  },
});

module.exports = PredefinedQuestion;
