import logging
import os
from typing import Dict, Any, Optional
from config import SICILONCLOUD_API_KEY

logger = logging.getLogger(__name__)

class SCModel:
    def __init__(self, model_id : str = "Qwen/Qwen2-7B-Instruct"):
        self.model_id = model_id
        self.api_key = SICILONCLOUD_API_KEY or os.environ.get('SICILONCLOUD_API_KEY')
        if not self.api_key:
            raise ValueError("SiliconCloud API key is not set")
        self.client = None
        self.loaded = False
        self.last_token_count = 0
        logger.info(f"Initializing SiliconCloud model: {model_id}")
        
    def load(self) -> None:
        if self.loaded:
            return
        try:
            import openai
            self.client = openai.OpenAI(
                base_url="https://api.siliconflow.cn/v1",
                api_key=self.api_key
            )
            self.loaded = True
            logger.info(f"SiliconCloud model {self.model_id} loaded successfully")
        except ImportError:
            raise ImportError("OpenAI package is not installed. Please install it with: pip install openai")
        except Exception as e:
            logger.error(f"Error initializing SiliconCloud client: {str(e)}")
            raise
    
    def unload(self) -> None:
        if not self.loaded:
            return
        self.client = None
        self.loaded = False
        logger.info(f"SiliconCloud model {self.model_id} unloaded")
        
    def generate(self, system_prompt: str, user_question: str, params: dict = None) -> str:
        if not self.loaded:
            raise RuntimeError(f"SiliconCloud model {self.model_id} is not loaded")
        try:
            messages = []
            if system_prompt:
                messages.append({"role" : "user", "content" : system_prompt + user_question})
            else:
                messages.append({"role" : "user", "content" : user_question})
                
            gen_params = {
                "model": self.model_id,
                "messages": messages,
                "temperature": 0.7,
                "max_tokens": 4096
            }
            
            if params:
                if 'temperature' in params:
                    gen_params['temperature'] = float(params['temperature'])
                if 'top_p' in params:
                    gen_params['top_p'] = float(params['top_p'])
                if 'max_tokens' in params:
                    gen_params['max_tokens'] = int(params['max_tokens'])
                if 'presence_penalty' in params:
                    gen_params['presence_penalty'] = float(params['presence_penalty'])
                if 'frequency_penalty' in params:
                    gen_params['frequency_penalty'] = float(params['frequency_penalty'])
                    
            response = self.client.chat.completions.create(**gen_params)
            self.last_token_count = response.usage.total_tokens
            return response.choices[0].message.content
        except Exception as e:
            logger.error(f"Error calling SiliconCloud API: {str(e)}")
            raise RuntimeError(f"SiliconCloud API error: {str(e)}")