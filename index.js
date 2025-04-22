const TelegramBot = require("node-telegram-bot-api");
const { User } = require("./db.js");
const dotenv = require("dotenv");
dotenv.config();
const mongoose = require("mongoose");
const { getJupiterQuote } = require("./jupiter.js");
const { getMinttokenAddress } = require("./jupiter.js");
const { encrypt, decrypt } = require("./cryptoutills.js");
const { excauteSwapTransaction, sendSol,
    getUserKeypair } = require("./signtransaction.js");
const {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  Transaction,
  SystemProgram,

  sendAndConfirmTransaction,
  clusterApiUrl,
} = require("@solana/web3.js");

console.log("Bot Token:", process.env.TELEGRAM_TOKEN);

const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: true });

console.log("my name is nikhil kant");

const { Connection, clusterApiUrlc } = require("@solana/web3.js");


const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

async function getOrCreatewallet(chatId) {
  let user = await User.findOne({ telegram_id: chatId });
  if (!user) {
    const keypair = Keypair.generate();
    const publicKey = keypair.publicKey.toBase58();
    const privateKey = Buffer.from(keypair.secretKey).toString("base64");
    console.log("Private key:", privateKey);

    const encryptedPrivateKey = encrypt(privateKey);
    console.log("Encrypted private key:", encryptedPrivateKey);

    const user = await User.create({
      telegram_id: chatId,
      public_key: publicKey,
      private_key: encryptedPrivateKey,
    });
    return { publicKey, keypair };
  } else {
    const decryptedPrivateKey = decrypt(user.private_key);
    const secretKey = Buffer.from(decryptedPrivateKey, "base64");
    const keypair = Keypair.fromSecretKey(secretKey);
    return { publicKey: user.public_key, keypair };
  }
}
function mainMenu(chatId) {
  bot.sendMessage(chatId, "Choose an option", {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🪪 Wallet", callback_data: "wallet" }],
        [{ text: "💰 Balance", callback_data: "balance" }],
        [{ text: "🚿 Airdrop 1 SOL", callback_data: "airdrop" }],
        [{ text: "📤 Send SOL", callback_data: "send" }],
        [{ text: "🚀 Buy Token ", callback_data: "buy" }],
        [{ text: "📤 Export Wallet 🔐", callback_data: "export" }],
      ],
    },
  });
}
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  await getOrCreatewallet(chatId);
  bot.sendMessage(chatId, "🚀 welcome to solana wallet Bot!");
  mainMenu(chatId);
});

