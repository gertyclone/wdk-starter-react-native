import Header from '@/components/header';
import { clearAvatar } from '@/config/avatar-options';
import { networkConfigs } from '@/config/networks';
import useWalletAvatar from '@/hooks/use-wallet-avatar';
import getDisplaySymbol from '@/utils/get-display-symbol';
import { NetworkType, useWallet } from '@tetherto/wdk-react-native-provider';
import * as Clipboard from 'expo-clipboard';
import { useDebouncedNavigation } from '@/hooks/use-debounced-navigation';
import { useTranslation } from '@/hooks/use-translation';
import { changeLanguage, getCurrentLanguage } from '@/i18n';
import { getLanguageName, getSupportedLanguageCodes, type SupportedLanguage } from '@/i18n/config';
import { Copy, Globe, Info, Shield, Trash2, Wallet } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { toast } from 'sonner-native';
import { colors } from '@/constants/colors';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useDebouncedNavigation();
  const { t, i18n } = useTranslation(['common', 'screens']);
  const { wallet, clearWallet, addresses } = useWallet();
  const avatar = useWalletAvatar();
  const [currentLanguage, setCurrentLanguage] = useState<string>(getCurrentLanguage());

  useEffect(() => {
    // Update current language when i18n language changes
    const updateLanguage = () => {
      setCurrentLanguage(getCurrentLanguage());
    };
    updateLanguage();
  }, [i18n.language]);

  const handleLanguageChange = async (languageCode: SupportedLanguage) => {
    try {
      await changeLanguage(languageCode);
      setCurrentLanguage(languageCode);
      toast.success(t('screens:settings.languageChanged'));
    } catch (error) {
      console.error('Failed to change language:', error);
      toast.error(t('screens:settings.languageChangeFailed'));
    }
  };

  const handleDeleteWallet = () => {
    Alert.alert(
      t('screens:settings.deleteWallet'),
      t('screens:settings.deleteWalletConfirm'),
      [
        {
          text: t('common:buttons.cancel'),
          style: 'cancel',
        },
        {
          text: t('screens:settings.deleteWallet'),
          style: 'destructive',
          onPress: async () => {
            try {
              await clearWallet();
              await clearAvatar();
              toast.success(t('screens:settings.walletDeleted'));
              router.dismissAll('/');
            } catch (error) {
              console.error('Failed to delete wallet:', error);
              toast.error(t('screens:settings.deleteFailed'));
            }
          },
        },
      ]
    );
  };

  const handleCopyAddress = async (address: string, networkName: string) => {
    await Clipboard.setStringAsync(address);
    toast.success(t('screens:settings.addressCopied', { network: networkName }));
  };

  const formatAddress = (address: string) => {
    if (!address) return t('screens:settings.notAvailable');
    if (address.length <= 15) return address;
    return `${address.slice(0, 10)}...${address.slice(-10)}`;
  };

  const getNetworkName = (network: string) => {
    return networkConfigs[network as NetworkType].name || network;
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Header title={t('screens:settings.title')} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Wallet Info Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Wallet size={20} color={colors.primary} />
            <Text style={styles.sectionTitle}>{t('screens:settings.walletInfo')}</Text>
          </View>

          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{t('common:labels.name')}</Text>
              <Text style={styles.infoValue}>{wallet?.name || t('screens:settings.unknown')}</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{t('screens:settings.icon')}</Text>
              <Text style={styles.infoValue}>{avatar}</Text>
            </View>

            <View style={[styles.infoRow, styles.infoRowLast]}>
              <Text style={styles.infoLabel}>{t('screens:settings.enabledAssets')}</Text>
              <Text style={styles.infoValue}>
                {wallet?.enabledAssets?.map(asset => getDisplaySymbol(asset)).join(', ') || t('screens:settings.none')}
              </Text>
            </View>
          </View>
        </View>

        {/* Language Selection Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Globe size={20} color={colors.primary} />
            <Text style={styles.sectionTitle}>{t('screens:settings.language')}</Text>
          </View>

          <View style={styles.infoCard}>
            {getSupportedLanguageCodes().map((langCode, index, array) => (
              <TouchableOpacity
                key={langCode}
                style={[
                  styles.infoRow,
                  index === array.length - 1 ? styles.infoRowLast : null,
                  currentLanguage === langCode && styles.selectedLanguageRow,
                ]}
                onPress={() => handleLanguageChange(langCode)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.infoLabel,
                    currentLanguage === langCode && styles.selectedLanguageLabel,
                  ]}
                >
                  {getLanguageName(langCode)}
                </Text>
                {currentLanguage === langCode && (
                  <Text style={styles.selectedLanguageIndicator}>✓</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Network Addresses Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Shield size={20} color={colors.primary} />
            <Text style={styles.sectionTitle}>{t('screens:settings.networkAddresses')}</Text>
          </View>

          <View style={styles.addressCard}>
            {addresses &&
              Object.entries(addresses).map(([network, address], index, array) => (
                <TouchableOpacity
                  key={network}
                  style={[
                    styles.addressRow,
                    index === array.length - 1 ? styles.addressRowLast : null,
                  ]}
                  onPress={() => handleCopyAddress(address as string, getNetworkName(network))}
                  activeOpacity={0.7}
                >
                  <View style={styles.addressContent}>
                    <Text style={styles.networkLabel}>{getNetworkName(network)}</Text>
                    <Text style={styles.addressValue}>{formatAddress(address as string)}</Text>
                  </View>
                  <Copy size={18} color={colors.primary} />
                </TouchableOpacity>
              ))}
          </View>
        </View>

        {/* About Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Info size={20} color={colors.primary} />
            <Text style={styles.sectionTitle}>{t('screens:settings.about')}</Text>
          </View>

          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{t('common:labels.version')}</Text>
              <Text style={styles.infoValue}>1.0.0</Text>
            </View>

            <View style={[styles.infoRow, styles.infoRowLast]}>
              <Text style={styles.infoLabel}>{t('screens:settings.wdkVersion')}</Text>
              <Text style={styles.infoValue}>{t('screens:settings.latest')}</Text>
            </View>
          </View>
        </View>

        {/* Danger Zone */}
        <View style={styles.dangerSection}>
          <View style={styles.sectionHeader}>
            <Trash2 size={20} color={colors.danger} />
            <Text style={[styles.sectionTitle, styles.dangerTitle]}>{t('screens:settings.dangerZone')}</Text>
          </View>

          <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteWallet}>
            <Trash2 size={20} color={colors.white} />
            <Text style={styles.deleteButtonText}>{t('screens:settings.deleteWallet')}</Text>
          </TouchableOpacity>

          <Text style={styles.warningText}>
            {t('screens:settings.deleteWarning')}
          </Text>
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
  infoCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  },
  infoValue: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
  },
  infoValueSmall: {
    fontSize: 12,
    color: colors.text,
    fontWeight: '500',
  },
  addressCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
  },
  addressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDark,
  },
  addressRowLast: {
    borderBottomWidth: 0,
  },
  addressContent: {
    flex: 1,
    marginRight: 12,
  },
  networkLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  addressValue: {
    fontSize: 13,
    color: colors.text,
    fontFamily: 'monospace',
  },
  dangerSection: {
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 40,
  },
  dangerTitle: {
    color: colors.danger,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.danger,
    borderRadius: 12,
    paddingVertical: 16,
    marginBottom: 12,
  },
  deleteButtonText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  warningText: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  selectedLanguageRow: {
    backgroundColor: colors.tintedBackground,
  },
  selectedLanguageLabel: {
    color: colors.primary,
    fontWeight: '600',
  },
  selectedLanguageIndicator: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: 'bold',
  },
});
