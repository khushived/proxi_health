import os
import joblib
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split, RandomizedSearchCV
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score

# --- Configuration / assumptions ---
# Dataset path (user-provided)
DATA_PATH = r"D:\Projects\proxihealth\personal_health_data.csv"
# Target column assumption (inferred from dataset)
TARGET_COLUMN = "Anomaly_Flag"  # binary: 0/1
# Output model path
MODEL_OUT = os.path.join(os.path.dirname(__file__), "model.joblib")


def main():
    print(f"Loading data from: {DATA_PATH}")
    df = pd.read_csv(DATA_PATH)
    print("Rows, cols:", df.shape)

    if TARGET_COLUMN not in df.columns:
        raise SystemExit(f"Target column '{TARGET_COLUMN}' not found in CSV columns: {list(df.columns)}")

    # Drop identifier/time columns that shouldn't be used as predictive features
    drop_cols = [c for c in ["User_ID", "Timestamp"] if c in df.columns]
    X = df.drop(columns=drop_cols + [TARGET_COLUMN])
    y = df[TARGET_COLUMN]

    # Simple type split
    numeric_cols = X.select_dtypes(include=[np.number]).columns.tolist()
    categorical_cols = X.select_dtypes(include=[object, "category"]).columns.tolist()

    print("Numeric features:", numeric_cols)
    print("Categorical features:", categorical_cols)

    # Preprocessing
    numeric_transformer = Pipeline(steps=[
        ("imputer", SimpleImputer(strategy="median")),
        ("scaler", StandardScaler())
    ])

    # Use sparse_output for compatibility with newer scikit-learn versions
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

    # Random Forest classifier (we'll run a small randomized search)
    clf = RandomForestClassifier(random_state=42, n_jobs=-1)

    pipeline = Pipeline(steps=[('preprocessor', preprocessor), ('classifier', clf)])

    # Train/test split
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, stratify=y, random_state=42)

    # Hyperparameter space (small, fast)
    param_dist = {
        'classifier__n_estimators': [100, 200, 400],
        'classifier__max_depth': [None, 10, 20, 40],
        'classifier__min_samples_split': [2, 5, 10],
        'classifier__min_samples_leaf': [1, 2, 4],
        'classifier__bootstrap': [True, False]
    }

    search = RandomizedSearchCV(
        pipeline,
        param_distributions=param_dist,
        n_iter=20,
        scoring='f1',
        cv=3,
        verbose=2,
        random_state=42,
        n_jobs=-1
    )

    print("Starting hyperparameter search and training (this may take a bit)...")
    search.fit(X_train, y_train)

    print("Best params:", search.best_params_)

    # Evaluate
    best = search.best_estimator_
    y_pred = best.predict(X_test)

    print("Accuracy:", accuracy_score(y_test, y_pred))
    print("Classification report:\n", classification_report(y_test, y_pred))
    print("Confusion matrix:\n", confusion_matrix(y_test, y_pred))

    # Save model
    joblib.dump(best, MODEL_OUT)
    print(f"Trained model saved to: {MODEL_OUT}")


if __name__ == '__main__':
    main()
