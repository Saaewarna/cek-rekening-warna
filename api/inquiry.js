export default async function handler(req, res) {
  // ==========================================
  // 1. CONFIG: IP WHITELIST & API KEY
  // ==========================================
  const ALLOWED_IPS = [
    '127.0.0.1',
    '::1',
    // Masukkan IP Publik kamu di bawah (Cek Logs Vercel kalau error)
    '38.47.38.176', 
  ];

  try {
    // ----------------------------------------
    // CEK IP (SECURITY)
    // ----------------------------------------
    let clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';
    if (clientIp.includes(',')) clientIp = clientIp.split(',')[0].trim();

    console.log(`[DEBUG] Request masuk dari IP: ${clientIp}`);

    if (!ALLOWED_IPS.includes(clientIp)) {
      return res.status(403).json({
        success: false,
        error: `AKSES DITOLAK. IP Kamu (${clientIp}) tidak terdaftar.`,
        your_ip: clientIp
      });
    }

    // ----------------------------------------
    // CEK API KEY (Mencegah Error 500 krn Key hilang)
    // ----------------------------------------
    if (!process.env.RAPIDAPI_KEY) {
      console.error('[CRITICAL] RAPIDAPI_KEY belum disetting di Vercel!');
      return res.status(500).json({ error: 'Server Config Error: API Key belum dipasang di Vercel.' });
    }

    // ==========================================
    // 2. PROSES REQUEST
    // ==========================================
    const { mode, id, provider, bank, rekening } = req.query;
    
    // Siapkan Header
    const headers = {
      'x-rapidapi-key': process.env.RAPIDAPI_KEY,
      'Content-Type': 'application/json'
    };

    let url = '';
    
    if (mode === 'ewallet') {
      if (!id || !provider) throw new Error('Data e-wallet tidak lengkap.');
      
      const p = provider.toLowerCase().trim();
      const host = process.env.RAPIDAPI_HOST || 'cek-e-wallet.p.rapidapi.com'; 
      headers['x-rapidapi-host'] = host;
      
      // EncodeURIComponent penting biar ID yang aneh-aneh gak bikin error
      url = (p === 'linkaja')
        ? `https://${host}/cekewallet/${encodeURIComponent(id)}/LINKAJA`
        : `https://${host}/cek_ewallet/${encodeURIComponent(id)}/${encodeURIComponent(p)}`;

    } else if (mode === 'bank') {
      if (!bank || !rekening) throw new Error('Data bank tidak lengkap.');

      const host = 'cek-nomor-rekening-bank.p.rapidapi.com';
      headers['x-rapidapi-host'] = host;
      
      // [FIX ERROR 500] Gunakan encodeURIComponent untuk menangani spasi (misal "bank bca")
      url = `https://${host}/check_bank_lq/${encodeURIComponent(bank)}/${encodeURIComponent(rekening)}`;

    } else {
      return res.status(400).json({ error: 'Mode tidak valid.' });
    }

    // ----------------------------------------
    // EKSEKUSI FETCH
    // ----------------------------------------
    // Timeout 10 detik biar gak loading selamanya
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      console.log(`[DEBUG] Fetching URL: ${url}`); // Cek URL di Logs kalau error
      const apiReq = await fetch(url, { headers, signal: controller.signal });
      clearTimeout(timeout);

      // Cek apakah response berupa JSON
      const contentType = apiReq.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await apiReq.text();
        console.error("[API ERROR] Response bukan JSON:", text);
        return res.status(502).json({ error: "Terjadi gangguan pada Provider API (Bad Gateway)." });
      }

      const data = await apiReq.json();

      if (!apiReq.ok) {
        return res.status(apiReq.status).json({ 
          error: data.message || data.error || 'Gagal validasi dari pusat.' 
        });
      }

      return res.status(200).json(data);

    } catch (fetchError) {
      clearTimeout(timeout);
      console.error('[FETCH ERROR]', fetchError);
      return res.status(502).json({ error: 'Koneksi ke server pusat timeout/gagal.' });
    }

  } catch (err) {
    console.error('[SERVER ERROR]', err);
    return res.status(500).json({ error: `Internal Error: ${err.message}` });
  }
}

