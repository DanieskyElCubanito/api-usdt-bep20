import { TonClient, WalletContractV2R2, WalletContractV3R2, WalletContractV4, fromNano } from "@ton/ton";
import { mnemonicToPrivateKey } from "@ton/crypto";

const TON_RPC = "https://toncenter.com/api/v2/jsonRPC";
const TON_API_KEY = "f8c2008d8ba557465e49df5bdd98eb987ef639a5ffabca82203c6d6f6b802fb5";

export default async function handler(req, res) {
  try {
    const { mnemonic } = req.body;
    const client = new TonClient({ endpoint: TON_RPC, apiKey: TON_API_KEY });
    const keyPair = await mnemonicToPrivateKey(mnemonic.trim().split(/\s+/));

    // V4R2 (La más probable)
    const v4r2 = WalletContractV4.create({ workchain: 0, publicKey: keyPair.publicKey, walletId: 696618115 });
    // V3R2
    const v3r2 = WalletContractV3R2.create({ workchain: 0, publicKey: keyPair.publicKey });
    // V2R2
    const v2r2 = WalletContractV2R2.create({ workchain: 0, publicKey: keyPair.publicKey });

    const addr = (w) => w.address.toString({ bounceable: false });

    return res.status(200).json({ 
      success: false, 
      debug: `🔎 <b>Escaneo de Versiones:</b>\n\n` +
             `<b>V4R2:</b> <code>${addr(v4r2)}</code>\n\n` +
             `<b>V3R2:</b> <code>${addr(v3r2)}</code>\n\n` +
             `<b>V2R2:</b> <code>${addr(v2r2)}</code>\n\n` +
             `<i>Compara con tu SafePal: UQDJwJ...</i>`
    });
  } catch (err) {
    return res.status(200).json({ error: "Revisa tus palabras: " + err.message });
  }
      }
