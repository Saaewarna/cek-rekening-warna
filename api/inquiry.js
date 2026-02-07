export default async function handler(req, res) {
  // ==========================================
  // 🛡️ BAGIAN 1: KEAMANAN (IP WHITELIST)
  // ==========================================
  
  // DAFTAR IP YANG DIBOLEHKAN AKSES (Ganti/Tambah di sini)
  // Masukkan IP Server kamu, IP VPN, atau IP statis kantor.
  const ALLOWED_IPS = [
    '127.0.0.1',      // Wajib: Localhost (biar jalan saat dev di laptop)
    '::1',            // Wajib: Localhost IPv6
    '116.212.153.62',   // IP LANTAI 9 BARIS HIJAU
    '45.201.166.118'    // IP LANTAI 9 BARIS BIRU
    '38.47.38.176'    // IP LANTAI 8 BARIS MERONA
    '45.201.166.118'    // IP LANTAI 8 BARIS UNGU
  ];

  // Mendapatkan IP asli pengunjung (support Vercel/Cloudflare)
  let clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

  // Jika ada banyak IP (karena proxy), ambil yang paling depan (IP asli)
  if (clientIp && clientIp.indexOf(',') > -1) {
    clientIp = clientIp.split(',')[0].trim();
  }

  // Cek apakah IP ada di daftar putih
  if (!ALLOWED_IPS.includes(clientIp)) {
    console.warn(`[BLOCKED] Percobaan akses ilegal dari IP: ${clientIp}`);
    
    // Langsung tolak request. JANGAN panggil RapidAPI.
    return res.status(403).json({
      success: false,
      error: 'AKSES DITOLAK: IP Anda tidak terdaftar.',
      your_ip: clientIp // Saya tampilkan ini biar kamu gampang copy IP-nya kalau mau di-whitelist
    });
  }

  // ==========================================
  // 🚀 BAGIAN 2: LOGIKA UTAMA (Hanya jalan jika IP aman)
  // ==========================================

  const { mode, id, provider, bank, rekening } = req.query;

  // 1. Validasi Input Dasar
  if (!mode) {
    return res.status(400).json({ error: 'Parameter mode wajib diisi (ewallet/bank).' });
  }

  const sanitizedId = id?.trim();
  const sanitizedProvider = provider?.trim();
  const sanitizedBank = bank?.trim();
  const sanitizedRekening = rekening?.trim();

  let url = '';
  // Pastikan RAPIDAPI_KEY sudah ada di Environment Variables Vercel
  const headers = {
    'x-rapidapi-key': process.env.RAPIDAPI_KEY,
  };

  // 2. Tentukan URL dan Header berdasarkan Mode
  if (mode === 'ewallet') {
    if (!sanitizedId || !sanitizedProvider) {
      return res.status(400).json({ error: 'Parameter id dan provider wajib diisi untuk e-wallet.' });
    }

    // Logic khusus LinkAja vs E-wallet lain
    url = sanitizedProvider.toLowerCase() === 'linkaja'
      ? `https://${process.env.RAPIDAPI_HOST}/cekewallet/${sanitizedId}/LINKAJA`
      : `https://${process.env.RAPIDAPI_HOST}/cek_ewallet/${sanitizedId}/${sanitizedProvider.toLowerCase()}`;

    headers['x-rapidapi-host'] = process.env.RAPIDAPI_HOST;

  } else if (mode === 'bank') {
    if (!sanitizedBank || !sanitizedRekening) {
      return res.status(400).json({ error: 'Parameter bank dan rekening wajib diisi untuk cek rekening.' });
    }

    // Gunakan API Host khusus Bank
    const selectedHost = "cek-nomor-rekening-bank.p.rapidapi.com";
    const supportedBanks = [
      'bank_bca', 'bank_bni', 'bank_bri', 'bank_mandiri', 'bank_btn',
      'bank_danamon', 'bank_btpn', 'bank_bsi', 'bank_digibank',
      'bank_permata', 'bank_cimb_niaga', 'bank_dbs_indonesia'
    ];

    if (!supportedBanks.includes(sanitizedBank)) {
      return res.status(400).json({ error: 'Bank tidak didukung.' });
    }

    const path = `check_bank_lq/${sanitizedBank}`;
    url = `https://${selectedHost}/${path}/${sanitizedRekening}`;
    headers['x-rapidapi-host'] = selectedHost;

  } else {
    return res.status(400).json({ error: 'Mode tidak valid. Gunakan "ewallet" atau "bank".' });
  }

  // 3. Eksekusi Request ke API
  try {
    const response = await fetch(url, { method: 'GET', headers });
    const data = await response.json();

    // [HANDLE LOGIC ERROR] Cek jika API merespon 200 OK tapi isinya error
    if (data.success === false) {
      return res.status(400).json({ 
        error: data.data || 'Gagal validasi. Cek data input.' 
      });
    }

    // [HANDLE HTTP ERROR]
    if (!response.ok) {
      const errorMessage = data?.message || data?.error || 'Gagal ambil data dari API';
      return res.status(response.status).json({ error: errorMessage });
    }

    // Berhasil
    res.status(200).json(data);

  } catch (error) {
    console.error('API Internal Error:', error);
    res.status(500).json({ error: 'Sedang Maintenance, Coba Lagi Nanti :)' });
  }
}
