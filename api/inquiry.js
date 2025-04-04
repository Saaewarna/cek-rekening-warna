export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { bankCode, accountNumber, demoMode } = req.body;

  if (demoMode) {
    return res.status(200).json({
      status: 200,
      message: "Rekening ditemukan. (DEMO)",
      data: {
        bank: bankCode || "Bank Demo",
        rekening: accountNumber || "0000000000",
        name: "ERZA DEMO",
        saldo: "999999"
      }
    });
  }

  const token = "59|duOPH8HB155IQ7xmfzhVXhngOvniL08APtCqswX8bae08bd5";

  try {
    const storepandaRes = await fetch("https://storepanda.web.id/api/inquiry", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({ bankCode, accountNumber })
    });

    const data = await storepandaRes.json();
    res.status(storepandaRes.status).json(data);
  } catch (err) {
    res.status(500).json({ error: "Proxy error", details: err.message });
  }
}
