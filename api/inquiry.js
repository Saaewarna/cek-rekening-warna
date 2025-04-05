export default async function handler(req, res) {
  const { mode, id, provider, bank, rekening } = req.query;

  if (!mode) {
    return res.status(400).json({ error: 'Parameter mode wajib diisi (ewallet/bank).' });
  }

  const headers = {
    'x-rapidapi-key': process.env.RAPIDAPI_KEY,
  };

  try {
    let url = '';
    if (mode === 'ewallet') {
      if (!id || !provider) {
        return res.status(400).json({ error: 'Parameter id dan provider wajib diisi untuk e-wallet.' });
      }

      const endpointMap = {
        shopeepay: 'cekshopeepay',
        gopay: 'cekgopay',
        ovo: 'cekovo',
        dana: 'cekdana',
        linkaja: 'ceklinkaja',
      };

      const endpoint = endpointMap[provider];

      if (!endpoint) {
        return res.status(400).json({ error: 'Provider tidak dikenal atau belum didukung.' });
      }

      url = `https://${process.env.RAPIDAPI_HOST}/${endpoint}/${id}`;
      headers['x-rapidapi-host'] = process.env.RAPIDAPI_HOST;

    } else if (mode === 'bank') {
      if (!bank || !rekening) {
        return res.status(400).json({ error: 'Parameter bank dan rekening wajib diisi untuk cek rekening.' });
      }

      url = `https://${process.env.RAPIDAPI_HOST_BANK}/check_bank_lq/${bank}/${rekening}`;
      headers['x-rapidapi-host'] = process.env.RAPIDAPI_HOST_BANK;
    } else {
      return res.status(400).json({ error: 'Mode tidak valid. Gunakan "ewallet" atau "bank".' });
    }

    const response = await fetch(url, { method: 'GET', headers });
    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    console.error('API error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
