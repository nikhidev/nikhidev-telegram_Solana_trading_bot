const crypto = require('crypto');
const dotenv = require('dotenv');
dotenv.config();

 const secretKey = Buffer.from(process.env.SECRET_KEY,'hex'); // Replace with your secret key
 console.log('SECRET_KEY :',secretKey);
 
 const algorithm = 'aes-256-cbc'; // Encryption algorithm
 const iv = crypto.randomBytes(16); // Initialization vector

 function encrypt(text) {
    const iv = crypto.randomBytes(16); // Generate a new IV for each encryption
    const cipher = crypto.createCipheriv(algorithm, Buffer.from(secretKey), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex'); // Prepend IV to the encrypted text
 }
 function decrypt(text) {
    if (!text.includes(':')) {
      throw new Error(`Invalid encrypted data format: ${text}`);
    }
  
    const [ivHex, encryptedHex] = text.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const encryptedText = Buffer.from(encryptedHex, 'hex');
  
    const decipher = crypto.createDecipheriv(algorithm, Buffer.from(secretKey, 'hex'), iv);
    const decrypted = Buffer.concat([decipher.update(encryptedText), decipher.final()]);
    return decrypted.toString();
  }
  
  
  
  module.exports = { encrypt, decrypt };