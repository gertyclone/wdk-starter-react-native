import Header from '@/components/header';
import { useDebouncedNavigation } from '@/hooks/use-debounced-navigation';
import { Box, ChevronDown, Circle, Info, Plus } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import {
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

  // Placeholder handlers - customize these based on your needs
  const handleCreateSpace = () => {
    // TODO: Implement create space functionality
    console.log('Create space pressed');
  };

  const handleSpacePress = (spaceId: string) => {
    // TODO: Navigate to space details or open space
    console.log('Space pressed:', spaceId);
  };

  const handlePurchase = () => {
    // TODO: Implement purchase functionality
    console.log('Purchase pressed', { subspace, spaceName });
  };

  const handleSelectSpaceName = (option: string) => {
    setSpaceName(option);
    setShowDropdown(false);
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

  // Calculate total price (price + fee) and format button label
  const calculateTotalPrice = useCallback(
    (
      price: number | null,
      fee1: number | null,
      fee6: number | null,
      fee48: number | null,
      duration: string
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

      return `Purchase for ${formattedSats}`;
    },
    [getBlockFee]
  );

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

          // Store price and block fees if available
          // The recalculation useEffect will update the button label
          if (data.price !== undefined && data.price !== null) {
            setPriceSats(data.price);
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
              `[Spaces] API response: price=${data.price}, 1_block_fee=${fee1Value}, 6_block_fee=${fee6Value}, 48_block_fee=${fee48Value}`
            );
            // Don't set button label here - let the recalculation useEffect handle it
          } else {
            setPriceSats(null);
            setBlockFee1(null);
            setBlockFee6(null);
            setBlockFee48(null);
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
        } else {
          // Unknown state
          setButtonState(null);
          setIsButtonEnabled(false);
          setButtonLabel('Purchase');
          setPriceSats(null);
          setBlockFee1(null);
          setBlockFee6(null);
          setBlockFee48(null);
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
      }
    };

    // Debounce the API call
    const timeoutId = setTimeout(() => {
      checkAvailability();
    }, 500); // Wait 500ms after user stops typing

    return () => clearTimeout(timeoutId);
  }, [subspace, spaceName]);

  // Recalculate price when duration changes
  useEffect(() => {
    if (buttonState === 'available' && priceSats !== null) {
      const blockFee = getBlockFee(selectedDuration, blockFee1, blockFee6, blockFee48);
      if (blockFee !== null) {
        console.log(
          `[Spaces] Recalculating price: duration=${selectedDuration}, price=${priceSats}, blockFee=${blockFee}`
        );
        const totalLabel = calculateTotalPrice(
          priceSats,
          blockFee1,
          blockFee6,
          blockFee48,
          selectedDuration
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

            {/* Duration Radio Buttons */}
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
          </View>
        </View>

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
});
