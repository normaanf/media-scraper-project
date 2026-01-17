package com.example.scraper;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Service
@RequiredArgsConstructor // Tự động tạo Constructor cho các biến final (Dependency Injection)
@Slf4j // Để ghi log
public class ScraperService {

    private final MediaRepository repo;

    // Virtual Threads Executor: Vũ khí bí mật để xử lý 5000 request
    private final ExecutorService virtualExecutor = Executors.newVirtualThreadPerTaskExecutor();

    /**
     * Hàm này chỉ nhận list URL và đẩy vào luồng chạy ngầm.
     * Nó trả về void ngay lập tức để Controller không bị block.
     */
    public void scrapeUrlsAsync(List<String> urls) {
        log.info("Nhận được {} urls để xử lý", urls.size());
        urls.forEach(url -> virtualExecutor.submit(() -> performScraping(url)));
    }

    /**
     * Logic nghiệp vụ thực sự: Kết nối Jsoup, parse HTML, lưu DB
     */
    private void performScraping(String url) {
        try {
            // Timeout 10s để tránh treo thread quá lâu nếu mạng lag
            Document doc = Jsoup.connect(url)
                    .userAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64)") // Giả danh trình duyệt thật
                    .timeout(10000)
                    .get();

            List<MediaItem> items = new ArrayList<>();

            // Logic lấy ảnh
            doc.select("img[src]").forEach(el -> {
                String src = el.attr("abs:src");
                if (isValidUrl(src)) items.add(new MediaItem(url, src, "IMAGE"));
            });

            // Logic lấy video
            doc.select("video source[src]").forEach(el -> {
                String src = el.attr("abs:src");
                if (isValidUrl(src)) items.add(new MediaItem(url, src, "VIDEO"));
            });

            // Batch insert: Lưu một cục vào DB cho nhanh
            if (!items.isEmpty()) {
                repo.saveAll(items);
                log.info("Đã lưu {} media từ {}", items.size(), url);
            }

        } catch (Exception e) {
            log.error("Lỗi khi cào trang {}: {}", url, e.getMessage());
        }
    }

    // Helper đơn giản để check url rỗng
    private boolean isValidUrl(String url) {
        return url != null && !url.trim().isEmpty() && url.startsWith("http");
    }

    /**
     * Lấy dữ liệu cho Frontend (Gọi qua Repo)
     */
    public Page<MediaItem> getMediaData(String type, String search, Pageable pageable) {
        if (type != null && !type.isEmpty() && search != null && !search.isEmpty()) {
            return repo.findByTypeAndOriginalUrlContaining(type, search, pageable);
        }
        if (type != null && !type.isEmpty()) {
            return repo.findByType(type, pageable);
        }
        return repo.findAll(pageable);
    }
}