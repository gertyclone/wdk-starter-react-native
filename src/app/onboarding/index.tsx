import { View, StyleSheet } from 'react-native';
import { useEffect } from 'react';
import { useDebouncedNavigation } from '@/hooks/use-debounced-navigation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OnBoardingWelcome } from '@/components/onboarding/onboarding-welcome';
import * as SplashScreen from 'expo-splash-screen';
import { colors } from '@/constants/colors';
import { useTranslation } from '@/hooks/use-translation';

export default function OnBoardingScreen() {
  const router = useDebouncedNavigation();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation('screens');

  const handleCreateWallet = () => {
    router.push('/wallet-setup/name-wallet');
  };

  const handleImportWallet = () => {
    router.push('/wallet-setup/import-wallet');
  };

  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <OnBoardingWelcome
        title={t('onboarding.welcome')}
        subtitle={t('onboarding.subtitle')}
        actionButtons={[
          {
            id: 1,
            title: t('onboarding.createWallet'),
            iconName: 'wallet',
            variant: 'filled',
            onPress: handleCreateWallet,
          },
          {
            id: 2,
            title: t('onboarding.importWallet'),
            iconName: 'download',
            variant: 'tinted',
            onPress: handleImportWallet,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
