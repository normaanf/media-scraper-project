package com.example.scraper;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*") // CORS cho phép React gọi
@RequiredArgsConstructor
public class ScraperController {

    private final ScraperService service; // Inject Service vào đây

    // API 1: Nhận yêu cầu cào
    @PostMapping("/scrape")
    public ResponseEntity<?> scrape(@RequestBody List<String> urls) {
        if (urls == null || urls.isEmpty()) {
            return ResponseEntity.badRequest().body("Danh sách URL không được rỗng");
        }

        // Gọi service xử lý ngầm
        service.scrapeUrlsAsync(urls);

        // Trả về 202 Accepted ngay lập tức
        return ResponseEntity.accepted()
                .body("Hệ thống đang xử lý " + urls.size() + " trang web trong nền.");
    }

    // API 2: Lấy dữ liệu đã cào
    @GetMapping("/media")
    public ResponseEntity<Page<MediaItem>> getMedia(
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String search,
            @PageableDefault(size = 20, sort = "id", direction = Sort.Direction.DESC) Pageable pageable) {

        Page<MediaItem> result = service.getMediaData(type, search, pageable);
        return ResponseEntity.ok(result);
    }
}