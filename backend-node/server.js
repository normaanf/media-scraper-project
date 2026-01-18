import express from 'express';
import pg from 'pg';
import * as cheerio from 'cheerio';
import axios from 'axios';
import cors from 'cors';

const app = express();
const PORT = 8080;

// --- CONFIGURATION ---

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Cho phép nhận body lớn (danh sách 5000 URL)

// Middleware: Logger đo thời gian phản hồi của API (Response Time)
// Giúp phát hiện xem API nhận request có bị chậm khi tải cao không
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        // Chỉ log nếu request chậm hơn 500ms để đỡ rác màn hình console
        if (duration > 500) {
            console.log(`[SLOW API] ${req.method} ${req.originalUrl} took ${duration}ms`);
        }
    });
    next();
});

// 1. Cấu hình Database (PostgreSQL)
// Sử dụng pg.Pool để quản lý kết nối hiệu quả
const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@db:5432/scraperdb',
    max: 20, // Giới hạn cứng số kết nối DB để bảo vệ RAM
    idleTimeoutMillis: 30000,
});

// Hàm khởi tạo Database (Thay thế cho Hibernate auto-ddl của Java)
const initDb = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS media_item (
                id SERIAL PRIMARY KEY,
                original_url TEXT NOT NULL,
                media_url TEXT NOT NULL,
                type VARCHAR(50) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            -- Tạo index để search nhanh hơn
            CREATE INDEX IF NOT EXISTS idx_type ON media_item(type);
            CREATE INDEX IF NOT EXISTS idx_original_url ON media_item(original_url);
        `);
        console.log("Database initialized successfully!");
    } catch (err) {
        console.error("Error initializing database:", err);
    }
};
initDb();

// --- QUEUE SYSTEM (IN-MEMORY) ---

// Hàng đợi chứa các URL đang chờ xử lý
// Dùng mảng JS thường vì nó nhanh và nhẹ nhất cho giới hạn 1GB RAM
const taskQueue = []; 
let isProcessing = false;

// --- WORKER LOGIC ---

const processQueue = async () => {
    // Nếu đang chạy hoặc không có việc thì thôi
    if (isProcessing || taskQueue.length === 0) return;
    isProcessing = true;

    // Lấy ra 20 URL để xử lý cùng lúc (Batch Size)
    // Con số 20 là "Sweet Spot" để cân bằng giữa tốc độ và RAM/CPU
    const batchSize = 20;
    const batch = taskQueue.splice(0, batchSize);
    
    // Đánh dấu thời gian bắt đầu xử lý batch (dùng cho Monitoring)
    const batchStart = Date.now(); 

    try {
        // Chạy song song (Parallel) các request trong batch
        await Promise.all(batch.map(async (url) => {
            try {
                // Timeout 5s: Quan trọng để tránh worker bị treo mãi mãi vì 1 trang web lag
                const { data } = await axios.get(url, { 
                    timeout: 5000,
                    headers: { 'User-Agent': 'Mozilla/5.0 (Compatible; MediaScraper/1.0)' }
                });
                
                const $ = cheerio.load(data);
                const items = [];

                // Lấy ảnh
                $('img').each((_, el) => {
                    const src = $(el).attr('src');
                    // Chỉ lấy link tuyệt đối http/https
                    if (src && src.startsWith('http')) items.push([url, src, 'IMAGE']);
                });

                // Lấy video
                $('video source').each((_, el) => {
                    const src = $(el).attr('src');
                    if (src && src.startsWith('http')) items.push([url, src, 'VIDEO']);
                });

                // BULK INSERT: Kỹ thuật quan trọng để tăng tốc độ ghi DB
                // Thay vì gọi INSERT 100 lần, ta gọi 1 lần duy nhất.
                if (items.length > 0) {
                    const values = items.flat();
                    // Tạo placeholders: ($1, $2, $3), ($4, $5, $6)...
                    const placeholders = items.map((_, i) => `($${i * 3 + 1}, $${i * 3 + 2}, $${i * 3 + 3})`).join(',');
                    
                    await pool.query(
                        `INSERT INTO media_item (original_url, media_url, type) VALUES ${placeholders}`,
                        values
                    );
                }
            } catch (err) {
                // Lỗi cào (404, timeout) là bình thường, chỉ log nhẹ và bỏ qua
                // console.warn(`Failed to scrape ${url}: ${err.message}`); 
            }
        }));

        // MONITORING LOG: Thời gian tiêu tốn để xử lý 1 batch
        // Đây là thông số quan trọng để bạn trả lời phỏng vấn về "Load"
        const batchDuration = Date.now() - batchStart;
        console.log(`[WORKER] Processed batch of ${batch.length} URLs in ${batchDuration}ms. Queue remaining: ${taskQueue.length}`);

    } catch (err) {
        console.error("Critical Batch Error:", err);
    } finally {
        isProcessing = false;
        
        // Cơ chế Non-blocking:
        // Dùng setImmediate để đẩy việc xử lý batch tiếp theo xuống cuối hàng đợi Event Loop.
        // Điều này giúp CPU có thời gian "thở" để xử lý các request HTTP mới đến.
        if (taskQueue.length > 0) {
            setImmediate(processQueue);
        }
    }
};

// --- API ENDPOINTS ---

// 1. API Nhận request (Producer)
app.post('/api/scrape', (req, res) => {
    const urls = req.body;
    
    // Validation cơ bản
    if (!Array.isArray(urls)) {
        return res.status(400).send("Invalid format: Body must be an array of URLs strings.");
    }

    // Chỉ đẩy vào hàng đợi, KHÔNG xử lý ngay (Async Processing)
    // Đây là bí quyết để trả lời ngay lập tức (Low Latency)
    taskQueue.push(...urls);
    
    // Kích hoạt worker nếu nó đang ngủ
    if (!isProcessing) processQueue();

    // Trả về 202 Accepted chuẩn RESTful cho xử lý bất đồng bộ
    res.status(202).json({ 
        message: `Accepted ${urls.length} URLs for processing.`,
        queueLength: taskQueue.length 
    });
});

// 2. API Lấy dữ liệu (Consumer View)
app.get('/api/media', async (req, res) => {
    const { page = 0, size = 20, type, search } = req.query;
    const limit = parseInt(size);
    const offset = parseInt(page) * limit;
    
    // Xây dựng câu query động (Dynamic Query)
    let query = `SELECT * FROM media_item WHERE 1=1`;
    let countQuery = `SELECT COUNT(*) FROM media_item WHERE 1=1`;
    const params = [];
    let paramIndex = 1;

    if (type && type.trim() !== '') {
        query += ` AND type = $${paramIndex}`;
        countQuery += ` AND type = $${paramIndex}`;
        params.push(type);
        paramIndex++;
    }

    if (search && search.trim() !== '') {
        query += ` AND original_url ILIKE $${paramIndex}`; // ILIKE: Case-insensitive search
        countQuery += ` AND original_url ILIKE $${paramIndex}`;
        params.push(`%${search}%`);
        paramIndex++;
    }

    query += ` ORDER BY id DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    
    try {
        // Chạy 2 query song song để tối ưu thời gian (lấy data + đếm tổng số)
        const [dataRes, countRes] = await Promise.all([
            pool.query(query, [...params, limit, offset]),
            pool.query(countQuery, params)
        ]);
        
        // Format response giống Spring Boot PageImpl để Frontend dễ mapping
        res.json({
            content: dataRes.rows.map(row => ({
                id: row.id,
                originalUrl: row.original_url,
                mediaUrl: row.media_url,
                type: row.type,
                createdAt: row.created_at
            })),
            totalPages: Math.ceil(parseInt(countRes.rows[0].count) / limit),
            totalElements: parseInt(countRes.rows[0].count),
            number: parseInt(page),
            size: limit
        });
    } catch (err) {
        console.error("Query Error:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// --- SERVER START ---
app.listen(PORT, () => {
    console.log(`--------------------------------------------------`);
    console.log(`🚀 Node.js Media Scraper running on port ${PORT}`);
    console.log(`👉 Architecture: Producer-Consumer (In-Memory Queue)`);
    console.log(`--------------------------------------------------`);
});