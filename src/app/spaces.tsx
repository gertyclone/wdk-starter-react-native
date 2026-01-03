import Header from '@/components/header';
import { useDebouncedNavigation } from '@/hooks/use-debounced-navigation';
import { Box, ChevronDown, Circle, Info, Plus } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/constants/colors';
import { pricingService, FiatCurrency } from '@/services/pricing-service';
import {
  AssetTicker,
  NetworkType,
  useWallet,
  WDKService,
} from '@tetherto/wdk-react-native-provider';
import AsyncStorage from '@react-native-async-storage/async-storage';
import getChainsConfig from '@/config/get-chains-config';

const SPACE_NAME_OPTIONS = ['usdt', 'xaut', 'pubkey'];
const DURATION_OPTIONS = ['~10 mins', '~1 hour', '~8 hours'];
const SPACES_API_BASE_URL = 'http://192.168.1.111:7264';
// const SPACES_API_BASE_URL = 'http://70.251.209.207:7264';
const SPACES_APP_NAME = 'spaces-wallet';

interface SpaceAvailabilityResponse {
  state: 'available' | 'taken';
  price?: number; // Price in sats
  '1_block_fee'?: number; // Block fee for ~10 mins in sats
  '6_block_fee'?: number; // Block fee for ~1 hour in sats
  '48_block_fee'?: number; // Block fee for ~8 hours in sats
  handle?: string;
  id?: number; // quote_id from API
  [key: string]: any;
}

interface SpaceItem {
  space_name: string;
  [key: string]: any;
}

interface GetSpacesResponse {
  spaces: SpaceItem[];
  [key: string]: any;
}

