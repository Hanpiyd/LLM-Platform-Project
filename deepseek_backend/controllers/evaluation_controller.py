from flask import Blueprint, request, jsonify, current_app
from services.evaluation_service import save_evaluation, get_model_metrics

evaluation_bp = Blueprint('evaluation', __name__)

@evaluation_bp.route('', methods = ['POST'])
def submit_evaluation():
    evaluation_data = request.get_json()
    required_fields = ['timestamp', 'userQuestion', 'models', 'preference']
    for field in required_fields:
        if field not in evaluation_data:
            return jsonify({
                'success': False,
                'message': f'Missing required field: {field}'
            }), 400
            
    try:
        save_evaluation(evaluation_data)
        return jsonify({
            'success': True,
            'message': 'Evaluation data saved successfully'
        })
    except Exception as e:
        current_app.logger.error(f"Evaluation controller error: {str(e)}")
        return jsonify({
            'success': False,
            'message': f'Failed to save evaluation: {str(e)}'
        }), 500
        
    
@evaluation_bp.route('/metrics', methods = ['GET'])
def get_metrics():
    try:
        metrics = get_model_metrics()
        return jsonify({
            'success': True,
            'metrics': metrics
        })
    except Exception as e:
        current_app.logger.error(f"Get metrics error: {str(e)}")
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500
    