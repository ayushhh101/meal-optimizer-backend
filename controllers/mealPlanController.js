// backend-service/src/controllers/mealPlanController.js
const MealPlan = require('../models/MealPlan');
const WeeklyMealPlan = require('../models/WeeklyMealPlan'); // ⬅️ THIS WAS MISSING!
const User = require('../models/User');
const aiAgentService = require('../services/aiAgentService');
const { validationResult } = require('express-validator');
const axios = require('axios');

const categorizeIngredient = (item) => {
  const s = item.toLowerCase();
  
  if (/chicken|fish|egg|beef|tofu|paneer|lentil|chickpea|rajma|dal|kidney beans|black lentils|prawns|shrimp|mutton|lamb|salmon|tuna/i.test(s)) {
    return "Protein";
  } else if (/rice|oats|bread|pasta|quinoa|wheat|poha|semolina|rava|couscous|tortilla|pita|dalia|roti|chapati|naan/i.test(s)) {
    return "Grains";
  } else if (/apple|banana|spinach|carrot|broccoli|peas|cucumber|tomato|onion|pepper|potato|mint|coriander|cilantro|parsley|zucchini|cauliflower|eggplant|bell pepper|lettuce|cabbage|beans|mango|orange|berry|berries/i.test(s)) {
    return "Fruits & Vegetables";
  } else if (/milk|yogurt|curd|cheese|butter|ghee|cream|paneer/i.test(s)) {
    return "Dairy";
  } else if (/olive oil|vegetable oil|coconut oil|sesame oil|mustard oil|sunflower oil/i.test(s)) {
    return "Oils";
  } else if (/cumin|coriander powder|turmeric|chili powder|garam masala|oregano|paprika|hing|asafoetida|cinnamon|cardamom|saffron|black pepper|salt|bay leaf|cloves/i.test(s)) {
    return "Spices";
  } else if (/sugar|honey|jaggery|sweetener|stevia|erythritol/i.test(s)) {
    return "Sweeteners";
  } else if (/almond|cashew|walnut|peanut|pistachio|seeds|chia|flax|sesame/i.test(s)) {
    return "Nuts & Seeds";
  } else {
    return "Others";
  }
};

// Helper function to calculate week details
const getWeekDetails = (date = new Date()) => {
  const currentDate = new Date(date);
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;
  
  const weekOfMonth = WeeklyMealPlan.getWeekOfMonth(currentDate);
  
  const oneJan = new Date(year, 0, 1);
  const numberOfDays = Math.floor((currentDate - oneJan) / (24 * 60 * 60 * 1000));
  const weekNumber = Math.ceil((numberOfDays + oneJan.getDay() + 1) / 7);
  
  const { startDate, endDate } = WeeklyMealPlan.getWeekBoundaries(currentDate);
  
  return { year, month, weekNumber, weekOfMonth, startDate, endDate };
};

