# Start from a standard Python image
FROM python:3.11-slim

# Set the working directory inside the container
WORKDIR /app

# Install the system dependencies (Tesseract and Poppler)
RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*

# Copy your requirements file and install Python packages
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of your backend code into the container
COPY . .

# --- THIS IS THE FIX ---
# Use Render's $PORT variable instead of hardcoding 10000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "$PORT"]