const userSession = {};
bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;
  const { publicKey, keypair } = await getOrCreatewallet(chatId);

  if (data === "wallet") {
    bot.sendMessage(chatId, `Your wallet address is: ${publicKey}`);
  }
  if (data == "export") {
    const user = await User.findOne({ telegram_id: chatId });
    if (!user) {
      bot.sendMessage(chatId, "User not found.");
      return;
    }
    const decryptedBase64 = decrypt(user.private_key);

    // Step 2: Warn and show the key
    bot.sendMessage(
      chatId,
      `⚠️ *WARNING:* Do *not* share this key with anyone. We do not guarantee your funds.\n\n🔑 *Your Private Key (base64)*:\n\`${decryptedBase64}\``,
      { parse_mode: "Markdown" }
    );
  }
  if (data == "balance") {
    const balance = await connection.getBalance(keypair.publicKey);
    const sol = balance / LAMPORTS_PER_SOL;
    bot.sendMessage(chatId, `Your balance is: ${sol} SOL`);
  }
  if (data == "buy") {
    bot.sendMessage(
      chatId,
      "Please Select a token or enter the token address you want to buy:",
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "💵 USDC", callback_data: "buy_token_USDC" },
              { text: "🐶 BONK", callback_data: "buy_token_BONK" },
            ],
            [
              { text: "🧠 JTO", callback_data: "buy_token_JTO" },
              { text: "🐕 WIF", callback_data: "buy_token_WIF" },
            ],
            [
              {
                text: "🧾 Enter Token Address",
                callback_data: "buy_token_custom",
              },
            ],
          ],
        },
      }
    );
  }
  if (data == "buy_token_custom") {
    bot.sendMessage(
      chatId,
      "Please enter the *Mint Address* of the token you want to buy:",
      {
        parse_mode: "Markdown",
      }
    );
    bot.once("message", async (msg) => {
      const mintAddress = msg.text.trim();
      userSession[chatId] = {
        tokenMIntAddress: mintAddress,
        tokenSymbol: "custom",
      };

      bot.sendMessage(chatId, "How much SOL do you want to spend ?");
      bot.once("message", async (msg2) => {
        const solAmount = parseFloat(msg2.text.trim());
        
        if (isNaN(solAmount) || solAmount <= 0) {
          return bot.sendMessage(
            chatId,
            "❌ Invalid amount .Please enter the a valid number ."
          );
        }
        userSession[chatId].solAmount = solAmount;
        const tokenMInt = userSession[chatId].tokenMIntAddress;
        bot.sendMessage(chatId, `Fetching price for ${solAmount} Sol ..`);
        try {
          const quote = await getJupiterQuote(solAmount, tokenMInt);
          if (!quote) {
            return bot.sendMessage(
              chatId,
              "❌ could not fetch price . Try again"
            );
          }

          const amountOut = quote.amountOut;
          bot.sendMessage(
            chatId,
            `You will get *${amountOut}* token for *${solAmount} SOL*`,
            {
              parse_mode: "Markdown",
              reply_markup: {
                inline_keyboard: [
                  [
                    { text: "✅ Yes", callback_data: "buy_token_yes" },
                    { text: "❌ No", callback_data: "buy_token_no" },
                  ],
                ],
              },
            }
          );
        } catch (error) {
          console.error("Error fetching quote:", error);
          bot.sendMessage(
            chatId,
            "❌ Failed to fetch price. Please try again later."
          );
        }
      });
    });
    return;
  }
  if (data.startsWith("buy_token_") && data != "buy_token_custom") {
    const tokensymbol = data.replace("buy_token_", "");
    userSession[chatId] = { tokensymbol}
    if (tokensymbol == "custom") {
      bot.sendMessage(
        chatId,
        "please enter the *Mint Address* of the token you want to buy:",
        {
          parse_mode: "Markdown",
        }
      );
    }
    // else{
    //   const userSession={};
    //   userSession[chatId]={tokensymbol:tokensymbol};
    //   bot.sendMessage(chatId,`👉 You have Selected *${tokensymbol}*/n How much sol do want to spend for it`,{
    //     parse_mode:"Markdown"
    //   } )
    // }
    bot.once("message", async (msg) => {
      const chatId = msg.chat.id;
      const solAmount = parseFloat(msg.text.trim());
      if (isNaN(solAmount) || solAmount <= 0) {
        bot.sendMessage(
          chatId,
          "Please enter the valid amount of SOL . try again "
        );
        
      }
      
     userSession[chatId].solAmount = solAmount;
      const tokenSymbol = userSession[chatId].tokensymbol;
      bot.sendMessage(chatId, `🔍 Fetching price for ${solAmount} SOL...`)
      try{
        const tokenMIntAddress = getMinttokenAddress(tokenSymbol);
        const quote = await getJupiterQuote(solAmount, tokenMIntAddress);
        if(quote){
          bot.sendMessage(chatId,`💰 You will get ${quote.amountOut} ${tokenSymbol} for ${solAmount} SOL`);
          bot.sendMessage(chatId,`✅ Do you want to proceed with this transaction?`,{
            reply_markup:{
              inline_keyboard:[
                [
                  {text:"✅ Yes",callback_data:"buy_token_yes"},
                  {text:"❌ No",callback_data:"buy_token_no"}
                ]
              ]
            }
          })
        }else{
          bot.sendMessage(chatId,`❌ Failed to fetch price. Please try again later.`)
        }

      }
      catch(error){
        console.error("Error fetching quote:",error);
        bot.sendMessage(chatId,`❌ Failed to fetch price. Please try again later.`)
      }
    });
    return
  };
    
        if (data == "buy_token_yes") {
          try{
          const solAmount = userSession[chatId].solAmount;
          const tokenSymbol = userSession[chatId].tokenSymbol
          const tokenMIntAddress = userSession[chatId].tokenMIntAddress || getMinttokenAddress(tokenSymbol);

          if(!solAmount || !tokenSymbol){
            bot.sendMessage(chatId,`❌ Invalid session data. Please try again.`)
          
          }
          bot.sendMessage(chatId,`🔍 Fetching price for ${solAmount} SOL...`)

          const quote = await getJupiterQuote(solAmount, tokenMIntAddress);

          if(!quote){
            bot.sendMessage(chatId,`❌ Failed to fetch price. Please try again later.`)
          }
            const { amountOut } = quote;

            bot.sendMessage(
              chatId,
              `🎉 Transaction confirmed! swaping ${solAmount} SOL for ${amountOut} ${tokenSymbol}....`
            );
          
              const transaction = await excauteSwapTransaction(
                solAmount,
                tokenMIntAddress
              );
              if(transaction){
                bot.sendMessage(
                  chatId,
                  `✅ Transaction successful! \n\n🔗 [Transaction Link](https://explorer.solana.com/tx/${transaction}?cluster=devnet)`,
                  {
                    parse_mode: "Markdown",
                  }
                );
              }
              else{
                bot.sendMessage(chatId,`❌ Transaction failed. Please try again.`)
              }
            } catch (error) {
              console.error("Error while excuating the transaction", error);
              bot.sendMessage(chatId, "❌ swap failed . Please try again.");

          } 
          return
        }

          if (data == "buy_token_no") {
            bot.sendMessage(chatId, "❌ Token purchase has been cancelled");
          }
        
    if (data == "airdrop") {
      bot.sendMessage(chatId, "Airdropping 1 SOL...");
      try {
        await connection.requestAirdrop(
          keypair.publicKey,
          1 * LAMPORTS_PER_SOL
        );
        setTimeout(async () => {
          const balance = await connection.getBalance(keypair.publicKey);
          const sol = balance / LAMPORTS_PER_SOL;
          bot.sendMessage(
            chatId,
            `Airdrop completed! \nNew Balance :${sol}SOL`,
            { parse_mode: "Markdown" }
          );
        }, 4000);
      } catch (err) {
        console.log(err);
        bot.sendMessage(chatId, "Airdrop failed!");
      }
    }
    
  if (data === "send") {
    bot.sendMessage(
      chatId,
      "📨 Please enter the address and amount of SOL to send, like:\n\n`<wallet-address> <amount>`",
      {
        parse_mode: "Markdown",
      }
    );

    bot.once("message", async (msg) => {
      try {
        const input = msg.text.trim().split(" ");
        if (input.length !== 2) {
          return bot.sendMessage(
            chatId,
            "❌ Invalid format. Use:\n\n`<wallet-address> <amount>`",
            {
              parse_mode: "Markdown",
            }
          );
        }

        const targetAddress = input[0];
        const amountSOL = parseFloat(input[1]);
        if (isNaN(amountSOL) || amountSOL <= 0) {
          return bot.sendMessage(
            chatId,
            "❌ Invalid amount. Use a positive number."
          );
        }

        const toPublicKey = new PublicKey(targetAddress);
        const lamports = amountSOL * LAMPORTS_PER_SOL;

        const transaction = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: keypair.publicKey,
            toPubkey: toPublicKey,
            lamports,
          })
        );

        const { blockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = keypair.publicKey;

        transaction.sign(keypair);

        console.log("🔄 Sending transaction...");

        const signature = await sendAndConfirmTransaction(
          connection,
          transaction,
          [keypair]
        );

        console.log("✅ Transaction successful:", signature);

        // Debug: Check chatId value
        console.log("Attempting to send message to chatId:", chatId);

        // Check if chatId is valid
        if (chatId) {
          bot.sendMessage(
            chatId,
            `✅ Transaction successful!\n\n🔗 [Transaction Link](https://explorer.solana.com/tx/${signature}?cluster=devnet)`,
            {
              parse_mode: "Markdown",
            }
          );
        } else {
          console.error("Invalid chatId: ", chatId);
        }
      } catch (err) {
        console.error("❌ Error sending SOL:", err);
        bot.sendMessage(
          chatId,
          "❌ Failed to send SOL. Check the address and try again."
        );
      }
    });
  }
});
