export default async function handler(req, res) {
  const { mode, id, provider, bank, rekening } = req.query;

  if (!mode) {
    return res.status(400).json({ error: 'Parameter mode wajib diisi (ewallet/bank).' });
  }

  const sanitizedId = id?.trim();
  const sanitizedProvider = provider?.trim();
  const sanitizedBank = bank?.trim();
  const sanitizedRekening = rekening?.trim();

  let url = '';
  const headers = {
    'x-rapidapi-key': process.env.RAPIDAPI_KEY,
  };

  if (mode === 'ewallet') {
    if (!sanitizedId || !sanitizedProvider) {
      return res.status(400).json({ error: 'Parameter id dan provider wajib diisi untuk e-wallet.' });
    }

    url = sanitizedProvider.toLowerCase() === 'linkaja'
      ? `https://${process.env.RAPIDAPI_HOST}/cekewallet/${sanitizedId}/LINKAJA`
      : `https://${process.env.RAPIDAPI_HOST}/cek_ewallet/${sanitizedId}/${sanitizedProvider.toLowerCase()}`;

    headers['x-rapidapi-host'] = process.env.RAPIDAPI_HOST;

  } else if (mode === 'bank') {
    if (!sanitizedBank || !sanitizedRekening) {
      return res.status(400).json({ error: 'Parameter bank dan rekening wajib diisi untuk cek rekening.' });
    }

    // ✅ GUNAKAN API UTAMA (bukan per bank)
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

  try {
    console.log('[DEBUG] Final URL:', url);
    const response = await fetch(url, { method: 'GET', headers });
    const data = await response.json();

    if (!response.ok) {
      const errorMessage = data?.message || data?.error || 'Gagal ambil data dari API';
      return res.status(response.status).json({ error: errorMessage });
    }

    console.log(`[INQUIRY] mode: ${mode}, provider: ${provider}, id: ${id}, bank: ${bank}, rekening: ${rekening}`);

    res.status(200).json(data);
  } catch (error) {
    console.error('API error:', error);
    res.status(500).json({ error: 'Sedang Maintenance, Coba Lagi Nanti :)' });
  }
}
