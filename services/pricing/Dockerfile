FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY fee_engine.py black76.py iv_solve.py iv_study.py state_classifier.py ticket_builder.py oi_bias.py nse_live.py angel_live.py angel_candles.py broker_connect.py market_strip.py api.py ./
EXPOSE 8000
CMD uvicorn api:app --host 0.0.0.0 --port ${PORT:-8000}
