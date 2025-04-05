// ✅ FINAL inquiry.js versi check_bank_lq universal endpoint

export default async function handler(req, res) {
  const { mode, id, provider, bank, rekening } = req.query;

  if (!mode) return res.status(400).json({ error: 'Parameter mode wajib diisi (ewallet/bank).' });

  let url = '';
  let headers = {
    'x-rapidapi-key': process.env.RAPIDAPI_KEY
  };

  if (mode === 'ewallet') {
    if (!id || !provider) return res.status(400).json({ error: 'id & provider wajib untuk ewallet.' });

    url = `https://${process.env.RAPIDAPI_HOST}/cek_ewallet/${id}/${provider}`;
    headers['x-rapidapi-host'] = process.env.RAPIDAPI_HOST;

  } else if (mode === 'bank') {
    if (!bank || !rekening) return res.status(400).json({ error: 'bank & rekening wajib untuk cek rekening.' });

    const validBanks = [
      'bank_bni', 'bank_bri', 'bank_bca', 'bank_mandiri',
      'bank_danamon', 'bank_permata', 'bank_btn', 'bank_btpn',
      'bank_bsi', 'bank_cimb', 'bank_digibank'
    ];

    if (!validBanks.includes(bank)) {
      return res.status(400).json({ error: 'Bank tidak dikenali atau belum didukung.' });
    }

    const selectedHost = process.env.RAPIDAPI_HOST_BANK;
    headers['x-rapidapi-host'] = selectedHost;
    url = `https://${selectedHost}/check_bank_lq/${bank}/${rekening}`;

  } else {
    return res.status(400).json({ error: 'Mode tidak valid. Gunakan "ewallet" atau "bank".' });
  }

  try {
    const response = await fetch(url, { method: 'GET', headers });
    const data = await response.json();

    console.log('📦 API Response:', JSON.stringify(data, null, 2));

    res.status(200).json(data);
  } catch (error) {
    console.error('❌ API error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
