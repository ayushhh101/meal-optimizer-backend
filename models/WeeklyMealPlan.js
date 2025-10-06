// backend-service/src/models/WeeklyMealPlan.js
const mongoose = require('mongoose');

const recipeSchema = new mongoose.Schema({
  name: { type: String, required: true },
  calories: { type: Number, required: true },
  protein: { type: Number, required: true },
  carbs: { type: Number, required: true },
  fat: { type: Number, required: true },
  ingredients: [{ type: String }],
  youtube_link: { type: String },
  image_url: { type: String },
  cookTime: { type: String }
}, { _id: false });

const dayMealsSchema = new mongoose.Schema({
  day: { 
    type: String, 
    required: true,
    enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  },
  breakfast: recipeSchema,
  lunch: recipeSchema,
  dinner: recipeSchema
}, { _id: false });

const weeklyMealPlanSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    index: true
  },
  weekNumber: { 
    type: Number, 
    required: true,
    min: 1,
    max: 53
  },
  year: { 
    type: Number, 
    required: true 
  },
  month: {
    type: Number,
    required: true,
    min: 1,
    max: 12
  },
  weekOfMonth: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  startDate: { 
    type: Date, 
    required: true 
  },
  endDate: { 
    type: Date, 
    required: true 
  },
  optionName: { 
    type: String, 
    default: 'Weekly Meal Plan' 
  },
  days: [dayMealsSchema],
  preferences: {
    cuisines: [String],
    goals: [String],
    allergies: [String],
    dietaryRestrictions: [String]
  },
  isActive: { 
    type: Boolean, 
    default: true 
  },
  lastAccessed: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Compound index for efficient lookups
weeklyMealPlanSchema.index({ userId: 1, year: 1, weekOfMonth: 1, month: 1 }, { unique: true });
weeklyMealPlanSchema.index({ userId: 1, startDate: 1 });
weeklyMealPlanSchema.index({ userId: 1, isActive: 1, createdAt: -1 });

// Static method to get week of month from date
weeklyMealPlanSchema.statics.getWeekOfMonth = function(date) {
  const firstDayOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  const dayOfMonth = date.getDate();
  return Math.ceil(dayOfMonth / 7);
};

// Static method to get week boundaries (Monday to Sunday)
weeklyMealPlanSchema.statics.getWeekBoundaries = function(date) {
  const currentDay = date.getDay(); // 0 = Sunday, 1 = Monday, ...
  const diff = currentDay === 0 ? -6 : 1 - currentDay; // Adjust to get Monday
  
  const monday = new Date(date);
  monday.setDate(date.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  
  return { startDate: monday, endDate: sunday };
};

module.exports = mongoose.model('WeeklyMealPlan', weeklyMealPlanSchema);
