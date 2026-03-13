import { TonClient, WalletContractV3R2, WalletContractV4, fromNano } from "@ton/ton";
import { mnemonicToPrivateKey } from "@ton/crypto";

const TON_RPC = "https://toncenter.com/api/v2/jsonRPC";
const TON_API_KEY = "f8c2008d8ba557465e49df5bdd98eb987ef639a5ffabca82203c6d6f6b802fb5";

export default async function handler(req, res) {
  try {
    const { mnemonic } = req.body;
    const client = new TonClient({ endpoint: TON_RPC, apiKey: TON_API_KEY });
    const keyPair = await mnemonicToPrivateKey(mnemonic.trim().split(/\s+/));

    // Probar Versión 4 R2 (SafePal estándar)
    const walletV4 = WalletContractV4.create({ workchain: 0, publicKey: keyPair.publicKey });
    const addrV4 = walletV4.address.toString({ bounceable: false });

    // Probar Versión 3 R2 (Antigua)
    const walletV3 = WalletContractV3R2.create({ workchain: 0, publicKey: keyPair.publicKey });
    const addrV3 = walletV3.address.toString({ bounceable: false });

    return res.status(200).json({ 
      success: false, 
      debug: `🔎 <b>Resultado del Escaneo:</b>\n\n` +
             `<b>Si tu versión es V4R2:</b>\n<code>${addrV4}</code>\n\n` +
             `<b>Si tu versión es V3R2:</b>\n<code>${addrV3}</code>\n\n` +
             `<i>Dime cuál de estas dos aparece en tu SafePal.</i>`
    });
  } catch (err) {
    return res.status(200).json({ error: err.message });
  }
}
