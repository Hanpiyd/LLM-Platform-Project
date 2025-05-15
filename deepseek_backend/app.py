from flask import Flask, jsonify
from flask_cors import CORS
import os
import logging
from controllers.model_controller import model_bp
from controllers.generate_controller import generate_bp
from controllers.evaluation_controller import evaluation_bp

logging.basicConfig(
    level = logging.INFO,
    format = '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

app = Flask(__name__)
CORS(app)

app.register_blueprint(model_bp, url_prefix = '/api/model')
app.register_blueprint(generate_bp, url_prefix = '/api/generate')
app.register_blueprint(evaluation_bp, url_prefix = '/api/evaluation')

@app.route('/api/models', methods = ['GET'])
def get_models():
    from models.model_manager import ModelManager
    manager = ModelManager.get_instance()
    models_list = []
    for model_id, model_info in manager.get_available_models().items():
        model_data = {
            'id' : model_id,
            'name' : model_info.get('name', model_id),
            'description' : model_info.get('description', ''),
            'isLoaded' : manager.is_model_loaded(model_id),
            'position' : manager.get_model_position(model_id)
        }
        models_list.append(model_data)
        
    return jsonify({
        'success' : True,
        'models' : models_list
    })
    
@app.errorhandler(404)
def not_found(error):
    return jsonify({'success': False, 'message': 'API endpoint not found'}), 404

@app.errorhandler(500)
def server_error(error):
    app.logger.error(f"Server error: {str(error)}")
    return jsonify({'success': False, 'message': str(error)}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    from models.model_manager import ModelManager
    manager = ModelManager.get_instance()
    app.run(debug = True, host = '0.0.0.0', port = port)
    for model_id in list(manager.loaded_models.keys()):
        try:
            manager.unload_model(model_id)
        except Exception as e:
            app.logger.error(f"Error unloading model {model_id}: {str(e)}")