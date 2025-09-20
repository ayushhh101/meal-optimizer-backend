// backend-service/src/models/MealPlan.js
const mongoose = require('mongoose');

const nutritionSchema = new mongoose.Schema({
  calories: { type: Number, required: true },
  protein: { type: Number, required: true },
  carbs: { type: Number, required: true },
  fats: { type: Number, required: true },
  fiber: { type: Number, default: 0 },
  sugar: { type: Number, default: 0 }
}, { _id: false });

const mealPlanSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  date: { type: String, required: true },
  theme: { type: String, default: 'Balanced Indian Cuisine' },
  strategy: {
    nutritional: { type: String, default: 'Balanced nutrition' },
    budget: { type: String, default: 'Cost-effective meal selection' }
  },
  meals: [{
    mealType: { type: String, required: true },
    recipe: {
      id: { type: Number, required: true },
      name: { type: String, required: true },
      cuisine: { type: String, required: true },
      prepTime: { type: Number, required: true },
      servings: { type: Number, default: 2 },
      difficulty: { type: String, default: 'Medium' },
      nutrition: nutritionSchema,
      cost: {
        total: { type: Number, required: true },
        perServing: { type: Number, required: true },
        budgetFriendly: { type: Boolean, default: true },
        valueScore: { type: Number, default: 1.0 }
      },
      ingredients: [{ type: String }],
      instructions: [{ type: String }],
      dietaryTags: [{ type: String }],
      allergens: [{ type: String }],
      links: {
        recipe: { type: String, default: '' },
        image: { type: String, default: '' }
      },
      source: {
        database: { type: Boolean, default: true },
        nutritionSource: { type: String, default: 'database' },
        matchScore: { type: Number, default: 0 }
      }
    },
    rationale: { type: String, default: '' },
    targetNutrition: {
      calories: { type: Number },
      protein: { type: Number },
      budget: { type: Number }
    }
  }],
  dailySummary: {
    nutrition: nutritionSchema,
    budget: {
      planned: { type: Number, required: true },
      actual: { type: Number, required: true },
      savings: { type: Number, default: 0 },
      utilization: { type: Number, default: 100 },
      efficiency: { type: String, default: 'Good' },
      costPerCalorie: { type: Number, default: 0 },
      costPerProtein: { type: Number, default: 0 }
    },
    timing: {
      totalPrepTime: { type: Number, default: 0 },
      averagePrepTime: { type: Number, default: 0 }
    }
  },
  compliance: {
    nutritionTargets: {
      calories: { type: Boolean, default: true },
      protein: { type: Boolean, default: true },
      carbs: { type: Boolean, default: true },
      fats: { type: Boolean, default: true },
      budget: { type: Boolean, default: true }
    },
    dietaryRestrictions: { type: Boolean, default: true },
    allergenFree: { type: Boolean, default: true },
    budgetCompliant: { type: Boolean, default: true }
  },
  analysis: {
    database: {
      recipesAnalyzed: { type: Number, default: 0 },
      matchSuccessRate: { type: Number, default: 0 },
      uniqueRecipes: { type: Number, default: 0 },
      utilization: { type: String, default: 'Good' }
    },
    cuisineDistribution: { type: Map, of: Number },
    warnings: [{ type: String }]
  },
  isActive: { type: Boolean, default: true },
  feedback: {
    rating: { type: Number, min: 1, max: 5 },
    comment: { type: String },
    wouldRecommend: { type: Boolean }
  }
}, {
  timestamps: true
});

// Indexes
mealPlanSchema.index({ userId: 1, date: 1 });
mealPlanSchema.index({ userId: 1, createdAt: -1 });
mealPlanSchema.index({ id: 1 }, { unique: true });

module.exports = mongoose.model('MealPlan', mealPlanSchema);
