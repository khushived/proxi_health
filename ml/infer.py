import joblib
import pandas as pd
import os

MODEL_PATH = os.path.join(os.path.dirname(__file__), "model.joblib")


def load_model(path=MODEL_PATH):
    return joblib.load(path)


def predict_from_dict(input_dict, model=None):
    """Input: a dict mapping feature names to values (same names as CSV columns, excluding target).
    Example:
      sample = {"Age": 45, "Gender": "Female", "Weight": 70.0, ...}
    """
    if model is None:
        model = load_model()
    df = pd.DataFrame([input_dict])
    pred = model.predict(df)
    proba = model.predict_proba(df) if hasattr(model, 'predict_proba') else None
    return pred[0], (proba[0].tolist() if proba is not None else None)


if __name__ == '__main__':
    # Quick local test (user should replace with real values)
    sample = {}
    print("Load model:", MODEL_PATH)
    m = load_model()
    print("Model loaded. To run inference, call predict_from_dict(sample, model=m)")
