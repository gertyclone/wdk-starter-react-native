import 'dotenv/config'
import WDK from '@tetherto/wdk'
import WalletManagerEvm from '@tetherto/wdk-wallet-evm'
import WalletManagerTron from '@tetherto/wdk-wallet-tron'
import WalletManagerBtc from '@tetherto/wdk-wallet-btc'

// Load seed phrase from environment variable
const seedPhrase = process.env.SEED_PHRASE

if (!seedPhrase) {
  console.error('Error: SEED_PHRASE environment variable is not set.')
  console.error('Please create a .env file with your seed phrase:')
  console.error('  SEED_PHRASE=your twelve word seed phrase here')
  process.exit(1)
}

console.log('Using seed phrase from environment variable.')

/**
 * Gets the Bitcoin network configuration based on environment variable.
 * Set NETWORK=testnet to use testnet, otherwise defaults to mainnet.
 * 
 * @returns {Object} Configuration object with network, host, and port
 */
function getNetworkConfig () {
  const networkEnv = process.env.NETWORK?.toLowerCase()
  const isTestnet = networkEnv === 'testnet'
  
  if (isTestnet) {
    return {
      network: 'testnet',
      host: '127.0.0.1',
      port: 40001
    }
  } else {
    return {
      network: 'bitcoin',
      host: '192.168.1.110',
      port: 50001
      // host: '192.168.1.110',
      // port: 49174
    }
  }
}

// Get network configuration from environment variable
// Usage: NETWORK=testnet node simple.js  (for testnet)
//        NETWORK=bitcoin node simple.js  (for mainnet, or omit NETWORK)
const networkConfig = getNetworkConfig()
console.log(`Network: ${networkConfig.network} (${networkConfig.host}:${networkConfig.port})`)

