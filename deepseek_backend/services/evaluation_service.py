import os
import json
import uuid
from datetime import datetime
from typing import Dict, Any, List
import logging
from config import EVALUATION_FILE_PATH, MODEL_METRICS_FILE_PATH

logger = logging.getLogger(__name__)

def load_evaluation() -> List[Dict[str, Any]]:
    if not os.path.exists(EVALUATION_FILE_PATH):
        return []
    try:
        with open(EVALUATION_FILE_PATH, "r", encoding='utf-8') as f:
            return json.load(f)
    except json.JSONDecodeError:
        return []
    except Exception as e:
        logger.error(f"Error loading evaluations: {str(e)}")
        return []
    
def save_evaluation(evaluation_data : Dict[str, Any]) -> None:
    evaluation_data['serverTimestamp'] = datetime.utcnow().isoformat()
    evaluation_data['id'] = str(uuid.uuid4())
    
    try:
        evaluations = load_evaluation()
        evaluations.append(evaluation_data)
        os.makedirs(os.path.dirname(EVALUATION_FILE_PATH), exist_ok=True)
        with open(EVALUATION_FILE_PATH, "w", encoding="utf-8") as f:
            json.dump(evaluations, f, ensure_ascii=False, indent=2)
        logger.info(f"Evaluation saved with ID: {evaluation_data['id']}")
        update_model_metrics(evaluation_data)
    except Exception as e:
        logger.error(f"Error saving evaluation: {str(e)}")
        raise
    
def load_metrics() -> Dict[str, Any]:
    if not os.path.exists(MODEL_METRICS_FILE_PATH):
        return {}
    try:
        with open(MODEL_METRICS_FILE_PATH, "r", encoding='utf-8') as f:
            return json.load(f)
    except json.JSONDecodeError:
        return {}
    except Exception as e:
        logger.error(f"Error loading metrics: {str(e)}")
        return {}
    
def update_model_metrics(evaluation_data: Dict[str, Any]) -> None:
    try:
        left_model_id = evaluation_data['models']['left']['id']
        right_model_id = evaluation_data['models']['right']['id']
        left_rating = evaluation_data['models']['left']['rating']
        right_rating = evaluation_data['models']['right']['rating']
        preference = evaluation_data['preference']
        metrics = load_metrics()
        
        if left_model_id not in metrics:
            metrics[left_model_id] = {
                'total_comparisons': 0,
                'wins': 0,
                'ties': 0, 
                'losses': 0,
                'avg_rating': 0,
                'last_updated': None
            }
        
        left_metrics = metrics[left_model_id]
        left_metrics['total_comparisons'] += 1
        if preference == left_model_id:
            left_metrics['wins'] += 1
        elif preference == 'tie':
            left_metrics['ties'] += 1
        else:
            left_metrics['losses'] += 1
        left_metrics["avg_rating"] = (((left_metrics['avg_rating'] * (left_metrics['total_comparisons'] - 1)) + left_rating) / left_metrics['total_comparisons'])
        left_metrics['last_updated'] = datetime.utcnow().isoformat()
        
        if right_model_id not in metrics:
            metrics[right_model_id] = {
                'total_comparisons': 0,
                'wins': 0,
                'ties': 0, 
                'losses': 0,
                'avg_rating': 0,
                'last_updated': None
            }
            
        right_metrics = metrics[right_model_id]
        right_metrics['total_comparisons'] += 1
        if preference == right_model_id:
            right_metrics['wins'] += 1
        elif preference == 'tie':
            right_metrics['ties'] += 1
        else:
            right_metrics['losses'] += 1
        right_metrics["avg_rating"] = (((right_metrics['avg_rating'] * (right_metrics['total_comparisons'] - 1)) + right_rating) / right_metrics['total_comparisons'])
        right_metrics['last_updated'] = datetime.utcnow().isoformat()
        
        os.makedirs(os.path.dirname(MODEL_METRICS_FILE_PATH), exist_ok=True)
        with open(MODEL_METRICS_FILE_PATH, 'w', encoding='utf-8') as f:
            json.dump(metrics, f, ensure_ascii=False, indent=2)
        logger.info(f"Updated metrics for models {left_model_id} and {right_model_id}")
    except Exception as e:
        logger.error(f"Error updating model metrics: {str(e)}")
        raise

def get_model_metrics() -> Dict[str, Dict[str, Any]]:
    return load_metrics()