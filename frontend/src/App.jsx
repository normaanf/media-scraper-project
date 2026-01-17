import { useEffect, useState } from "react";
import { Toaster, toast } from "react-hot-toast";
import {
  Play,
  Image as ImageIcon,
  Search,
  RefreshCw,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

/* -------------------- UI COMPONENTS -------------------- */

const Button = ({
  children,
  onClick,
  variant = "primary",
  isLoading,
  disabled,
  className = "",
}) => {
  const base =
    "flex items-center justify-center gap-2 px-4 py-2 rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed";

  const variants = {
    primary:
      "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow hover:shadow-lg",
    secondary:
      "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50",
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled || isLoading}
      className={`${base} ${variants[variant]} ${className}`}
    >
      {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  );
};

const SkeletonCard = () => (
  <div className="bg-white p-3 rounded-xl border animate-pulse">
    <div className="aspect-video bg-gray-200 rounded-lg mb-3" />
    <div className="h-3 bg-gray-200 rounded w-3/4 mb-2" />
    <div className="h-2 bg-gray-100 rounded w-1/2" />
  </div>
);

const MediaCard = ({ item }) => (
  <div className="group bg-white rounded-2xl shadow-sm hover:shadow-md border overflow-hidden transition">
    <div className="relative aspect-video bg-gray-100">
      {item.type === "IMAGE" ? (
        <img
          src={item.mediaUrl}
          alt=""
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
      ) : (
        <video
          src={item.mediaUrl}
          controls
          className="w-full h-full object-contain bg-black"
        />
      )}

      {/* TYPE BADGE */}
      <span
        className={`absolute top-2 left-2 text-xs px-2 py-1 rounded-full text-white ${
          item.type === "IMAGE" ? "bg-blue-600" : "bg-purple-600"
        }`}
      >
        {item.type}
      </span>

      {/* HOVER OVERLAY */}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition flex items-center justify-center opacity-0 group-hover:opacity-100">
        <a
          href={item.mediaUrl}
          target="_blank"
          rel="noreferrer"
          className="bg-white px-4 py-2 rounded-lg text-sm shadow hover:bg-gray-100"
        >
          Open
        </a>
      </div>
    </div>

    <div className="p-3">
      <p
        className="text-xs text-gray-500 truncate"
        title={item.originalUrl}
      >
        {item.originalUrl}
      </p>
      <div className="mt-2 flex justify-between items-center text-[11px] text-gray-400">
        <span>ID #{item.id}</span>
      </div>
    </div>
  </div>
);

/* -------------------- MAIN APP -------------------- */

export default function App() {
  const [urls, setUrls] = useState("");
  const [data, setData] = useState([]);
  const [page, setPage] = useState(0);
  const [filterType, setFilterType] = useState("");
  const [loading, setLoading] = useState(false);
  const [isScraping, setIsScraping] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [hasNext, setHasNext] = useState(true);

  /* -------------------- API -------------------- */

  const loadData = async (pageNum = 0) => {
    setLoading(true);
    try {
      let url = `http://localhost:8080/api/media?page=${pageNum}&size=12&sort=id,desc`;
      if (filterType) url += `&type=${filterType}`;

      const res = await fetch(url);
      const json = await res.json();

      setData(json.content || []);
      setPage(json.number || 0);
      setHasNext(!json.last);
    } catch (e) {
      toast.error("Không tải được dữ liệu");
    } finally {
      setLoading(false);
    }
  };

  const handleScrape = async () => {
    if (!urls.trim()) {
      toast.error("Vui lòng nhập URL");
      return;
    }

    const list = urls.split("\n").filter(Boolean);
    setIsScraping(true);

    try {
      await fetch("http://localhost:8080/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(list),
      });

      toast.success(`Đã gửi ${list.length} URL`);
      setUrls("");
      loadData(0);
    } catch {
      toast.error("Lỗi kết nối backend");
    } finally {
      setIsScraping(false);
    }
  };

  useEffect(() => {
    loadData(page);
    if (!autoRefresh) return;
    const i = setInterval(() => loadData(page), 5000);
    return () => clearInterval(i);
  }, [page, filterType, autoRefresh]);

  /* -------------------- UI -------------------- */

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 text-gray-800 pb-20">
      <Toaster position="top-right" />

      {/* HEADER */}
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b">
        <div className="max-w-7xl mx-auto px-4 h-16 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-2 rounded-lg">
              <RefreshCw className="text-white w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Media Scraper Pro
            </h1>
          </div>

          <div className="flex items-center gap-3 text-sm">
            {autoRefresh && (
              <span className="flex items-center gap-1 text-green-600">
                <Loader2 className="w-3 h-3 animate-spin" />
                Live
              </span>
            )}
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={() => setAutoRefresh(!autoRefresh)}
                className="accent-blue-600"
              />
              Auto refresh
            </label>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* LEFT */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow border">
            <h2 className="font-semibold mb-3 flex items-center gap-2">
              <Search className="w-4 h-4 text-blue-500" />
              Input URLs
            </h2>

            <textarea
              rows={8}
              value={urls}
              onChange={(e) => setUrls(e.target.value)}
              placeholder="https://example.com"
              className="w-full p-4 bg-gray-50 border rounded-xl text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none"
            />

            <Button
              onClick={handleScrape}
              isLoading={isScraping}
              className="w-full mt-4"
            >
              Start Scraping
            </Button>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow border">
            <h3 className="text-sm font-medium mb-3">Filter</h3>
            <div className="flex gap-2">
              {["", "IMAGE", "VIDEO"].map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    setFilterType(t);
                    setPage(0);
                  }}
                  className={`flex-1 py-2 rounded-lg text-sm border transition ${
                    filterType === t
                      ? "bg-blue-50 border-blue-300 text-blue-700 font-semibold"
                      : "hover:bg-gray-50"
                  }`}
                >
                  {t || "ALL"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div className="lg:col-span-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold">
              Gallery
              <span className="ml-2 text-xs bg-gray-200 px-2 py-1 rounded-full">
                Page {page + 1}
              </span>
            </h2>

            <div className="flex gap-2">
              <Button
                variant="secondary"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                <ChevronLeft />
              </Button>
              <Button
                variant="secondary"
                disabled={!hasNext}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight />
              </Button>
            </div>
          </div>

          {/* CONTENT */}
          {loading && data.length === 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          )}

          {!loading && data.length === 0 && (
            <div className="py-24 text-center text-gray-400">
              <ImageIcon className="w-12 h-12 mx-auto mb-3" />
              <p className="text-sm">Chưa có media</p>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {data.map((item) => (
              <MediaCard key={item.id} item={item} />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
