const url = `https://check-id-ovo-gopay-shopee-linkaja-dana.p.rapidapi.com/cek_ewallet/${id}/${provider}`;

const options = {
  method: 'GET',
  headers: {
    'x-rapidapi-host': 'check-id-ovo-gopay-shopee-linkaja-dana.p.rapidapi.com', // ← hardcoded dulu
    'x-rapidapi-key': 'f25158c23dmshfe6d6692cc150e5p158bd1jsndeeb3f95e537'
},
};