const generateMealPlanFromAgent = async (req, res) => {
  try {
    const { name, preferences, forceRegenerate = false } = req.body;
    
    console.log('📥 Received request:', { name, preferences, forceRegenerate });
    
    if (!preferences || !name) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        message: 'Request body must contain "name" and "preferences".'
      });
    }

    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        message: 'User must be authenticated to generate meal plans'
      });
    }

    const weekDetails = getWeekDetails();
    console.log('📅 Week details:', weekDetails);

    // Check cache - but skip if forceRegenerate is true
    if (!forceRegenerate) {
      const existingPlan = await WeeklyMealPlan.findOne({
        userId,
        year: weekDetails.year,
        month: weekDetails.month,
        weekOfMonth: weekDetails.weekOfMonth,
        isActive: true
      });

      if (existingPlan) {
        console.log('✅ Found cached meal plan');
        existingPlan.lastAccessed = new Date();
        await existingPlan.save();

        return res.status(200).json({
          success: true,
          message: 'Meal plan retrieved from cache',
          cached: true,
          data: {
            meal_plans: {
              meal_plan_options: [{
                option_name: existingPlan.optionName,
                days: existingPlan.days
              }]
            },
            weekInfo: {
              weekOfMonth: existingPlan.weekOfMonth,
              weekNumber: existingPlan.weekNumber,
              startDate: existingPlan.startDate,
              endDate: existingPlan.endDate
            }
          }
        });
      }
    }

    // If forceRegenerate, we'll update the existing plan instead of deleting
    console.log(forceRegenerate ? '🔄 Force regenerating meal plan...' : '🆕 Generating new meal plan...');

    // Call FastAPI
    const fastApiUrl = 'http://127.0.0.1:8000/meal-plan';
    console.log(`🔄 Calling FastAPI at: ${fastApiUrl}`);

    let agentResponse;
    try {
      agentResponse = await axios.post(
        fastApiUrl,
        { name, preferences },
        {
          timeout: 120000, // 2 minutes for image fetching
          headers: { 'Content-Type': 'application/json' }
        }
      );
      console.log('✅ FastAPI response received');
    } catch (axiosError) {
      console.error('❌ FastAPI Error:', axiosError.message);
      
      if (axiosError.code === 'ECONNREFUSED') {
        return res.status(503).json({
          success: false,
          error: 'AI Service Unavailable',
          message: 'Python FastAPI service is not running. Start it with: uvicorn main:app --reload --host 127.0.0.1 --port 8000'
        });
      }
      
      if (axiosError.code === 'ETIMEDOUT') {
        return res.status(503).json({
          success: false,
          error: 'AI Service Timeout',
          message: 'The AI service took too long. This may be due to image fetching. Please try again.'
        });
      }
      
      return res.status(503).json({
        success: false,
        error: 'AI Service Error',
        message: axiosError.response?.data?.detail || axiosError.message
      });
    }

    // Extract meal plan data
    const mealPlanData = agentResponse.data?.data?.meal_plans?.meal_plan_options?.[0];
    
    if (!mealPlanData || !mealPlanData.days || !Array.isArray(mealPlanData.days)) {
      console.error('❌ Invalid meal plan structure:', agentResponse.data);
      return res.status(500).json({
        success: false,
        error: 'Invalid Response',
        message: 'AI service returned invalid meal plan data',
        received: agentResponse.data
      });
    }

    console.log(`✅ Meal plan has ${mealPlanData.days.length} days`);

    // FIXED: Use findOneAndUpdate with upsert instead of delete + create
    const weeklyMealPlan = await WeeklyMealPlan.findOneAndUpdate(
      {
        userId,
        year: weekDetails.year,
        month: weekDetails.month,
        weekOfMonth: weekDetails.weekOfMonth
      },
      {
        $set: {
          weekNumber: weekDetails.weekNumber,
          startDate: weekDetails.startDate,
          endDate: weekDetails.endDate,
          optionName: mealPlanData.option_name || 'Weekly Meal Plan',
          days: mealPlanData.days,
          preferences: preferences,
          isActive: true,
          lastAccessed: new Date(),
          updatedAt: new Date()
        }
      },
      {
        upsert: true, // Create if doesn't exist
        new: true,    // Return the updated document
        setDefaultsOnInsert: true
      }
    );

    console.log(`✅ ${forceRegenerate ? 'Updated' : 'Saved'} to MongoDB: Week ${weekDetails.weekOfMonth}, ${weekDetails.month}/${weekDetails.year}`);

    res.status(200).json({
      success: true,
      message: forceRegenerate ? 'Meal plan regenerated successfully' : 'Meal plan generated and cached successfully',
      cached: false,
      regenerated: forceRegenerate,
      data: {
        meal_plans: {
          meal_plan_options: [{
            option_name: mealPlanData.option_name,
            days: mealPlanData.days
          }]
        },
        weekInfo: {
          weekOfMonth: weekDetails.weekOfMonth,
          weekNumber: weekDetails.weekNumber,
          startDate: weekDetails.startDate,
          endDate: weekDetails.endDate
        }
      }
    });

  } catch (error) {
    console.error("❌ Fatal error in generateMealPlanFromAgent:");
    console.error("Error name:", error.name);
    console.error("Error message:", error.message);
    console.error("Stack trace:", error.stack);
    
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};


