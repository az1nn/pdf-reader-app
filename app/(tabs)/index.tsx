import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
  Platform,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useTheme, usePdfs } from '@/lib/contexts';
import type { PdfDocument } from '@/lib/storage';

type SortOption = 'name' | 'dateAdded' | 'lastRead' | 'progress';
type FilterOption = 'all' | 'reading' | 'completed' | 'not_started';

function StatusBadge({ status, colors }: { status: PdfDocument['status']; colors: any }) {
  const config = {
    not_started: { label: 'New', bg: colors.surfaceSecondary, text: colors.textSecondary },
    reading: { label: 'Reading', bg: colors.primary + '20', text: colors.primary },
    completed: { label: 'Done', bg: colors.success + '20', text: colors.success },
  };
  const c = config[status];
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <Text style={[styles.badgeText, { color: c.text }]}>{c.label}</Text>
    </View>
  );
}

function PdfCard({ pdf, colors, onPress, onDelete }: {
  pdf: PdfDocument;
  colors: any;
  onPress: () => void;
  onDelete: () => void;
}) {
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Pressable
      onPress={onPress}
      onLongPress={() => {
        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        Alert.alert('Delete PDF', `Remove "${pdf.name}" from your library?`, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: onDelete },
        ]);
      }}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.cardBorder,
          opacity: pressed ? 0.85 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
      ]}
    >
      <View style={styles.cardHeader}>
        <View style={[styles.pdfIcon, { backgroundColor: colors.primary + '15' }]}>
          <MaterialCommunityIcons name="file-pdf-box" size={28} color={colors.primary} />
        </View>
        <View style={styles.cardTitleArea}>
          <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={2}>{pdf.name}</Text>
          <View style={styles.cardMeta}>
            <Text style={[styles.cardMetaText, { color: colors.textTertiary }]}>
              {formatSize(pdf.fileSize)}
            </Text>
            <View style={[styles.metaDot, { backgroundColor: colors.textTertiary }]} />
            <Text style={[styles.cardMetaText, { color: colors.textTertiary }]}>
              {pdf.totalPages > 0 ? `${pdf.totalPages} pages` : 'Unknown pages'}
            </Text>
          </View>
        </View>
        <StatusBadge status={pdf.status} colors={colors} />
      </View>

      <View style={styles.cardFooter}>
        <View style={styles.progressSection}>
          <View style={[styles.progressBar, { backgroundColor: colors.progressBg }]}>
            <View
              style={[
                styles.progressFill,
                { backgroundColor: colors.progressFill, width: `${pdf.readPercent}%` },
              ]}
            />
          </View>
          <Text style={[styles.progressLabel, { color: colors.textSecondary }]}>
            {pdf.readPercent}% · Page {pdf.currentPage}{pdf.totalPages > 0 ? ` / ${pdf.totalPages}` : ''}
          </Text>
        </View>
        <Text style={[styles.lastReadText, { color: colors.textTertiary }]}>
          {pdf.lastRead ? `Last read ${formatDate(pdf.lastRead)}` : 'Not started'}
        </Text>
      </View>
    </Pressable>
  );
}

