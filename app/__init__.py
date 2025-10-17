import os
from flask import Flask
from dotenv import load_dotenv

def create_app():
    # load .env so Flask can read config
    load_dotenv()

    app = Flask(__name__, static_folder="static", template_folder="templates")
    app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "dev")
    app.config["MONGODB_URI"] = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
    app.config["MONGODB_DB"] = os.getenv("MONGODB_DB", "todolist")

    # import and attach routes
    from .routes import bp as routes_bp
    app.register_blueprint(routes_bp)

    return app
