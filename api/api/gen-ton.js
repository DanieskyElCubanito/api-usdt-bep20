import { mnemonicNew, mnemonicToPrivateKey } from "@ton/crypto";
import { WalletContractV4 } from "@ton/ton";

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).send('Método no permitido');
  
  try {
    // Generar 24 palabras
    const mnemonic = await mnemonicNew();
    const keyPair = await mnemonicToPrivateKey(mnemonic);

    // Crear la billetera v4R2
    const wallet = WalletContractV4.create({
      workchain: 0,
      publicKey: keyPair.publicKey,
    });

    res.status(200).json({
      address: wallet.address.toString({ bounceable: false }),
      seed: mnemonic.join(" ") // Esto lo guardaremos en el bot para poder retirar
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