// Create wallet manager with configuration
const wallet = new WalletManagerBtc(seedPhrase, {
    network: networkConfig.network,
    host: networkConfig.host,
    port: networkConfig.port,
    // bip: 86, // Use BIP86 for Taproot (m/86') addresses
    script_type: 'P2TR'
  })
  
  // Get accounts (inherit configuration from manager)
  const account0 = await wallet.getAccount(0)
  // const account1 = await wallet.getAccount(1)
  // const customAccount = await wallet.getAccountByPath("0'/0/5")
  
  const address0 = await account0.getAddress()
  // const address1 = await account1.getAddress()
  // const addressCustom = await customAccount.getAddress()
  console.log('Address0:', address0) // tb1p... (testnet) or bc1p... (mainnet)
  // console.log('Address1:', address1) // tb1p... (testnet) or bc1p... (mainnet)
  // console.log('AddressCustom:', addressCustom) // tb1p... (testnet) or bc1p... (mainnet)
  
  const balance = await account0.getBalance()
  console.log('Balance:', balance.toString())
  
  // Mempool.space API to get fee rates and it doesn't like Proton VPN
  const feeRates = await wallet.getFeeRates()
  console.log('Current fee rates:', feeRates) // { normal: X, fast: Y } sat/vB
  
  // Compose transaction without sending it using quoteSendTransactionWithMemoTX
  const composeTransaction = async (to, value, memo, feeRate) => {
    // Get the raw transaction hex using quoteSendTransactionWithMemoTX
    const txHex = await account0.quoteSendTransactionWithMemoTX({
      to: to,
      value: value,
      memo: memo,
      feeRate: feeRate
    })
    
    return txHex
  }
  
  // Compose and log transaction details
  try {
    // Use normal fee rate from getFeeRates()
    // Example: Create transaction with memo using quoteSendTransactionWithMemoTX
    const memo = 'Hello, Bitcoin!'
    const sendAmount = 800 // satoshis
    const feeRate = feeRates.normal
    
    // Debug fee calculation
    console.log('\n=== Fee Calculation Debug ===')
    console.log('Fee rate:', feeRate.toString(), 'sat/vB')
    console.log('Send amount:', sendAmount, 'satoshis')
    console.log('Memo:', memo)
    const memoSize = Buffer.from(memo, 'utf8').length
    console.log('Memo size:', memoSize, 'bytes')
    // OP_RETURN output size: OP_RETURN (1 byte) + push opcode (1 byte) + data length
    const opReturnOutputSize = 1 + 1 + memoSize
    console.log('OP_RETURN output size:', opReturnOutputSize, 'bytes')
    const opReturnFee = Number(feeRate) * opReturnOutputSize
    console.log('OP_RETURN fee estimate:', opReturnFee, 'satoshis')
    const MIN_TX_FEE_SATS = 141 // Minimum transaction fee from the library
    console.log('MIN_TX_FEE_SATS:', MIN_TX_FEE_SATS, 'satoshis')
    console.log('Note: Base fee will be max(coinselect fee, MIN_TX_FEE_SATS)')
    console.log('Total balance:', balance.toString(), 'satoshis')
    console.log('Estimated minimum fee (MIN_TX_FEE_SATS + opReturnFee):', MIN_TX_FEE_SATS + opReturnFee, 'satoshis')
    console.log('Estimated total required (sendAmount + minFee):', sendAmount + MIN_TX_FEE_SATS + opReturnFee, 'satoshis')
    
    const txHex = await composeTransaction(address0, sendAmount, memo, feeRate) // 800 satoshis + memo
    
    console.log('Transaction composed successfully (not sent)')
    console.log('Raw hex from quoteSendTransactionWithMemoTX:', txHex)
  } catch (error) {
    console.error('\n=== Error Details ===')
    console.error('Error message:', error.message)
    console.error('Error type:', error.constructor.name)
    if (error.stack) {
      console.error('Stack trace:', error.stack)
    }
    
    if (error.message.includes('Insufficient balance')) {
      // Try to get fee estimate to calculate total required amount
      const sendAmount = 800
      const memo = 'Hello, Bitcoin!'
      let totalRequired = sendAmount
      let feeEstimate = null
      
      try {
        const quote = await account0.quoteSendTransactionWithMemo({
          to: address0,
          value: sendAmount,
          memo: memo,
          feeRate: feeRates.normal
        })
        feeEstimate = quote.fee
        const feeNum = typeof feeEstimate === 'bigint' ? Number(feeEstimate) : feeEstimate
        totalRequired = sendAmount + feeNum
      } catch (quoteError) {
        console.error('Fee quote also failed:', quoteError.message)
        // If quote fails, just use the send amount
      }
      
      console.log('\n=== Balance Analysis ===')
      console.log('Current balance:', balance.toString(), 'satoshis')
      if (feeEstimate !== null) {
        const feeNum = typeof feeEstimate === 'bigint' ? Number(feeEstimate) : feeEstimate
        console.log('Required amount:', totalRequired, 'satoshis (', sendAmount, 'satoshis +', feeNum, 'satoshis fee)')
        console.log('Required amount (BTC):', (totalRequired / 100000000).toFixed(8))
        console.log('Balance sufficient:', Number(balance) >= totalRequired ? 'YES' : 'NO')
      } else {
        console.log('Required amount: at least', sendAmount, 'satoshis + transaction fees')
      }
    } else {
      console.error('Failed to compose transaction:', error.message)
    }
  }
  
  // Alternative: Use quoteSendTransaction for just the fee estimate
  const quote = await account0.quoteSendTransaction({ to: address0, value: 8000, confirmationTarget: 10 })
  console.log('No Memo Fee estimate:', quote.fee, 'satoshis')
  
  const quotememo = await account0.quoteSendTransactionWithMemo({ to: address0, value: 20000, memo: 'Hello, Bitcoin!', confirmationTarget: 10 })
  console.log('With Memo Fee estimate:', quotememo.fee, 'satoshis')
  
  const memotx = await account0.quoteSendTransactionWithMemoTX({ to: address0, value: 20000, memo: 'Hello, Bitcoin!', confirmationTarget: 10 })
  console.log('Raw hex from quoteSendTransactionWithMemoTX:', memotx)
  
  // To actually send the transaction:
  // try {
  //   const tx = await account0.sendTransactionWithMemo({ to: address0, value: 20000, memo: 'Hello, Bitcoin!', confirmationTarget: 10 })
  //   console.log('Transaction sent with memo:', tx)
  // } catch (error) {
  //   console.error('Transaction failed with memo:', error)
  // }

  // Nostr message signing
  try {
    // Import required libraries
    const fs = await import('fs/promises')
    const crypto = await import('crypto')
    const ecc = await import('@bitcoinerlab/secp256k1')
    
    // Read the Nostr template
    const nostrTemplate = JSON.parse(await fs.readFile('nostr-template.json', 'utf8'))
    
    // Get the key pair from account0
    const keyPair = account0.keyPair
    const publicKeyHex = Buffer.from(keyPair.publicKey).toString('hex')
    
    // For Nostr, we use the x-only public key (32 bytes, remove 0x02/0x03 prefix)
    // This is the standard format for Nostr pubkeys
    const nostrPubkey = publicKeyHex.slice(2) // Remove 0x02/0x03 prefix to get 32-byte x-coordinate
    
    // Update the template with the pubkey
    nostrTemplate.pubkey = nostrPubkey
    
    // Create the event array for serialization (without id and sig)
    // Nostr events are serialized as: [0, <pubkey>, <created_at>, <kind>, <tags>, <content>]
    const eventArray = [
      0,
      nostrPubkey,
      nostrTemplate.created_at,
      nostrTemplate.kind,
      nostrTemplate.tags,
      nostrTemplate.content
    ]
    
    // Serialize the event array as a JSON string (canonical format, no whitespace)
    // This is critical - must match exactly what other Nostr implementations use
    const eventJsonString = JSON.stringify(eventArray)
    
    // Calculate the event ID: SHA-256 hash of the serialized event array
    const eventIdHash = crypto.createHash('sha256').update(eventJsonString).digest()
    const eventId = eventIdHash.toString('hex')
    nostrTemplate.id = eventId
    
    // Sign the event ID (hash) with Schnorr signature
    // Nostr requires signing the SHA-256 hash (event ID), not the serialized event
    const privateKey = Buffer.from(keyPair.privateKey)
    
    // Sign the hash using Schnorr signature (BIP-340)
    // signSchnorr takes the hash (32 bytes) and private key (32 bytes), returns 64-byte signature
    const schnorrSignature = ecc.signSchnorr(eventIdHash, privateKey)
    
    // Convert signature to hex string (64 bytes = 128 hex characters)
    const signatureHex = Buffer.from(schnorrSignature).toString('hex')
    nostrTemplate.sig = signatureHex
    
    // Log the signed message
    console.log('\n=== Signed Nostr Message ===')
    console.log(JSON.stringify(nostrTemplate, null, 2))
    
    // Note: Signature verification with x-only pubkeys requires converting to a Point
    // The signature is valid if the event can be verified by Nostr clients
    // For debugging, you can verify using Nostr libraries or online tools
    console.log('\n=== Nostr Event Details ===')
    console.log('Event ID:', nostrTemplate.id)
    console.log('Public Key:', nostrTemplate.pubkey)
    console.log('Signature:', nostrTemplate.sig)
    console.log('\nNote: You can verify this event using any Nostr client or verification tool.')
  } catch (error) {
    console.error('Error signing Nostr message:', error)
    if (error.stack) {
      console.error('Stack trace:', error.stack)
    }
  }

  // Clean up when done (after transaction completes)
  wallet.dispose()