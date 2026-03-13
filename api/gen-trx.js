const TronWeb = require('tronweb');

export default async function handler(req, res) {
  try {
    const tronWeb = new TronWeb({
      fullHost: 'https://api.trongrid.io'
    });

    const account = await tronWeb.createAccount();

    res.status(200).json({
      address: account.address.base58,
      privateKey: account.privateKey
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
