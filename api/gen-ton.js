import { mnemonicNew, mnemonicToPrivateKey } from "@ton/crypto";
import { WalletContractV4 } from "@ton/ton";

export default async function handler(req, res) {
  try {
    const mnemonic = await mnemonicNew();
    const keyPair = await mnemonicToPrivateKey(mnemonic);
    const wallet = WalletContractV4.create({
      workchain: 0,
      publicKey: keyPair.publicKey,
    });

    res.status(200).json({
      address: wallet.address.toString({ bounceable: false }),
      seed: mnemonic.join(" ")
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
