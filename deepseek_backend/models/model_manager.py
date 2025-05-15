import os
import json
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

class ModelManager:
    _instance = None
    
    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = ModelManager()
        return cls._instance
    
    def __init__(self):
        if ModelManager._instance is not None:
            return 
        self.loaded_models = {}
        self.positions = {
            'left' : None,
            'right' : None
        }
        self.local_model_id = None
        from config import MODEL_CONFIG_PATH
        self.available_models = self._load_models_config(MODEL_CONFIG_PATH) 
        
        for model_id, model_info in self.available_models.items():
            if model_info.get('type') == 'unsloth' and model_info.get('is_local', False):
                self.local_model_id = model_id
                self.load_local_model()
                break
    
        logger.info(f"ModelManager initialized with {len(self.available_models)} available models")
        
    def _load_models_config(self, config_path : str) -> Dict[str, Dict[str, Any]]:
        if not os.path.exists(config_path):
            default_config = {
                'gpt-4o': {
                    'name': 'GPT-4o',
                    'description': 'OpenAI的GPT-4o模型',
                    'type': 'api',
                    'api_provider': 'openai',
                    'model_id': 'gpt-4o'
                },
                'claude-3.5': {
                    'name': 'Claude-3.5',
                    'description': 'Anthropic的Claude-3.5模型',
                    'type': 'api',
                    'api_provider': 'anthropic',
                    'model_id': 'claude-3.5'
                },
                'qwen2.5-7B': {
                    'name': 'Qwen2.5-7B',
                    'description': 'Tongyi的Qwen2.5-7B模型',
                    'type': 'unsloth',
                    'model_path': 'qwen/Qwen2.5-7B-instruct',
                    'max_seq_length': 4096,
                    'load_in_4bit': True,
                    'is_local' : True
                }
            } 
            
            with open(config_path, 'w', encoding = 'utf-8') as f:
                json.dump(default_config, f, ensure_ascii=False, indent=2)
            
            return default_config
        
        else:
            try:
                with open(config_path, "r", encoding = 'utf-8') as f:
                    return json.load(f)
            except json.JSONDecodeError as e:
                logger.error(f"Error loading models config: {str(e)}")
                return {} 
    
    def load_local_model(self):
        if not self.local_model_id:
            logger.warning("No local model configured")
            return
        
        model_id = self.local_model_id
        model_info = self.available_models[model_id]
        try:
            from models.unsloth_model import UnslothModel
            model = UnslothModel(
                model_name = model_info.get('model_path'),
                model_config = {
                    'max_seq_length': model_info.get('max_seq_length', 8192),
                    'load_in_4bit': model_info.get('load_in_4bit', True),
                    'dtype': model_info.get('dtype', 'bfloat16'),
                    'max_new_tokens': model_info.get('max_new_tokens', 4096),
                    'temperature': model_info.get('temperature', 0.7),
                    'top_p': model_info.get('top_p', 0.9)
                }
            )
            model.load()
            self.loaded_models[model_id] = model
            logger.info(f"Local model {model_id} loaded successfully")
        except Exception as e:
            logger.error(f"Failed to load local model: {str(e)}")
            raise
            
    def load_model(self, model_id : str, position : str) -> None:
        if model_id not in self.available_models:
            raise ValueError(f"Unknown model: {model_id}")
        
        if model_id == self.local_model_id:
            old_model_id = self.positions[position]
            self.positions[position] = model_id
            logger.info(f"Local model {model_id} assigned to position {position}")
            return
        
        if model_id in self.loaded_models:
            logger.info(f"Model {model_id} already loaded, updating position to {position}")
            
        else:
            model_info = self.available_models[model_id]
            logger.info(f"Loading model {model_id} ({model_info['name']})...")
            model_type = model_info.get('type', 'api')    
            if model_type == 'unsloth':
                from models.unsloth_model import UnslothModel
                model = UnslothModel(
                    model_name = model_info.get('model_path'),
                    model_config={
                        'max_seq_length': model_info.get('max_seq_length', 8192),
                        'load_in_4bit': model_info.get('load_in_4bit', True),
                        'dtype': model_info.get('dtype', 'bfloat16'),
                        'max_new_tokens': model_info.get('max_new_tokens', 4096),
                        'temperature': model_info.get('temperature', 0.7),
                        'top_p': model_info.get('top_p', 0.9)
                    }
                )
            elif model_type == 'api':
                api_provider = model_info.get('api_provider')
                if api_provider == 'openai':
                    from models.openai_model import OpenAIModel
                    model = OpenAIModel(model_info.get('model_id', 'gpt-4o'))    
                elif api_provider == 'anthropic':
                    from models.anthropic_model import AnthropicModel
                    model = AnthropicModel(model_info.get('model_id', 'claude-3.5')) 
                elif api_provider == 'siliconcloud':
                    from models.siliconcloud_model import SCModel
                    model = SCModel(model_info.get('model_id', 'Qwen/Qwen2-7B-Instruct'))
                else:
                    raise ValueError(f"Unknown API provider: {api_provider}")
            else:
                raise ValueError(f"Unknown model type: {model_type}")
            model.load()
            self.loaded_models[model_id] = model
            logger.info(f"Model {model_id} loaded successfully")
        
        old_model_id = self.positions[position]
        if old_model_id and old_model_id != model_id:
            if old_model_id != self.local_model_id:
                self.unload_model(old_model_id, position)
                
        self.positions[position] = model_id
        
    def unload_model(self, model_id : str, position : str = None) -> None:
        """卸载模型，可选指定从哪个位置卸载"""
        if model_id == self.local_model_id:
            logger.info(f"Skipping unload for local model {model_id}")
            return
        
        if model_id not in self.loaded_models:
            logger.warning(f"Model {model_id} is not loaded")
            return
        
        # 如果指定了位置，只清除该位置的模型引用
        if position:
            if self.positions[position] == model_id:
                self.positions[position] = None
                logger.info(f"Removed model {model_id} reference from {position} position")
            else:
                logger.warning(f"Model {model_id} not found in {position} position")
        else:
            # 如果未指定位置，清除所有引用（原来的行为）
            for pos, mid in list(self.positions.items()):
                if mid == model_id:
                    self.positions[pos] = None
        
        # 检查模型是否仍在其他位置使用
        still_in_use = False
        for pos, mid in self.positions.items():
            if mid == model_id:
                still_in_use = True
                break
                
        # 只有当模型不再被任何位置使用时，才真正卸载
        if not still_in_use:
            model = self.loaded_models[model_id]
            try:
                logger.info(f"Unloading model {model_id}...")
                model.unload()
                del self.loaded_models[model_id]
                logger.info(f"Model {model_id} unloaded successfully")
            except Exception as e:
                logger.error(f"Error unloading model {model_id}: {str(e)}")
                raise
        else:
            logger.info(f"Model {model_id} still in use by another position, keeping it loaded")
        
    def get_model(self, model_id : str) -> Any:
        if model_id not in self.loaded_models:
            raise ValueError(f"Model {model_id} is not loaded")
        return self.loaded_models[model_id]
    
    def is_model_loaded(self, model_id: str) -> bool:
        return model_id in self.loaded_models
    
    def get_model_position(self, model_id : str) -> Optional[str]:
        for pos, mid in self.positions.items():
            if mid == model_id:
                return pos
            
        return None
    
    def get_model_at_position(self, position: str) -> Optional[str]:
        return self.positions.get(position)
    
    def get_available_models(self) -> Dict[str, Dict[str, Any]]:
        return self.available_models