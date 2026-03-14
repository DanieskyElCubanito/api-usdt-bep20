const doge = require('bitcore-lib-doge');

export default async function handler(req, res) {
  try {
    const privateKey = new doge.PrivateKey();
    const address = privateKey.toAddress();

    res.status(200).json({
      address: address.toString(),
      privateKey: privateKey.toString()
    });
  } catch (error) {
    res.status(500).json({ error: "Error generando wallet DOGE: " + error.message });
  }
}
