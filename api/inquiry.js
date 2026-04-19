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

    if (!ALLOWED_IPS.includes(clientIp)) {
      return res.status(403).json({
        success: false,
        is_valid: false,
        validation_status: 'INVALID',
        error: `Akses ditolak, IP kamu (${clientIp}) belum di Whitelist.`,
        your_ip: clientIp,
      });
    }

    if (!process.env.RAPIDAPI_KEY) {
      return res.status(500).json({
        success: false,
        is_valid: false,
        validation_status: 'INVALID',
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
          validation_status: 'INVALID',
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
          validation_status: 'INVALID',
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
        validation_status: 'INVALID',
        error: 'Mode tidak valid.',
        input: {},
      });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const apiReq = await fetch(url, {
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      const contentType = apiReq.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const text = await apiReq.text();
        return res.status(502).json({
          success: false,
          is_valid: false,
          validation_status: 'INVALID',
          input,
          error: 'Provider API mengembalikan response non-JSON.',
          raw_text: text,
        });
      }

      const raw = await apiReq.json();

      if (!apiReq.ok) {
        return res.status(apiReq.status).json({
          success: false,
          is_valid: false,
          validation_status: 'INVALID',
          input,
          error: raw?.message || raw?.error || 'Gagal validasi dari pusat.',
          raw,
        });
      }

      let normalized = {};
      let validation_status = 'INVALID';
      let is_valid = false;

      if (mode === 'ewallet') {
        const d = raw?.data || raw || {};

        normalized = {
          nama:
            d?.name ||
            d?.nama ||
            d?.account_name ||
            d?.account_holder ||
            d?.owner_name ||
            d?.customer_name ||
            d?.holder ||
            '',
          nomor:
            d?.account_number ||
            d?.id ||
            d?.number ||
            d?.phone ||
            d?.hp ||
            d?.accountNo ||
            input.id ||
            '',
          provider:
            d?.bank ||
            d?.wallet ||
            d?.provider ||
            d?.channel ||
            input.provider ||
            '',
          status:
            d?.status ||
            raw?.status ||
            '',
        };

        const hasNomor = Boolean(normalized.nomor);
        const hasNama = Boolean(normalized.nama);

        if (hasNomor && hasNama) {
          validation_status = 'VALID';
          is_valid = true;
        } else if (hasNomor) {
          validation_status = 'PARTIAL';
          is_valid = true;
        }
      } else {
        const d = raw?.data || raw || {};

        normalized = {
          nama:
            d?.nama ||
            d?.name ||
            d?.account_name ||
            d?.account_holder ||
            d?.owner_name ||
            d?.beneficiary_name ||
            d?.holder ||
            '',
          nomor:
            d?.no_rekening ||
            d?.account_number ||
            d?.rekening ||
            d?.number ||
            d?.accountNo ||
            input.rekening ||
            '',
          bank:
            d?.nama_bank ||
            d?.bank_name ||
            d?.bank ||
            d?.issuer_bank ||
            input.bank ||
            '',
        };

        const hasNomor = Boolean(normalized.nomor);
        const hasNama = Boolean(normalized.nama);

        if (hasNomor && hasNama) {
          validation_status = 'VALID';
          is_valid = true;
        } else if (hasNomor) {
          validation_status = 'PARTIAL';
          is_valid = true;
        }
      }

      return res.status(200).json({
        success: true,
        is_valid,
        validation_status,
        input,
        normalized,
        raw,
        error:
          validation_status === 'INVALID'
            ? 'Data validasi tidak cocok dengan format yang dikenali.'
            : null,
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

      return res.status(502).json({
        success: false,
        is_valid: false,
        validation_status: 'INVALID',
        input,
        error: friendlyError,
        debug: {
          name: errorName,
          message: errorMessage,
        },
      });
    }
  } catch (err) {
    return res.status(500).json({
      success: false,
      is_valid: false,
      validation_status: 'INVALID',
      error: `Internal Error: ${err.message}`,
    });
  }
}
