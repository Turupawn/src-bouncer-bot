// Sign the message using the ERC712 format
async function signMessage(userId, message)
{
  // ERC712 expects you to send the message in a specific format
  // We define the Domain, which has general information about the dapp and has to be the same for all the messages
  // Then, we define the types of the message, which are the fields of the message
  // Finally, we define the message, which is the actual message to be signed
  const msgParams = JSON.stringify({
    types: {
      EIP712Domain: [
        { name: 'name', type: 'string' },
        { name: 'version', type: 'string' },
        { name: 'chainId', type: 'uint256' },
      ],
      AccessRequest: [
        { name: 'userId', type: 'uint256' },
        { name: 'message', type: 'string' }
      ],
    },
    primaryType: 'AccessRequest',
    domain: {
      name: 'Telegram Group Access',
      version: '1',
      chainId: NETWORK_ID,
    },
    message: {
      userId: userId,
      message: message,
    },
  });

  console.log(msgParams);

  // ERC712 introduced the eth_signTypedData_v4 method, which is now widely supported by all the wallets
  const signature = await ethereum.request({
    method: "eth_signTypedData_v4",
    params: [accounts[0], msgParams],
  });

  console.log(signature);

  document.getElementById("signature").textContent="Signature: " + signature;

  // Send the message to the telegram bot
  await sendSignature(userId, message, signature);
}

// Send the signature to the telegram bot
async function sendSignature(userId, message, signature) {
  // Let's start by grouping the data to send to the telegram bot
  const requestData = {
    userId: userId,
    message: message,
    signature: signature
  };

  try {
    // Send the data to the telegram bot by calling the /verify POST endpoint
    // If the signature is valid, the bot will send a message to the user
    const response = await fetch(BOT_API_URL + '/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestData)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    alert("Message sent successfully!");
  } catch (error) {
    console.error('Error:', error);
    alert("Failed to send message: " + error.message);
  }
}