export default function SpacesScreen() {
  const insets = useSafeAreaInsets();
  const router = useDebouncedNavigation();
  const { wallet, addresses, balances } = useWallet();
  const [subspace, setSubspace] = useState('');
  const [spaceName, setSpaceName] = useState<string>('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [buttonState, setButtonState] = useState<'available' | 'taken' | 'loading' | null>(null);
  const [isButtonEnabled, setIsButtonEnabled] = useState(false);
  const [buttonLabel, setButtonLabel] = useState('Purchase');
  const [selectedDuration, setSelectedDuration] = useState<string>('~10 mins');
  const [priceSats, setPriceSats] = useState<number | null>(null);
  const [blockFee1, setBlockFee1] = useState<number | null>(null);
  const [blockFee6, setBlockFee6] = useState<number | null>(null);
  const [blockFee48, setBlockFee48] = useState<number | null>(null);
  const [spaceNameOptions, setSpaceNameOptions] = useState<string[]>(SPACE_NAME_OPTIONS);
  const [btcPriceUSD, setBtcPriceUSD] = useState<number | null>(null);
  const [quoteId, setQuoteId] = useState<number | null>(null);
  const [handle, setHandle] = useState<string | null>(null);
  const [isConfirmationMode, setIsConfirmationMode] = useState(false);
  const [purchaseData, setPurchaseData] = useState<{
    taproot_address: string;
    handle: string;
    total_price: number;
    expiring_blockheight: number;
  } | null>(null);
  const [showTxHexModal, setShowTxHexModal] = useState(false);
  const [txHex, setTxHex] = useState<string>('');

  // Placeholder handlers - customize these based on your needs
  const handleCreateSpace = () => {
    // TODO: Implement create space functionality
    console.log('Create space pressed');
  };

  const handleSpacePress = (spaceId: string) => {
    // TODO: Navigate to space details or open space
    console.log('Space pressed:', spaceId);
  };

  const handlePurchase = async () => {
    console.log('[Spaces] Purchase button pressed', {
      subspace,
      spaceName,
      quoteId,
      handle,
      priceSats,
      selectedDuration,
    });

    // If already in confirmation mode, handle sending the transaction
    if (isConfirmationMode) {
      if (!purchaseData || !quoteId) {
        console.error('[Spaces] Missing purchase data or quoteId');
        Alert.alert('Error', 'Missing purchase information. Please try again.');
        return;
      }

      setButtonState('loading');
      setIsButtonEnabled(false);
      setButtonLabel('Composing Transaction...');

      try {
        // Get Bitcoin account through WDKService
        if (!wallet) {
          throw new Error('Wallet not available');
        }

        // Get the Bitcoin address from addresses (same as settings page)
        // This is the address that should be used for transactions
        // The settings page uses accountIndex=0 via resolveWalletAddresses()
        const bitcoinAddress = addresses?.[NetworkType.SEGWIT];
        if (!bitcoinAddress) {
          throw new Error('Bitcoin address not available. Please ensure wallet is initialized.');
        }

        // Detect script type dynamically from the wallet address
        // P2TR (Taproot) addresses start with bc1p (mainnet) or tb1p (testnet)
        // P2WPKH (Native SegWit) addresses start with bc1q (mainnet) or tb1q (testnet)
        // P2PKH addresses start with 1 (mainnet) or m/n (testnet)
        let scriptType: 'P2TR' | 'P2WPKH' | 'P2PKH';
        const addressLower = bitcoinAddress.toLowerCase();
        if (addressLower.startsWith('bc1p') || addressLower.startsWith('tb1p')) {
          scriptType = 'P2TR';
        } else if (addressLower.startsWith('bc1q') || addressLower.startsWith('tb1q')) {
          scriptType = 'P2WPKH';
        } else if (addressLower.startsWith('1') || addressLower.startsWith('m') || addressLower.startsWith('n')) {
          scriptType = 'P2PKH';
        } else {
          // Fallback to config if address format is unrecognized
          const chainsConfig = getChainsConfig();
          const bitcoinConfig = chainsConfig.bitcoin;
          scriptType = (bitcoinConfig?.script_type as 'P2TR' | 'P2WPKH' | 'P2PKH') || 'P2WPKH';
        }

        console.log('[Spaces] Script type detected from address:', scriptType);
        console.log('[Spaces] Bitcoin address:', bitcoinAddress);
        console.log('[Spaces] Composing transaction:', {
          to: purchaseData.taproot_address,
          value: purchaseData.total_price,
          scriptType,
        });

        // Debug: Log account info to help diagnose UTXO issues
        // The error "No unspent outputs available" means the account at index 0
        // doesn't have UTXOs, or there's a network/Electrum server mismatch
        console.log('[Spaces] Using account index 0 for transaction');
        console.log('[Spaces] Network: SEGWIT (Bitcoin)');
        console.log(
          '[Spaces] Using Bitcoin address from addresses[NetworkType.SEGWIT]:',
          bitcoinAddress
        );
        console.log(
          '[Spaces] Using account index 0 (same as settings page via resolveWalletAddresses)'
        );

        // Use the appropriate method based on script_type:
        // - P2TR (Taproot): Use quoteSendByNetworkWithMemoTX (requires memo)
        // - P2WPKH (Native SegWit): Use quoteSendByNetworkTX (no memo required)
        // We use account index 0, which matches what resolveWalletAddresses() uses
        // This ensures we're using the same address that's displayed on the settings page
        // Pass amount in satoshis directly (WDKService will handle conversion internally)
        // Note: Both methods use confirmationTarget: 1 by default.
        // TODO: Update WDKService to accept conf_target parameter and use getConfTarget(selectedDuration)
        // to match the user's selected duration.
        let transactionHex: string;

        if (scriptType === 'P2TR') {
          // P2TR (Taproot) - use memo method
          const quoteOptions = {
            network: NetworkType.SEGWIT,
            accountIndex: 0,
            amount: purchaseData.total_price,
            recipientAddress: purchaseData.taproot_address,
            asset: AssetTicker.BTC,
            memo: purchaseData.handle,
          };
          console.log(
            '[Spaces] quoteSendByNetworkWithMemoTX options:',
            JSON.stringify(quoteOptions, null, 2)
          );

          // Check balance before attempting transaction (including fees)
          const btcBalance = balances?.list?.find(
            (b) => b.networkType === NetworkType.SEGWIT && b.denomination === AssetTicker.BTC
          );
          // Convert balance from BTC to satoshis (balance.value is in BTC, multiply by 100M)
          const balanceBTC = btcBalance ? parseFloat(btcBalance.value) : 0;
          const balanceSats = balanceBTC * 100000000;

          // Estimate transaction fee to check if we have enough balance
          let estimatedFee = 0;
          let totalRequired = quoteOptions.amount;
          try {
            const feeQuote = await WDKService.quoteSendByNetworkWithMemo(
              quoteOptions.network,
              quoteOptions.accountIndex,
              quoteOptions.amount / 100000000, // Convert to BTC for quote
              quoteOptions.recipientAddress,
              quoteOptions.asset,
              quoteOptions.memo
            );
            // Fee is returned in base units (BTC), convert to satoshis
            estimatedFee = feeQuote * 100000000;
            totalRequired = quoteOptions.amount + estimatedFee;
          } catch (feeError) {
            console.warn('[Spaces] Could not estimate fee, using amount only:', feeError);
            // If fee estimation fails, we'll let the transaction attempt proceed
            // and it will fail with a more specific error
          }

          console.log('[Spaces] Balance check (P2TR):', {
            balanceBTC: balanceBTC.toFixed(8),
            balanceSats: Math.round(balanceSats),
            requestedAmount: quoteOptions.amount,
            requestedAmountBTC: (quoteOptions.amount / 100000000).toFixed(8),
            estimatedFee: Math.round(estimatedFee),
            estimatedFeeBTC: (estimatedFee / 100000000).toFixed(8),
            totalRequired: Math.round(totalRequired),
            totalRequiredBTC: (totalRequired / 100000000).toFixed(8),
            sufficient: balanceSats >= totalRequired,
          });

          if (balanceSats < totalRequired) {
            const shortfall = totalRequired - balanceSats;
            console.error('[Spaces] Insufficient balance (including fees) - P2TR:', {
              balanceBTC: balanceBTC.toFixed(8),
              balanceSats: Math.round(balanceSats),
              requestedAmount: quoteOptions.amount,
              estimatedFee: Math.round(estimatedFee),
              totalRequired: Math.round(totalRequired),
              shortfall: Math.round(shortfall),
              shortfallBTC: (shortfall / 100000000).toFixed(8),
            });
            throw new Error(
              `Insufficient balance. Have ${Math.round(balanceSats)} sats, need ${Math.round(totalRequired)} sats (${quoteOptions.amount} amount + ${Math.round(estimatedFee)} fee, shortfall: ${Math.round(shortfall)} sats)`
            );
          }

          transactionHex = await WDKService.quoteSendByNetworkWithMemoTX(
            quoteOptions.network,
            quoteOptions.accountIndex,
            quoteOptions.amount,
            quoteOptions.recipientAddress,
            quoteOptions.asset,
            quoteOptions.memo
          );
        } else {
          // P2WPKH (Native SegWit) - use non-memo method
          const quoteOptions = {
            network: NetworkType.SEGWIT,
            accountIndex: 0,
            amount: purchaseData.total_price,
            recipientAddress: purchaseData.taproot_address,
            asset: AssetTicker.BTC,
          };
          console.log(
            '[Spaces] quoteSendByNetworkTX options:',
            JSON.stringify(quoteOptions, null, 2)
          );

          // Check balance before attempting transaction (including fees)
          const btcBalance = balances?.list?.find(
            (b) => b.networkType === NetworkType.SEGWIT && b.denomination === AssetTicker.BTC
          );
          // Convert balance from BTC to satoshis (balance.value is in BTC, multiply by 100M)
          const balanceBTC = btcBalance ? parseFloat(btcBalance.value) : 0;
          const balanceSats = balanceBTC * 100000000;

          // Estimate transaction fee to check if we have enough balance
          let estimatedFee = 0;
          let totalRequired = quoteOptions.amount;
          try {
            const feeQuote = await WDKService.quoteSendByNetwork(
              quoteOptions.network,
              quoteOptions.accountIndex,
              quoteOptions.amount / 100000000, // Convert to BTC for quote
              quoteOptions.recipientAddress,
              quoteOptions.asset
            );
            // Fee is returned in base units (BTC), convert to satoshis
            estimatedFee = feeQuote * 100000000;
            totalRequired = quoteOptions.amount + estimatedFee;
          } catch (feeError) {
            console.warn('[Spaces] Could not estimate fee, using amount only:', feeError);
            // If fee estimation fails, we'll let the transaction attempt proceed
            // and it will fail with a more specific error
          }

          console.log('[Spaces] Balance check:', {
            balanceBTC: balanceBTC.toFixed(8),
            balanceSats: Math.round(balanceSats),
            requestedAmount: quoteOptions.amount,
            requestedAmountBTC: (quoteOptions.amount / 100000000).toFixed(8),
            estimatedFee: Math.round(estimatedFee),
            estimatedFeeBTC: (estimatedFee / 100000000).toFixed(8),
            totalRequired: Math.round(totalRequired),
            totalRequiredBTC: (totalRequired / 100000000).toFixed(8),
            sufficient: balanceSats >= totalRequired,
          });

          if (balanceSats < totalRequired) {
            const shortfall = totalRequired - balanceSats;
            console.error('[Spaces] Insufficient balance (including fees):', {
              balanceBTC: balanceBTC.toFixed(8),
              balanceSats: Math.round(balanceSats),
              requestedAmount: quoteOptions.amount,
              estimatedFee: Math.round(estimatedFee),
              totalRequired: Math.round(totalRequired),
              shortfall: Math.round(shortfall),
              shortfallBTC: (shortfall / 100000000).toFixed(8),
            });
            throw new Error(
              `Insufficient balance. Have ${Math.round(balanceSats)} sats, need ${Math.round(totalRequired)} sats (${quoteOptions.amount} amount + ${Math.round(estimatedFee)} fee, shortfall: ${Math.round(shortfall)} sats)`
            );
          }

          transactionHex = await WDKService.quoteSendByNetworkTX(
            quoteOptions.network,
            quoteOptions.accountIndex,
            quoteOptions.amount,
            quoteOptions.recipientAddress,
            quoteOptions.asset
          );
        }

        // Log full transaction hex for verification
        console.log('[Spaces] Full transaction hex:', transactionHex);
        console.log('[Spaces] Transaction hex length:', transactionHex.length);
        console.log('[Spaces] Transaction hex generated:', transactionHex.substring(0, 50) + '...');

        // Display transaction hex in modal
        setTxHex(transactionHex);
        setShowTxHexModal(true);

        // Reset button state while showing modal
        setButtonState('available');
        setIsButtonEnabled(true);

        // Send PUT request to confirm purchase
        const spaceNameLower = spaceName.toLowerCase();
        const url = `${SPACES_API_BASE_URL}/spaces/${spaceNameLower}/${subspace.trim()}?app=${SPACES_APP_NAME}&format=json`;
        const startTime = Date.now();
        console.log(`[Spaces API] PUT ${url}`);

        const requestBody = {
          quote_id: quoteId,
        };

        console.log('[Spaces API] PUT request body:', JSON.stringify(requestBody, null, 2));

        const response = await fetch(url, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

        const endTime = Date.now();
        const duration = endTime - startTime;

        if (!response.ok) {
          const errorText = await response.text();
          console.error(
            `[Spaces API] PUT ${url} - HTTP error! status: ${response.status} (${duration}ms)`,
            errorText
          );
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log(`[Spaces API] PUT ${url} - Success (${duration}ms)`, data);

        // Store job_id and handle in local storage
        if (data.job_id && data.handle) {
          const storageKey = `spaces_purchase_${data.job_id}`;
          const storageData = {
            job_id: data.job_id,
            handle: data.handle,
            quote_id: data.quote_id,
            timestamp: Date.now(),
          };
          await AsyncStorage.setItem(storageKey, JSON.stringify(storageData));
          console.log('[Spaces] Stored purchase data in AsyncStorage:', storageKey, storageData);
        }

        // Reset confirmation mode
        setIsConfirmationMode(false);
        setPurchaseData(null);
        setButtonState('available');
        setIsButtonEnabled(true);

        // Recalculate button label
        if (priceSats !== null) {
          const blockFee = getBlockFee(selectedDuration, blockFee1, blockFee6, blockFee48);
          if (blockFee !== null && btcPriceUSD !== null) {
            const totalLabel = calculateTotalPrice(
              priceSats,
              blockFee1,
              blockFee6,
              blockFee48,
              selectedDuration,
              btcPriceUSD
            );
            setButtonLabel(totalLabel);
          }
        }
      } catch (error) {
        console.error('[Spaces] Error in confirmation flow:', error);

        // Enhanced error logging for insufficient balance
        if (error instanceof Error && error.message.includes('Insufficient balance')) {
          const btcBalance = balances?.list?.find(
            (b) => b.networkType === NetworkType.SEGWIT && b.denomination === AssetTicker.BTC
          );
          // Convert balance from BTC to satoshis (balance.value is in BTC, multiply by 100M)
          const balanceBTC = btcBalance ? parseFloat(btcBalance.value) : 0;
          const balanceSats = balanceBTC * 100000000;
          const requestedAmount = purchaseData?.total_price || 0;

          console.error('[Spaces] Insufficient balance details:', {
            errorMessage: error.message,
            balanceBTC: balanceBTC.toFixed(8),
            balanceSats: Math.round(balanceSats),
            requestedAmount,
            requestedAmountBTC: (requestedAmount / 100000000).toFixed(8),
            shortfall: Math.round(requestedAmount - balanceSats),
            shortfallBTC: ((requestedAmount - balanceSats) / 100000000).toFixed(8),
            fromAddress: addresses?.[NetworkType.SEGWIT],
            recipientAddress: purchaseData?.taproot_address,
          });
        } else {
          console.error('[Spaces] Transaction error details:', {
            errorMessage: error instanceof Error ? error.message : String(error),
            errorStack: error instanceof Error ? error.stack : undefined,
            purchaseData,
            fromAddress: addresses?.[NetworkType.SEGWIT],
          });
        }

        Alert.alert(
          'Error',
          error instanceof Error ? error.message : 'Failed to process transaction'
        );
        setButtonState('available');
        setIsButtonEnabled(true);
        // Restore button label
        if (purchaseData && btcPriceUSD !== null) {
          const formattedSats = purchaseData.total_price.toLocaleString();
          const satsPerBitcoin = 100000000;
          const usdAmount = (purchaseData.total_price / satsPerBitcoin) * btcPriceUSD;
          const formattedUSD = usdAmount.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          });
          setButtonLabel(
            `Send ${formattedSats} sats = $${formattedUSD} for ${purchaseData.handle}`
          );
        } else if (purchaseData) {
          const formattedSats = purchaseData.total_price.toLocaleString();
          setButtonLabel(`Send ${formattedSats} sats for ${purchaseData.handle}`);
        }
      }
      return;
    }

    // Validate required data
    if (!priceSats) {
      console.error('[Spaces] Missing priceSats');
      Alert.alert('Error', 'Price information is missing. Please try again.');
      return;
    }

    if (!handle) {
      console.error('[Spaces] Missing handle');
      Alert.alert('Error', 'Handle information is missing. Please try again.');
      return;
    }

    if (quoteId === null) {
      console.error('[Spaces] Missing quoteId');
      Alert.alert('Error', 'Quote ID is missing. Please try again.');
      return;
    }

    const blockFee = getBlockFee(selectedDuration, blockFee1, blockFee6, blockFee48);
    if (blockFee === null) {
      console.error('[Spaces] Block fee not available for duration:', selectedDuration);
      Alert.alert('Error', 'Block fee not available. Please select a duration.');
      return;
    }

    setButtonState('loading');
    setIsButtonEnabled(false);
    setButtonLabel('Processing...');

    const spaceNameLower = spaceName.toLowerCase();
    const url = `${SPACES_API_BASE_URL}/spaces/${spaceNameLower}/${subspace.trim()}?app=${SPACES_APP_NAME}&format=json`;
    const startTime = Date.now();
    console.log(`[Spaces API] POST ${url}`);

    try {
      const confTarget = getConfTarget(selectedDuration);
      const requestBody = {
        block_fee: blockFee,
        handle: handle,
        price: priceSats,
        quote_id: quoteId,
        conf_target: confTarget,
      };

      console.log('[Spaces API] POST request body:', JSON.stringify(requestBody, null, 2));

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `[Spaces API] POST ${url} - HTTP error! status: ${response.status} (${duration}ms)`,
          errorText
        );
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log(`[Spaces API] POST ${url} - Success (${duration}ms)`, data);

      // Store purchase data and enter confirmation mode
      setPurchaseData({
        taproot_address: data.taproot_address,
        handle: data.handle,
        total_price: data.total_price,
        expiring_blockheight: data.expiring_blockheight,
      });
      setIsConfirmationMode(true);

      // Calculate USD equivalent for button label
      const totalPrice = data.total_price;
      const formattedSats = totalPrice.toLocaleString();

      if (btcPriceUSD !== null) {
        const satsPerBitcoin = 100000000;
        const usdAmount = (totalPrice / satsPerBitcoin) * btcPriceUSD;
        const formattedUSD = usdAmount.toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
        // Update button label with USD
        const confirmLabel = `Send ${formattedSats} sats = $${formattedUSD} for ${data.handle}`;
        setButtonLabel(confirmLabel);
      } else {
        // Update button label without USD if price not available
        const confirmLabel = `Send ${formattedSats} sats for ${data.handle}`;
        setButtonLabel(confirmLabel);
      }
      setIsButtonEnabled(true);
      setButtonState('available');
    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;

      console.error(`[Spaces API] POST ${url} - Failed (${duration}ms):`, error);

      setButtonState(null);
      setIsButtonEnabled(false);
      setButtonLabel('Purchase');
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to process purchase');
    }
  };

  const handleSelectSpaceName = (option: string) => {
    setSpaceName(option);
    setShowDropdown(false);
  };

  // Helper function to shorten address for display
  const shortenAddress = (address: string): string => {
    if (address.length <= 13) {
      return address; // If address is already short, return as-is
    }
    return `${address.substring(0, 8)}...${address.substring(address.length - 5)}`;
  };

  // Handle cancel purchase - sends DELETE request
  const handleCancelPurchase = async () => {
    if (!purchaseData || !quoteId || !handle) {
      console.error('[Spaces] Missing data for cancel purchase');
      return;
    }

    const spaceNameLower = spaceName.toLowerCase();
    const url = `${SPACES_API_BASE_URL}/spaces/${spaceNameLower}/${subspace.trim()}?app=${SPACES_APP_NAME}&format=json`;
    const startTime = Date.now();
    console.log(`[Spaces API] DELETE ${url}`);

    try {
      const requestBody = {
        quote_id: quoteId,
        handle: handle,
      };

      console.log('[Spaces API] DELETE request body:', JSON.stringify(requestBody, null, 2));

      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `[Spaces API] DELETE ${url} - HTTP error! status: ${response.status} (${duration}ms)`,
          errorText
        );
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log(`[Spaces API] DELETE ${url} - Success (${duration}ms)`, data);

      // Reset confirmation mode and clear purchase data
      setIsConfirmationMode(false);
      setPurchaseData(null);

      // Reset button state to initial
      setButtonState('available');
      setIsButtonEnabled(true);

      // Recalculate button label based on current price and duration
      if (priceSats !== null) {
        const blockFee = getBlockFee(selectedDuration, blockFee1, blockFee6, blockFee48);
        if (blockFee !== null && btcPriceUSD !== null) {
          const totalLabel = calculateTotalPrice(
            priceSats,
            blockFee1,
            blockFee6,
            blockFee48,
            selectedDuration,
            btcPriceUSD
          );
          setButtonLabel(totalLabel);
        }
      }
    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;

      console.error(`[Spaces API] DELETE ${url} - Failed (${duration}ms):`, error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to cancel purchase');
    }
  };

  // Get the appropriate block fee based on selected duration
  const getBlockFee = useCallback(
    (
      duration: string,
      fee1: number | null,
      fee6: number | null,
      fee48: number | null
    ): number | null => {
      switch (duration) {
        case '~10 mins':
          return fee1;
        case '~1 hour':
          return fee6;
        case '~8 hours':
          return fee48;
        default:
          return fee1;
      }
    },
    []
  );

  // Get the confirmation target based on selected duration
  const getConfTarget = useCallback((duration: string): number => {
    switch (duration) {
      case '~10 mins':
        return 1; // 1_block_fee
      case '~1 hour':
        return 6; // 6_block_fee
      case '~8 hours':
        return 48; // 48_block_fee
      default:
        return 1;
    }
  }, []);

  // Calculate total price (price + fee) and format button label
  const calculateTotalPrice = useCallback(
    (
      price: number | null,
      fee1: number | null,
      fee6: number | null,
      fee48: number | null,
      duration: string,
      btcPrice: number | null
    ): string => {
      if (price === null) {
        return 'Purchase';
      }

      const blockFee = getBlockFee(duration, fee1, fee6, fee48);
      if (blockFee === null) {
        return 'Purchase';
      }

      const totalPrice = price + blockFee;
      // Format sats with commas for readability
      const formattedSats = totalPrice.toLocaleString();

      // Calculate USD: (total_price_sats / 100,000,000) * btc_price_usd
      if (btcPrice === null) {
        return `Purchase for ${formattedSats} sats`;
      }

      const satsPerBitcoin = 100000000;
      const usdAmount = (totalPrice / satsPerBitcoin) * btcPrice;

      // Format USD with commas and 2 decimal places
      const formattedUSD = usdAmount.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

      return `Purchase for ${formattedSats} sats = $${formattedUSD}`;
    },
    [getBlockFee]
  );

  // Initialize pricing service and fetch BTC price
  useEffect(() => {
    const loadBtcPrice = async () => {
      try {
        // Initialize pricing service if not already initialized
        if (!pricingService.isReady()) {
          await pricingService.initialize();
        }

        // Get BTC/USD price
        const btcPrice = pricingService.getExchangeRate(AssetTicker.BTC, FiatCurrency.USD);
        if (btcPrice) {
          setBtcPriceUSD(btcPrice);
        } else {
          // If not in cache, fetch it
          await pricingService.refreshExchangeRates();
          const refreshedPrice = pricingService.getExchangeRate(AssetTicker.BTC, FiatCurrency.USD);
          if (refreshedPrice) {
            setBtcPriceUSD(refreshedPrice);
          }
        }
      } catch (error) {
        console.error('[Spaces] Failed to load BTC price:', error);
        // Fallback to a default price if fetch fails
        setBtcPriceUSD(89018);
      }
    };

    loadBtcPrice();

    // Refresh BTC price every 30 seconds
    const interval = setInterval(async () => {
      try {
        if (pricingService.isReady()) {
          await pricingService.refreshExchangeRates();
          const refreshedPrice = pricingService.getExchangeRate(AssetTicker.BTC, FiatCurrency.USD);
          if (refreshedPrice) {
            setBtcPriceUSD(refreshedPrice);
          }
        }
      } catch (error) {
        console.error('[Spaces] Failed to refresh BTC price:', error);
      }
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, []);

  // Load space names from API when component mounts
  useEffect(() => {
    const loadSpaces = async () => {
      const url = `${SPACES_API_BASE_URL}/getspaces?app=${SPACES_APP_NAME}`;
      const startTime = Date.now();
      console.log(`[Spaces API] GET ${url}`);

      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        const endTime = Date.now();
        const duration = endTime - startTime;

        if (!response.ok) {
          console.error(
            `[Spaces API] GET ${url} - HTTP error! status: ${response.status} (${duration}ms)`
          );
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data: GetSpacesResponse = await response.json();
        console.log(`[Spaces API] GET ${url} - Success (${duration}ms)`);

        if (data.spaces && Array.isArray(data.spaces)) {
          // Extract space_name from each object
          const spaceNames = data.spaces
            .map((item) => item.space_name)
            .filter((name): name is string => typeof name === 'string' && name.length > 0);
          setSpaceNameOptions(spaceNames);
        }
      } catch (error) {
        const endTime = Date.now();
        const duration = endTime - startTime;

        if (error instanceof TypeError && error.message.includes('Network request failed')) {
          console.error(
            `[Spaces API] GET ${url} - Network failure (${duration}ms):`,
            error.message
          );
        } else {
          console.error(`[Spaces API] GET ${url} - Failed (${duration}ms):`, error);
        }
        // Keep default options on error
      }
    };

    loadSpaces();
  }, []);

  // Check space availability when subspace or spaceName changes
  useEffect(() => {
    const checkAvailability = async () => {
      // Only make request if both fields have values
      if (!subspace.trim() || !spaceName) {
        setButtonState(null);
        setIsButtonEnabled(false);
        setButtonLabel('Purchase');
        setPriceSats(null);
        setBlockFee1(null);
        setBlockFee6(null);
        setBlockFee48(null);
        return;
      }

      setButtonState('loading');
      setIsButtonEnabled(false);
      setButtonLabel('Checking...');

      const spaceNameLower = spaceName.toLowerCase();
      const url = `${SPACES_API_BASE_URL}/spaces/${spaceNameLower}/${subspace.trim()}?app=${SPACES_APP_NAME}&format=json`;
      const startTime = Date.now();
      console.log(`[Spaces API] GET ${url}`);

      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        const endTime = Date.now();
        const duration = endTime - startTime;

        if (!response.ok) {
          console.error(
            `[Spaces API] GET ${url} - HTTP error! status: ${response.status} (${duration}ms)`
          );
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data: SpaceAvailabilityResponse = await response.json();
        console.log(`[Spaces API] GET ${url} - Success (${duration}ms)`);

        if (data.state === 'available') {
          setButtonState('available');
          setIsButtonEnabled(true);
          setIsConfirmationMode(false); // Reset confirmation mode
          setPurchaseData(null); // Clear previous purchase data

          // Store price and block fees if available
          // The recalculation useEffect will update the button label
          if (data.price !== undefined && data.price !== null) {
            setPriceSats(data.price);

            // Store handle and quote_id (id field)
            if (data.handle) {
              setHandle(data.handle);
              console.log('[Spaces] Stored handle:', data.handle);
            } else {
              setHandle(null);
            }

            if (data.id !== undefined && data.id !== null) {
              setQuoteId(data.id);
              console.log('[Spaces] Stored quoteId:', data.id);
            } else {
              setQuoteId(null);
            }

            // Block fees can be 0, so check for undefined/null specifically
            const fee1Value =
              data['1_block_fee'] !== undefined && data['1_block_fee'] !== null
                ? data['1_block_fee']
                : null;
            const fee6Value =
              data['6_block_fee'] !== undefined && data['6_block_fee'] !== null
                ? data['6_block_fee']
                : null;
            const fee48Value =
              data['48_block_fee'] !== undefined && data['48_block_fee'] !== null
                ? data['48_block_fee']
                : null;
            setBlockFee1(fee1Value);
            setBlockFee6(fee6Value);
            setBlockFee48(fee48Value);
            console.log(
              `[Spaces] API response: price=${data.price}, handle=${data.handle}, id=${data.id}, 1_block_fee=${fee1Value}, 6_block_fee=${fee6Value}, 48_block_fee=${fee48Value}`
            );
            // Don't set button label here - let the recalculation useEffect handle it
          } else {
            setPriceSats(null);
            setBlockFee1(null);
            setBlockFee6(null);
            setBlockFee48(null);
            setHandle(null);
            setQuoteId(null);
            setButtonLabel('Purchase');
          }
        } else if (data.state === 'taken') {
          setButtonState('taken');
          setIsButtonEnabled(false);
          setButtonLabel('Taken');
          setPriceSats(null);
          setBlockFee1(null);
          setBlockFee6(null);
          setBlockFee48(null);
          setIsConfirmationMode(false);
          setPurchaseData(null);
          setHandle(null);
          setQuoteId(null);
        } else {
          // Unknown state
          setButtonState(null);
          setIsButtonEnabled(false);
          setButtonLabel('Purchase');
          setPriceSats(null);
          setBlockFee1(null);
          setBlockFee6(null);
          setBlockFee48(null);
          setIsConfirmationMode(false);
          setPurchaseData(null);
          setHandle(null);
          setQuoteId(null);
        }
      } catch (error) {
        const endTime = Date.now();
        const duration = endTime - startTime;

        if (error instanceof TypeError && error.message.includes('Network request failed')) {
          console.error(
            `[Spaces API] GET ${url} - Network failure (${duration}ms):`,
            error.message
          );
        } else {
          console.error(`[Spaces API] GET ${url} - Failed (${duration}ms):`, error);
        }

        setButtonState(null);
        setIsButtonEnabled(false);
        setButtonLabel('Purchase');
        setPriceSats(null);
        setBlockFee1(null);
        setBlockFee6(null);
        setBlockFee48(null);
        setIsConfirmationMode(false);
        setPurchaseData(null);
        setHandle(null);
        setQuoteId(null);
      }
    };

    // Debounce the API call
    const timeoutId = setTimeout(() => {
      checkAvailability();
    }, 500); // Wait 500ms after user stops typing

    return () => clearTimeout(timeoutId);
  }, [subspace, spaceName]);

  // Recalculate price when duration changes or BTC price updates
  useEffect(() => {
    if (buttonState === 'available' && priceSats !== null) {
      const blockFee = getBlockFee(selectedDuration, blockFee1, blockFee6, blockFee48);
      if (blockFee !== null) {
        const totalPriceSats = priceSats + blockFee;
        console.log(
          `[Spaces] Recalculating price: duration=${selectedDuration}, price=${priceSats}, blockFee=${blockFee}, totalPriceSats=${totalPriceSats}, btcPriceUSD=${btcPriceUSD}`
        );
        const totalLabel = calculateTotalPrice(
          priceSats,
          blockFee1,
          blockFee6,
          blockFee48,
          selectedDuration,
          btcPriceUSD
        );
        setButtonLabel(totalLabel);
      } else {
        setButtonLabel('Purchase');
      }
    }
  }, [
    selectedDuration,
    priceSats,
    blockFee1,
    blockFee6,
    blockFee48,
    buttonState,
    btcPriceUSD,
    calculateTotalPrice,
    getBlockFee,
  ]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Header title="Spaces" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Search Section */}
        <View style={styles.section}>
          <View style={styles.searchCard}>
            <View style={styles.searchRow}>
              <TextInput
                style={styles.subspaceInput}
                placeholder="subspace"
                placeholderTextColor={colors.textSecondary}
                value={subspace}
                onChangeText={setSubspace}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Text style={styles.atSymbol}>@</Text>
              <TouchableOpacity
                style={styles.dropdownButton}
                onPress={() => setShowDropdown(true)}
                activeOpacity={0.7}
              >
                <Text style={[styles.dropdownText, !spaceName && styles.dropdownPlaceholder]}>
                  {spaceName || 'space_name'}
                </Text>
                <ChevronDown size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Duration Radio Buttons - Hidden in confirmation mode */}
            {!isConfirmationMode && (
              <View style={styles.radioGroup}>
                {DURATION_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option}
                    style={styles.radioButton}
                    onPress={() => setSelectedDuration(option)}
                    activeOpacity={0.7}
                  >
                    {selectedDuration === option ? (
                      <Circle size={20} color={colors.primary} fill={colors.primary} />
                    ) : (
                      <Circle size={20} color={colors.textSecondary} />
                    )}
                    <Text
                      style={[
                        styles.radioLabel,
                        selectedDuration === option && styles.radioLabelSelected,
                      ]}
                    >
                      {option}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Confirmation message - Shown in confirmation mode */}
            {isConfirmationMode && purchaseData && (
              <View style={styles.confirmationMessage}>
                <Text style={styles.confirmationText}>
                  Send {purchaseData.total_price.toLocaleString()} sats to{' '}
                  {shortenAddress(purchaseData.taproot_address)} before block{' '}
                  {purchaseData.expiring_blockheight} to complete the purchase of{' '}
                  {purchaseData.handle}.
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={[
                styles.purchaseButton,
                !isButtonEnabled && styles.purchaseButtonDisabled,
                buttonState === 'loading' && styles.purchaseButtonLoading,
              ]}
              onPress={handlePurchase}
              disabled={!isButtonEnabled}
              activeOpacity={isButtonEnabled ? 0.7 : 1}
            >
              <Text
                style={[
                  styles.purchaseButtonText,
                  !isButtonEnabled && styles.purchaseButtonTextDisabled,
                ]}
              >
                {buttonLabel}
              </Text>
            </TouchableOpacity>

            {/* Cancel Purchase button - Shown in confirmation mode */}
            {isConfirmationMode && (
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={handleCancelPurchase}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelButtonText}>Cancel Purchase</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Transaction Hex Modal */}
        <Modal
          visible={showTxHexModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowTxHexModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Transaction Hex</Text>
              <ScrollView style={styles.txHexContainer}>
                <Text style={styles.txHexText} selectable>
                  {txHex}
                </Text>
              </ScrollView>
              <TouchableOpacity
                style={styles.modalDismissButton}
                onPress={() => setShowTxHexModal(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.modalDismissButtonText}>Dismiss</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Create Space Section */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.createButton}
            onPress={handleCreateSpace}
            activeOpacity={0.7}
          >
            <Plus size={20} color={colors.primary} />
            <Text style={styles.createButtonText}>Create New Space</Text>
          </TouchableOpacity>
        </View>

        {/* Spaces List Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Box size={20} color={colors.primary} />
            <Text style={styles.sectionTitle}>My Spaces</Text>
          </View>

          {/* Placeholder: Replace with actual spaces data */}
          <View style={styles.infoCard}>
            <Text style={styles.emptyText}>No spaces yet</Text>
            <Text style={styles.emptySubtext}>Create your first space to get started</Text>
          </View>

          {/* Example space item (uncomment when you have data) */}
          {/* {spaces.map((space) => (
            <TouchableOpacity
              key={space.id}
              style={styles.spaceCard}
              onPress={() => handleSpacePress(space.id)}
              activeOpacity={0.7}
            >
              <View style={styles.spaceContent}>
                <Text style={styles.spaceName}>{space.name}</Text>
                <Text style={styles.spaceDescription}>{space.description}</Text>
              </View>
              <Settings size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          ))} */}
        </View>

        {/* Info Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Info size={20} color={colors.primary} />
            <Text style={styles.sectionTitle}>About Spaces</Text>
          </View>

          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>What are Spaces?</Text>
              <Text style={styles.infoValue}>
                Spaces are customizable environments for organizing your digital assets and
                activities.
              </Text>
            </View>

            <View style={[styles.infoRow, styles.infoRowLast]}>
              <Text style={styles.infoLabel}>Features</Text>
              <Text style={styles.infoValue}>Create, manage, and organize your spaces</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Dropdown Modal */}
      <Modal
        visible={showDropdown}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDropdown(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowDropdown(false)}
        >
          <View style={styles.dropdownContainer}>
            {spaceNameOptions.map((option) => (
              <TouchableOpacity
                key={option}
                style={[
                  styles.dropdownOption,
                  spaceName === option && styles.dropdownOptionSelected,
                ]}
                onPress={() => handleSelectSpaceName(option)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.dropdownOptionText,
                    spaceName === option && styles.dropdownOptionTextSelected,
                  ]}
                >
                  {option}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  section: {
    paddingHorizontal: 20,
    paddingTop: 24,
    marginBottom: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginLeft: 8,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: colors.primary,
    borderStyle: 'dashed',
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
    marginLeft: 8,
  },
  infoCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDark,
  },
  infoRowLast: {
    borderBottomWidth: 0,
  },
  infoLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    flex: 1,
    marginRight: 12,
  },
  infoValue: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
    flex: 2,
    textAlign: 'right',
  },
  spaceCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  spaceContent: {
    flex: 1,
    marginRight: 12,
  },
  spaceName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  spaceDescription: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  emptyText: {
    fontSize: 16,
    color: colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  searchCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  atSymbol: {
    fontSize: 24,
    fontWeight: '600',
    color: '#AA4981',
    paddingHorizontal: 0,
    marginHorizontal: -4,
  },
  subspaceInput: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.borderDark,
  },
  dropdownButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.borderDark,
  },
  dropdownText: {
    fontSize: 14,
    color: colors.text,
  },
  dropdownPlaceholder: {
    color: colors.textSecondary,
  },
  radioGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 8,
  },
  radioButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  radioLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  radioLabelSelected: {
    color: colors.text,
    fontWeight: '500',
  },
  purchaseButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  purchaseButtonDisabled: {
    backgroundColor: colors.card,
    opacity: 0.6,
  },
  purchaseButtonLoading: {
    backgroundColor: colors.card,
  },
  purchaseButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.black,
  },
  purchaseButtonTextDisabled: {
    color: colors.textSecondary,
  },
  cancelButton: {
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    borderWidth: 1,
    borderColor: colors.borderDark,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownContainer: {
    backgroundColor: colors.card,
    borderRadius: 12,
    minWidth: 200,
    maxWidth: '80%',
    paddingVertical: 8,
    shadowColor: colors.black,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  dropdownOption: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  dropdownOptionSelected: {
    backgroundColor: colors.tintedBackground,
  },
  dropdownOptionText: {
    fontSize: 14,
    color: colors.text,
  },
  dropdownOptionTextSelected: {
    color: colors.primary,
    fontWeight: '600',
  },
  confirmationMessage: {
    backgroundColor: colors.cardDark,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  confirmationText: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
    textAlign: 'center',
  },
  modalContent: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  txHexContainer: {
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 12,
    maxHeight: 400,
    marginBottom: 16,
  },
  txHexText: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: colors.text,
    lineHeight: 18,
  },
  modalDismissButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalDismissButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.black,
  },
});