// Get current week's meal plan
const getCurrentWeekMealPlan = async (req, res) => {
  try {
    const userId = req.user.userId;
    const weekDetails = getWeekDetails();

    const mealPlan = await WeeklyMealPlan.findOne({
      userId,
      year: weekDetails.year,
      month: weekDetails.month,
      weekOfMonth: weekDetails.weekOfMonth,
      isActive: true
    });

    if (!mealPlan) {
      return res.status(404).json({
        success: false,
        message: 'No meal plan found for current week. Please generate one.'
      });
    }

    // Update last accessed
    mealPlan.lastAccessed = new Date();
    await mealPlan.save();

    res.json({
      success: true,
      data: {
        meal_plans: {
          meal_plan_options: [{
            option_name: mealPlan.optionName,
            days: mealPlan.days
          }]
        },
        weekInfo: {
          weekOfMonth: mealPlan.weekOfMonth,
          weekNumber: mealPlan.weekNumber,
          startDate: mealPlan.startDate,
          endDate: mealPlan.endDate
        }
      }
    });
  } catch (error) {
    console.error('Get current week meal plan error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get meal plan',
      message: error.message
    });
  }
};

// Get all meal plans for a user
const getAllUserMealPlans = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { limit = 10, page = 1 } = req.query;

    const mealPlans = await WeeklyMealPlan.find({ userId, isActive: true })
      .sort({ year: -1, weekNumber: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const totalCount = await WeeklyMealPlan.countDocuments({ userId, isActive: true });

    res.json({
      success: true,
      data: {
        mealPlans,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalCount / limit),
          totalCount
        }
      }
    });
  } catch (error) {
    console.error('Get all meal plans error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get meal plans',
      message: error.message
    });
  }
};

// Delete/deactivate a meal plan
const deleteMealPlan = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { planId } = req.params;

    const mealPlan = await WeeklyMealPlan.findOneAndUpdate(
      { _id: planId, userId },
      { isActive: false },
      { new: true }
    );

    if (!mealPlan) {
      return res.status(404).json({
        success: false,
        message: 'Meal plan not found'
      });
    }

    res.json({
      success: true,
      message: 'Meal plan deactivated successfully'
    });
  } catch (error) {
    console.error('Delete meal plan error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete meal plan',
      message: error.message
    });
  }
};

// Legacy functions
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

const getTodaysMeals = async (req, res) => {
  try {
    const userId = req.user.userId;
    const weekDetails = getWeekDetails();
    
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    console.log(`📅 Fetching meals for ${today}`);

    const weeklyPlan = await WeeklyMealPlan.findOne({
      userId,
      year: weekDetails.year,
      month: weekDetails.month,
      weekOfMonth: weekDetails.weekOfMonth,
      isActive: true
    });

    if (!weeklyPlan) {
      return res.status(404).json({
        success: false,
        message: 'No meal plan found for current week. Please generate one.',
        needsGeneration: true
      });
    }

    const todaysMeals = weeklyPlan.days.find(day => day.day === today);

    if (!todaysMeals) {
      return res.status(404).json({
        success: false,
        message: `No meals found for ${today}`,
        needsGeneration: false
      });
    }

    const defaultImage = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400';

    // Helper function to format meal data
    const formatMealData = (meal, mealType, defaultName) => {
      if (!meal) {
        return {
          id: mealType,
          title: defaultName,
          type: mealType,
          category: mealType.charAt(0).toUpperCase() + mealType.slice(1),
          calories: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
          ingredients: [],
          recipe: '',
          image: defaultImage,
          cookTime: '30 mins',
          servings: '2',
          isCompleted: false,
          isAiGenerated: true
        };
      }

      return {
        id: mealType,
        title: meal.name || defaultName,
        type: mealType,
        category: mealType.charAt(0).toUpperCase() + mealType.slice(1),
        calories: meal.calories || 0,
        protein: meal.protein || 0,
        carbs: meal.carbs || 0,
        fat: meal.fat || 0,
        ingredients: meal.ingredients || [],
        recipe: meal.recipe || '',
        image: meal.image_url || meal.image || defaultImage, // Map both image_url and image
        cookTime: meal.cookTime || '30 mins',
        servings: meal.servings || '2',
        isCompleted: meal.isCompleted || false,
        isAiGenerated: true,
        youtubeLink: meal.youtube_link || ''
      };
    };

    // Format meals with proper structure
    const mealsArray = [
      formatMealData(todaysMeals.breakfast, 'breakfast', 'No Breakfast Planned'),
      formatMealData(todaysMeals.lunch, 'lunch', 'No Lunch Planned'),
      formatMealData(todaysMeals.dinner, 'dinner', 'No Dinner Planned')
    ];

    const nutritionStats = {
      calories: mealsArray.reduce((sum, meal) => sum + (meal.calories || 0), 0),
      protein: mealsArray.reduce((sum, meal) => sum + (meal.protein || 0), 0),
      carbs: mealsArray.reduce((sum, meal) => sum + (meal.carbs || 0), 0),
      fat: mealsArray.reduce((sum, meal) => sum + (meal.fat || 0), 0)
    };

    console.log(`✅ Formatted meals for ${today}:`, {
      breakfast: mealsArray[0].title,
      lunch: mealsArray[1].title,
      dinner: mealsArray[2].title,
      totalCalories: nutritionStats.calories
    });

    res.json({
      success: true,
      mealPlan: {
        day: today,
        meals: mealsArray,
        nutritionStats
      },
      weekInfo: {
        weekOfMonth: weeklyPlan.weekOfMonth,
        weekNumber: weeklyPlan.weekNumber,
        startDate: weeklyPlan.startDate,
        endDate: weeklyPlan.endDate,
        optionName: weeklyPlan.optionName
      }
    });

  } catch (error) {
    console.error('❌ Error fetching today\'s meals:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch today\'s meals',
      message: error.message
    });
  }
};

