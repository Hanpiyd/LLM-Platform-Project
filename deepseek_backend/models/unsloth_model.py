import gc
import torch
import logging
from typing import Optional, Dict, Any
from config import DEFAULT_MAX_NEW_TOKENS, DEFAULT_TEMPERATURE, DEFAULT_TOP_P

logger = logging.getLogger(__name__)

class UnslothModel:
    def __init__(self, model_name: str, model_config: Dict[str, Any] = None):
        self.model_name = model_name
        self.config = model_config or {}
        self.loaded = False
        self.model = None
        self.tokenizer = None
        self.last_token_count = 0
        logger.info(f"Initializing Unsloth model: {model_name}")
        
    def load(self) ->None:
        if self.loaded:
            logger.info(f"Model {self.model_name} already loaded")
            return
        try:
            logger.info(f"Loading model {self.model_name} with Unsloth...")
            try:
                from unsloth import FastLanguageModel
            except ImportError:
                raise ImportError("Unsloth package is not installed. Please install it with: pip install unsloth")
            max_seq_length = self.config.get("max_seq_length", 8192)
            dtype_str = self.config.get("dtype", "bfloat16")
            if dtype_str == "bfloat16":
                dtype = torch.bfloat16
            elif dtype_str == "float16":
                dtype = torch.float16
            elif dtype_str == "float32":
                dtype = torch.float32
            else:
                dtype = torch.bfloat16
                
            load_in_4bit = self.config.get("load_in_4bit", True)
            self.model, self.tokenizer = FastLanguageModel.from_pretrained(
                model_name = self.model_name,
                max_seq_length = max_seq_length,
                dtype=dtype,
                load_in_4bit=load_in_4bit
            )
            self.model = FastLanguageModel.get_peft_model(
                self.model,
                r=self.config.get("lora_r", 16),
                target_modules=self.config.get("target_modules", ["q_proj", "k_proj", "v_proj", "o_proj"]),
                lora_alpha=self.config.get("lora_alpha", 16),
                lora_dropout=self.config.get("lora_dropout", 0)
            )
            self.loaded = True
            logger.info(f"Model {self.model_name} loaded successfully")
        except Exception as e:
            logger.error(f"Error loading model {self.model_name}: {str(e)}")
            self.unload()
            raise
        
    def unload(self) -> None:
        if not self.loaded:
            logger.info(f"Model {self.model_name} is not loaded")
            return
        
        logger.info(f"Unloading model {self.model_name}...")
        
        try:
            del self.model
            del self.tokenizer
            self.model = None
            self.tokenizer = None
            gc.collect()
            
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
                torch.cuda.synchronize()
            self.loaded = False
            logger.info(f"Model {self.model_name} unloaded successfully")
        except Exception as e:
            logger.error(f"Error unloading model {self.model_name}: {str(e)}")
            raise
        
    def generate(self, system_prompt: str, user_question: str, params: dict = None) -> str:
        if not self.loaded:
            raise RuntimeError(f"Model {self.model_name} is not loaded")
        try:
            if system_prompt:
                prompt = f"{system_prompt}\n\n{user_question}"
            else:
                prompt = user_question
            
            formatted_prompt = prompt
            inputs = self.tokenizer(formatted_prompt, return_tensors = "pt").to(self.model.device)
            
            gen_params = {
                "max_new_tokens": self.config.get("max_new_tokens", DEFAULT_MAX_NEW_TOKENS),
                "temperature": self.config.get("temperature", DEFAULT_TEMPERATURE),
                "top_p": self.config.get("top_p", DEFAULT_TOP_P),
                "repetition_penalty": self.config.get("repetition_penalty", 1.1),
                "do_sample": self.config.get("do_sample", True)
            }
            with torch.no_grad():
                outputs = self.model.generate(
                    **inputs,
                    **gen_params
                )
            input_length = inputs["input_ids"].shape[1]
            generated_text = self.tokenizer.decode(
                outputs[0][input_length:], 
                skip_special_tokens=True
            )
            self.last_token_count = outputs.shape[1]
            return generated_text.strip()
        
        except Exception as e:
            logger.error(f"Error generating response with {self.model_name}: {str(e)}")
            raise RuntimeError(f"Error generating response: {str(e)}")
            