export default async function handler(req, res) {
  const { id, provider } = req.query;

  const url = `https://check-id-ovo-gopay-shopee-linkaja-dana.p.rapidapi.com/cek_ewallet/${id}/${provider}`;

  const options = {
    method: 'GET',
    headers: {
      'x-rapidapi-host': 'check-id-ovo-gopay-shopee-linkaja-dana.p.rapidapi.com', // hardcoded for debug
      'x-rapidapi-key': 'f25158c23dmshfe6d6692cc150e5p158bd1jsndeeb3f95e537'
    }
  };

  try {
    const response = await fetch(url, options);
    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    console.error('API error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