const getTodaysGroceryList = async (req, res) => {
  try {
    const userId = req.user.userId;
    const weekDetails = getWeekDetails();
    
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    console.log(`🛒 Generating grocery list for ${today}`);

    // Find current week's meal plan
    const weeklyPlan = await WeeklyMealPlan.findOne({
      userId,
      year: weekDetails.year,
      month: weekDetails.month,
      weekOfMonth: weekDetails.weekOfMonth,
      isActive: true
    });

    if (!weeklyPlan) {
      return res.status(404).json({
        success: false,
        message: 'No meal plan found for current week. Please generate one.',
        needsGeneration: true
      });
    }

    // In controllers/mealPlanController.js

// ... other functions ...

const toggleMealCompletion = async (req, res) => {
  try {
    const { mealType } = req.params; // 'breakfast', 'lunch', or 'dinner'
    const { isCompleted } = req.body; // true or false
    const userId = req.user.userId;

    if (!['breakfast', 'lunch', 'dinner'].includes(mealType)) {
      return res.status(400).json({ success: false, message: 'Invalid meal type.' });
    }

    const weekDetails = getWeekDetails();
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });

    // Find the current weekly plan
    const weeklyPlan = await WeeklyMealPlan.findOne({
      userId,
      year: weekDetails.year,
      month: weekDetails.month,
      weekOfMonth: weekDetails.weekOfMonth,
    });

    if (!weeklyPlan) {
      return res.status(404).json({ success: false, message: 'Weekly meal plan not found.' });
    }

    // Find today's plan within the week
    const dayPlan = weeklyPlan.days.find(day => day.day === today);
    if (!dayPlan || !dayPlan[mealType]) {
        return res.status(404).json({ success: false, message: `Meal for ${mealType} not found for today.` });
    }

    // Update the status and save
    dayPlan[mealType].isCompleted = isCompleted;
    await weeklyPlan.save();

    res.json({
      success: true,
      message: `${mealType} updated successfully.`,
      data: dayPlan[mealType]
    });

  } catch (error) {
    console.error(`❌ Error toggling meal completion for ${req.params.mealType}:`, error);
    res.status(500).json({ success: false, message: 'Server error while updating meal.' });
  }
};





    // Find today's meals
    const todaysMeals = weeklyPlan.days.find(day => day.day === today);

    if (!todaysMeals) {
      return res.status(404).json({
        success: false,
        message: `No meals found for ${today}`,
        needsGeneration: false
      });
    }

    // Collect all ingredients from all meals
    const categorizedList = {};
    const allIngredients = [];

    // Extract ingredients from each meal
    ['breakfast', 'lunch', 'dinner'].forEach(mealType => {
      const meal = todaysMeals[mealType];
      if (meal && meal.ingredients && Array.isArray(meal.ingredients)) {
        allIngredients.push(...meal.ingredients);
      }
    });

    // Categorize and deduplicate ingredients
    allIngredients.forEach(ingredient => {
      if (!ingredient || typeof ingredient !== 'string') return;
      
      const category = categorizeIngredient(ingredient);
      
      if (!categorizedList[category]) {
        categorizedList[category] = [];
      }
      
      // Check if ingredient already exists in this category (case-insensitive)
      const exists = categorizedList[category].some(
        item => item.toLowerCase() === ingredient.toLowerCase()
      );
      
      if (!exists) {
        categorizedList[category].push(ingredient);
      }
    });

    // Sort items within each category
    Object.keys(categorizedList).forEach(category => {
      categorizedList[category].sort();
    });

    // Count total items
    const totalItems = Object.values(categorizedList).reduce(
      (sum, items) => sum + items.length, 
      0
    );

    console.log(`✅ Generated grocery list with ${totalItems} items in ${Object.keys(categorizedList).length} categories`);

    res.json({
      success: true,
      data: {
        day: today,
        groceryList: categorizedList,
        totalItems,
        meals: {
          breakfast: todaysMeals.breakfast?.name,
          lunch: todaysMeals.lunch?.name,
          dinner: todaysMeals.dinner?.name
        },
        weekInfo: {
          weekOfMonth: weeklyPlan.weekOfMonth,
          weekNumber: weeklyPlan.weekNumber,
          startDate: weeklyPlan.startDate,
          endDate: weeklyPlan.endDate
        }
      }
    });

  } catch (error) {
    console.error('❌ Error generating grocery list:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate grocery list',
      message: error.message
    });
  }


  


};


