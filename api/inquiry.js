// Coba import fetch manual buat jaga-jaga kalau Node.js versi lama
// Kalau error biarin aja, kita fallback nanti
let nodeFetch;
try { nodeFetch = await import('node-fetch').then(m => m.default); } catch (e) {}

export default async function handler(req, res) {
  try {
    // ==========================================
    // 🛡️ BAGIAN 1: KEAMANAN (IP WHITELIST)
    // ==========================================
    
    // GANTI IP DI SINI DENGAN IP KAMU YANG MUNCUL DI LOG VERCEL NANTI
    const ALLOWED_IPS = [
      '127.0.0.1', 
      '::1',
      // Masukkan IP Publik kamu di bawah ini (Copy dari Log Vercel kalau muncul)
      '114.125.0.0', // Contoh (Ganti dengan IP aslimu)
    ];

    // Ambil IP dengan cara aman (pakai ?. biar gak crash kalau null)
    let clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';

    // Bersihkan format IP (ambil yang paling depan kalau ada koma)
    if (clientIp && clientIp.indexOf(',') > -1) {
      clientIp = clientIp.split(',')[0].trim();
    }

    console.log(`[DEBUG] Incoming Request from IP: ${clientIp}`);

    // Cek Whitelist
    // Kita cek apakah IP user ada di dalam daftar ALLOWED_IPS
    const isAllowed = ALLOWED_IPS.includes(clientIp);

    if (!isAllowed) {
      console.warn(`[BLOCKED] IP ${clientIp} tidak terdaftar.`);
      return res.status(403).json({
        success: false, 
        error: `AKSES DITOLAK. IP Kamu (${clientIp}) belum terdaftar di script.`,
        your_ip: clientIp 
      });
    }

    // ==========================================
    // 🚀 BAGIAN 2: LOGIKA UTAMA
    // ==========================================
    
    const { mode, id, provider, bank, rekening } = req.query;

    if (!process.env.RAPIDAPI_KEY) {
      throw new Error("RAPIDAPI_KEY belum disetting di Vercel Environment Variables!");
    }

    let url = '';
    const headers = {
      'x-rapidapi-key': process.env.RAPIDAPI_KEY,
      'x-rapidapi-host': ''
    };

    // Mode E-WALLET
    if (mode === 'ewallet') {
      if (!id || !provider) return res.status(400).json({ error: 'Data e-wallet kurang lengkap.' });
      
      const host = process.env.RAPIDAPI_HOST || 'cek-e-wallet.p.rapidapi.com'; 
      headers['x-rapidapi-host'] = host;
      
      const p = provider.toLowerCase();
      url = p === 'linkaja'
        ? `https://${host}/cekewallet/${id}/LINKAJA`
        : `https://${host}/cek_ewallet/${id}/${p}`;
    
    // Mode BANK
    } else if (mode === 'bank') {
      if (!bank || !rekening) return res.status(400).json({ error: 'Data bank kurang lengkap.' });
      
      const host = "cek-nomor-rekening-bank.p.rapidapi.com";
      headers['x-rapidapi-host'] = host;
      
      // Sanitasi nama bank biar sesuai format API
      // Pastikan value di frontend (HTML) sama persis dengan yang diharapkan API
      url = `https://${host}/check_bank_lq/${bank}/${rekening}`;
      
    } else {
      return res.status(400).json({ error: 'Mode tidak dikenali.' });
    }

    // Eksekusi Fetch (Support Node lama & baru)
    const fetchFunc = global.fetch || nodeFetch;
    if (!fetchFunc) {
      throw new Error("Fetch tidak ditemukan. Silakan upgrade Node.js di Vercel ke versi 18+");
    }

    const apiRes = await fetchFunc(url, { method: 'GET', headers });
    
    // Cek response API apakah JSON valid
    const text = await apiRes.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (err) {
      console.error("API Response bukan JSON:", text);
      return res.status(502).json({ error: "Terjadi kesalahan pada Provider API (Bad Gateway)." });
    }

    if (!apiRes.ok) {
      return res.status(apiRes.status).json({ error: data.message || data.error || 'Gagal dari pusat.' });
    }

    return res.status(200).json(data);

  } catch (error) {
    console.error('[CRITICAL ERROR]', error);
    return res.status(500).json({ 
      error: `Server Error: ${error.message}`,
      hint: "Cek Logs Vercel untuk detail."
    });
  }
}
