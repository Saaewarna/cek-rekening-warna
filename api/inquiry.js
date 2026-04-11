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

  const MAX_BULK = 10;
  const CONCURRENCY = 1;
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

    function detectIsValid(mode, data) {
      if (!data) return false;

      if (mode === 'ewallet') {
        return (
          data?.data?.status === 'SUCCESS' &&
          !!data?.data?.name &&
          !!data?.data?.account_number
        );
      }

      if (mode === 'bank') {
        return (
          data?.success === true &&
          !!data?.data?.nama &&
          !!data?.data?.no_rekening
        );
      }

      return false;
    }

    function sleep(ms) {
      return new Promise((resolve) => setTimeout(resolve, ms));
    }

    function buildRequestConfig({ mode, id, provider, bank, rekening }) {
      const headers = {
        'x-rapidapi-key': process.env.RAPIDAPI_KEY,
        'Content-Type': 'application/json',
      };

      let url = '';
      let input = {};

      if (mode === 'ewallet') {
        if (!id || !provider) {
          return {
            ok: false,
            result: {
              success: false,
              is_valid: false,
              error: 'Data e-wallet tidak lengkap.',
              input: { id, provider },
            },
          };
        }

        const p = String(provider).toLowerCase().trim();
        const host = process.env.RAPIDAPI_HOST || 'cek-e-wallet.p.rapidapi.com';
        headers['x-rapidapi-host'] = host;

        input = { id, provider: p };

        url =
          p === 'linkaja'
            ? `https://${host}/cekewallet/${encodeURIComponent(id)}/LINKAJA`
            : `https://${host}/cek_ewallet/${encodeURIComponent(id)}/${encodeURIComponent(p)}`;

        return { ok: true, headers, url, input };
      }

      if (mode === 'bank') {
        if (!bank || !rekening) {
          return {
            ok: false,
            result: {
              success: false,
              is_valid: false,
              error: 'Data bank tidak lengkap.',
              input: { bank, rekening },
            },
          };
        }

        const host = 'cek-nomor-rekening-bank.p.rapidapi.com';
        headers['x-rapidapi-host'] = host;
        input = { bank, rekening };

        url = `https://${host}/check_bank_lq/${encodeURIComponent(bank)}/${encodeURIComponent(rekening)}`;

        return { ok: true, headers, url, input };
      }

      return {
        ok: false,
        result: {
          success: false,
          is_valid: false,
          error: 'Mode tidak valid.',
          input: {},
        },
      };
    }

    async function doFetchOnce({ url, headers, mode, input }) {
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

          return {
            success: false,
            is_valid: false,
            input,
            error: 'Provider API mengembalikan response non-JSON.',
            raw: text,
          };
        }

        const data = await apiReq.json();
        const isValid = detectIsValid(mode, data);

        if (!apiReq.ok) {
          return {
            success: false,
            is_valid: false,
            input,
            error: data?.message || data?.error || 'Gagal validasi dari pusat.',
            data,
          };
        }

        return {
          success: true,
          is_valid: isValid,
          input,
          data,
          error: isValid ? null : 'Data tidak valid / response tidak lengkap',
        };
      } catch (fetchError) {
        clearTimeout(timeout);
        console.error('[FETCH ERROR]', fetchError);

        const isAbort =
          fetchError?.name === 'AbortError' ||
          String(fetchError?.message || '').toLowerCase().includes('abort');

        return {
          success: false,
          is_valid: false,
          input,
          error: isAbort
            ? 'Koneksi ke server pusat timeout.'
            : 'Koneksi ke server pusat gagal.',
        };
      }
    }

    async function fetchSingleInquiry(
      { mode, id, provider, bank, rekening },
      { allowRetry = false } = {}
    ) {
      const config = buildRequestConfig({ mode, id, provider, bank, rekening });

      if (!config.ok) {
        return config.result;
      }

      const firstTry = await doFetchOnce({
        url: config.url,
        headers: config.headers,
        mode,
        input: config.input,
      });

      if (firstTry.success || !allowRetry) {
        return firstTry;
      }

      await sleep(1000);

      const secondTry = await doFetchOnce({
        url: config.url,
        headers: config.headers,
        mode,
        input: config.input,
      });

      return secondTry;
    }

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
          error: `Maksimal ${MAX_BULK} data per request.`,
        });
      }

      const results = [];

      for (let i = 0; i < items.length; i += CONCURRENCY) {
        const chunk = items.slice(i, i + CONCURRENCY);

        const chunkResults = await Promise.all(
          chunk.map((item) =>
            fetchSingleInquiry(
              {
                mode,
                id: item.id,
                provider: item.provider,
                bank: item.bank,
                rekening: item.rekening,
              },
              { allowRetry: false } // BULK TANPA RETRY
            )
          )
        );

        results.push(...chunkResults);
      }

      const successCount = results.filter((r) => r.is_valid === true).length;
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

    const { mode, id, provider, bank, rekening } = req.query;

    const single = await fetchSingleInquiry(
      { mode, id, provider, bank, rekening },
      { allowRetry: true } // SINGLE BOLEH RETRY 1X
    );

    if (!single.success) {
      return res.status(400).json(single);
    }

    return res.status(200).json(single.data);
  } catch (err) {
    console.error('[SERVER ERROR]', err);
    return res.status(500).json({
      success: false,
      error: `Internal Error: ${err.message}`,
    });
  }
}
