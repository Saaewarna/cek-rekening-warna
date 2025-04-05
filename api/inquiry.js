export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id, provider } = req.query;

  if (!id || !provider) {
    return res.status(400).json({ error: 'Missing id or provider' });
  }

  const url = `https://check-id-ovo-gopay-shopee-linkaja-dana.p.rapidapi.com/cek_ewallet/${id}/${provider}`;

  const options = {
    method: 'GET',
    headers: {
      'x-rapidapi-host': process.env.RAPIDAPI_HOST,
      'x-rapidapi-key': process.env.RAPIDAPI_KEY,
    },
  };

  try {
    const response = await fetch(url, options);
    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
