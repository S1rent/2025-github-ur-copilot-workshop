"""Pomodoro Timer Flask Application"""

import os
from flask import Flask, render_template

app = Flask(__name__)


@app.route("/")
def index():
    """Render the Pomodoro Timer page."""
    return render_template("index.html")


if __name__ == "__main__":
    debug_mode = os.environ.get("FLASK_DEBUG", "false").lower() == "true"
    app.run(debug=debug_mode, port=5000)
