import os

OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY', '')
ANTHROPIC_API_KEY = os.environ.get('ANTHROPIC_API_KEY', '')
SICILONCLOUD_API_KEY = os.environ.get('SICILONCLOUD_API_KEY', 'sk-bebzdnndtkywsxvfjbxljovyzyzoeatnjagywgmcfqffnlpq')

MODEL_CONFIG_PATH = os.environ.get('MODEL_CONFIG_PATH', 'models_config.json')
EVALUATION_FILE_PATH = os.environ.get('EVALUATION_FILE_PATH', 'data/evaluations.json')
MODEL_METRICS_FILE_PATH = os.environ.get('MODEL_METRICS_FILE_PATH', 'data/model_metrics.json')

DEFAULT_MAX_NEW_TOKENS = 8192
DEFAULT_TEMPERATURE = 0.7
DEFAULT_TOP_P = 0.9