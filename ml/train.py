import os
import json
import joblib
import numpy as np
import pandas as pd
from datetime import datetime
from sklearn.model_selection import train_test_split, RandomizedSearchCV
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score, f1_score

# --- Configuration ---
DATA_PATH = r"D:\Projects\proxihealth\personal_health_data.csv"
TARGET_COLUMN = "Medical_Conditions"  # Classes: 'Diabetes', 'Hypertension', 'None'
MODEL_OUT = os.path.join(os.path.dirname(__file__), "model_conditions.joblib")
METRICS_OUT = r"D:\Projects\proxihealth\frontend\public\ml_metrics.json"

def main():
    print(f"Loading data from: {DATA_PATH}")
    df = pd.read_csv(DATA_PATH)
    print("Rows, cols:", df.shape)

    if TARGET_COLUMN not in df.columns:
        raise SystemExit(f"Target column '{TARGET_COLUMN}' not found in CSV columns: {list(df.columns)}")

    # Drop identifier, timestamp, and the Anomaly_Flag
    drop_cols = [c for c in ["User_ID", "Timestamp", "Anomaly_Flag"] if c in df.columns]
    X = df.drop(columns=drop_cols + [TARGET_COLUMN])
    y = df[TARGET_COLUMN]

    # Feature type identification
    numeric_cols = X.select_dtypes(include=[np.number]).columns.tolist()
    categorical_cols = X.select_dtypes(include=[object, "category"]).columns.tolist()

    print("Numeric features:", numeric_cols)
    print("Categorical features:", categorical_cols)

    # Preprocessing pipelines
    numeric_transformer = Pipeline(steps=[
        ("imputer", SimpleImputer(strategy="median")),
        ("scaler", StandardScaler())
    ])

    categorical_transformer = Pipeline(steps=[
        ("imputer", SimpleImputer(strategy="most_frequent")),
        ("onehot", OneHotEncoder(handle_unknown="ignore", sparse_output=False))
    ])

    preprocessor = ColumnTransformer(
        transformers=[
            ("num", numeric_transformer, numeric_cols),
            ("cat", categorical_transformer, categorical_cols),
        ],
        remainder="drop"
    )

    # Random Forest Classifier
    clf = RandomForestClassifier(random_state=42, n_jobs=-1)
    pipeline = Pipeline(steps=[('preprocessor', preprocessor), ('classifier', clf)])

    # Stratified Train/Test Split
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, stratify=y, random_state=42)

    # Hyperparameter space
    param_dist = {
        'classifier__n_estimators': [100, 200, 300],
        'classifier__max_depth': [None, 10, 20],
        'classifier__min_samples_split': [2, 5, 10],
        'classifier__min_samples_leaf': [1, 2, 4],
        'classifier__bootstrap': [True, False]
    }

    # Use f1_macro for multi-class optimization
    search = RandomizedSearchCV(
        pipeline,
        param_distributions=param_dist,
        n_iter=10, # Kept reasonable for faster training
        scoring='f1_macro',
        cv=3,
        verbose=1,
        random_state=42,
        n_jobs=-1
    )

    print("Training Random Forest model (RandomizedSearchCV)...")
    search.fit(X_train, y_train)

    print("Best parameters:", search.best_params_)
    best_model = search.best_estimator_

    # Evaluation
    y_pred = best_model.predict(X_test)
    accuracy = accuracy_score(y_test, y_pred)
    f1_macro = f1_score(y_test, y_pred, average='macro')
    
    print("\nModel Performance Summary:")
    print(f"Accuracy: {accuracy:.4f}")
    print(f"F1 Macro: {f1_macro:.4f}")
    print("\nClassification Report:\n", classification_report(y_test, y_pred))
    print("Confusion Matrix:\n", confusion_matrix(y_test, y_pred))

    # Save model pipeline
    joblib.dump(best_model, MODEL_OUT)
    print(f"Trained model saved to: {MODEL_OUT}")

    # Save metrics JSON for the frontend
    metrics = {
        "accuracy_mean": float(accuracy),
        "f1_mean": float(f1_macro),
        "cv_folds": 3,
        "n_samples": int(df.shape[0]),
        "timestamp": datetime.now().isoformat(),
        "classes": best_model.classes_.tolist()
    }
    
    os.makedirs(os.path.dirname(METRICS_OUT), exist_ok=True)
    with open(METRICS_OUT, 'w') as f:
        json.dump(metrics, f, indent=4)
    print(f"Metrics JSON saved to: {METRICS_OUT}")

if __name__ == '__main__':
    main()
