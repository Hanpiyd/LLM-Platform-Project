import time
from flask import Blueprint, request, jsonify, current_app
from models.model_manager import ModelManager

generate_bp = Blueprint('generate', __name__)

@generate_bp.route('', methods = ['POST'])
def generate_response():
    data = request.get_json()
    model_id = data.get('modelId')
    system_prompt = data.get('systemPrompt', '')
    user_question = data.get('userQuestion', '')
    model_params = data.get('modelParams', None)
    
    if not model_id or not user_question:
        return jsonify({
            'success': False,
            'message': 'Missing required parameters: modelId or userQuestion'
        }), 400
    
    manager = ModelManager.get_instance()
    
    try:
        if not manager.is_model_loaded(model_id):
            current_app.logger.error(f"Model {model_id} is not loaded. Currently loaded models: {list(manager.loaded_models.keys())}")
            return jsonify({
                'success': False,
                'message': f'Model {model_id} is not loaded'
            }), 400
            
        model = manager.get_model(model_id)
        start_time = time.time()
        
        is_local_model = model_id == manager.local_model_id
        if model_params and not is_local_model:
            response = model.generate(system_prompt, user_question, model_params)
        else:
            response = model.generate(system_prompt, user_question)
        generation_time = (time.time() - start_time) * 1000
        return jsonify({
            'success': True, 
            'modelId': model_id,
            'response': response,
            'metadata': {
                'generationTime': round(generation_time, 2),
                'tokensUsed': getattr(model, 'last_token_count', None),
                'paramsUsed': model_params if model_params else "默认参数"
            }
        })
            
        
    except Exception as e:
        current_app.logger.error(f"Generate controller error: {str(e)}")
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500