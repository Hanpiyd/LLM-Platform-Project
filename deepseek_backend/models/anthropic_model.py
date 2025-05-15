import logging
import os
from typing import Dict, Any, Optional
from config import ANTHROPIC_API_KEY

logger = logging.getLogger(__name__)

class AnthropicModel:
    def __init__(self, model_id :str = 'claude-3.5'):
        self.model_id = model_id
        self.api_key = ANTHROPIC_API_KEY or os.environ.get('ANTHROPIC_API_KEY')
        if not self.api_key:
            raise ValueError("Anthropic API key is not set")
        self.client = None
        self.loaded = False
        self.last_token_count = 0
        logger.info(f"Initializing Anthropic model: {model_id}")
        
    def load(self) -> None:
        if self.loaded:
            return 
        try:
            import openai
            self.client = openai.OpenAI(
                base_url="https://openrouter.ai/api/v1",
                api_key=self.api_key
            )
            self.loaded = True
            logger.info(f"Anthropic model {self.model_id} loaded successfully")
        except ImportError:
            raise ImportError("Anthropic package is not installed. Please install it with: pip install anthropic")
        except Exception as e:
            logger.error(f"Error initializing Anthropic client: {str(e)}")
            raise
    
    def unload(self) -> None:
        if not self.loaded:
            return
        self.client = None
        self.loaded = False
        logger.info(f"Anthropic model {self.model_id} unloaded")
        
    def generate(self, system_prompt: str, user_question: str, params: dict = None) -> str:
        if not self.loaded:
            raise RuntimeError(f"Anthropic model {self.model_id} is not loaded")
        try:
            messages = [{"role" : "user", "content" : system_prompt + user_question}]
            
            gen_params = {
                "model": f"anthropic/{self.model_id}",
                "messages": messages,
                "max_tokens": 4096
            }
            if params:
                if 'temperature' in params:
                    gen_params['temperature'] = float(params['temperature'])
                if 'top_p' in params:
                    gen_params['top_p'] = float(params['top_p'])
                if 'max_tokens' in params:
                    gen_params['max_tokens'] = int(params['max_tokens'])
                    
            response = self.client.chat.completions.create(**gen_params) 
            self.last_token_count = response.usage.total_tokens
            return response.choices[0].message.content
        except Exception as e:
            logger.error(f"Error calling Anthropic API: {str(e)}")
            raise RuntimeError(f"Anthropic API error: {str(e)}")