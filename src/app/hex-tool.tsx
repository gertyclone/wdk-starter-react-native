import Header from '@/components/header';
import { useDebouncedNavigation } from '@/hooks/use-debounced-navigation';
import { useLocalSearchParams } from 'expo-router';
import { Copy, Trash2 } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Keyboard,
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';

const isValidHex = (text: string): boolean => {
  if (text.length === 0) return true;
  return /^[0-9A-Fa-f]*$/.test(text);
};

const asciiToHex = (text: string): string => {
  return text
    .split('')
    .map((char) => char.charCodeAt(0).toString(16).padStart(2, '0').toUpperCase())
    .join('');
};

const hexToAscii = (hex: string): string => {
  let ascii = '';
  for (let i = 0; i < hex.length; i += 2) {
    const hexByte = hex.slice(i, i + 2);
    const charCode = parseInt(hexByte, 16);
    if (isNaN(charCode)) break;
    ascii += String.fromCharCode(charCode);
  }
  return ascii;
};

type DataType = '00' | '01' | '02' | '03' | '04' | '05' | '06' | '07' | '08' | '09' | '0A' | '0B' | '0C' | '0D' | string;

type TableRow = {
  id: string;
  type: DataType;
  value: string;
};

const DATA_TYPES: Record<string, { name: string; placeholder: string }> = {
  '00': { name: 'Handle', placeholder: '@space(top-level) -or- user@space(sub-space)' },
  '01': { name: 'Owner URI', placeholder: 'http://192.168.1.254:8080/api-docs' },
  '02': { name: 'Nostr Pubkey', placeholder: '040e739ce127b6d77c34ea12e10245b72742a26c67ce0575c3b0add38dc297b4282' },
  '03': { name: 'Nostr Relays', placeholder: 'wss://relay@primal,wss://relay.primal.net,ws://194.195.222.47:4848/' },
  '04': { name: 'Pubky.app', placeholder: 'pk:7fmjpcuuzf54hw18bsgi3zihzyh4awseeuq5tmojefaezjbd64cy' },
  '05': { name: 'DID', placeholder: 'did:btc1:k1q0rnnwf657vuu8trztlczvlmphjgc6q598h79cm6sp7c4fgqh0fkc0vzd9u:' },
  '06': { name: 'A Rec', placeholder: '192.168.1.254' },
  '07': { name: 'CNAME', placeholder: 'www.example.com or website@space(recursive lookup)' },
  '08': { name: 'SMTP', placeholder: 'in1-smtp.messagingengine.com' },
  '09': { name: 'TXT', placeholder: 'ASCII -or- Encoded TXT ~00~user~user@space, ~01~book~urn:isbn:0-294-56559-3' },
  '0A': { name: 'BTC Addr', placeholder: 'bc1pjeda67ewjtms6p20nk3udt6c5wwk90zzdlhd3dx73r8ynzsm07nqwxggmu' },
  '0B': { name: 'ETH Addr', placeholder: '0xC3P0F36260817d1c78C471406BdE482177a1935071' },
  '0C': { name: 'Script Pubkey', placeholder: '5120.............................b8821d0d92d2d52bb767317bb07a8cbed20' },
  '0D': { name: 'TON Addr', placeholder: 'UQCLR......dJqdkB4OSKur7QG70TvovFOQSZWRj7awCShy5' },
};

