export default async function handler(req, res) {
  const ALLOWED_IPS = [
    '127.0.0.1',
    '::1',
    '38.47.38.176',
    '45.201.166.118',
    '116.212.153.62',
    '96.9.95.126',
    '93.185.162.116',
  ];

  const FETCH_TIMEOUT_MS = 8000;

  try {
    let clientIp =
      req.headers['x-forwarded-for'] ||
      req.socket?.remoteAddress ||
      '';

    if (clientIp.includes(',')) clientIp = clientIp.split(',')[0].trim();

    console.log(`[DEBUG] Request masuk dari IP: ${clientIp}`);

    if (!ALLOWED_IPS.includes(clientIp)) {
      return res.status(403).json({
        success: false,
        error: `Akses ditolak, IP kamu (${clientIp}) belum di Whitelist.`,
        your_ip: clientIp,
      });
    }

    if (!process.env.RAPIDAPI_KEY) {
      console.error('[CRITICAL] RAPIDAPI_KEY belum disetting di Vercel!');
      return res.status(500).json({
        success: false,
        error: 'Server Config Error: API Key belum dipasang di Vercel.',
      });
    }

    const requestData = req.method === 'GET' ? req.query : (req.body || {});
    const { mode, id, provider, bank, rekening } = requestData;

    const headers = {
      'x-rapidapi-key': process.env.RAPIDAPI_KEY,
      'Content-Type': 'application/json',
    };

    let url = '';
    let input = {};

    if (mode === 'ewallet') {
      if (!id || !provider) {
        return res.status(400).json({
          success: false,
          is_valid: false,
          error: 'Data e-wallet tidak lengkap.',
          input: { id, provider },
        });
      }

      const p = String(provider).toLowerCase().trim();
      const host = process.env.RAPIDAPI_HOST || 'cek-e-wallet.p.rapidapi.com';
      headers['x-rapidapi-host'] = host;

      input = { id, provider: p };

      url =
        p === 'linkaja'
          ? `https://${host}/cekewallet/${encodeURIComponent(id)}/LINKAJA`
          : `https://${host}/cek_ewallet/${encodeURIComponent(id)}/${encodeURIComponent(p)}`;
    } else if (mode === 'bank') {
      if (!bank || !rekening) {
        return res.status(400).json({
          success: false,
          is_valid: false,
          error: 'Data bank tidak lengkap.',
          input: { bank, rekening },
        });
      }

      const host = 'cek-nomor-rekening-bank.p.rapidapi.com';
      headers['x-rapidapi-host'] = host;

      input = { bank, rekening };
      url = `https://${host}/check_bank_lq/${encodeURIComponent(bank)}/${encodeURIComponent(rekening)}`;
    } else {
      return res.status(400).json({
        success: false,
        is_valid: false,
        error: 'Mode tidak valid.',
        input,
      });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      console.log(`[DEBUG] Fetching URL: ${url}`);

      const apiReq = await fetch(url, {
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      const contentType = apiReq.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const text = await apiReq.text();
        console.error('[API ERROR] Response bukan JSON:', text);

        return res.status(502).json({
          success: false,
          is_valid: false,
          input,
          error: 'Provider API mengembalikan response non-JSON.',
          raw: text,
        });
      }

      const data = await apiReq.json();

      let isValid = false;
      if (mode === 'ewallet') {
        isValid =
          data?.data?.status === 'SUCCESS' &&
          !!data?.data?.name &&
          !!data?.data?.account_number;
      } else if (mode === 'bank') {
        isValid =
          data?.success === true &&
          !!data?.data?.nama &&
          !!data?.data?.no_rekening;
      }

      if (!apiReq.ok) {
        return res.status(apiReq.status).json({
          success: false,
          is_valid: false,
          input,
          error: data?.message || data?.error || 'Gagal validasi dari pusat.',
          data,
        });
      }

      return res.status(200).json({
        success: true,
        is_valid: isValid,
        input,
        data,
        error: isValid ? null : 'Data tidak valid / response tidak lengkap',
      });
    } catch (fetchError) {
      clearTimeout(timeout);

      const isAbort =
        fetchError?.name === 'AbortError' ||
        String(fetchError?.message || '').toLowerCase().includes('abort');

      return res.status(502).json({
        success: false,
        is_valid: false,
        input,
        error: isAbort
          ? 'Koneksi ke server pusat timeout.'
          : 'Koneksi ke server pusat gagal.',
      });
    }
  } catch (err) {
    console.error('[SERVER ERROR]', err);
    return res.status(500).json({
      success: false,
      error: `Internal Error: ${err.message}`,
    });
  }
}
