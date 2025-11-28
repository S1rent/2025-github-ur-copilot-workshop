"""
Pomodoro Timer Web Application

A Flask-based Pomodoro Timer with enhanced visual feedback including:
- Circular progress bar animation
- Color gradient transitions (blue → yellow → red)
- Dynamic particle/ripple background effects
"""

from flask import Flask, render_template

app = Flask(__name__)


@app.route("/")
def index():
    """Render the main Pomodoro Timer page."""
    return render_template("index.html")


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
