// We'll use the official node-telegram-bot-api library to interact with the Telegram API and ethers to verify the signature
const TelegramBot = require("node-telegram-bot-api");
const { ethers } = require("ethers");
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const sqlite3 = require('sqlite3').verbose();
const CHAT_ID = process.env.CHAT_ID;

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
const CHAIN_ID = process.env.CHAIN_ID;
const WEB_DAPP_URL = process.env.WEB_DAPP_URL;

const app = express();
app.use(cors());
app.use(express.json());

// Token balance checker
const requiredTokenBalance = ethers.parseUnits("1000", 18); // Required balance of 1000 SRC tokens
const tokenAddress = "0xd29687c813D741E2F938F4aC377128810E217b1b"; 
const rpcUrl = "https://rpc.ankr.com/scroll";
const provider = new ethers.JsonRpcProvider(rpcUrl);
const abi = ["function balanceOf(address owner) view returns (uint256)"];
const contract = new ethers.Contract(tokenAddress, abi, provider);
const blockNumber = 13895425; // 8949016 is one of the first blocks of SCR

const db = new sqlite3.Database('users.db', (err) => {
    if (err) console.error('Database opening error: ', err);
    db.run(`CREATE TABLE IF NOT EXISTS users (
        userId TEXT PRIMARY KEY,
        walletAddress TEXT,
        joinedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
});

//  Starts the telegram bot and the API server that recieves the signature and verifies it
(async () => {
    try {
        bot.botInfo = await bot.getMe();
        app.listen(8080, () => {
            console.log("\nServer is running on port 8080");
            console.log("Bot is running...");
        });
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
})();

// The /verify endpoint is used to verify the signature and send a welcome message to the user
app.post("/verify", async (req, res) => {
    const { userId, message, signature } = req.body;
    try {
        const signerAddress = await getAuthenticationSigner(userId, message, signature);
        const balance = await contract.balanceOf(signerAddress, { blockTag: blockNumber });
        
        if (balance >= requiredTokenBalance) {
            // Check for existing wallet address and remove if found
            const removeExisting = async () => {
                return new Promise((resolve, reject) => {
                    db.get(
                        'SELECT userId FROM users WHERE walletAddress = ? AND userId != ?',
                        [signerAddress, userId],
                        async (err, row) => {
                            if (err) reject(err);
                            if (row) {
                                try {
                                    await bot.banChatMember(CHAT_ID, row.userId);
                                    await bot.unbanChatMember(CHAT_ID, row.userId);
                                    db.run('DELETE FROM users WHERE userId = ?', [row.userId]);
                                } catch (e) {
                                    console.error('Error removing existing user:', e);
                                }
                            }
                            resolve();
                        }
                    );
                });
            };

            // Store new user
            const storeUser = async () => {
                return new Promise((resolve, reject) => {
                    db.run(
                        'INSERT OR REPLACE INTO users (userId, walletAddress) VALUES (?, ?)',
                        [userId, signerAddress],
                        (err) => {
                            if (err) reject(err);
                            resolve();
                        }
                    );
                });
            };

            await removeExisting();
            await storeUser();

            // Generate chat invite link and send it
            const inviteLink = await bot.createChatInviteLink(CHAT_ID, {
                member_limit: 1
            });

            await bot.sendMessage(
                Number(userId),
                `Welcome! You're authenticated as ${signerAddress}.\n\nHere's your exclusive invite link: ${inviteLink.invite_link}`
            );
        } else {
            // ... existing error message code ...
        }
        res.json({ success: true, signerAddress });
    } catch (error) {
        console.error("Verification error:", error);
        res.status(400).json({ success: false, error: error.message });
    }
});

// getAuthenticationSigner returns the signer address by verifying the signature
function getAuthenticationSigner(userId, message, signature) {
    // accessRequest is the actual data schema of the message that we want to verify
    const accessRequest = {
        userId: userId,
        message: message,
    };
    // domain is the general information about your dapp, this is the same for all the messages
    const domain = {
        name: "Telegram Group Access",
        version: "1",
        chainId: CHAIN_ID,
    };
    // types is the data schema of the message that we want to verify
    const types = {
    AccessRequest: [
            { name: "userId", type: "uint256" },
            { name: "message", type: "string" },
        ]
    };
    // verifyTypedData verifies the signature in the erc712 style and return the signer address by ecrecovering
    // We don't need to do worry about those details, ethers does it for us
    return ethers.verifyTypedData(domain, types, accessRequest, signature);
}

// This is the main function that runs when the bot receives a message
bot.on("message", async (msg) => {
    const text = msg.text || "";
    // It checks if the message is "authenticate" and if so, it sends a message to the user to visit the website
    if (text.toLowerCase() === "/auth" || text.toLowerCase() === "/start") {
        // userId is the user's id in telegram
        const userId = msg.from.id;
        // We send the user to the web dapp to authenticate
        bot.sendMessage(
            userId, 
            `Please <a href="${WEB_DAPP_URL}?userId=${userId}">click here</a> to authenticate`, 
            { parse_mode: 'HTML' }
        );
        return;
    }
});

console.log("\nBot is running...");