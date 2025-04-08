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

    const host = process.env.RAPIDAPI_HOST;
    headers['x-rapidapi-host'] = host;

    url = sanitizedProvider.toLowerCase() === 'linkaja'
      ? `https://${host}/cekewallet/${sanitizedId}/LINKAJA`
      : `https://${host}/cek_ewallet/${sanitizedId}/${sanitizedProvider.toLowerCase()}`;

  } else if (mode === 'bank') {
    if (!sanitizedBank || !sanitizedRekening) {
      return res.status(400).json({ error: 'Parameter bank dan rekening wajib diisi untuk cek rekening.' });
    }

    const supportedBanks = [
      'bank_bca', 'bank_bni', 'bank_bri', 'bank_mandiri', 'bank_btn',
      'bank_danamon', 'bank_btpn', 'bank_bsi', 'bank_digibank',
      'bank_permata', 'bank_cimb_niaga', 'bank_dbs_indonesia'
    ];

    if (!supportedBanks.includes(sanitizedBank)) {
      return res.status(400).json({ error: 'Bank tidak didukung.' });
    }

    const host = process.env.RAPIDAPI_HOST_BANK;
    headers['x-rapidapi-host'] = host;

    url = `https://${host}/check_bank_lq/${sanitizedBank}/${sanitizedRekening}`;
  } else {
    return res.status(400).json({ error: 'Mode tidak valid. Gunakan "ewallet" atau "bank".' });
  }

  try {
    console.log('[DEBUG] Final URL:', url);
    const response = await fetch(url, { method: 'GET', headers });
    const raw = await response.text();

    console.log('[RAW RESPONSE]', raw);

    if (!raw || raw.trim() === '') {
      return res.status(500).json({ error: "API tidak memberikan response (kosong)." });
    }

    let data;
    try {
      data = JSON.parse(raw);

      if (
        data.data &&
        typeof data.data === "string" &&
        (data.data.startsWith("{") || data.data.startsWith("["))
      ) {
        data.data = JSON.parse(data.data);
      }
    } catch (err) {
      console.error('[PARSE ERROR]', err);
      return res.status(500).json({ error: "Gagal parsing response JSON dari API." });
    }

    if (!response.ok) {
      const errorMessage = data?.message || data?.error || 'Gagal ambil data dari API';
      return res.status(response.status).json({ error: errorMessage });
    }

    res.status(200).json(data);
  } catch (error) {
    console.error('[API ERROR]', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
