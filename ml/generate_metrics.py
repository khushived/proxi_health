import os
import json
import time
from datetime import datetime
import numpy as np
import pandas as pd
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import cross_val_score
import joblib

DATA_PATH = r"D:\Projects\proxihealth\personal_health_data.csv"
TARGET_COLUMN = "Anomaly_Flag"
MODEL_OUT = os.path.join(os.path.dirname(__file__), "model.joblib")
FRONTEND_METRICS_OUT = r"D:\Projects\proxihealth\frontend\public\ml_metrics.json"


def build_pipeline():
    df = pd.read_csv(DATA_PATH)
    drop_cols = [c for c in ["User_ID", "Timestamp"] if c in df.columns]
    X = df.drop(columns=drop_cols + [TARGET_COLUMN])
    numeric_cols = X.select_dtypes(include=[np.number]).columns.tolist()
    categorical_cols = X.select_dtypes(include=[object, "category"]).columns.tolist()

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

    clf = RandomForestClassifier(random_state=42, n_jobs=-1)
    pipeline = Pipeline(steps=[('preprocessor', preprocessor), ('classifier', clf)])
    return pipeline, X, df[TARGET_COLUMN]


def main():
    print("Building pipeline and loading data...")
    pipeline, X, y = build_pipeline()
    print("Running cross-validation (5 folds) for accuracy and f1...")

    acc = cross_val_score(pipeline, X, y, scoring='accuracy', cv=5, n_jobs=-1)
    f1 = cross_val_score(pipeline, X, y, scoring='f1', cv=5, n_jobs=-1)

    metrics = {
        'accuracy_mean': float(np.mean(acc)),
        'accuracy_std': float(np.std(acc)),
        'f1_mean': float(np.mean(f1)),
        'f1_std': float(np.std(f1)),
        'cv_folds': 5,
        'n_samples': int(X.shape[0]),
        'timestamp': datetime.utcnow().isoformat()
    }

    print("CV Accuracy: ", metrics['accuracy_mean'], "+/-", metrics['accuracy_std'])
    print("CV F1: ", metrics['f1_mean'], "+/-", metrics['f1_std'])

    # Fit on full data and save model
    print("Fitting final model on full dataset and saving...")
    pipeline.fit(X, y)
    joblib.dump(pipeline, MODEL_OUT)
    print(f"Model saved to: {MODEL_OUT}")

    # Save metrics for frontend
    os.makedirs(os.path.dirname(FRONTEND_METRICS_OUT), exist_ok=True)
    with open(FRONTEND_METRICS_OUT, 'w', encoding='utf-8') as f:
        json.dump(metrics, f, indent=2)
    print(f"Metrics written to: {FRONTEND_METRICS_OUT}")


if __name__ == '__main__':
    main()
