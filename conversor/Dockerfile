FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg poppler-utils && rm -rf /var/lib/apt/lists/* && pip install --no-cache-dir boto3==1.35.36
WORKDIR /app
COPY converter.py .
CMD ["python", "-u", "converter.py"]
