// backend-service/src/routes/mealPlans.js
const express = require('express');
const { body, query, param } = require('express-validator');
const auth = require('../middleware/auth');
const {
  generateMealPlan,
  getMealPlans,
  getMealPlanById,
  updateMealPlanFeedback,
  searchRecipes,
  generateMealPlanFromAgent,
  getCurrentWeekMealPlan,
  getAllUserMealPlans,
  deleteMealPlan,
  getTodaysMeals,
  getTodaysGroceryList,
  toggleMealCompletion
} = require('../controllers/mealPlanController');

const router = express.Router();

// IMPORTANT: More specific routes must come BEFORE generic ones
// Order matters in Express routing!

// Route to search recipes (must come before /:planId to avoid conflict)
router.post(
  '/recipes/search', 
  auth,
  [
    body('dietary').optional().isArray(),
    body('cuisines').optional().isArray(),
    body('allergies').optional().isArray(),
    body('maxBudget').optional().isFloat({ min: 0 }),
    body('limit').optional().isInt({ min: 1, max: 100 })
  ],
  searchRecipes
);

// Route to get current week's meal plan (specific route)
router.get(
  '/current',
  auth,
  getCurrentWeekMealPlan
);

router.get(
  '/today',
  auth,
  getTodaysMeals
);

router.patch(
  '/today/:mealType/complete',
  auth,
  // Add toggleMealCompletion to the list of imported controllers
  toggleMealCompletion 
);

// Route to get all user's weekly meal plans (specific route)
router.get(
  '/all',
  auth,
  [
    query('limit').optional().isInt({ min: 1, max: 50 }),
    query('page').optional().isInt({ min: 1 })
  ],
  getAllUserMealPlans
);

// Route to generate/get cached meal plan from AI agent
// This is the main endpoint your frontend calls
router.post(
  '/generate-from-agent',
  auth,
  [
    body('name').notEmpty().trim(),
    body('preferences').isObject(),
    body('preferences.cuisines').optional().isArray(),
    body('preferences.goals').optional().isArray(),
    body('preferences.allergies').optional().isArray(),
    body('preferences.dietaryRestrictions').optional().isArray(),
    body('forceRegenerate').optional().isBoolean()
  ],
  generateMealPlanFromAgent
);

// Generate meal plan and save to DB (legacy route)
router.post(
  '/generate', 
  auth,
  [
    body('date').optional().isISO8601().toDate(),
    body('customBudget').optional().isFloat({ min: 50, max: 1000 }),
    body('overridePreferences').optional().isObject()
  ],
  generateMealPlan
);

// Get user's meal plans (generic route)
router.get(
  '/', 
  auth,
  [
    query('date').optional().isISO8601(),
    query('limit').optional().isInt({ min: 1, max: 50 }),
    query('page').optional().isInt({ min: 1 })
  ],
  getMealPlans
);

// Delete/deactivate a meal plan (must come before /:planId GET)
router.delete(
  '/:planId',
  auth,
  [param('planId').notEmpty().isMongoId()],
  deleteMealPlan
);

// Update meal plan feedback (specific action on planId)
router.put(
  '/:planId/feedback', 
  auth,
  [
    param('planId').notEmpty().isMongoId(),
    body('rating').optional().isInt({ min: 1, max: 5 }),
    body('comment').optional().isString().trim(),
    body('wouldRecommend').optional().isBoolean()
  ],
  updateMealPlanFeedback
);

// Get specific meal plan (generic :planId route - must come LAST)
router.get(
  '/:planId', 
  auth,
  [param('planId').notEmpty().isMongoId()],
  getMealPlanById
);

router.get(
  '/today/grocery',
  auth,
  getTodaysGroceryList
);

module.exports = router;
