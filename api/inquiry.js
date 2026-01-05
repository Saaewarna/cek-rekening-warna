export default async function handler(req, res) {
  const { mode, id, provider, bank, rekening } = req.query;

  if (!mode) {
    return res.status(400).json({ error: 'Parameter mode wajib diisi (ewallet/bank).' });
  }

  // Gunakan API Key dari Environment Variable agar aman
  const API_KEY = process.env.8sqrhsP2Vok5s6C77Qz6vaiovJevQTdeUcZUXzletZEH1gwa6O; 
  const BASE_URL = "https://use.api.co.id/api/v1/bank/validate";

  const sanitizedId = mode === 'ewallet' ? id?.trim() : rekening?.trim();
  const serviceCode = mode === 'ewallet' ? provider?.trim() : bank?.trim();

  if (!sanitizedId || !serviceCode) {
    return res.status(400).json({ error: 'Data nomor dan bank/provider harus lengkap.' });
  }

  try {
    const response = await fetch(BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        bank: serviceCode,
        number: sanitizedId
      })
    });

    const result = await response.json();

    if (result.status === true || result.success === true) {
      // Format response disamakan agar frontend tidak perlu banyak ubah
      return res.status(200).json({
        success: true,
        data: {
          nama: result.data.name || result.data.account_name,
          no_rekening: sanitizedId,
          nama_bank: serviceCode.toUpperCase()
        }
      });
    } else {
      return res.status(404).json({ error: result.message || 'Data tidak ditemukan.' });
    }
  } catch (error) {
    return res.status(500).json({ error: 'Gagal menghubungi server api.co.id' });
  }
}
