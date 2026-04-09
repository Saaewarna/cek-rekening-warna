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

  const MAX_BULK = 50;
  const CONCURRENCY = 5;

  try {
    // ==========================================
    // 1. CEK IP
    // ==========================================
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

    // ==========================================
    // 2. CEK API KEY
    // ==========================================
    if (!process.env.RAPIDAPI_KEY) {
      console.error('[CRITICAL] RAPIDAPI_KEY belum disetting di Vercel!');
      return res.status(500).json({
        error: 'Server Config Error: API Key belum dipasang di Vercel.',
      });
    }

    // ==========================================
    // 3. HELPER FETCH SINGLE
    // ==========================================
    async function fetchSingleInquiry({ mode, id, provider, bank, rekening }) {
      const headers = {
        'x-rapidapi-key': process.env.RAPIDAPI_KEY,
        'Content-Type': 'application/json',
      };

      let url = '';

      if (mode === 'ewallet') {
        if (!id || !provider) {
          return {
            success: false,
            error: 'Data e-wallet tidak lengkap.',
            input: { id, provider },
          };
        }

        const p = provider.toLowerCase().trim();
        const host = process.env.RAPIDAPI_HOST || 'cek-e-wallet.p.rapidapi.com';
        headers['x-rapidapi-host'] = host;

        url =
          p === 'linkaja'
            ? `https://${host}/cekewallet/${encodeURIComponent(id)}/LINKAJA`
            : `https://${host}/cek_ewallet/${encodeURIComponent(id)}/${encodeURIComponent(p)}`;
      } else if (mode === 'bank') {
        if (!bank || !rekening) {
          return {
            success: false,
            error: 'Data bank tidak lengkap.',
            input: { bank, rekening },
          };
        }

        const host = 'cek-nomor-rekening-bank.p.rapidapi.com';
        headers['x-rapidapi-host'] = host;

        url = `https://${host}/check_bank_lq/${encodeURIComponent(bank)}/${encodeURIComponent(rekening)}`;
      } else {
        return {
          success: false,
          error: 'Mode tidak valid.',
        };
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      try {
        console.log(`[DEBUG] Fetching URL: ${url}`);
        const apiReq = await fetch(url, {
          headers,
          signal: controller.signal,
        });

        clearTimeout(timeout);

        const contentType = apiReq.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          const text = await apiReq.text();
          console.error('[API ERROR] Response bukan JSON:', text);
          return {
            success: false,
            error: 'Provider API mengembalikan response non-JSON.',
            raw: text,
          };
        }

        const data = await apiReq.json();

        if (!apiReq.ok) {
          return {
            success: false,
            error: data.message || data.error || 'Gagal validasi dari pusat.',
            data,
          };
        }

        return {
          success: true,
          data,
        };
      } catch (fetchError) {
        clearTimeout(timeout);
        console.error('[FETCH ERROR]', fetchError);
        return {
          success: false,
          error: 'Koneksi ke server pusat timeout/gagal.',
        };
      }
    }

    // ==========================================
    // 4. BULK MODE (POST)
    // ==========================================
    if (req.method === 'POST') {
      const { mode, items } = req.body || {};

      if (!mode || !Array.isArray(items)) {
        return res.status(400).json({
          success: false,
          error: 'Body harus berisi mode dan items[].',
        });
      }

      if (items.length < 1) {
        return res.status(400).json({
          success: false,
          error: 'Items tidak boleh kosong.',
        });
      }

      if (items.length > MAX_BULK) {
        return res.status(400).json({
          success: false,
          error: `Maksimal bulk ${MAX_BULK} data per request.`,
        });
      }

      const results = [];

      for (let i = 0; i < items.length; i += CONCURRENCY) {
        const chunk = items.slice(i, i + CONCURRENCY);

        const chunkResults = await Promise.all(
          chunk.map(async (item) => {
            const result = await fetchSingleInquiry({
              mode,
              id: item.id,
              provider: item.provider,
              bank: item.bank,
              rekening: item.rekening,
            });

            return {
              input: item,
              ...result,
            };
          })
        );

        results.push(...chunkResults);
      }

      const successCount = results.filter((r) => r.success).length;
      const failedCount = results.length - successCount;

      return res.status(200).json({
        success: true,
        mode,
        total: results.length,
        success_count: successCount,
        failed_count: failedCount,
        results,
      });
    }

    // ==========================================
    // 5. SINGLE MODE (GET)
    // ==========================================
    const { mode, id, provider, bank, rekening } = req.query;

    const single = await fetchSingleInquiry({
      mode,
      id,
      provider,
      bank,
      rekening,
    });

    if (!single.success) {
      return res.status(400).json(single);
    }

    return res.status(200).json(single.data);
  } catch (err) {
    console.error('[SERVER ERROR]', err);
    return res.status(500).json({
      error: `Internal Error: ${err.message}`,
    });
  }
}
