# High-Performance Media Scraper

A full-stack application designed to scrape images and videos from URLs under strict resource constraints (**1 CPU, 1GB RAM**). Capable of handling **5,000 concurrent requests** using Java 21 Virtual Threads.

## 🚀 Tech Stack

* **Backend:** Java 21, Spring Boot 3.2 (Virtual Threads enabled).
* **Frontend:** React 18, Vite, Tailwind CSS v4.
* **Database:** PostgreSQL 15.
* **Infrastructure:** Docker Compose (Resource limited).

## 🛠️ How to Run

1.  **Prerequisites:** Docker & Docker Compose installed.
2.  **Start the application:**
    ```bash
    docker-compose up --build
    ```
3.  **Access:**
    * Frontend: `http://localhost:3000`
    * Backend API: `http://localhost:8080`

## 🧪 Load Testing

To verify the **5,000 concurrent requests** requirement:
```bash
# Run k6 load test script provided in the root directory
docker run --rm -i --network=host grafana/k6 run - < loadtest.js
