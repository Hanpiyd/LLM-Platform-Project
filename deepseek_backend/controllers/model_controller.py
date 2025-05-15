from flask import Blueprint, request, jsonify, current_app
from models.model_manager import ModelManager

model_bp = Blueprint('model', __name__)

@model_bp.route('/status/<model_id>', methods = ['POST'])
def handle_model_status(model_id):
    data = request.get_json()
    action = data.get('action')
    position = data.get('position')
    
    if not action or not position:
        return jsonify({
            'success' : False,
            'message': 'Missing required parameters: action or position'
        }), 400
        
    manager = ModelManager.get_instance()
    
    try:
        if model_id == manager.local_model_id:
            manager.positions[position] = model_id
            return jsonify({
                'success': True,
                'message': f'Local model {model_id} assigned to {position} position'
            })
            
        if action == 'load':
            current_model = manager.get_model_at_position(position)
            if current_model and current_model != model_id:
                manager.unload_model(current_model, position)
            
            manager.load_model(model_id, position)
            return jsonify({
                'success': True,
                'message': f'Model {model_id} loaded at {position} position'
            })
            
        elif action == 'unload':
            if model_id == manager.local_model_id:
                return jsonify({
                    'success': True,
                    'message': f'Skipped unloading local model {model_id}'
                })
            
            manager.unload_model(model_id, position)
            return jsonify({
                'success': True,
                'message': f'Model {model_id} unloaded from {position}'
            })
        
        else:
            return jsonify({
                'success': False,
                'message': f'Invalid action: {action}'
            }), 400
            
    except Exception as e:
        current_app.logger.error(f"Model controller error: {str(e)}")
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500