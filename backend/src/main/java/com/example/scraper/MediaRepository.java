package com.example.scraper;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MediaRepository extends JpaRepository<MediaItem, Long>{
    Page<MediaItem> findByTypeAndOriginalUrlContaining(String type, String originalUrl, Pageable pageable);
    Page<MediaItem> findByType(String type, Pageable pageable);
}