export default function HexToolScreen() {
  const insets = useSafeAreaInsets();
  const router = useDebouncedNavigation();
  const { subspace, spaceName } = useLocalSearchParams<{
    subspace: string;
    spaceName: string;
  }>();

  const [hexString, setHexString] = useState('01');
  const [asciiDecodedText, setAsciiDecodedText] = useState('');
  const [selectedVersion, setSelectedVersion] = useState<'00' | '01'>('01');
  const [tableRows, setTableRows] = useState<TableRow[]>([]);
  const [selectedRowForType, setSelectedRowForType] = useState<string | null>(null);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  const parseVTLV = (hex: string) => {
    const upperHex = hex.toUpperCase();

    if (upperHex.length === 0) {
      return null;
    }

    if (upperHex.length < 2) {
      return null;
    }

    const version = upperHex.slice(0, 2);
    
    if (version === '00') {
      if (upperHex.length < 6) {
        return null;
      }

      const lengthHex = upperHex.slice(2, 6);
      const length = parseInt(lengthHex, 16);
      const expectedTotalLength = 2 + 4 + length * 2;

      if (upperHex.length < expectedTotalLength) {
        return { version, length, truncated: true };
      }

      const valueHex = upperHex.slice(6, expectedTotalLength);
      return { version, length, value: valueHex };
    }

    return { version };
  };

  const handleTextChange = (text: string) => {
    if (text.length > 0) {
      if (!isValidHex(text)) {
        const invalidCharMatch = text.match(/[^0-9A-Fa-f]/);
        const invalidChar = invalidCharMatch ? invalidCharMatch[0] : 'unknown';
        
        Alert.alert(
          'Invalid Hex Character',
          `The character "${invalidChar}" is not a valid hexadecimal digit.\n\nOnly hexadecimal digits (0-9, A-F, a-f) are allowed.`,
          [{ text: 'OK' }]
        );
        return;
      }
    }
    
    const upperText = text.toUpperCase();
    setHexString(upperText);
  };

  const handleHexBlur = () => {
    if (!hexString || hexString.length === 0) {
      return;
    }

    if (!isValidHex(hexString)) {
      return;
    }

    const parsed = parseVTLV(hexString);
    if (!parsed) {
      return;
    }

    if (parsed.version === '00') {
      if (parsed.value && !parsed.truncated) {
        const decodedText = hexToAscii(parsed.value);
        setSelectedVersion('00');
        setAsciiDecodedText(decodedText);
        setTableRows([]);
      }
    } else if (parsed.version === '01') {
      const upperHex = hexString.toUpperCase();
      const items: TableRow[] = [];
      let offset = 2;

      while (offset < upperHex.length) {
        if (offset + 4 > upperHex.length) {
          break;
        }

        const typeHex = upperHex.slice(offset, offset + 2);
        offset += 2;

        const lengthHex = upperHex.slice(offset, offset + 2);
        const length = parseInt(lengthHex, 16);
        offset += 2;

        if (offset + length * 2 > upperHex.length) {
          break;
        }

        const valueHex = upperHex.slice(offset, offset + length * 2);
        const value = hexToAscii(valueHex);
        offset += length * 2;

        items.push({
          id: Date.now().toString() + items.length,
          type: typeHex,
          value: value,
        });
      }

      if (items.length > 0) {
        setSelectedVersion('01');
        setTableRows(items);
        setAsciiDecodedText('');
      }
    }
  };

  const recalculateVersion01Hex = useCallback(() => {
    if (selectedVersion !== '01') return;
    
    let hex = '01';
    
    for (const row of tableRows) {
      if (!row.value) continue;
      
      const typeHex = row.type.padStart(2, '0').toUpperCase();
      const valueLength = row.value.length;
      if (valueLength > 255) {
        Alert.alert('Error', `Value for ${DATA_TYPES[row.type]?.name || 'row'} exceeds 255 characters.`);
        continue;
      }
      const lengthHex = valueLength.toString(16).padStart(2, '0').toUpperCase();
      const valueHex = asciiToHex(row.value);
      hex += typeHex + lengthHex + valueHex;
    }
    
    setHexString(hex);
  }, [selectedVersion, tableRows]);

  useEffect(() => {
    AsyncStorage.setItem('vltv_hex', hexString);
  }, [hexString]);

  useEffect(() => {
    if (selectedVersion === '01') {
      recalculateVersion01Hex();
    }
  }, [tableRows, selectedVersion, recalculateVersion01Hex]);

  // Track which input is focused to determine if we should hide hex display
  const [focusedInput, setFocusedInput] = useState<'hex' | 'table' | 'ascii' | null>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  // Hide hex display when table or ascii inputs are focused AND keyboard is visible
  useEffect(() => {
    const shouldHide = (focusedInput === 'table' || focusedInput === 'ascii') && keyboardVisible;
    setIsKeyboardVisible(shouldHide);
  }, [focusedInput, keyboardVisible]);

  // Handle keyboard visibility with listeners
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () => {
      setKeyboardVisible(true);
    });
    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardVisible(false);
    });

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  const handleVersionChange = (version: '00' | '01') => {
    setSelectedVersion(version);
    if (version === '00' && asciiDecodedText.length > 0) {
      updateHexFromAscii(asciiDecodedText, version);
    } else if (version === '01') {
      // Recalculate hex for Version 01
    } else {
      if (hexString.length >= 2) {
        setHexString(version + hexString.slice(2));
      } else {
        setHexString(version);
      }
    }
  };

  const updateHexFromAscii = (asciiText: string, version: string = selectedVersion) => {
    const length = asciiText.length;
    if (length > 65535) {
      Alert.alert('Error', 'Handle text cannot exceed 65535 characters.');
      return;
    }
    const lengthHex = length.toString(16).padStart(4, '0').toUpperCase();
    const asciiHex = asciiToHex(asciiText);
    setHexString(version + lengthHex + asciiHex);
  };

  const handleAsciiTextChange = (text: string) => {
    setAsciiDecodedText(text);
    if (selectedVersion === '00') {
      if (text.length === 0) {
        setHexString(selectedVersion);
      } else {
        updateHexFromAscii(text);
      }
    }
  };

  const getLengthByteDecimal = (): number | null => {
    if (hexString.length === 0) return null;
    const totalBytes = Math.floor(hexString.length / 2);
    return totalBytes;
  };

  const copyToClipboard = async () => {
    if (hexString.length === 0) {
      Alert.alert('Nothing to Copy', 'The hex string is empty.');
      return;
    }
    try {
      await Clipboard.setStringAsync(hexString);
      Alert.alert('Copied!', 'Hex string copied to clipboard.');
    } catch {
      Alert.alert('Error', 'Failed to copy to clipboard.');
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Header title="Hex Tool" />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <View style={styles.textInputContainer}>
            <View style={styles.labelContainer}>
              <Text style={styles.label}>Hex String</Text>
              {(() => {
                const lengthDecimal = getLengthByteDecimal();
                return lengthDecimal !== null ? (
                  <>
                    <Text style={styles.lengthLabel}> (Length: {lengthDecimal})</Text>
                    <TouchableOpacity
                      style={styles.copyButton}
                      onPress={copyToClipboard}
                      activeOpacity={0.7}>
                      <Copy size={18} color={colors.text} />
                    </TouchableOpacity>
                  </>
                ) : null;
              })()}
            </View>
            {!isKeyboardVisible && (
              <TextInput
                testID="vtlv-hex"
                style={styles.textInput}
                value={hexString}
                onChangeText={handleTextChange}
                onFocus={() => setFocusedInput('hex')}
                onBlur={() => {
                  setFocusedInput(null);
                  handleHexBlur();
                }}
                multiline
                editable
                selectTextOnFocus
                placeholder="Generated VTLV hex string will appear here..."
                placeholderTextColor={colors.textSecondary}
              />
            )}
          </View>


          {selectedVersion === '00' && (
            <View style={styles.textInputContainer}>
              <Text style={styles.label}>Unencoded ASCII Text</Text>
              <TextInput
                testID="ascii-text"
                style={styles.textInput}
                value={asciiDecodedText}
                onChangeText={handleAsciiTextChange}
                onFocus={() => setFocusedInput('ascii')}
                onBlur={() => setFocusedInput(null)}
                multiline
                editable
                placeholder="Any ASCII text"
                placeholderTextColor={colors.textSecondary}
              />
            </View>
          )}

          {selectedVersion === '01' && (
            <View style={styles.tableContainer}>
              <View style={styles.table}>
                <View style={styles.tableHeader}>
                  <View style={[styles.tableHeaderCellType, styles.tableHeaderCell]}>
                    <Text style={styles.tableHeaderText}>Type</Text>
                  </View>
                  <View style={[styles.tableHeaderCellValue, styles.tableHeaderCell]}>
                    <Text style={styles.tableHeaderText}>Value</Text>
                  </View>
                  <View style={styles.tableHeaderCellActions}>
                    <Trash2 size={18} color={colors.textSecondary} />
                  </View>
                </View>
                {tableRows.map((row) => (
                  <View key={row.id} style={[styles.tableRow, { borderBottomColor: colors.borderDark }]}>
                    <View style={[styles.tableCellType, styles.tableCell]}>
                      <TouchableOpacity
                        style={styles.dropdownButton}
                        onPress={() => setSelectedRowForType(row.id)}
                        activeOpacity={0.7}>
                        <Text style={styles.dropdownButtonText}>
                          {DATA_TYPES[row.type]?.name || `Type ${row.type}`}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    <View style={[styles.tableCellValue, styles.tableCell]}>
                      <TextInput
                        style={styles.tableInput}
                        value={row.value}
                        onChangeText={(text) => {
                          setTableRows(
                            tableRows.map((r) => (r.id === row.id ? { ...r, value: text } : r))
                          );
                        }}
                        onFocus={() => setFocusedInput('table')}
                        onBlur={() => setFocusedInput(null)}
                        placeholder={DATA_TYPES[row.type]?.placeholder || 'Enter value...'}
                        placeholderTextColor={colors.textSecondary}
                      />
                    </View>
                    <View style={styles.tableCellActions}>
                      <TouchableOpacity
                        style={styles.deleteButton}
                        onPress={() => {
                          setTableRows(tableRows.filter((r) => r.id !== row.id));
                        }}
                        activeOpacity={0.7}>
                        <Trash2 size={18} color={colors.error} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
              <TouchableOpacity
                style={styles.insertButton}
                onPress={() => {
                  const newRow: TableRow = {
                    id: Date.now().toString(),
                    type: '00',
                    value: '',
                  };
                  setTableRows([...tableRows, newRow]);
                }}
                activeOpacity={0.7}>
                <Text style={styles.insertButtonText}>Insert</Text>
              </TouchableOpacity>
              {/* Type Selection Modal */}
              <Modal
                visible={selectedRowForType !== null}
                transparent
                animationType="fade"
                onRequestClose={() => setSelectedRowForType(null)}>
                <TouchableOpacity
                  style={styles.modalOverlay}
                  activeOpacity={1}
                  onPress={() => setSelectedRowForType(null)}>
                  <View style={styles.modalContent}>
                    {Object.keys(DATA_TYPES).map((type) => (
                      <TouchableOpacity
                        key={type}
                        style={[styles.modalOption, { borderBottomColor: colors.borderDark }]}
                        onPress={() => {
                          if (selectedRowForType) {
                            setTableRows(
                              tableRows.map((r) =>
                                r.id === selectedRowForType ? { ...r, type } : r
                              )
                            );
                            setSelectedRowForType(null);
                          }
                        }}
                        activeOpacity={0.7}>
                        <View style={styles.modalOptionContent}>
                          <Text style={styles.modalOptionName}>{DATA_TYPES[type].name}</Text>
                          <Text style={styles.modalOptionType}>Type {type}</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                </TouchableOpacity>
              </Modal>
            </View>
          )}
        </View>
      </ScrollView>
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
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  textInputContainer: {
    marginBottom: 16,
  },
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  lengthLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
    opacity: 0.7,
  },
  copyButton: {
    marginLeft: 8,
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textInput: {
    minHeight: 120,
    maxHeight: 200,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.borderDark,
    borderRadius: 8,
    backgroundColor: colors.card,
    color: colors.text,
    fontSize: 14,
    fontFamily: 'monospace',
    textAlignVertical: 'top',
  },
  separator: {
    height: 1,
    width: '100%',
    backgroundColor: colors.borderDark,
    marginVertical: 16,
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    marginBottom: 16,
  },
  versionButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  versionButtonSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  versionButtonUnselected: {
    backgroundColor: colors.card,
    borderColor: colors.borderDark,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  buttonTextSelected: {
    color: colors.black,
  },
  buttonTextUnselected: {
    color: colors.textSecondary,
  },
  tableContainer: {
    marginTop: 16,
    marginBottom: 16,
  },
  table: {
    borderWidth: 1,
    borderColor: colors.borderDark,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 12,
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDark,
    backgroundColor: colors.cardDark,
  },
  tableHeaderCell: {
    padding: 12,
    borderRightWidth: 1,
    borderRightColor: colors.borderDark,
  },
  tableHeaderCellType: {
    width: 140,
  },
  tableHeaderCellValue: {
    flex: 1,
  },
  tableHeaderCellActions: {
    width: 70,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tableHeaderText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tableCell: {
    padding: 8,
    borderRightWidth: 1,
    borderRightColor: colors.borderDark,
    justifyContent: 'center',
  },
  tableCellType: {
    width: 140,
  },
  tableCellValue: {
    flex: 1,
  },
  tableCellActions: {
    width: 70,
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownButton: {
    padding: 8,
    borderWidth: 1,
    borderColor: colors.borderDark,
    borderRadius: 4,
    backgroundColor: colors.card,
    minHeight: 40,
    justifyContent: 'center',
  },
  dropdownButtonText: {
    fontSize: 14,
    color: colors.text,
  },
  tableInput: {
    padding: 8,
    borderWidth: 1,
    borderColor: colors.borderDark,
    borderRadius: 4,
    backgroundColor: colors.card,
    fontSize: 14,
    color: colors.text,
    minHeight: 40,
  },
  deleteButton: {
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 32,
    minHeight: 32,
  },
  insertButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  insertButtonText: {
    color: colors.black,
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: colors.card,
    borderRadius: 8,
    padding: 16,
    minWidth: 200,
    maxWidth: 300,
    maxHeight: '80%',
  },
  modalOption: {
    padding: 16,
    borderBottomWidth: 1,
  },
  modalOptionContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalOptionName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  modalOptionType: {
    fontSize: 12,
    color: colors.textSecondary,
    opacity: 0.6,
  },
});
