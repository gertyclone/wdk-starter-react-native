import { SeedPhrase } from '@/components/SeedPhrase';
import * as Clipboard from 'expo-clipboard';
import { useDebouncedNavigation } from '@/hooks/use-debounced-navigation';
import { useTranslation } from '@/hooks/use-translation';
import { ChevronLeft, Download, FileText, ScanText } from 'lucide-react-native';
import React, { useState } from 'react';
import { colors } from '@/constants/colors';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { toast } from 'sonner-native';

export default function ImportWalletScreen() {
  const router = useDebouncedNavigation();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation(['common', 'screens', 'errors']);
  const [secretWords, setSecretWords] = useState<string[]>(Array(12).fill(''));

  const handleWordChange = (index: number, text: string) => {
    const newWords = [...secretWords];
    newWords[index] = text.trim().toLowerCase();
    setSecretWords(newWords);
  };

  const handlePaste = async () => {
    try {
      const clipboardContent = await Clipboard.getStringAsync();

      if (!clipboardContent.trim()) {
        toast.error(t('screens:walletSetup.importWallet.emptyClipboard'));
        return;
      }

      const words = clipboardContent.trim().split(/\s+/).slice(0, 12);

      if (words.length < 12) {
        toast.error(t('screens:walletSetup.importWallet.invalidPhrase', { count: words.length }));
        return;
      }

      const newWords = [...secretWords];
      words.forEach((word, index) => {
        if (index < 12) {
          newWords[index] = word.toLowerCase().trim();
        }
      });
      setSecretWords(newWords);

      toast.success(t('screens:walletSetup.importWallet.pasteSuccess'));
    } catch (error) {
      console.error('Paste error:', error);
      toast.error(t('screens:walletSetup.importWallet.pasteFailed'));
    }
  };

  const handleScanText = () => {
    Alert.alert(t('screens:walletSetup.importWallet.scanText'), t('screens:walletSetup.importWallet.scanTextMessage'), [
      { text: t('common:buttons.done') },
    ]);
  };

  const isFormValid = () => {
    return secretWords.every(word => word.trim().length > 0);
  };

  const validateSeedPhrase = (phrase: string): boolean => {
    const words = phrase
      .trim()
      .split(' ')
      .filter(word => word.length > 0);

    // Check if we have exactly 12 or 24 words
    if (words.length !== 12 && words.length !== 24) {
      return false;
    }

    // Basic word validation - each word should be at least 3 characters
    const validWords = words.every(
      word => word.length >= 3 && /^[a-z]+$/.test(word) // only lowercase letters
    );

    return validWords;
  };

  const handleImportWallet = () => {
    if (!isFormValid()) {
      Alert.alert(t('screens:walletSetup.importWallet.incomplete'), t('screens:walletSetup.importWallet.incompleteMessage'), [
        { text: t('common:buttons.done') },
      ]);
      return;
    }

    // Join the words into a seed phrase
    const seedPhrase = secretWords.join(' ');

    // Validate the seed phrase
    if (!validateSeedPhrase(seedPhrase)) {
      Alert.alert(
        t('screens:walletSetup.importWallet.invalidSeedPhrase'),
        t('screens:walletSetup.importWallet.invalidSeedPhraseMessage'),
        [{ text: t('common:buttons.done') }]
      );
      return;
    }

    // Navigate to name wallet screen with the seed phrase
    router.push({
      pathname: './import-name-wallet',
      params: { seedPhrase: encodeURIComponent(seedPhrase) },
    });
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={24} color={colors.primary} />
          <Text style={styles.backText}>{t('common:buttons.back')}</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.content}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>{t('screens:walletSetup.importWallet.title')}</Text>

          <SeedPhrase words={secretWords} editable={true} onWordChange={handleWordChange} />

          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.actionButton} onPress={handlePaste}>
              <FileText size={20} color={colors.primary} />
              <Text style={styles.actionButtonText}>{t('common:buttons.paste')}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={handleScanText}>
              <ScanText size={20} color={colors.primary} />
              <Text style={styles.actionButtonText}>{t('screens:walletSetup.importWallet.scanText')}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
        <TouchableOpacity
          style={[styles.importButton, !isFormValid() && styles.importButtonDisabled]}
          onPress={handleImportWallet}
        >
          <Download size={20} color={isFormValid() ? colors.black : colors.textTertiary} />
          <Text
            style={[styles.importButtonText, !isFormValid() && styles.importButtonTextDisabled]}
          >
            {t('screens:walletSetup.importWallet.title')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backText: {
    color: colors.primary,
    fontSize: 16,
    marginLeft: 4,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 32,
  },
  actionButtons: {
    flexDirection: 'row',
    marginHorizontal: -8,
    marginBottom: 24,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.tintedBackground,
    borderRadius: 12,
    paddingVertical: 14,
    marginHorizontal: 8,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  actionButtonText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  importButton: {
    backgroundColor: colors.primary,
    height: 56,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  importButtonDisabled: {
    backgroundColor: colors.card,
  },
  importButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.black,
  },
  importButtonTextDisabled: {
    color: colors.textTertiary,
  },
});
