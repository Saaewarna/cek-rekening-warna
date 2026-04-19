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

    if (clientIp.includes(',')) {
      clientIp = clientIp.split(',')[0].trim();
    }

    console.log(`[DEBUG] Request masuk dari IP: ${clientIp}`);

    if (!ALLOWED_IPS.includes(clientIp)) {
      return res.status(403).json({
        success: false,
        is_valid: false,
        error: `Akses ditolak, IP kamu (${clientIp}) belum di Whitelist.`,
        your_ip: clientIp,
      });
    }

    if (!process.env.RAPIDAPI_KEY) {
      console.error('[CRITICAL] RAPIDAPI_KEY belum disetting di Vercel!');
      return res.status(500).json({
        success: false,
        is_valid: false,
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
        input: {},
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

      const raw = await apiReq.json();

      if (!apiReq.ok) {
        return res.status(apiReq.status).json({
          success: false,
          is_valid: false,
          input,
          error: raw?.message || raw?.error || 'Gagal validasi dari pusat.',
          raw,
        });
      }

      let normalized = null;
      let isValid = false;

      if (mode === 'ewallet') {
        const d = raw?.data || raw || {};

        normalized = {
          nama:
            d?.name ||
            d?.nama ||
            d?.account_name ||
            d?.owner_name ||
            '',
          nomor:
            d?.account_number ||
            d?.id ||
            d?.number ||
            d?.phone ||
            input.id ||
            '',
          provider:
            d?.bank ||
            d?.wallet ||
            d?.provider ||
            input.provider ||
            '',
          status:
            d?.status ||
            raw?.status ||
            '',
        };

        isValid = Boolean(normalized.nama && normalized.nomor);
      }

      if (mode === 'bank') {
        const d = raw?.data || raw || {};

        normalized = {
          nama:
            d?.nama ||
            d?.name ||
            d?.account_name ||
            d?.owner_name ||
            '',
          nomor:
            d?.no_rekening ||
            d?.account_number ||
            d?.rekening ||
            d?.number ||
            input.rekening ||
            '',
          bank:
            d?.nama_bank ||
            d?.bank_name ||
            d?.bank ||
            input.bank ||
            '',
        };

        isValid = Boolean(normalized.nama && normalized.nomor);
      }

      return res.status(200).json({
        success: true,
        is_valid: isValid,
        input,
        normalized,
        raw,
        error: isValid ? null : 'Data validasi tidak cocok dengan format yang dikenali.',
      });
    } catch (fetchError) {
      clearTimeout(timeout);

      const errorName = fetchError?.name || 'UnknownError';
      const errorMessage = fetchError?.message || String(fetchError);
      const lowerMessage = errorMessage.toLowerCase();

      const isAbort =
        errorName === 'AbortError' || lowerMessage.includes('abort');

      let friendlyError = 'Koneksi ke server pusat gagal.';

      if (isAbort) {
        friendlyError = 'Koneksi ke server pusat timeout.';
      } else if (lowerMessage.includes('fetch failed')) {
        friendlyError = 'Koneksi ke provider gagal (fetch failed).';
      } else if (lowerMessage.includes('network')) {
        friendlyError = 'Koneksi jaringan ke provider bermasalah.';
      } else if (lowerMessage.includes('dns')) {
        friendlyError = 'DNS provider gagal di-resolve.';
      } else if (lowerMessage.includes('tls') || lowerMessage.includes('ssl')) {
        friendlyError = 'Koneksi SSL/TLS ke provider gagal.';
      } else if (lowerMessage.includes('socket')) {
        friendlyError = 'Koneksi socket ke provider terputus.';
      }

      console.error('[FETCH ERROR DETAIL]', {
        name: errorName,
        message: errorMessage,
        mode,
        input,
        url,
      });

      return res.status(502).json({
        success: false,
        is_valid: false,
        input,
        error: friendlyError,
        debug: {
          name: errorName,
          message: errorMessage,
        },
      });
    }
  } catch (err) {
    console.error('[SERVER ERROR]', err);
    return res.status(500).json({
      success: false,
      is_valid: false,
      error: `Internal Error: ${err.message}`,
    });
  }
}
