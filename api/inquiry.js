// api/inquiry.js (for Vercel serverless function)
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { bankCode, accountNumber } = req.body;
  const token = "59|duOPH8HB155IQ7xmfzhVXhngOvniL08APtCqswX8bae08bd5";

  try {
    const response = await fetch("https://storepanda.web.id/api/inquiry", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({ bankCode, accountNumber })
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    res.status(500).json({ error: "Proxy error", detail: err.message });
  }
}
