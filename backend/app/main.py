# pyrefly: ignore [missing-import]
from fastapi import FastAPI

app = FastAPI(title='Backend API')

@app.get('/')
def root():
    return {'status': 'ok', 'message': 'Backend dang hoat dong'}
