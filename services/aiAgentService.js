// backend-service/src/services/aiAgentService.js
const axios = require('axios');

class AIAgentService {
  constructor() {
    this.baseURL = process.env.AI_AGENT_SERVICE_URL || 'http://localhost:8000';
    this.timeout = 60000; // 60 seconds
  }

  async generateMealPlan(userId, preferences, customBudget = null) {
    try {
      const response = await axios.post(
        `${this.baseURL}/api/meal-plan/generate`,
        {
          userId,
          preferences,
          customBudget,
          date: new Date().toISOString().split('T')[0]
        },
        {
          timeout: this.timeout,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('AI Agent Service Error:', error.message);
      throw new Error(`Failed to generate meal plan: ${error.message}`);
    }
  }

  async searchRecipes(criteria) {
    try {
      const response = await axios.post(
        `${this.baseURL}/api/recipes/search`,
        criteria,
        {
          timeout: this.timeout,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('Recipe Search Error:', error.message);
      throw new Error(`Failed to search recipes: ${error.message}`);
    }
  }

  async getDatasetStats() {
    try {
      const response = await axios.get(`${this.baseURL}/api/dataset/stats`, {
        timeout: this.timeout
      });

      return response.data;
    } catch (error) {
      console.error('Dataset Stats Error:', error.message);
      throw new Error(`Failed to get dataset stats: ${error.message}`);
    }
  }

  async getCuisines() {
    try {
      const response = await axios.get(`${this.baseURL}/api/cuisines`, {
        timeout: this.timeout
      });

      return response.data;
    } catch (error) {
      console.error('Cuisines Error:', error.message);
      throw new Error(`Failed to get cuisines: ${error.message}`);
    }
  }
}

module.exports = new AIAgentService();
