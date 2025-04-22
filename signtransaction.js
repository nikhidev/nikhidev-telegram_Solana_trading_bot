const { Keypair, Transaction, SystemProgram, Connection, clusterApiUrl, sendAndConfirmTransaction } = require('@solana/web3.js');
const { decrypt } = require("./cryptoutills.js");
const { getJupiterSwapTransaction } = require('./jupiter');

// Initialize connection
const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');

/**
 * Executes a token swap via Jupiter Aggregator
 * @param {number} solAmount - Amount of SOL to swap (in SOL, not lamports)
 * @param {string} tokenMintAddress - Destination token mint address
 * @returns {Promise<string>} Transaction signature
 */
async function executeSwapTransaction(solAmount, tokenMintAddress) {
    try {
        // 1. Get user keypair (decryption happens here)
        const userKeyPair = await getUserKeypair();
        
        // 2. Get swap transaction from Jupiter
        const swapTransaction = await getJupiterSwapTransaction({
            connection,
            userPublicKey: userKeyPair.publicKey,
            inputMint: 'So11111111111111111111111111111111111111112', // SOL mint
            outputMint: tokenMintAddress,
            amount: Math.floor(solAmount * 10**9), // Convert SOL to lamports
            slippage: 1 // 1% slippage
        });

        if (!swapTransaction) {
            throw new Error('Failed to get swap transaction from Jupiter');
        }

        // 3. Sign and send transaction
        const { transaction } = swapTransaction;
        transaction.feePayer = userKeyPair.publicKey;
        transaction.partialSign(userKeyPair);

        const signature = await sendAndConfirmTransaction(
            connection,
            transaction,
            [userKeyPair]
        );

        return signature;

    } catch (error) {
        console.error('Swap failed:', error);
        throw new Error(`Swap execution failed: ${error.message}`);
    }
}

/**
 * Helper function to get user keypair from encrypted private key
 * @returns {Promise<Keypair>} Solana Keypair
 */
async function getUserKeypair() {
    try {
        // Get encrypted private key from your database
        // This depends on your database implementation
        const user = await User.findOne({ /* your query */ });
        if (!user) throw new Error('User not found');
        
        // Decrypt the private key
        const decryptedPrivateKey = decrypt(user.private_key);
        const secretKey = Buffer.from(decryptedPrivateKey, 'base64');
        
        return Keypair.fromSecretKey(secretKey);
    } catch (error) {
        console.error('Failed to get user keypair:', error);
        throw new Error('Failed to load wallet credentials');
    }
}

/**
 * Signs and sends a SOL transfer transaction
 * @param {string} recipient - Recipient public key
 * @param {number} amount - Amount in SOL
 * @returns {Promise<string>} Transaction signature
 */
async function sendSol(recipient, amount) {
    try {
        const userKeyPair = await getUserKeypair();
        const lamports = amount * 10**9; // Convert to lamports

        const transaction = new Transaction().add(
            SystemProgram.transfer({
                fromPubkey: userKeyPair.publicKey,
                toPubkey: new PublicKey(recipient),
                lamports,
            })
        );

        const signature = await sendAndConfirmTransaction(
            connection,
            transaction,
            [userKeyPair]
        );

        return signature;
    } catch (error) {
        console.error('SOL transfer failed:', error);
        throw new Error(`Failed to send SOL: ${error.message}`);
    }
}

module.exports = {
    executeSwapTransaction,
    sendSol,
    getUserKeypair
};