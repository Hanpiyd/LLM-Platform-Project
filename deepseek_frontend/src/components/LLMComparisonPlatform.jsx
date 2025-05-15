import React, { useState, useEffect } from 'react';
import { Send, RefreshCw, Trash, Star, CheckCircle, ArrowUpDown, AlertCircle, Settings, RotateCcw } from 'lucide-react';
import { modelStatusAPI, generateAPI, evaluationAPI, modelsAPI } from '../services/api';

// 默认提示词
const DEFAULT_PROMPT = "你是一个有用的、诚实的AI助手。请简洁地回答以下问题：";

export default function LLMComparisonPlatform() {
  // 状态定义
  const [leftModel, setLeftModel] = useState(null);
  const [rightModel, setRightModel] = useState(null);
  const [modelOptions, setModelOptions] = useState([]);
  const [localModelId, setLocalModelId] = useState(null); // 本地模型ID
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [userQuestion, setUserQuestion] = useState('');
  const [leftResponse, setLeftResponse] = useState('');
  const [rightResponse, setRightResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [leftRating, setLeftRating] = useState(0);
  const [rightRating, setRightRating] = useState(0);
  const [betterModel, setBetterModel] = useState(null); // 可以是leftModel.id, rightModel.id, 或 'tie'
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [apiStatus, setApiStatus] = useState({ success: null, message: '' });
  
  // 添加模型参数状态
  const [modelParams, setModelParams] = useState({
    left: {
      temperature: 0.7,
      top_p: 0.9,
      max_tokens: 4096,
      presence_penalty: 0,
      frequency_penalty: 0,
      thinking_mode: false
    },
    right: {
      temperature: 0.7,
      top_p: 0.9,
      max_tokens: 4096,
      presence_penalty: 0,
      frequency_penalty: 0,
      thinking_mode: false
    }
  });

  // 添加参数面板显示状态
  const [showParamsPanel, setShowParamsPanel] = useState({
    left: false,
    right: false
  });
  
  // 模型加载状态 - 仅跟踪API模型的加载状态
  const [modelLoadingStates, setModelLoadingStates] = useState({
    left: { loading: false, error: null },
    right: { loading: false, error: null }
  });

  // 新增: 刷新模型状态函数 - 确保前端状态与后端一致
  const refreshModelStatus = async () => {
    try {
      const response = await modelsAPI.getModels();
      if (response && response.success && response.models) {
        const models = response.models;
        
        // 更新两侧模型的加载状态
        for (let position of ['left', 'right']) {
          const currentModel = position === 'left' ? leftModel : rightModel;
          const currentModelId = currentModel?.id;
          
          if (currentModelId) {
            const modelInfo = models.find(m => m.id === currentModelId);
            
            // 如果模型不存在或未加载，更新UI状态
            if (!modelInfo || !modelInfo.isLoaded) {
              console.warn(`模型${currentModelId}在${position}侧未加载或已被卸载`);
              setModelLoadingStates(prev => ({
                ...prev,
                [position]: { 
                  loading: false, 
                  error: `模型${currentModelId}未加载，可能已被卸载` 
                }
              }));
            }
          }
        }
      }
    } catch (error) {
      console.error("刷新模型状态失败:", error);
    }
  };

  // 获取模型列表
  useEffect(() => {
    const loadModels = async () => {
      try {
        const response = await modelsAPI.getModels();
        if (response && response.success && response.models) {
          setModelOptions(response.models);
          
          // 找出本地模型
          const localModel = response.models.find(model => 
            model.type === 'unsloth' && model.is_local);
          
          if (localModel) {
            setLocalModelId(localModel.id);
          }
          
          // 设置默认模型 - 本地模型放在左侧，第一个API模型放在右侧
          if (response.models.length >= 2) {
            const localModelId = localModel?.id;
            const apiModelId = response.models.find(model => 
              model.id !== localModelId)?.id;
              
            if (localModelId) {
              setLeftModel(localModel);
              notifyModelChange('left', localModel, null, true);
            } else {
              setLeftModel(response.models[0]);
              notifyModelChange('left', response.models[0], null, false);
            }
            
            if (apiModelId) {
              const apiModel = response.models.find(model => model.id === apiModelId);
              setRightModel(apiModel);
              notifyModelChange('right', apiModel, null, false);
            } else {
              setRightModel(response.models[1]);
              notifyModelChange('right', response.models[1], null, false);
            }
          }
        }
      } catch (error) {
        console.error("Failed to load models:", error);
        setApiStatus({
          success: false,
          message: '加载模型列表失败'
        });
      }
    };
    
    loadModels();
    
    // 组件卸载时仅卸载API模型，本地模型保持加载
    return () => {
      if (leftModel && leftModel.id !== localModelId) {
        modelStatusAPI.unloadModel(leftModel.id, 'left')
          .catch(err => console.error('卸载左侧模型失败:', err));
      }
      if (rightModel && rightModel.id !== localModelId) {
        modelStatusAPI.unloadModel(rightModel.id, 'right')
          .catch(err => console.error('卸载右侧模型失败:', err));
      }
    };
  }, []);

  // 处理参数面板显示切换
  const toggleParamsPanel = (side) => {
    setShowParamsPanel(prev => ({
      ...prev,
      [side]: !prev[side]
    }));
  };

  // 处理参数变更
  const handleParamChange = (side, paramName, value) => {
    setModelParams(prev => ({
      ...prev,
      [side]: {
        ...prev[side],
        [paramName]: value
      }
    }));
  };

  // 重置参数到默认值
  const handleResetParams = (side) => {
    setModelParams(prev => ({
      ...prev,
      [side]: {
        temperature: 0.7,
        top_p: 0.9,
        max_tokens: 4096,
        presence_penalty: 0,
        frequency_penalty: 0,
        thinking_mode: false
      }
    }));
  };

  // 处理模型选择变更，区分本地模型和API模型
  const notifyModelChange = async (side, newModel, oldModel, isLocal = false) => {
    if (!newModel || (oldModel && newModel.id === oldModel.id)) return;

    // 本地模型不需要显示加载状态，只需通知后端更新位置
    if (isLocal || newModel.id === localModelId) {
      try {
        await modelStatusAPI.loadModel(newModel.id, side);
        // 更新后刷新状态
        await refreshModelStatus();
      } catch (error) {
        console.error(`${side}侧本地模型位置更新错误:`, error);
        setModelLoadingStates(prev => ({
          ...prev,
          [side]: { loading: false, error: error.message || '本地模型更新失败' }
        }));
      }
      return;
    }

    // 更新加载状态
    setModelLoadingStates(prev => ({
      ...prev,
      [side]: { loading: true, error: null }
    }));

    try {
      // 卸载旧模型
      if (oldModel && oldModel.id !== localModelId) {
        await modelStatusAPI.unloadModel(oldModel.id, side);
      }

      // 加载新模型
      const response = await modelStatusAPI.loadModel(newModel.id, side);
      
      // 检查响应状态
      if (!response || !response.success) {
        throw new Error(response?.message || "模型加载失败");
      }

      // 成功加载模型
      setModelLoadingStates(prev => ({
        ...prev,
        [side]: { loading: false, error: null }
      }));
      
      // 刷新所有模型状态，确保前后端一致
      await refreshModelStatus();
    } catch (error) {
      console.error(`${side}侧模型切换错误:`, error);
      
      // 错误处理 - 恢复之前的模型状态
      if (side === 'left') {
        setLeftModel(oldModel);
      } else {
        setRightModel(oldModel);
      }
      
      setModelLoadingStates(prev => ({
        ...prev,
        [side]: { loading: false, error: error.message || '模型加载失败' }
      }));
    }
  };

  // 处理左侧模型变化
  // 在LLMComparisonPlatform.jsx中修改handleLeftModelChange函数
const handleLeftModelChange = (newModelId) => {
  const oldModel = leftModel;
  const newModel = modelOptions.find(model => model.id === newModelId);
  
  // 检查右侧是否已加载相同模型
  if (rightModel && rightModel.id === newModelId) {
    // 显示警告，右侧模型将被卸载
    setApiStatus({
      success: false,
      message: `模型${newModel.name}已在右侧加载，将优先在左侧使用`
    });
    
    // 重置右侧模型，避免两侧使用同一模型
    setRightModel(null);
    setModelLoadingStates(prev => ({
      ...prev,
      right: { loading: false, error: null }
    }));
  }
  
  setLeftModel(newModel);
  notifyModelChange('left', newModel, oldModel, newModel.id === localModelId);
};

// 同样修改handleRightModelChange函数
const handleRightModelChange = (newModelId) => {
  const oldModel = rightModel;
  const newModel = modelOptions.find(model => model.id === newModelId);
  
  // 检查左侧是否已加载相同模型
  if (leftModel && leftModel.id === newModelId) {
    // 显示警告，左侧模型将被卸载
    setApiStatus({
      success: false,
      message: `模型${newModel.name}已在左侧加载，将优先在右侧使用`
    });
    
    // 重置左侧模型，避免两侧使用同一模型
    setLeftModel(null);
    setModelLoadingStates(prev => ({
      ...prev,
      left: { loading: false, error: null }
    }));
  }
  
  setRightModel(newModel);
  notifyModelChange('right', newModel, oldModel, newModel.id === localModelId);
};

  // 创建模型参数控制面板组件
  const ModelParamsPanel = ({ side, params, onChange, isLocalModel }) => {
    return (
      <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <h3 className="text-md font-medium mb-3">模型参数设置</h3>
        
        <div className="space-y-3">
          {/* Temperature 参数 */}
          <div>
            <div className="flex justify-between mb-1">
              <label className="text-sm text-gray-600">Temperature</label>
              <span className="text-sm font-medium">{params.temperature.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0"
              max="2"
              step="0.01"
              value={params.temperature}
              onChange={(e) => onChange(side, 'temperature', parseFloat(e.target.value))}
              className={`w-full ${side === 'left' ? 'accent-blue-600' : 'accent-purple-600'}`}
              disabled={isLocalModel}
            />
            <p className="text-xs text-gray-500 mt-1">
              较低的值使输出更确定，较高的值使输出更随机多样
            </p>
          </div>
          
          {/* Top P 参数 */}
          <div>
            <div className="flex justify-between mb-1">
              <label className="text-sm text-gray-600">Top P</label>
              <span className="text-sm font-medium">{params.top_p.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={params.top_p}
              onChange={(e) => onChange(side, 'top_p', parseFloat(e.target.value))}
              className={`w-full ${side === 'left' ? 'accent-blue-600' : 'accent-purple-600'}`}
              disabled={isLocalModel}
            />
            <p className="text-xs text-gray-500 mt-1">
              控制输出的多样性，较低的值使输出更确定
            </p>
          </div>
          
          {/* 最大输出 Tokens */}
          <div>
            <div className="flex justify-between mb-1">
              <label className="text-sm text-gray-600">最大输出长度</label>
              <span className="text-sm font-medium">{params.max_tokens}</span>
            </div>
            <input
              type="range"
              min="256"
              max="8192"
              step="256"
              value={params.max_tokens}
              onChange={(e) => onChange(side, 'max_tokens', parseInt(e.target.value))}
              className={`w-full ${side === 'left' ? 'accent-blue-600' : 'accent-purple-600'}`}
              disabled={isLocalModel}
            />
            <p className="text-xs text-gray-500 mt-1">
              控制生成回答的最大长度
            </p>
          </div>

          <div className="border-t border-gray-200 pt-3 mt-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2 text-amber-500"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></svg>
              <label className="text-sm font-medium text-gray-700">思考模式</label>
            </div>
            <div className="relative inline-block w-12 align-middle select-none">
              <input
                type="checkbox"
                name={`thinking-mode-${side}`}
                id={`thinking-mode-${side}`}
                checked={params.thinking_mode}
                onChange={(e) => onChange(side, 'thinking_mode', e.target.checked)}
                className="sr-only"
                disabled={isLocalModel}
              />
              <label
                htmlFor={`thinking-mode-${side}`}
                className={`block h-6 overflow-hidden rounded-full cursor-pointer transition-colors duration-200 ease-in ${
                  params.thinking_mode 
                  ? side === 'left' ? 'bg-blue-500' : 'bg-purple-500' 
                  : 'bg-gray-300'
                } ${isLocalModel ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <span
                  className={`block h-6 w-6 rounded-full bg-white shadow transform transition-transform duration-200 ease-in ${
                    params.thinking_mode ? 'translate-x-6' : 'translate-x-0'
                  }`}
                ></span>
              </label>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            启用后模型会先思考再回答，提高复杂问题的准确性（仅限Qwen3系列模型）
          </p>
        </div>
          
          {/* 重置按钮 */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => handleResetParams(side)}
              className={`px-3 py-1 text-sm rounded-md text-white ${
                side === 'left' ? 'bg-blue-500 hover:bg-blue-600' : 
                'bg-purple-500 hover:bg-purple-600'
              }`}
              disabled={isLocalModel}
            >
              重置为默认值
            </button>
          </div>
        </div>
      </div>
    );
  };

  // 渲染模型选择器 - 包含参数控制面板
  const renderModelSelector = (side, model, handleChange, loadingState) => {
    const isLocalModel = model?.id === localModelId;
    
    return (
      <div>
        <h2 className={`text-xl font-semibold mb-4 text-center ${
          side === 'left' ? 'text-blue-600' : 'text-purple-600'
        }`}>模型 {side === 'left' ? 'A' : 'B'}</h2>
        
        <div className="mb-3 text-xs text-gray-500 text-center">
          注意：同一模型只能在左侧或右侧加载，不能同时在两侧使用
        </div>

        <div className="relative">
          <select
            value={model?.id || ''}
            onChange={(e) => handleChange(e.target.value)}
            disabled={!isLocalModel && loadingState.loading || !modelOptions.length}
            className={`w-full p-4 border rounded-lg appearance-none focus:ring-2 focus:border-transparent cursor-pointer text-center
              ${!isLocalModel && loadingState.loading 
                ? 'bg-gray-100 text-gray-500 border-gray-300' 
                : loadingState.error
                  ? 'bg-red-50 text-red-800 border-red-200 focus:ring-red-500'
                  : side === 'left'
                    ? 'bg-blue-50 text-blue-800 border-blue-200 focus:ring-blue-500'
                    : 'bg-purple-50 text-purple-800 border-purple-200 focus:ring-purple-500'
              }`}
          >
            {!modelOptions.length && <option value="">加载中...</option>}
            {modelOptions.map(modelOption => {
              const isLoadedInOtherSide = side === 'left' 
                ? rightModel?.id === modelOption.id 
                : leftModel?.id === modelOption.id;
                
              return (
                <option 
                  key={modelOption.id} 
                  value={modelOption.id}
                  disabled={isLoadedInOtherSide && modelOption.id !== model?.id}
                >
                  {modelOption.name} 
                  {modelOption.id === localModelId ? '(本地)' : ''}
                  {isLoadedInOtherSide && modelOption.id !== model?.id ? ' (已在另一侧加载)' : ''}
                </option>
              );
            })}
          </select>
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
            {!isLocalModel && loadingState.loading ? (
              <RefreshCw size={18} className="text-gray-500 animate-spin" />
            ) : loadingState.error ? (
              <AlertCircle size={18} className="text-red-500" />
            ) : (
              <svg className={`w-5 h-5 ${side === 'left' ? 'text-blue-600' : 'text-purple-600'}`} fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd"></path>
              </svg>
            )}
          </div>
        </div>
        
        {/* 只为非本地模型显示加载状态 */}
        {!isLocalModel && loadingState.loading && (
          <p className="mt-2 text-sm text-gray-600 flex items-center justify-center">
            <RefreshCw size={14} className="animate-spin mr-1" /> 模型加载中...
          </p>
        )}
        {loadingState.error && (
          <p className="mt-2 text-sm text-red-600 flex items-center justify-center">
            <AlertCircle size={14} className="mr-1" /> {loadingState.error}
          </p>
        )}
        
        {/* 添加参数控制按钮 */}
        <div className="mt-3 flex justify-center">
          <button
            type="button"
            onClick={() => toggleParamsPanel(side)}
            className={`px-3 py-1 text-sm rounded-md border flex items-center ${
              showParamsPanel[side] 
                ? `${side === 'left' ? 'bg-blue-100 border-blue-300' : 'bg-purple-100 border-purple-300'}` 
                : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
            }`}
            disabled={(isLocalModel) || (!model)}
          >
            <Settings size={14} className="mr-1" />
            {isLocalModel 
              ? '本地模型参数固定' 
              : showParamsPanel[side] ? '隐藏参数设置' : '高级参数设置'}
          </button>
        </div>
        
        {/* 参数面板 */}
        {showParamsPanel[side] && !(!model) && (
          <ModelParamsPanel 
            side={side} 
            params={modelParams[side]} 
            onChange={handleParamChange}
            isLocalModel={isLocalModel}
          />
        )}
      </div>
    );
  };

  // 处理提交问题
  const handleSubmit = async () => {
    if (!userQuestion.trim()) return;
    
    // 新增：在提交前刷新模型状态，确保前后端一致
    await refreshModelStatus();
    
    // 新增更强的验证逻辑
    if (!leftModel || !rightModel) {
      setApiStatus({
        success: false,
        message: '请先选择两侧模型'
      });
      return;
    }
    
    // 确保没有模型正在加载或加载失败
    if (modelLoadingStates.left.loading || modelLoadingStates.right.loading) {
      setApiStatus({
        success: false,
        message: '请等待模型完成加载'
      });
      return;
    }
    
    if (modelLoadingStates.left.error || modelLoadingStates.right.error) {
      setApiStatus({
        success: false,
        message: '模型加载失败，请重新选择模型'
      });
      return;
    }
    
    setIsLoading(true);
    setLeftResponse('');
    setRightResponse('');
    setLeftRating(0);
    setRightRating(0);
    setBetterModel(null);
    setFeedbackSubmitted(false);
    setApiStatus({ success: null, message: '' });
    
    try {      
      // 使用API服务发送请求，包含参数
      const [leftResult, rightResult] = await Promise.all([
        generateAPI.getModelResponse(
          leftModel.id, 
          prompt, 
          userQuestion, 
          leftModel.id === localModelId ? null : modelParams.left
        ),
        generateAPI.getModelResponse(
          rightModel.id, 
          prompt, 
          userQuestion, 
          rightModel.id === localModelId ? null : modelParams.right
        )
      ]);
      
      // 设置响应
      if (leftResult.success) {
        setLeftResponse(leftResult.response);
      } else {
        throw new Error(leftResult.message || '左侧模型响应错误');
      }
      
      if (rightResult.success) {
        setRightResponse(rightResult.response);
      } else {
        throw new Error(rightResult.message || '右侧模型响应错误');
      }
    } catch (error) {
      console.error("Error calling model API:", error);
      setApiStatus({
        success: false,
        message: error.message || '获取模型回复时出错'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // 重置所有内容
  const handleReset = () => {
    setPrompt(DEFAULT_PROMPT);
    setUserQuestion('');
    setLeftResponse('');
    setRightResponse('');
    setLeftRating(0);
    setRightRating(0);
    setBetterModel(null);
    setFeedbackSubmitted(false);
    setApiStatus({ success: null, message: '' });
  };

  // 提交评价
  const handleFeedbackSubmit = async () => {
    if (!leftRating || !rightRating || !betterModel) return;

    try {
      // 收集评估数据
      const evaluationData = {
        timestamp: new Date().toISOString(),
        systemPrompt: prompt,
        userQuestion: userQuestion,
        models: {
          left: {
            id: leftModel.id,
            name: leftModel.name,
            response: leftResponse,
            rating: leftRating,
            params: leftModel.id === localModelId ? "默认参数" : modelParams.left
          },
          right: {
            id: rightModel.id,
            name: rightModel.name,
            response: rightResponse,
            rating: rightRating,
            params: rightModel.id === localModelId ? "默认参数" : modelParams.right
          }
        },
        preference: betterModel // 'left模型ID', 'right模型ID', 或 'tie'
      };
      
      // 使用API服务发送评估
      const result = await evaluationAPI.submitEvaluation(evaluationData);
      setApiStatus(result);
      setFeedbackSubmitted(true);
    } catch (error) {
      console.error('提交评价失败:', error);
      setApiStatus({
        success: false,
        message: '提交评价失败: ' + (error.message || '未知错误')
      });
    }
  };

  // 渲染星级评分
  const renderStars = (rating, setRating, disabled = false) => {
    return (
      <div className="flex space-x-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            disabled={disabled}
            onClick={() => setRating(star)}
            className={`focus:outline-none transition-all ${
              disabled ? 'cursor-not-allowed opacity-70' : 'hover:scale-110'
            }`}
          >
            <Star
              size={24}
              className={`${
                star <= rating
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'text-gray-300'
              } transition-colors`}
            />
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* 头部 */}
      <header className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white p-6 shadow-xl">
        <div className="container mx-auto text-center">
          <h1 className="text-3xl font-bold mb-2">大模型比较平台</h1>
          <p className="text-lg opacity-90">直观比较不同大语言模型的性能和回答质量</p>
        </div>
      </header>

      {/* 主要内容区 */}
      <main className="container mx-auto p-6 flex-grow">
        <div className="bg-white rounded-xl shadow-xl p-8 transition-all hover:shadow-2xl">
          {/* 模型选择区 - 使用新的渲染函数 */}
          <div className="mb-8 grid grid-cols-2 gap-10">
            {renderModelSelector('left', leftModel, handleLeftModelChange, modelLoadingStates.left)}
            {renderModelSelector('right', rightModel, handleRightModelChange, modelLoadingStates.right)}
          </div>

          {/* 输入区 */}
          <div className="mb-8">
            <div className="mb-6">
              <label className="block text-gray-700 text-lg font-medium mb-2">
                提示词（Prompt）
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows="3"
                className="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-gray-700"
                placeholder="输入提示词..."
              />
            </div>
            
            <div className="mb-6">
              <label className="block text-gray-700 text-lg font-medium mb-2">
                用户问题
              </label>
              <textarea
                value={userQuestion}
                onChange={(e) => setUserQuestion(e.target.value)}
                placeholder="输入您的问题..."
                rows="2"
                className="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-gray-700"
              />
            </div>
            
            <div className="flex justify-between">
              <button
                type="button"
                onClick={handleReset}
                className="flex items-center px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-all"
              >
                <Trash size={18} className="mr-2" /> 重置
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isLoading || !userQuestion.trim() || modelLoadingStates.left.loading || modelLoadingStates.right.loading || !leftModel || !rightModel}
                className={`flex items-center px-8 py-3 rounded-lg transition-all ${
                  isLoading || !userQuestion.trim() || modelLoadingStates.left.loading || modelLoadingStates.right.loading || !leftModel || !rightModel
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                    : 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:shadow-lg hover:opacity-90'
                }`}
              >
                {isLoading ? (
                  <>
                    <RefreshCw size={18} className="mr-2 animate-spin" /> 处理中...
                  </>
                ) : (
                  <>
                    <Send size={18} className="mr-2" /> 提交
                  </>
                )}
              </button>
            </div>
            
            {/* API状态消息 */}
            {apiStatus.success === false && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center">
                <AlertCircle size={18} className="mr-2 flex-shrink-0" />
                <span>{apiStatus.message}</span>
              </div>
            )}
          </div>

          {/* 响应显示区 */}
          <div className="grid grid-cols-2 gap-8 mb-8">
            <div className="rounded-xl shadow-md overflow-hidden border border-blue-100 transition-all hover:shadow-lg">
              <div className="bg-blue-50 p-4 border-b border-blue-100">
                <h3 className="text-xl font-semibold text-blue-700">{leftModel?.name || '模型A'} 回复</h3>
                {leftResponse && !isLoading && (
                  <div className="mt-1 text-xs text-blue-600 flex flex-wrap items-center gap-2">
                    {leftModel?.id === localModelId ? 
                      <span>使用本地模型默认参数</span> : 
                      <>
                        <span>Temperature: {modelParams.left.temperature.toFixed(2)}</span>
                        <span>• Top P: {modelParams.left.top_p.toFixed(2)}</span>
                        {modelParams.left.thinking_mode && 
                          <span className="flex items-center font-medium">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1 text-amber-500"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></svg>
                            思考模式已启用
                          </span>
                        }
                      </>
                    }
                  </div>
                )}
              </div>
              <div className="p-5 min-h-64 bg-white">
                {isLoading ? (
                  <div className="flex justify-center items-center h-full text-gray-400">
                    <RefreshCw size={24} className="animate-spin mr-2" /> 生成中...
                  </div>
                ) : leftResponse ? (
                  <p className="whitespace-pre-wrap text-gray-800">{leftResponse}</p>
                ) : (
                  <div className="flex justify-center items-center h-full text-gray-400">
                    模型响应将显示在这里
                  </div>
                )}
              </div>
            </div>
            
            <div className="rounded-xl shadow-md overflow-hidden border border-purple-100 transition-all hover:shadow-lg">
              <div className="bg-purple-50 p-4 border-b border-purple-100">
                <h3 className="text-xl font-semibold text-purple-700">{rightModel?.name || '模型B'} 回复</h3>
                {rightResponse && !isLoading && (
                  <div className="mt-1 text-xs text-purple-600 flex flex-wrap items-center gap-2">
                    {rightModel?.id === localModelId ? 
                      <span>使用本地模型默认参数</span> : 
                      <>
                        <span>Temperature: {modelParams.right.temperature.toFixed(2)}</span>
                        <span>• Top P: {modelParams.right.top_p.toFixed(2)}</span>
                        {modelParams.right.thinking_mode && 
                          <span className="flex items-center font-medium">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1 text-amber-500"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></svg>
                            思考模式已启用
                          </span>
                        }
                      </>
                    }
                  </div>
                )}
              </div>
              <div className="p-5 min-h-64 bg-white">
                {isLoading ? (
                  <div className="flex justify-center items-center h-full text-gray-400">
                    <RefreshCw size={24} className="animate-spin mr-2" /> 生成中...
                  </div>
                ) : rightResponse ? (
                  <p className="whitespace-pre-wrap text-gray-800">{rightResponse}</p>
                ) : (
                  <div className="flex justify-center items-center h-full text-gray-400">
                    模型响应将显示在这里
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 模型评分区域 - 总是显示 */}
          <div className="border-t border-gray-200 pt-6 mt-6">
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-6 rounded-lg mb-6">
              <h3 className="text-2xl font-bold mb-4 text-center text-gray-800">模型回答评分系统</h3>
              <p className="text-center text-gray-600 mb-6">为两个模型的回答评分并选择您认为更好的一个</p>
            </div>
            
            <div className="grid grid-cols-2 gap-8 mb-8">
              <div className="bg-blue-50 p-6 rounded-lg border border-blue-100 shadow-md">
                <h4 className="text-lg font-medium mb-4 text-blue-700">{leftModel?.name || '模型A'} 评分</h4>
                <div className="flex justify-center mb-2">
                  {renderStars(leftRating, setLeftRating, feedbackSubmitted)}
                </div>
                <p className="text-center text-sm text-blue-600 mt-2">
                  {leftRating > 0 ? `您给 ${leftModel?.name || '模型A'} 的评分: ${leftRating} 星` : "请为此模型评分"}
                </p>
              </div>
              
              <div className="bg-purple-50 p-6 rounded-lg border border-purple-100 shadow-md">
                <h4 className="text-lg font-medium mb-4 text-purple-700">{rightModel?.name || '模型B'} 评分</h4>
                <div className="flex justify-center mb-2">
                  {renderStars(rightRating, setRightRating, feedbackSubmitted)}
                </div>
                <p className="text-center text-sm text-purple-600 mt-2">
                  {rightRating > 0 ? `您给 ${rightModel?.name || '模型B'} 的评分: ${rightRating} 星` : "请为此模型评分"}
                </p>
              </div>
            </div>
            
            <div className="bg-gray-50 p-6 rounded-lg border border-gray-200 mb-6 shadow-md">
              <h4 className="text-lg font-medium mb-4 text-center text-gray-800">您认为哪个模型的回答更好？</h4>
              <div className="flex flex-wrap justify-center gap-4">
                <label className={`flex items-center p-4 rounded-lg cursor-pointer ${
                  betterModel === leftModel?.id ? 'bg-blue-100 border-2 border-blue-500' : 'bg-white border border-gray-200'
                } transition-all ${feedbackSubmitted ? 'cursor-not-allowed opacity-70' : 'hover:bg-blue-50'}`}>
                  <input
                    type="radio"
                    value={leftModel?.id}
                    checked={betterModel === leftModel?.id}
                    onChange={() => !feedbackSubmitted && leftModel && setBetterModel(leftModel.id)}
                    className="hidden"
                    disabled={feedbackSubmitted || !leftModel}
                  />
                  <div className="w-6 h-6 rounded-full border border-blue-600 flex items-center justify-center mr-3">
                    {betterModel === leftModel?.id && (
                      <div className="w-4 h-4 rounded-full bg-blue-600"></div>
                    )}
                  </div>
                  <span className="text-lg">{leftModel?.name || '模型A'} 更好</span>
                </label>
                
                <label className={`flex items-center p-4 rounded-lg cursor-pointer ${
                  betterModel === rightModel?.id ? 'bg-purple-100 border-2 border-purple-500' : 'bg-white border border-gray-200'
                } transition-all ${feedbackSubmitted ? 'cursor-not-allowed opacity-70' : 'hover:bg-purple-50'}`}>
                  <input
                    type="radio"
                    value={rightModel?.id}
                    checked={betterModel === rightModel?.id}
                    onChange={() => !feedbackSubmitted && rightModel && setBetterModel(rightModel.id)}
                    className="hidden"
                    disabled={feedbackSubmitted || !rightModel}
                  />
                  <div className="w-6 h-6 rounded-full border border-purple-600 flex items-center justify-center mr-3">
                    {betterModel === rightModel?.id && (
                      <div className="w-4 h-4 rounded-full bg-purple-600"></div>
                    )}
                  </div>
                  <span className="text-lg">{rightModel?.name || '模型B'} 更好</span>
                </label>
                
                {/* 平局选项 */}
                <label className={`flex items-center p-4 rounded-lg cursor-pointer ${
                  betterModel === 'tie' ? 'bg-amber-100 border-2 border-amber-500' : 'bg-white border border-gray-200'
                } transition-all ${feedbackSubmitted ? 'cursor-not-allowed opacity-70' : 'hover:bg-amber-50'}`}>
                  <input
                    type="radio"
                    value="tie"
                    checked={betterModel === 'tie'}
                    onChange={() => !feedbackSubmitted && setBetterModel('tie')}
                    className="hidden"
                    disabled={feedbackSubmitted}
                  />
                  <div className="w-6 h-6 rounded-full border border-amber-600 flex items-center justify-center mr-3">
                    {betterModel === 'tie' && (
                      <div className="w-4 h-4 rounded-full bg-amber-600"></div>
                    )}
                  </div>
                  <span className="text-lg flex items-center">
                    <ArrowUpDown size={16} className="mr-1" />平局
                  </span>
                </label>
              </div>
            </div>
            
            <div className="flex justify-center mt-8">
              {feedbackSubmitted ? (
                <div className={`flex items-center p-4 rounded-lg ${
                  apiStatus.success 
                    ? 'bg-green-100 text-green-700 border border-green-200' 
                    : 'bg-red-100 text-red-700 border border-red-200'
                }`}>
                  {apiStatus.success ? (
                    <CheckCircle size={20} className="mr-2" />
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="12" y1="8" x2="12" y2="12"></line>
                      <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                  )}
                  {apiStatus.message || (apiStatus.success ? '评价已提交，感谢您的反馈！' : '提交失败，请重试')}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleFeedbackSubmit}
                  disabled={!leftRating || !rightRating || !betterModel || !leftResponse || !rightResponse}
                  className={`px-8 py-3 rounded-lg transition-all ${
                    !leftRating || !rightRating || !betterModel || !leftResponse || !rightResponse
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                      : 'bg-gradient-to-r from-green-500 to-teal-500 text-white hover:shadow-lg'
                  }`}
                >
                  提交评价
                </button>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* 底部 */}
      <footer className="bg-gray-800 text-white p-6 text-center">
        <p className="text-lg">大模型比较平台 &copy; {new Date().getFullYear()}</p>
        <p className="text-sm text-gray-400 mt-2">探索人工智能的未来</p>
      </footer>
    </div>
  );
}