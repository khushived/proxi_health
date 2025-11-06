Random Forest training for `personal_health_data.csv`

Assumptions:
- The dataset path is: `D:\Projects\proxihealth\personal_health_data.csv` (as provided).
- The target column used for training is `Anomaly_Flag` (binary 0/1). If you intended a different target, update `TARGET_COLUMN` in `train.py`.

Files:
- `train.py` - main training script. Runs a small RandomizedSearchCV over a RandomForest pipeline, prints metrics, and saves the trained pipeline to `model.joblib` in this folder.
- `infer.py` - helper to load `model.joblib` and run a prediction from a Python dict.
- `requirements.txt` - Python dependencies.

How to run (Windows PowerShell):

1) (Optional) Create and activate a virtual environment.

2) Install dependencies:

python -m pip install -r ml\requirements.txt

3) Run training:

python ml\train.py

This will write `ml\model.joblib` when finished.

Notes:
- Training uses a small randomized search (20 iterations, 3-fold CV) and may take a few minutes depending on your machine. Reduce `n_iter` in `train.py` to speed up.
- The pipeline automatically imputes missing values, scales numeric features, and one-hot encodes categorical features.
