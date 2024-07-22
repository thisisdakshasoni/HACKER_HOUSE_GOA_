
const DiamSdk = require("diamante-sdk-js");
const fetch = require('node-fetch'); // if not already imported
const EventSource = require("eventsource");
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

(async function main() {
  try {
    // Step 1: Generate a new keypair and create a new account on the ledger
    const pair = DiamSdk.Keypair.random();
    console.log("Public Key:", pair.publicKey());
    console.log("Secret Key:", pair.secret());

    const friendbotURL = `https://friendbot.diamcircle.io?addr=${encodeURIComponent(pair.publicKey())}`;
    const response = await fetch(friendbotURL);
    const responseJSON = await response.json();
    console.log("Friendbot Response:", responseJSON);

    const server = new DiamSdk.Horizon.Server("https://diamtestnet.diamcircle.io/");
    const parentAccount = await server.loadAccount(pair.publicKey());

    // Function to prompt user input
    async function promptUser(query) {
      return new Promise((resolve) => {
        rl.question(query, (answer) => {
          resolve(answer);
        });
      });
    }

    // Function definitions
    async function setupTrustline() {
      const assetCode = await promptUser("Enter the asset code (e.g., USD): ");
      const issuerPublicKey = await promptUser("Enter the asset issuer public key: ");
      const asset = new DiamSdk.Asset(assetCode, issuerPublicKey);
      const trustTransaction = new DiamSdk.TransactionBuilder(parentAccount, {
        fee: DiamSdk.BASE_FEE,
        networkPassphrase: DiamSdk.Networks.TESTNET,
      })
        .addOperation(DiamSdk.Operation.changeTrust({
          asset: asset,
        }))
        .setTimeout(180)
        .build();

      trustTransaction.sign(pair);
      const trustResult = await server.submitTransaction(trustTransaction);
      console.log("Trustline Set Successfully!", trustResult);
    }

    async function issueAsset() {
      const assetCode = await promptUser("Enter the asset code (e.g., USD): ");
      const issuerPublicKey = await promptUser("Enter the asset issuer public key: ");
      const amount = await promptUser("Enter the amount to issue: ");
      const asset = new DiamSdk.Asset(assetCode, issuerPublicKey);
      const issueTransaction = new DiamSdk.TransactionBuilder(parentAccount, {
        fee: DiamSdk.BASE_FEE,
        networkPassphrase: DiamSdk.Networks.TESTNET,
      })
        .addOperation(DiamSdk.Operation.payment({
          destination: pair.publicKey(),
          asset: asset,
          amount: amount,
        }))
        .setTimeout(180)
        .build();

      issueTransaction.sign(pair);
      const issueResult = await server.submitTransaction(issueTransaction);
      console.log("Asset Issued Successfully!", issueResult);
    }

    async function makePayment() {
      const amount = await promptUser("Enter the amount to pay: ");
      const paymentTransaction = new DiamSdk.TransactionBuilder(parentAccount, {
        fee: DiamSdk.BASE_FEE,
        networkPassphrase: DiamSdk.Networks.TESTNET,
      })
        .addOperation(DiamSdk.Operation.payment({
          destination: pair.publicKey(),
          asset: DiamSdk.Asset.native(),
          amount: amount,
        }))
        .setTimeout(30)
        .build();

      paymentTransaction.sign(pair);
      const paymentResult = await server.submitTransaction(paymentTransaction);
      console.log("Payment Successful!", paymentResult);
    }

    async function manageBuyOffer() {
      const sellingCode = await promptUser("Enter the asset code you are selling (e.g., XLM): ");
      const sellingIssuer = await promptUser("Enter the asset issuer public key for the selling asset: ");
      const buyingCode = await promptUser("Enter the asset code you are buying (e.g., USD): ");
      const buyingIssuer = await promptUser("Enter the asset issuer public key for the buying asset: ");
      const buyAmount = await promptUser("Enter the amount to buy: ");
      const price = await promptUser("Enter the price per unit: ");
      const offerId = await promptUser("Enter the offer ID (use 0 for a new offer): ");

      const sellingAsset = new DiamSdk.Asset(sellingCode, sellingIssuer);
      const buyingAsset = new DiamSdk.Asset(buyingCode, buyingIssuer);
      const buyOfferTransaction = new DiamSdk.TransactionBuilder(parentAccount, {
        fee: DiamSdk.BASE_FEE,
        networkPassphrase: DiamSdk.Networks.TESTNET,
      })
        .addOperation(DiamSdk.Operation.manageBuyOffer({
          selling: sellingAsset,
          buying: buyingAsset,
          buyAmount: buyAmount,
          price: price,
          offerId: parseInt(offerId),
        }))
        .setTimeout(180)
        .build();

      buyOfferTransaction.sign(pair);
      const buyOfferResult = await server.submitTransaction(buyOfferTransaction);
      console.log("Buy Offer Successful!", buyOfferResult);
    }

    async function manageSellOffer() {
      const sellingCode = await promptUser("Enter the asset code you are selling (e.g., USD): ");
      const sellingIssuer = await promptUser("Enter the asset issuer public key for the selling asset: ");
      const buyingCode = await promptUser("Enter the asset code you are buying (e.g., XLM): ");
      const buyingIssuer = await promptUser("Enter the asset issuer public key for the buying asset: ");
      const amount = await promptUser("Enter the amount to sell: ");
      const price = await promptUser("Enter the price per unit: ");
      const offerId = await promptUser("Enter the offer ID (use 0 for a new offer): ");

      const sellingAsset = new DiamSdk.Asset(sellingCode, sellingIssuer);
      const buyingAsset = new DiamSdk.Asset(buyingCode, buyingIssuer);
      const sellOfferTransaction = new DiamSdk.TransactionBuilder(parentAccount, {
        fee: DiamSdk.BASE_FEE,
        networkPassphrase: DiamSdk.Networks.TESTNET,
      })
        .addOperation(DiamSdk.Operation.manageSellOffer({
          selling: sellingAsset,
          buying: buyingAsset,
          amount: amount,
          price: price,
          offerId: parseInt(offerId),
        }))
        .setTimeout(180)
        .build();

      sellOfferTransaction.sign(pair);
      const sellOfferResult = await server.submitTransaction(sellOfferTransaction);
      console.log("Sell Offer Successful!", sellOfferResult);
    }

    function streamPayments() {
      const es = new EventSource(`https://diamtestnet.diamcircle.io/accounts/${pair.publicKey()}/payments`);
      es.onmessage = function (message) {
        const result = message.data ? JSON.parse(message.data) : message;
        console.log("New payment:");
        console.log(result);
      };
      es.onerror = function (error) {
        console.log("An error occurred!");
      };
    }

    async function handlePreconditions() {
      const minTime = await promptUser("Enter the minimum time (UNIX timestamp): ");
      const maxTime = await promptUser("Enter the maximum time (UNIX timestamp): ");
      const amount = await promptUser("Enter the amount to send: ");

      const preconditionTransaction = new DiamSdk.TransactionBuilder(parentAccount, {
        fee: DiamSdk.BASE_FEE,
        networkPassphrase: DiamSdk.Networks.TESTNET,
        timebounds: {
          minTime: parseInt(minTime),
          maxTime: parseInt(maxTime),
        }
      })
        .addOperation(DiamSdk.Operation.payment({
          destination: pair.publicKey(),
          asset: DiamSdk.Asset.native(),
          amount: amount,
        }))
        .setTimeout(180)
        .build();

      preconditionTransaction.sign(pair);
      const preconditionResult = await server.submitTransaction(preconditionTransaction);
      console.log("Precondition Transaction Successful!", preconditionResult);
    }

    async function pathfinding() {
      const destinationAmount = await promptUser("Enter the amount to find a path for: ");
      const paths = await server.paths()
        .sourceAccount(pair.publicKey())
        .destinationAccount(pair.publicKey())
        .destinationAsset(DiamSdk.Asset.native())
        .destinationAmount(destinationAmount)
        .call();
      console.log("Pathfinding Result:", paths);
    }

    async function paymentChannel() {
      const receiverPublicKey = await promptUser("Enter the recipient public key: ");
      const startingBalanceA = await promptUser("Enter the starting balance for client A: ");
      const startingBalanceB = await promptUser("Enter the starting balance for client B: ");
      const amountToSend = await promptUser("Enter the amount to send: ");

      const paymentChannel = new DiamSdk.Starlight.PaymentChannel({
        server: server,
        clientASecret: pair.secret(),
        clientBPublic: receiverPublicKey,
      });

      await paymentChannel.open({
        startingBalanceA: startingBalanceA,
        startingBalanceB: startingBalanceB,
      });

      await paymentChannel.send(amountToSend);
      await paymentChannel.close();

      console.log("Payment Channel Transaction Complete");
    }

    // Main loop to prompt user for operations
    async function userPrompt() {
      let continueLoop = true;
      while (continueLoop) {
        const choice = await promptUser(`Select an operation to perform:
        1: Set up a trustline
        2: Issue an asset
        3: Make a payment
        4: Manage buy offer
        5: Manage sell offer
        6: Stream payments
        7: Handle preconditions
        8: Pathfinding
        9: Payment Channel
        0: Exit
        Enter your choice: `);
        
        switch (choice) {
          case '1':
            await setupTrustline();
            break;
          case '2':
            await issueAsset();
            break;
          case '3':
            await makePayment();
            break;
          case '4':
            await manageBuyOffer();
            break;
          case '5':
            await manageSellOffer();
            break;
          case '6':
            streamPayments();
            break;
          case '7':
            await handlePreconditions();
            break;
          case '8':
            await pathfinding();
            break;
          case '9':
            await paymentChannel();
            break;
          case '0':
            continueLoop = false;
            break;
          default:
            console.log("Invalid choice, please try again.");
        }
      }

      rl.close();
    }

    // Start the user prompt loop
    await userPrompt();

  } catch (error) {
    console.error("Error:", error);
  }
})();
