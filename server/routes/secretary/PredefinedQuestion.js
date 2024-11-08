const express = require('express');
const router = express.Router();
const PredefinedQuestion = require('../../models/PredefinedQuestion');

// Fetch all predefined questions
router.get('/predefined-questions', async (req, res) => {
  try {
    const questions = await PredefinedQuestion.findAll();
    res.json(questions);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve questions' });
  }
});

// Add a new question
router.post('/predefined-questions', async (req, res) => {
  const { question, reply } = req.body;
  try {
    const newQuestion = await PredefinedQuestion.create({ question, reply });
    res.status(201).json(newQuestion);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add question' });
  }
});

// Update a question
router.put('/predefined-questions/:id', async (req, res) => {
  const { id } = req.params;
  const { question, reply } = req.body;
  try {
    const updated = await PredefinedQuestion.update({ question, reply }, { where: { id } });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update question' });
  }
});

// Delete a question
router.delete('/predefined-questions/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await PredefinedQuestion.destroy({ where: { id } });
    res.json({ message: 'Question deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete question' });
  }
});

module.exports = router;
