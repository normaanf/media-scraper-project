import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  // Chiến thuật leo thang (Step Load)
  stages: [
    { duration: '30s', target: 500 },  // Giai đoạn 1: 500 RPS (Khởi động)
    { duration: '30s', target: 1000 }, // Giai đoạn 2: 1000 RPS (Tải nhẹ)
    { duration: '30s', target: 3000 }, // Giai đoạn 3: 3000 RPS (Tải nặng)
    { duration: '30s', target: 5000 }, // Giai đoạn 4: 5000 RPS (Cực hạn - Breaking Point)
    { duration: '20s', target: 0 },    // Hạ nhiệt
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'], 
  },
};

export default function () {
  const payload = JSON.stringify([
    "https://vnexpress.net", "https://dantri.com.vn", "https://github.com"
  ]);

  const params = {
    headers: { 'Content-Type': 'application/json' },
    timeout: '30s' // Timeout rộng để đo độ trễ thực tế
  };

  const res = http.post('http://host.docker.internal:8080/api/scrape', payload, params);

  check(res, {
    'status is 202': (r) => r.status === 202,
  });

  sleep(1);
}