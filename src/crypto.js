import sodium from 'libsodium-wrappers';

export async function initCrypto() {
  await sodium.ready;
}

export function generateKeyPair() {
  const kp = sodium.crypto_box_keypair();
  return {
    publicKey: sodium.to_base64(kp.publicKey),
    privateKey: sodium.to_base64(kp.privateKey)
  };
}

export function encryptMessage(message, recipientPublicKeyB64, myPrivateKeyB64) {
  const nonce = sodium.randombytes_buf(sodium.crypto_box_NONCEBYTES);
  const ciphertext = sodium.crypto_box_easy(
    message,
    nonce,
    sodium.from_base64(recipientPublicKeyB64),
    sodium.from_base64(myPrivateKeyB64)
  );
  return {
    ciphertext: sodium.to_base64(ciphertext),
    nonce: sodium.to_base64(nonce)
  };
}

export function decryptMessage(ciphertextB64, nonceB64, senderPublicKeyB64, myPrivateKeyB64) {
  try {
    const plaintext = sodium.crypto_box_open_easy(
      sodium.from_base64(ciphertextB64),
      sodium.from_base64(nonceB64),
      sodium.from_base64(senderPublicKeyB64),
      sodium.from_base64(myPrivateKeyB64)
    );
    return sodium.to_string(plaintext);
  } catch (e) {
    return '⚠️ Unable to decrypt';
  }
}