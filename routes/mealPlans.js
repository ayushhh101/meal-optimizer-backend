// backend-service/src/routes/mealPlans.js
const express = require('express');
const { body, query, param } = require('express-validator');
const auth = require('../middleware/auth');
const {
  generateMealPlan,
  getMealPlans,
  getMealPlanById,
  updateMealPlanFeedback,
  searchRecipes
} = require('../controllers/mealPlanController');

const router = express.Router();

// Generate meal plan
router.post('/generate', 
  auth,
  [
    body('date').optional().isISO8601().toDate(),
    body('customBudget').optional().isFloat({ min: 50, max: 1000 }),
    body('overridePreferences').optional().isObject()
  ],
  generateMealPlan
);

// Get user's meal plans
router.get('/', 
  auth,
  [
    query('date').optional().isISO8601(),
    query('limit').optional().isInt({ min: 1, max: 50 }),
    query('page').optional().isInt({ min: 1 })
  ],
  getMealPlans
);

// Get specific meal plan
router.get('/:planId', 
  auth,
  [param('planId').notEmpty()],
  getMealPlanById
);

// Update meal plan feedback
router.put('/:planId/feedback', 
  auth,
  [
    param('planId').notEmpty(),
    body('rating').optional().isInt({ min: 1, max: 5 }),
    body('comment').optional().isString().trim(),
    body('wouldRecommend').optional().isBoolean()
  ],
  updateMealPlanFeedback
);

// Search recipes
router.post('/recipes/search', 
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

module.exports = router;
