export default async function handler(req, res) {
  const { mode, id, provider, bank, rekening } = req.query;

  if (!mode) {
    return res.status(400).json({ error: 'Parameter mode wajib diisi (ewallet/bank).' });
  }

  let url = '';
  let headers = {
    'x-rapidapi-key': process.env.RAPIDAPI_KEY,
  };

  try {
    if (mode === 'ewallet') {
      if (!id || !provider) {
        return res.status(400).json({ error: 'Parameter id dan provider wajib diisi untuk e-wallet.' });
      }

      const ewalletBase = process.env.RAPIDAPI_HOST;
      headers['x-rapidapi-host'] = ewalletBase;

      // Adjust endpoint per provider
      switch (provider) {
        case 'shopeepay':
        case 'gopay':
        case 'ovo':
        case 'linkaja':
        case 'dana':
          url = `https://${ewalletBase}/cekwallet/${id}`;
          break;
        default:
          return res.status(400).json({ error: 'Provider tidak dikenali atau belum didukung.' });
      }

    } else if (mode === 'bank') {
      if (!bank || !rekening) {
        return res.status(400).json({ error: 'Parameter bank dan rekening wajib diisi untuk cek rekening.' });
      }

      const bankHost = process.env.RAPIDAPI_HOST_BANK;
      headers['x-rapidapi-host'] = bankHost;
      url = `https://${bankHost}/check_bank_lq/${bank}/${rekening}`;
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