const toggleMealCompletion = async (req, res) => {
  try {
    const { mealType } = req.params; // 'breakfast', 'lunch', or 'dinner'
    const { isCompleted } = req.body; // true or false
    const userId = req.user.userId;

    if (!['breakfast', 'lunch', 'dinner'].includes(mealType)) {
      return res.status(400).json({ success: false, message: 'Invalid meal type.' });
    }

    const weekDetails = getWeekDetails();
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });

    const weeklyPlan = await WeeklyMealPlan.findOne({
      userId,
      year: weekDetails.year,
      month: weekDetails.month,
      weekOfMonth: weekDetails.weekOfMonth,
    });

    if (!weeklyPlan) {
      return res.status(404).json({ success: false, message: 'Weekly meal plan not found.' });
    }

    const dayPlan = weeklyPlan.days.find(day => day.day === today);
    if (!dayPlan || !dayPlan[mealType]) {
        return res.status(404).json({ success: false, message: `Meal for ${mealType} not found for today.` });
    }

    dayPlan[mealType].isCompleted = isCompleted;
    await weeklyPlan.save();

    res.json({
      success: true,
      message: `${mealType} updated successfully.`,
      data: dayPlan[mealType]
    });

  } catch (error) {
    console.error(`❌ Error toggling meal completion for ${req.params.mealType}:`, error);
    res.status(500).json({ success: false, message: 'Server error while updating meal.' });
  }
};

const generateMealPlanInsight = async (req, res) => {
  try {
    const fastApiUrl = 'http://127.0.0.1:8000/generate-insight'; 
    const userId = req.user.userId;

    const user = await User.findById(userId).select('name preferences');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

   const weeklyPlans = await WeeklyMealPlan.find({ 
      userId: userId,
      endDate: { $gte: sevenDaysAgo } 
    });
    
    const completedMeals = [];
    weeklyPlans.forEach(plan => {
      plan.days.forEach(day => {
        ['breakfast', 'lunch', 'dinner'].forEach(mealType => {
          if (day[mealType] && day[mealType].isCompleted) {
            completedMeals.push(day[mealType]);
          }
        });
      });
    });

    if (completedMeals.length < 3) {
      return res.status(400).json({ success: false, message: 'Not enough data for an insight. Mark at least 3 meals as eaten!' });
    }

    const response = await axios.post(fastApiUrl, {
      userProfile: user.toObject(),
      completedMeals: completedMeals 
    });

    res.json(response.data);

  } catch (error) {
    console.error('❌ Error in generateMealPlanInsight:', error.message);
    if (error.isAxiosError) {
      return res.status(503).json({ success: false, message: 'The AI insight service is currently unavailable.' });
    }
    res.status(500).json({ success: false, message: 'Failed to generate insight' });
  }
};

module.exports = {
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
  toggleMealCompletion,
  generateMealPlanInsight
};
