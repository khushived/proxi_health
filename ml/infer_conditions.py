import sys
import json
import joblib
import pandas as pd
import os

MODEL_PATH = os.path.join(os.path.dirname(__file__), "model_conditions.joblib")

# Predefined default values for features expected by the trained model pipeline
DEFAULT_FEATURES = {
    "Age": 30,
    "Gender": "Male",
    "Weight": 70.0,
    "Height": 170.0,
    "Medication": "No",
    "Smoker": "No",
    "Alcohol_Consumption": "None",
    "Day_of_Week": "Monday",
    "Sleep_Duration": 7.0,
    "Deep_Sleep_Duration": 2.0,
    "REM_Sleep_Duration": 1.5,
    "Wakeups": 1,
    "Snoring": "No",
    "Heart_Rate": 70,
    "Blood_Oxygen_Level": 98.0,
    "ECG": "Normal",
    "Calories_Intake": 2000.0,
    "Water_Intake": 2.0,
    "Stress_Level": "Low",
    "Mood": "Neutral",
    "Skin_Temperature": 36.5,
    "Body_Fat_Percentage": 18.0,
    "Muscle_Mass": 55.0,
    "Health_Score": 80.0
}

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No input JSON provided"}))
        sys.exit(1)

    try:
        input_data = json.loads(sys.argv[1])
    except Exception as e:
        print(json.dumps({"error": f"Failed to parse input JSON: {str(e)}"}))
        sys.exit(1)

    if not os.path.exists(MODEL_PATH):
        print(json.dumps({"error": f"Model file not found at: {MODEL_PATH}. Please run train.py first."}))
        sys.exit(1)

    try:
        # Load the trained pipeline
        pipeline = joblib.load(MODEL_PATH)

        # Merge input data with defaults
        features = DEFAULT_FEATURES.copy()
        for key, val in input_data.items():
            if key in features:
                features[key] = val

        # Ensure correct datatypes
        features["Age"] = int(features["Age"])
        features["Weight"] = float(features["Weight"])
        features["Height"] = float(features["Height"])
        features["Sleep_Duration"] = float(features["Sleep_Duration"])
        features["Deep_Sleep_Duration"] = float(features["Deep_Sleep_Duration"])
        features["REM_Sleep_Duration"] = float(features["REM_Sleep_Duration"])
        features["Wakeups"] = int(features["Wakeups"])
        features["Heart_Rate"] = int(features["Heart_Rate"])
        features["Blood_Oxygen_Level"] = float(features["Blood_Oxygen_Level"])
        features["Calories_Intake"] = float(features["Calories_Intake"])
        features["Water_Intake"] = float(features["Water_Intake"])
        features["Skin_Temperature"] = float(features["Skin_Temperature"])
        features["Body_Fat_Percentage"] = float(features["Body_Fat_Percentage"])
        features["Muscle_Mass"] = float(features["Muscle_Mass"])
        features["Health_Score"] = float(features["Health_Score"])

        # Create DataFrame
        df = pd.DataFrame([features])

        # Ensure columns match expected training features
        # X variables from train.py drop: User_ID, Timestamp, Anomaly_Flag, Medical_Conditions
        expected_cols = pipeline.feature_names_in_
        df = df[expected_cols]

        # Predict class probabilities
        probs = pipeline.predict_proba(df)[0]
        classes = pipeline.classes_

        # Map classes to their probabilities
        results = {cls: float(prob) for cls, prob in zip(classes, probs)}
        
        # Determine predicted class
        pred_class = pipeline.predict(df)[0]

        print(json.dumps({
            "success": True,
            "prediction": pred_class,
            "probabilities": results
        }))

    except Exception as e:
        print(json.dumps({"error": f"Inference execution failed: {str(e)}"}))
        sys.exit(1)

if __name__ == '__main__':
    main()
