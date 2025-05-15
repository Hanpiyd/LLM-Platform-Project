// 后端API URLs - 在实际部署时更改为真实的API端点
const API_BASE_URL = 'http://localhost:5000';

const API_ENDPOINTS = {
  evaluation: `${API_BASE_URL}/api/evaluation`,
  generate: `${API_BASE_URL}/api/generate`,
  modelStatus: `${API_BASE_URL}/api/model/status`,
  models: `${API_BASE_URL}/api/models`,
};

// 模型状态API
export const modelStatusAPI = {
  // 加载模型
  loadModel: async (modelId, position) => {
    try {
      const response = await fetch(`${API_ENDPOINTS.modelStatus}/${modelId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'load',
          position
        })
      });
      
      if (!response.ok) {
        throw new Error(`模型加载失败: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('模型加载错误:', error);
      throw error;
    }
  },
  
  // 卸载模型
  unloadModel: async (modelId, position) => {
    try {
      const response = await fetch(`${API_ENDPOINTS.modelStatus}/${modelId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'unload',
          position
        })
      });
      
      if (!response.ok) {
        throw new Error(`模型卸载失败: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('模型卸载错误:', error);
      throw error;
    }
  }
};

// 生成回答API
export const generateAPI = {
  // 获取模型回答
  getModelResponse: async (modelId, systemPrompt, userQuestion, modelParams = null) => {
    try {
      const response = await fetch(API_ENDPOINTS.generate, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelId,
          systemPrompt,
          userQuestion,
          modelParams
        })
      });
      
      if (!response.ok) {
        throw new Error(`模型响应错误: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('获取模型回答错误:', error);
      throw error;
    }
  }
};

// 评估API
export const evaluationAPI = {
  // 提交评估
  submitEvaluation: async (evaluationData) => {
    try {
      const response = await fetch(API_ENDPOINTS.evaluation, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(evaluationData)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      return { success: true, message: result.message || '评估数据已成功记录' };
    } catch (error) {
      console.error('发送评估数据失败:', error);
      return { success: false, message: '提交评估数据失败: ' + (error.message || '未知错误') };
    }
  }
};

// 模型列表API
export const modelsAPI = {
  // 获取可用模型列表
  getModels: async () => {
    try {
      const response = await fetch(API_ENDPOINTS.models);
      
      if (!response.ok) {
        throw new Error(`获取模型列表失败: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('获取模型列表错误:', error);
      throw error;
    }
  }
};

export default {
  modelStatusAPI,
  generateAPI,
  evaluationAPI,
  modelsAPI
};