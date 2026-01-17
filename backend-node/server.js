import express from 'express';
import pg from 'pg';
import * as cheerio from 'cheerio';
import axios from 'axios';
import cors from 'cors';

const app = express();
const PORT = 8080;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Cho phép nhận body lớn

// 1. Cấu hình Database (PostgreSQL)
const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@db:5432/scraperdb',
    max: 20, // Giới hạn số kết nối DB để không sập RAM
});

// Tạo bảng nếu chưa có (Thay thế cho Hibernate của Java)
const initDb = async () => {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS media_item (
            id SERIAL PRIMARY KEY,
            original_url TEXT NOT NULL,
            media_url TEXT NOT NULL,
            type VARCHAR(50) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `);
    console.log("Database initialized!");
};
initDb();

// 2. Queue Hệ thống (In-memory)
// Hàng đợi chứa các URL đang chờ xử lý
const taskQueue = []; 
let isProcessing = false;

// 3. Worker Xử lý (Chạy ngầm)
const processQueue = async () => {
    if (isProcessing || taskQueue.length === 0) return;
    isProcessing = true;

    // Lấy ra 20 URL để xử lý cùng lúc (Batch Size)
    // Tại sao là 20? Để cân bằng giữa tốc độ và RAM 1GB.
    const batch = taskQueue.splice(0, 20); 

    try {
        // Chạy song song 20 request này
        await Promise.all(batch.map(async (url) => {
            try {
                // Timeout 5s để không bị treo
                const { data } = await axios.get(url, { timeout: 5000 });
                const $ = cheerio.load(data);
                const items = [];

                // Lấy ảnh
                $('img').each((_, el) => {
                    const src = $(el).attr('src');
                    if (src && src.startsWith('http')) items.push([url, src, 'IMAGE']);
                });

                // Lấy video
                $('video source').each((_, el) => {
                    const src = $(el).attr('src');
                    if (src && src.startsWith('http')) items.push([url, src, 'VIDEO']);
                });

                // Lưu vào DB (Bulk Insert - 1 query duy nhất cho tốc độ cao)
                if (items.length > 0) {
                    // Tạo câu lệnh insert nhiều dòng: ($1, $2, $3), ($4, $5, $6)...
                    const values = items.flat();
                    const placeholders = items.map((_, i) => `($${i * 3 + 1}, $${i * 3 + 2}, $${i * 3 + 3})`).join(',');
                    await pool.query(
                        `INSERT INTO media_item (original_url, media_url, type) VALUES ${placeholders}`,
                        values
                    );
                }
            } catch (err) {
                // Log lỗi nhỏ, không làm sập server
                // console.error(`Failed to scrape ${url}: ${err.message}`); 
            }
        }));
    } catch (err) {
        console.error("Batch error:", err);
    } finally {
        isProcessing = false;
        // Nếu còn việc, gọi đệ quy tiếp tục xử lý (nhưng dùng setImmediate để thở cho CPU)
        if (taskQueue.length > 0) {
            setImmediate(processQueue);
        }
    }
};

// 4. API Endpoints

// API nhận request (Non-blocking)
app.post('/api/scrape', (req, res) => {
    const urls = req.body;
    if (!Array.isArray(urls)) return res.status(400).send("Body must be an array of URLs");

    // Chỉ đẩy vào hàng đợi, không xử lý ngay
    taskQueue.push(...urls);
    
    // Kích hoạt worker nếu nó đang ngủ
    if (!isProcessing) processQueue();

    res.status(202).json({ 
        message: `Accepted ${urls.length} URLs for processing.`,
        queueLength: taskQueue.length 
    });
});

// API lấy dữ liệu (Pagination & Search)
app.get('/api/media', async (req, res) => {
    const { page = 0, size = 20, type, search } = req.query;
    const offset = page * size;
    
    let query = `SELECT * FROM media_item WHERE 1=1`;
    let countQuery = `SELECT COUNT(*) FROM media_item WHERE 1=1`;
    const params = [];
    let paramIndex = 1;

    if (type) {
        query += ` AND type = $${paramIndex}`;
        countQuery += ` AND type = $${paramIndex}`;
        params.push(type);
        paramIndex++;
    }

    if (search) {
        query += ` AND original_url ILIKE $${paramIndex}`; // ILIKE = Case insensitive search
        countQuery += ` AND original_url ILIKE $${paramIndex}`;
        params.push(`%${search}%`);
        paramIndex++;
    }

    query += ` ORDER BY id DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    
    try {
        const dataRes = await pool.query(query, [...params, size, offset]);
        const countRes = await pool.query(countQuery, params);
        
        // Format trả về giống Spring Boot Page để Frontend đỡ phải sửa
        res.json({
            content: dataRes.rows.map(row => ({
                id: row.id,
                originalUrl: row.original_url, // Map snake_case to camelCase
                mediaUrl: row.media_url,
                type: row.type
            })),
            totalPages: Math.ceil(parseInt(countRes.rows[0].count) / size),
            totalElements: parseInt(countRes.rows[0].count),
            number: parseInt(page)
        });
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.listen(PORT, () => {
    console.log(`Node Scraper running on port ${PORT}`);
});