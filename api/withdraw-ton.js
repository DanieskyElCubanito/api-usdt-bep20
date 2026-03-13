import { TonClient, WalletContractV4, fromNano } from "@ton/ton";
import { mnemonicToPrivateKey } from "@ton/crypto";

export default async function handler(req, res) {
  try {
    const { mnemonic } = req.body;
    
    // 1. Probamos la derivación estándar de TON
    const keyPair = await mnemonicToPrivateKey(mnemonic.trim().split(/\s+/));
    
    // 2. Probamos con un Wallet ID alternativo que a veces usan apps multi-moneda
    const walletStandard = WalletContractV4.create({ workchain: 0, publicKey: keyPair.publicKey });
    const walletSafePalAlt = WalletContractV4.create({ workchain: 0, publicKey: keyPair.publicKey, walletId: 696618115 });

    const addr1 = walletStandard.address.toString({ bounceable: false });
    const addr2 = walletSafePalAlt.address.toString({ bounceable: false });

    return res.status(200).json({ 
      success: false, 
      debug: `🔎 <b>Intento de Sincronización Final:</b>\n\n` +
             `<b>Opción A (Estándar):</b>\n<code>${addr1}</code>\n\n` +
             `<b>Opción B (SafePal ID):</b>\n<code>${addr2}</code>\n\n` +
             `<i>Tu dirección buscada: UQDJwJ...</i>\n\n` +
             `⚠️ <b>Si ninguna coincide:</b> Ve a SafePal > Configuración de la billetera y dime si tienes activada la 'Frase de paso' o 'Passphrase'.`
    });
  } catch (err) {
    return res.status(200).json({ error: err.message });
  }
                                }