export default function LibraryScreen() {
  const { colors } = useTheme();
  const { pdfs, loading, refresh, addPdf, deletePdf } = usePdfs();
  const insets = useSafeAreaInsets();

  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('dateAdded');
  const [filterBy, setFilterBy] = useState<FilterOption>('all');
  const [showSort, setShowSort] = useState(false);
  const [importing, setImporting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const handleImport = async () => {
    try {
      setImporting(true);
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled || !result.assets?.length) {
        setImporting(false);
        return;
      }

      const asset = result.assets[0];
      const fileName = asset.name || 'Untitled.pdf';

      let fileUri = asset.uri;
      let fileSize = asset.size || 0;

      if (Platform.OS !== 'web' && FileSystem.documentDirectory) {
        const destUri = FileSystem.documentDirectory + fileName;
        try {
          await FileSystem.copyAsync({ from: asset.uri, to: destUri });
          fileUri = destUri;
        } catch {
        }
      }

      await addPdf({
        name: fileName.replace('.pdf', ''),
        uri: fileUri,
        fileSize,
        totalPages: 0,
        dateAdded: new Date().toISOString(),
      });

      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      Alert.alert('Import Failed', 'Could not import the PDF file. Please try again.');
    } finally {
      setImporting(false);
    }
  };

  const filteredAndSorted = useMemo(() => {
    let result = [...pdfs];

    if (filterBy !== 'all') {
      result = result.filter(p => p.status === filterBy);
    }

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(p => p.name.toLowerCase().includes(q));
    }

    result.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'dateAdded':
          return new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime();
        case 'lastRead':
          if (!a.lastRead && !b.lastRead) return 0;
          if (!a.lastRead) return 1;
          if (!b.lastRead) return -1;
          return new Date(b.lastRead).getTime() - new Date(a.lastRead).getTime();
        case 'progress':
          return b.readPercent - a.readPercent;
        default:
          return 0;
      }
    });

    return result;
  }, [pdfs, search, sortBy, filterBy]);

  const sortOptions: { key: SortOption; label: string; icon: string }[] = [
    { key: 'dateAdded', label: 'Date Added', icon: 'calendar-outline' },
    { key: 'lastRead', label: 'Last Read', icon: 'time-outline' },
    { key: 'name', label: 'Name', icon: 'text-outline' },
    { key: 'progress', label: 'Progress', icon: 'trending-up-outline' },
  ];

  const filterOptions: { key: FilterOption; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'reading', label: 'Reading' },
    { key: 'completed', label: 'Done' },
    { key: 'not_started', label: 'New' },
  ];

  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  const renderItem = useCallback(({ item }: { item: PdfDocument }) => (
    <PdfCard
      pdf={item}
      colors={colors}
      onPress={() => router.push({ pathname: '/reader/[id]', params: { id: item.id } })}
      onDelete={() => deletePdf(item.id)}
    />
  ), [colors, deletePdf]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={{ paddingTop: insets.top + webTopInset }}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Library</Text>
          <Pressable
            onPress={handleImport}
            disabled={importing}
            style={({ pressed }) => [
              styles.importBtn,
              { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            {importing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="add" size={22} color="#fff" />
            )}
          </Pressable>
        </View>

        <View style={[styles.searchContainer, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
          <Feather name="search" size={18} color={colors.textTertiary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search PDFs..."
            placeholderTextColor={colors.textTertiary}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
            </Pressable>
          )}
        </View>

        <View style={styles.filtersRow}>
          <ScrollableFilters
            filters={filterOptions}
            selected={filterBy}
            onSelect={(key) => setFilterBy(key as FilterOption)}
            colors={colors}
          />
          <Pressable
            onPress={() => setShowSort(!showSort)}
            style={[styles.sortToggle, { borderColor: colors.border }]}
          >
            <Ionicons name="swap-vertical" size={18} color={colors.textSecondary} />
          </Pressable>
        </View>

        {showSort && (
          <View style={[styles.sortOptions, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {sortOptions.map(opt => (
              <Pressable
                key={opt.key}
                onPress={() => { setSortBy(opt.key); setShowSort(false); }}
                style={[styles.sortOption, sortBy === opt.key && { backgroundColor: colors.primary + '15' }]}
              >
                <Ionicons name={opt.icon as any} size={18} color={sortBy === opt.key ? colors.primary : colors.textSecondary} />
                <Text style={[styles.sortOptionText, { color: sortBy === opt.key ? colors.primary : colors.text }]}>
                  {opt.label}
                </Text>
                {sortBy === opt.key && <Ionicons name="checkmark" size={18} color={colors.primary} />}
              </Pressable>
            ))}
          </View>
        )}
      </View>

      {loading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredAndSorted}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="bookshelf" size={56} color={colors.textTertiary} />
              <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>
                {search ? 'No PDFs found' : 'Your library is empty'}
              </Text>
              <Text style={[styles.emptySubtext, { color: colors.textTertiary }]}>
                {search ? 'Try a different search term' : 'Tap + to import your first PDF'}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

function ScrollableFilters({ filters, selected, onSelect, colors }: {
  filters: { key: string; label: string }[];
  selected: string;
  onSelect: (key: string) => void;
  colors: any;
}) {
  return (
    <View style={styles.filterChips}>
      {filters.map(f => (
        <Pressable
          key={f.key}
          onPress={() => {
            if (Platform.OS !== 'web') Haptics.selectionAsync();
            onSelect(f.key);
          }}
          style={[
            styles.filterChip,
            {
              backgroundColor: selected === f.key ? colors.primary : colors.surfaceSecondary,
              borderColor: selected === f.key ? colors.primary : colors.border,
            },
          ]}
        >
          <Text
            style={[
              styles.filterChipText,
              { color: selected === f.key ? '#fff' : colors.textSecondary },
            ]}
          >
            {f.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  title: {
    fontSize: 28,
    fontFamily: 'Manrope_700Bold',
  },
  importBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    paddingHorizontal: 14,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Manrope_400Regular',
    height: '100%',
  },
  filtersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    gap: 10,
    marginBottom: 8,
  },
  filterChips: {
    flexDirection: 'row',
    flex: 1,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 13,
    fontFamily: 'Manrope_500Medium',
  },
  sortToggle: {
    width: 38,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sortOptions: {
    marginHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 8,
  },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 10,
  },
  sortOptionText: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Manrope_500Medium',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 120,
    paddingTop: 8,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  pdfIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitleArea: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontFamily: 'Manrope_600SemiBold',
    lineHeight: 22,
    marginBottom: 2,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardMetaText: {
    fontSize: 12,
    fontFamily: 'Manrope_400Regular',
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 11,
    fontFamily: 'Manrope_600SemiBold',
  },
  cardFooter: {
    gap: 6,
  },
  progressSection: {
    gap: 4,
  },
  progressBar: {
    height: 5,
    borderRadius: 2.5,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2.5,
  },
  progressLabel: {
    fontSize: 12,
    fontFamily: 'Manrope_500Medium',
  },
  lastReadText: {
    fontSize: 11,
    fontFamily: 'Manrope_400Regular',
  },
  loadingState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 80,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'Manrope_600SemiBold',
  },
  emptySubtext: {
    fontSize: 14,
    fontFamily: 'Manrope_400Regular',
    textAlign: 'center',
  },
});
