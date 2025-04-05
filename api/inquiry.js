export default async function handler(req, res) {
  const { mode, id, provider, bank, rekening } = req.query;

  if (!mode) return res.status(400).json({ error: 'Parameter mode wajib diisi (ewallet/bank).' });

  let url = '';
  let headers = {
    'x-rapidapi-key': process.env.RAPIDAPI_KEY
  };

  if (mode === 'ewallet') {
    if (!id || !provider) {
      return res.status(400).json({ error: 'id & provider wajib untuk ewallet.' });
    }

    url = `https://${process.env.RAPIDAPI_HOST}/cek_ewallet/${id}/${provider}`;
    headers['x-rapidapi-host'] = process.env.RAPIDAPI_HOST;

  } else if (mode === 'bank') {
    if (!bank || !rekening) {
      return res.status(400).json({ error: 'bank & rekening wajib untuk cek rekening.' });
    }

    const bankHostMap = {
      bank_bca: 'cek-nomor-rekening-bca.p.rapidapi.com',
      bank_bni: 'cek-nomor-rekening-bni.p.rapidapi.com',
      bank_bri: 'cek-nomor-rekening-bri.p.rapidapi.com',
      bank_mandiri: 'cek-nomor-rekening-bank-mandiri.p.rapidapi.com',
      bank_cimb: 'cek-nomor-rekening-cimb.p.rapidapi.com',
      bank_digibank: 'cek-nomor-rekening-digibank.p.rapidapi.com',
      bank_bsi: 'cek-nomor-rekening-bsi-indonesia.p.rapidapi.com',
      bank_btn: 'cek-nomor-rekening-btn.p.rapidapi.com',
      bank_btpn: 'cek-nomor-rekening-btpn-jenius.p.rapidapi.com',
      bank_danamon: 'cek-nomor-rekening-bank-danamon.p.rapidapi.com',
      bank_permata: 'cek-nomor-rekening-bank-permata.p.rapidapi.com'
    };

    const selectedHost = bankHostMap[bank];
    if (!selectedHost) return res.status(400).json({ error: 'Bank tidak dikenali atau belum didukung.' });

    headers['x-rapidapi-host'] = selectedHost;

    let path = '';
    switch (bank) {
      case 'bank_bca': path = `check_bca/${rekening}`; break;
      case 'bank_bni': path = `check_bni/${rekening}`; break;
      case 'bank_bri': path = `check_bri/${rekening}`; break;
      case 'bank_mandiri': path = `check_bank_lq/bank_mandiri/${rekening}`; break;
      case 'bank_cimb': path = `check_cimb/${rekening}`; break;
      case 'bank_digibank': path = `check_digibank/${rekening}`; break;
      case 'bank_bsi': path = `check_bsi/${rekening}`; break;
      case 'bank_btn': path = `check_btn/${rekening}`; break;
      case 'bank_btpn': path = `check_btpn/${rekening}`; break;
      case 'bank_danamon': path = `check_danamon/${rekening}`; break;
      case 'bank_permata': path = `check_permata/${rekening}`; break;
      default:
        return res.status(400).json({ error: 'Endpoint untuk bank belum ditentukan.' });
    }

    url = `https://${selectedHost}/${path}`;
  } else {
    return res.status(400).json({ error: 'Mode tidak valid. Gunakan "ewallet" atau "bank".' });
  }

  try {
    const response = await fetch(url, { method: 'GET', headers });
    const data = await response.json();

    console.log('📦 API Response:', JSON.stringify(data, null, 2)); // ← Biar bisa dilihat di log Vercel

    res.status(200).json(data);
  } catch (error) {
    console.error('❌ API error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
