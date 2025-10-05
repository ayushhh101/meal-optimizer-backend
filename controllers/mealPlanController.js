// backend-service/src/controllers/mealPlanController.js
const MealPlan = require('../models/MealPlan');
const User = require('../models/User');
const aiAgentService = require('../services/aiAgentService');
const { validationResult } = require('express-validator');
const axios = require('axios');

const generateMealPlanFromAgent = async (req, res) => {
  try {
    const { name, preferences } = req.body;
    if (!preferences || !name) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        message: 'Request body must contain "name" and "preferences".'
      });
    }

    const fastApiUrl = 'http://127.0.0.1:8000/meal-plan';
    console.log(`Forwarding request to FastAPI agent at: ${fastApiUrl}`);

    const agentResponse = await axios.post(fastApiUrl, { name, preferences });

    console.log("Successfully received response from FastAPI agent.");
    res.status(200).json({
      success: true,
      message: 'Meal plan generated successfully from AI agent',
      data: agentResponse.data
    });
  } catch (error) {
    console.error("Error calling FastAPI agent service:", error.message);
    if (error.isAxiosError) {
      return res.status(503).json({
        success: false,
        error: 'AI Service Unreachable',
        message: 'Could not connect to the Python meal plan service. Is it running?'
      });
    }
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'An unexpected error occurred while communicating with the AI service.'
    });
  }
};

const generateMealPlan = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: 'Validation error', details: errors.array() });
    }
    const userId = req.user.userId;
    const { date, customBudget, overridePreferences } = req.body;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    const preferences = { ...user.preferences.toObject(), ...overridePreferences };
    const aiResponse = await aiAgentService.generateMealPlan(userId, preferences, customBudget);
    if (!aiResponse.success) {
      return res.status(500).json({ success: false, error: 'AI service error', message: aiResponse.error || 'Failed to generate meal plan' });
    }
    const mealPlanData = aiResponse.data.mealPlan;
    const mealPlan = new MealPlan(mealPlanData);
    await mealPlan.save();
    await User.findByIdAndUpdate(userId, { lastMealPlanGenerated: new Date(), $inc: { totalMealPlansGenerated: 1 } });
    console.log(`Meal plan saved to MongoDB with ID: ${mealPlan.id}`);
    res.json({ success: true, message: 'Meal plan generated successfully', data: { mealPlan: mealPlanData, metadata: aiResponse.metadata } });
  } catch (error) {
    console.error('Generate meal plan error:', error);
    res.status(500).json({ success: false, error: 'Failed to generate meal plan', message: error.message });
  }
};

const getMealPlans = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { date, limit = 10, page = 1 } = req.query;
    const query = { userId, isActive: true };
    if (date) query.date = date;
    const mealPlans = await MealPlan.find(query).sort({ createdAt: -1 }).limit(limit * 1).skip((page - 1) * limit).lean();
    const totalCount = await MealPlan.countDocuments(query);
    res.json({ success: true, data: { mealPlans, pagination: { currentPage: page, totalPages: Math.ceil(totalCount / limit), totalCount } } });
  } catch (error) {
    console.error('Get meal plans error:', error);
    res.status(500).json({ success: false, error: 'Failed to get meal plans', message: error.message });
  }
};

const getMealPlanById = async (req, res) => {
  try {
    const { planId } = req.params;
    const userId = req.user.userId;
    const mealPlan = await MealPlan.findOne({ id: planId, userId, isActive: true }).lean();
    if (!mealPlan) {
      return res.status(404).json({ success: false, error: 'Meal plan not found' });
    }
    res.json({ success: true, data: { mealPlan } });
  } catch (error) {
    console.error('Get meal plan by ID error:', error);
    res.status(500).json({ success: false, error: 'Failed to get meal plan', message: error.message });
  }
};

const updateMealPlanFeedback = async (req, res) => {
  try {
    const { planId } = req.params;
    const userId = req.user.userId;
    const { rating, comment, wouldRecommend } = req.body;
    const mealPlan = await MealPlan.findOneAndUpdate({ id: planId, userId }, { feedback: { rating, comment, wouldRecommend } }, { new: true });
    if (!mealPlan) {
      return res.status(404).json({ success: false, error: 'Meal plan not found' });
    }
    res.json({ success: true, message: 'Feedback updated successfully', data: { mealPlan } });
  } catch (error) {
    console.error('Update feedback error:', error);
    res.status(500).json({ success: false, error: 'Failed to update feedback', message: error.message });
  }
};

const searchRecipes = async (req, res) => {
  try {
    const { dietary, cuisines, allergies, maxBudget, limit } = req.body;
    const searchCriteria = { dietary: dietary || ['vegetarian'], cuisines: cuisines || [], allergies: allergies || [], maxBudget: maxBudget || 100, limit: limit || 20 };
    const result = await aiAgentService.searchRecipes(searchCriteria);
    res.json(result);
  } catch (error) {
    console.error('Search recipes error:', error);
    res.status(500).json({ success: false, error: 'Failed to search recipes', message: error.message });
  }
};

module.exports = {
  generateMealPlan,
  getMealPlans,
  getMealPlanById,
  updateMealPlanFeedback,
  searchRecipes,
  generateMealPlanFromAgent
};

