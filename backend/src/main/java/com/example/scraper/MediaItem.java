package com.example.scraper;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Data
@NoArgsConstructor
@RequiredArgsConstructor
public class MediaItem {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NonNull private String originalUrl; // URL trang web gốc
    @NonNull @Column(length = 2048) private String mediaUrl; // URL ảnh/video
    @NonNull private String type; // "IMAGE" hoặc "VIDEO"

    private LocalDateTime createdAt = LocalDateTime.now();
}