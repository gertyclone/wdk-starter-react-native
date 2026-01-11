import Header from '@/components/header';
import { useDebouncedNavigation } from '@/hooks/use-debounced-navigation';
import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/constants/colors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { toast } from 'sonner-native';

export default function SubspaceScreen() {
  const insets = useSafeAreaInsets();
  const router = useDebouncedNavigation();
  const { subspace, spaceName } = useLocalSearchParams<{
    subspace: string;
    spaceName: string;
  }>();

  const [spaceData, setSpaceData] = useState<{
    subspace: string;
    spaceName: string;
    status?:
      | 'purchasing'
      | 'purchased'
      | 'pending'
      | 'processing'
      | 'confirmed'
      | 'expired'
      | 'cancelled';
    jobId?: number;
  } | null>(null);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);

  // Load space data from AsyncStorage
  useEffect(() => {
    const loadSpaceData = async () => {
      if (!subspace || !spaceName) return;

      try {
        const stored = await AsyncStorage.getItem('mySpaces');
        if (stored) {
          const loadedSpaces = JSON.parse(stored);
          const space = loadedSpaces.find(
            (s: { subspace: string; spaceName: string }) =>
              s.subspace === subspace && s.spaceName === spaceName.toLowerCase()
          );
          if (space) {
            setSpaceData({
              subspace: space.subspace,
              spaceName: space.spaceName,
              status: space.status,
              jobId: space.jobId,
            });
          }
        }
      } catch (error) {
        console.error('[Subspace] Failed to load space data:', error);
      }
    };

    loadSpaceData();
  }, [subspace, spaceName]);

  const handleDeletePress = () => {
    setShowDeleteConfirmation(true);
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirmation(false);
  };

  const handleConfirmDelete = async () => {
    if (!spaceData) return;

    const { subspace: spaceSubspace, spaceName: spaceSpaceName, jobId } = spaceData;

    // Remove from AsyncStorage
    try {
      const stored = await AsyncStorage.getItem('mySpaces');
      if (stored) {
        const loadedSpaces = JSON.parse(stored);
        const filtered = loadedSpaces.filter(
          (s: { subspace: string; spaceName: string }) =>
            !(s.subspace === spaceSubspace && s.spaceName === spaceSpaceName)
        );
        await AsyncStorage.setItem('mySpaces', JSON.stringify(filtered));
        console.log('[Subspace] Removed space from AsyncStorage:', spaceSubspace, '@', spaceSpaceName);
      }
    } catch (error) {
      console.error('[Subspace] Failed to remove space from AsyncStorage:', error);
      Alert.alert('Error', 'Failed to delete space');
      return;
    }

    // Close confirmation dialog
    setShowDeleteConfirmation(false);

    // Show success message
    toast.success(`Removed ${spaceSubspace}@${spaceSpaceName}`);

    // Navigate back to spaces page
    router.back();
  };

  if (!subspace || !spaceName) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Header title="Spaces" />
        <View style={styles.content}>
          <Text style={styles.errorText}>Invalid space</Text>
        </View>
      </View>
    );
  }

  const displayName = `${subspace}@${spaceName}`;

  // Get formatted status
  const getStatusText = (): string => {
    if (!spaceData?.status) return 'Unknown';

    const statusMap: Record<string, string> = {
      purchasing: 'Purchasing',
      pending: 'Pending',
      processing: 'Processing',
      confirmed: 'Confirmed',
      expired: 'Expired',
      cancelled: 'Cancelled',
      purchased: 'Purchased',
    };

    return statusMap[spaceData.status] || 'Unknown';
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Header title={displayName} />

      <View style={styles.content}>
        {/* Status Display */}
        <View style={styles.subspaceNameContainer}>
          <Text style={styles.subspaceNameText}>Status: {getStatusText()}</Text>
        </View>

        {/* Hex Tool Button */}
        <TouchableOpacity
          style={styles.hexToolButton}
          onPress={() => {
            router.push({
              pathname: '/hex-tool',
              params: {
                subspace: subspace,
                spaceName: spaceName,
              },
            });
          }}
          activeOpacity={0.7}
        >
          <Text style={styles.hexToolButtonText}>Hex Tool</Text>
        </TouchableOpacity>

        {/* Delete Space Button */}
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={handleDeletePress}
          activeOpacity={0.7}
        >
          <Text style={styles.deleteButtonText}>Delete Space</Text>
        </TouchableOpacity>
      </View>

      {/* Delete Confirmation Dialog */}
      <Modal
        visible={showDeleteConfirmation}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCancelDelete}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Confirm Delete</Text>
            <Text style={styles.deleteDialogText}>
              Are you sure, you want to delete {displayName}?
            </Text>
            <View style={styles.modalButtonRow}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={handleCancelDelete}
                activeOpacity={0.7}
              >
                <Text style={styles.modalCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalDeleteButton}
                onPress={handleConfirmDelete}
                activeOpacity={0.7}
              >
                <Text style={styles.modalDeleteButtonText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
    justifyContent: 'space-between',
  },
  subspaceNameContainer: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subspaceNameText: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
  },
  hexToolButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  hexToolButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.black,
  },
  deleteButton: {
    backgroundColor: colors.error || '#ef4444',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.white || '#ffffff',
  },
  errorText: {
    fontSize: 16,
    color: colors.text,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
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
  deleteDialogText: {
    fontSize: 16,
    color: colors.text,
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 22,
  },
  modalButtonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderDark,
  },
  modalCancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  modalDeleteButton: {
    flex: 1,
    backgroundColor: colors.error || '#ef4444',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalDeleteButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.white || '#ffffff',
  },
});
