const axios = require('axios');

 async function getJupiterQuote(solAmount, tokenSymbol) {
    try{
  const response = await axios.get(`https://quote-api.jup.ag/v1/quote`, {
    inputMint: "So11111111111111111111111111111111111111112",
    outputMint: getMinttokenAddress(tokenSymbol),
    amount : solAmount * Math.pow(10, 9)
  });

  const quote = response.data;
  if(quote && quote.data && quote.data.length > 0){
    return
    {
    amountOut :  quote.data[0].outAmount/Math.pow(10, 9);
    tokenSymbol:tokenSymbol
  };
}
    return null ;
} catch (error) {
  console.error('Error fetching quote:', error.message);
  return null;
}
}
function getMinttokenAddress(tokenSymbol) {
    const tokenMintAddress = {
        USDC: "Es9vMFrzA7f4QF1e9HZ1cTZmWwzBdmfgeZ7d8TT39T5V", // Example USDC mint address on Solana
        BONK: "9n4w7YpX31pKpH8XQfE5bKg8CwvvsFwA3kVzH6h85Lwe", // Example BONK mint address
        // Add more tokens here...
      };
      return tokenMintAddress[tokenSymbol] || null;
    }
    module.exports = {
        getJupiterQuote,
        getMinttokenAddress
    };