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

    const hostMap = {
      bank_bca: "cek-nomor-rekening-bca.p.rapidapi.com",
      bank_bni: "cek-nomor-rekening-bni.p.rapidapi.com",
      bank_bri: "cek-nomor-rekening-bri.p.rapidapi.com",
      bank_mandiri: "cek-nomor-rekening-mandiri.p.rapidapi.com",
      bank_btn: "cek-nomor-rekening-btn.p.rapidapi.com",
      bank_danamon: "cek-nomor-rekening-bank-danamon.p.rapidapi.com",
      bank_btpn: "cek-nomor-rekening-btpn-jenius.p.rapidapi.com",
      bank_bsi: "cek-nomor-rekening-bsi-indonesia.p.rapidapi.com",
      bank_digibank: "cek-nomor-rekening-digibank.p.rapidapi.com",
      bank_permata: "cek-nomor-rekening-bank-permata.p.rapidapi.com",
      bank_cimb_niaga: "cek-nomor-rekening-cimb-niaga.p.rapidapi.com",
      bank_dbs_indonesia: "cek-nomor-rekening-dbs-indonesia.p.rapidapi.com"
    };

    const pathMap = {
      bank_bca: "check_bank_lq/bank_bca",
      bank_bni: "check_bank_lq/bank_bni",
      bank_bri: "check_bank_lq/bank_bri",
      bank_mandiri: "check_bank_lq/bank_mandiri",
      bank_btn: "check_bank_lq/bank_btn",
      bank_danamon: "check_bank_lq/bank_danamon",
      bank_btpn: "check_bank_lq/bank_btpn",
      bank_bsi: "check_bank_lq/bank_bsi",
      bank_digibank: "check_bank_lq/bank_digibank",
      bank_permata: "check_bank_lq/bank_permata",
      bank_cimb_niaga: "check_bank_lq/bank_cimb_niaga",
      bank_dbs_indonesia: "check_bank_lq/bank_dbs_indonesia"
    };

    const selectedHost = hostMap[sanitizedBank];
    const selectedPath = pathMap[sanitizedBank];

    if (!selectedHost || !selectedPath) {
      return res.status(400).json({ error: 'Bank tidak didukung.' });
    }

    url = `https://${selectedHost}/${selectedPath}/${sanitizedRekening}`;
    headers["x-rapidapi-host"] = selectedHost;

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
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
