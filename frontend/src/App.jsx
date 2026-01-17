import { useState, useEffect } from 'react'

function App() {
  const [urls, setUrls] = useState("");
  const [data, setData] = useState([]);
  const [page, setPage] = useState(0);
  const [filterType, setFilterType] = useState("");

  // Hàm gọi API cào dữ liệu
  const handleScrape = async () => {
    const urlList = urls.split("\n").filter(u => u.trim() !== "");
    await fetch('http://localhost:8080/api/scrape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(urlList)
    });
    alert("Đã gửi yêu cầu! Dữ liệu sẽ sớm xuất hiện.");
  };

  // Hàm tải dữ liệu (có phân trang)
  const loadData = () => {
    let url = `http://localhost:8080/api/media?page=${page}&size=10&sort=id,desc`;
    if (filterType) url += `&type=${filterType}`;
    
    fetch(url)
      .then(res => res.json())
      .then(res => setData(res.content));
  };

  useEffect(() => { loadData(); }, [page, filterType]);

  return (
    <div style={{ padding: 20 }}>
      <h1>Media Scraper</h1>
      
      {/* Khu vực nhập liệu */}
      <div style={{ marginBottom: 20 }}>
        <textarea 
          rows="5" 
          style={{ width: '100%' }} 
          placeholder="Nhập URLs, mỗi dòng 1 link..."
          value={urls}
          onChange={e => setUrls(e.target.value)}
        />
        <button onClick={handleScrape}>Bắt đầu Cào</button>
      </div>

      {/* Bộ lọc */}
      <div>
        <label>Lọc: </label>
        <select onChange={e => setFilterType(e.target.value)}>
          <option value="">Tất cả</option>
          <option value="IMAGE">Ảnh</option>
          <option value="VIDEO">Video</option>
        </select>
        <button onClick={() => setPage(p => Math.max(0, p - 1))}>Trang Trước</button>
        <span> Trang {page + 1} </span>
        <button onClick={() => setPage(p => p + 1)}>Trang Sau</button>
      </div>

      {/* Hiển thị kết quả */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginTop: 20 }}>
        {data.map(item => (
          <div key={item.id} style={{ border: '1px solid #ccc', padding: 5 }}>
            <p style={{ fontSize: 10, wordBreak: 'break-all' }}>{item.originalUrl}</p>
            {item.type === 'IMAGE' ? (
              <img src={item.mediaUrl} style={{ width: '100%', height: 150, objectFit: 'cover' }} />
            ) : (
              <video src={item.mediaUrl} controls style={{ width: '100%' }} />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default App