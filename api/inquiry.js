export default async function handler(req, res) {
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
    // [DEBUGGING] Cek apakah ENV terbaca di Vercel Logs
    console.log('[DEBUG] API Key exist?', process.env.RAPIDAPI_KEY ? 'YES' : 'NO');
    console.log('[DEBUG] Host:', headers['x-rapidapi-host']);
    console.log('[DEBUG] Final URL:', url);

    const response = await fetch(url, { method: 'GET', headers });
    const data = await response.json();

    // [HANDLE LOGIC ERROR] Cek jika API merespon 200 OK tapi isinya error (misal: unauthorized)
    if (data.success === false) {
      console.error('[API REJECT]', data);
      // Mengembalikan pesan error dari API aslinya ke frontend
      return res.status(400).json({ 
        error: data.data || 'Gagal validasi. Cek Subscription RapidAPI atau Saldo.' 
      });
    }

    // [HANDLE HTTP ERROR] Cek jika status HTTP bukan 200 (misal 404/500)
    if (!response.ok) {
      const errorMessage = data?.message || data?.error || 'Gagal ambil data dari API';
      console.error('[API HTTP ERROR]', response.status, errorMessage);
      return res.status(response.status).json({ error: errorMessage });
    }

    console.log(`[INQUIRY SUCCESS] mode: ${mode}, provider: ${provider}, id: ${id}`);

    // Berhasil
    res.status(200).json(data);

  } catch (error) {
    console.error('API Internal Error:', error);
    res.status(500).json({ error: 'Sedang Maintenance, Coba Lagi Nanti :)' });
  }
}
