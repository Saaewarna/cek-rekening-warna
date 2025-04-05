export default async function handler(req, res) {
  const { mode, id, provider, bank, rekening } = req.query;

  const headers = {
    'x-rapidapi-key': process.env.RAPIDAPI_KEY
  };

  let url = '';
  let host = '';

  if (!mode) {
    return res.status(400).json({ error: 'Parameter mode wajib diisi (ewallet/bank).' });
  }

  if (mode === 'ewallet') {
    if (!id || !provider) {
      return res.status(400).json({ error: 'Parameter id dan provider wajib diisi untuk e-wallet.' });
    }

    host = process.env.RAPIDAPI_HOST; // e.g. check-id-ovo-gopay-shopee-linkaja-dana.p.rapidapi.com
    url = `https://${host}/cekewallet/${id}/${provider}`;
    headers['x-rapidapi-host'] = host;

  } else if (mode === 'bank') {
    if (!bank || !rekening) {
      return res.status(400).json({ error: 'Parameter bank dan rekening wajib diisi untuk cek rekening.' });
    }

    host = process.env.RAPIDAPI_HOST_BANK; // e.g. cek-nomor-rekening-bank.p.rapidapi.com
    url = `https://${host}/check_bank_lq/${bank}/${rekening}`;
    headers['x-rapidapi-host'] = host;

  } else {
    return res.status(400).json({ error: 'Mode tidak valid. Gunakan "ewallet" atau "bank".' });
  }

  try {
    const response = await fetch(url, { method: 'GET', headers });
    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    res.status(200).json(data);
  } catch (err) {
    console.error('API error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
