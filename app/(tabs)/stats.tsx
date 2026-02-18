import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useTheme, usePdfs } from '@/lib/contexts';
import * as Storage from '@/lib/storage';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

export default function StatsScreen() {
  const { colors, isDark } = useTheme();
  const { pdfs } = usePdfs();
  const insets = useSafeAreaInsets();

  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [sessions, setSessions] = useState<Storage.ReadingSession[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadSessions = useCallback(async () => {
    const data = await Storage.getSessionsForMonth(selectedYear, selectedMonth);
    setSessions(data);
  }, [selectedYear, selectedMonth]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadSessions();
    setRefreshing(false);
  }, [loadSessions]);

  const goToPrevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear(y => y - 1);
    } else {
      setSelectedMonth(m => m - 1);
    }
  };

  const goToNextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear(y => y + 1);
    } else {
      setSelectedMonth(m => m + 1);
    }
  };

  const totalPagesRead = sessions.reduce((sum, s) => sum + s.pagesRead, 0);
  const activeDays = new Set(sessions.map(s => s.date)).size;
  const daysInMonth = getDaysInMonth(selectedYear, selectedMonth);
  const avgPagesPerDay = activeDays > 0 ? Math.round(totalPagesRead / activeDays) : 0;
  const booksCompleted = pdfs.filter(p => p.status === 'completed').length;
  const booksInProgress = pdfs.filter(p => p.status === 'reading').length;

  const dailyPages: Record<string, number> = {};
  sessions.forEach(s => {
    dailyPages[s.date] = (dailyPages[s.date] || 0) + s.pagesRead;
  });

  const maxDailyPages = Math.max(1, ...Object.values(dailyPages));

  const getHeatmapColor = (pages: number) => {
    if (pages === 0) return colors.heatmapEmpty;
    const ratio = pages / maxDailyPages;
    if (ratio < 0.25) return colors.heatmapLow;
    if (ratio < 0.5) return colors.heatmapMedium;
    if (ratio < 0.75) return colors.heatmapHigh;
    return colors.heatmapMax;
  };

  const firstDay = getFirstDayOfMonth(selectedYear, selectedMonth);
  const calendarCells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) calendarCells.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarCells.push(d);

  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: 120, paddingTop: insets.top + webTopInset + 16 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
    >
      <Text style={[styles.screenTitle, { color: colors.text }]}>Reading Stats</Text>

      <View style={[styles.monthSelector, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Pressable onPress={goToPrevMonth} style={styles.monthArrow} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={[styles.monthText, { color: colors.text }]}>
          {MONTH_NAMES[selectedMonth]} {selectedYear}
        </Text>
        <Pressable onPress={goToNextMonth} style={styles.monthArrow} hitSlop={12}>
          <Ionicons name="chevron-forward" size={22} color={colors.text} />
        </Pressable>
      </View>

      <View style={styles.statsGrid}>
        <StatCard
          icon="book-outline"
          label="Pages Read"
          value={totalPagesRead.toString()}
          colors={colors}
        />
        <StatCard
          icon="calendar-outline"
          label="Active Days"
          value={`${activeDays}/${daysInMonth}`}
          colors={colors}
        />
        <StatCard
          icon="trending-up-outline"
          label="Avg/Day"
          value={avgPagesPerDay.toString()}
          colors={colors}
        />
        <StatCard
          icon="checkmark-circle-outline"
          label="Completed"
          value={booksCompleted.toString()}
          colors={colors}
        />
      </View>

      <View style={[styles.heatmapContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Daily Activity</Text>
        <View style={styles.weekdayHeader}>
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
            <Text key={i} style={[styles.weekdayText, { color: colors.textTertiary }]}>{day}</Text>
          ))}
        </View>
        <View style={styles.calendarGrid}>
          {calendarCells.map((day, i) => {
            if (day === null) {
              return <View key={`empty-${i}`} style={styles.calendarCell} />;
            }
            const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const pages = dailyPages[dateStr] || 0;
            return (
              <View key={`day-${day}`} style={styles.calendarCell}>
                <View style={[styles.heatmapDot, { backgroundColor: getHeatmapColor(pages) }]}>
                  <Text style={[styles.calendarDayText, { color: pages > 0 ? '#fff' : colors.textTertiary }]}>
                    {day}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
        <View style={styles.heatmapLegend}>
          <Text style={[styles.legendText, { color: colors.textTertiary }]}>Less</Text>
          {[colors.heatmapEmpty, colors.heatmapLow, colors.heatmapMedium, colors.heatmapHigh, colors.heatmapMax].map((c, i) => (
            <View key={i} style={[styles.legendDot, { backgroundColor: c }]} />
          ))}
          <Text style={[styles.legendText, { color: colors.textTertiary }]}>More</Text>
        </View>
      </View>

      <View style={[styles.booksSection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Currently Reading</Text>
        {booksInProgress === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="book-open" size={32} color={colors.textTertiary} />
            <Text style={[styles.emptyText, { color: colors.textTertiary }]}>No books in progress</Text>
          </View>
        ) : (
          pdfs.filter(p => p.status === 'reading').map(pdf => (
            <View key={pdf.id} style={[styles.bookRow, { borderBottomColor: colors.border }]}>
              <View style={styles.bookInfo}>
                <Text style={[styles.bookName, { color: colors.text }]} numberOfLines={1}>{pdf.name}</Text>
                <Text style={[styles.bookPages, { color: colors.textSecondary }]}>
                  Page {pdf.currentPage} of {pdf.totalPages}
                </Text>
              </View>
              <View style={styles.progressContainer}>
                <View style={[styles.progressBg, { backgroundColor: colors.progressBg }]}>
                  <View style={[styles.progressFill, { backgroundColor: colors.progressFill, width: `${pdf.readPercent}%` }]} />
                </View>
                <Text style={[styles.progressText, { color: colors.primary }]}>{pdf.readPercent}%</Text>
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

function StatCard({ icon, label, value, colors }: { icon: string; label: string; value: string; colors: any }) {
  return (
    <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Ionicons name={icon as any} size={24} color={colors.primary} />
      <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  screenTitle: {
    fontSize: 28,
    fontFamily: 'Manrope_700Bold',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  monthSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 20,
  },
  monthArrow: { padding: 4 },
  monthText: {
    fontSize: 17,
    fontFamily: 'Manrope_600SemiBold',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 14,
    gap: 10,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 6,
  },
  statValue: {
    fontSize: 24,
    fontFamily: 'Manrope_700Bold',
  },
  statLabel: {
    fontSize: 12,
    fontFamily: 'Manrope_500Medium',
  },
  heatmapContainer: {
    marginHorizontal: 20,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 17,
    fontFamily: 'Manrope_600SemiBold',
    marginBottom: 14,
  },
  weekdayHeader: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  weekdayText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontFamily: 'Manrope_500Medium',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    padding: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heatmapDot: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  calendarDayText: {
    fontSize: 11,
    fontFamily: 'Manrope_500Medium',
  },
  heatmapLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 12,
  },
  legendDot: {
    width: 14,
    height: 14,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    fontFamily: 'Manrope_400Regular',
    marginHorizontal: 4,
  },
  booksSection: {
    marginHorizontal: 20,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 10,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: 'Manrope_500Medium',
  },
  bookRow: {
    paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
  bookInfo: {
    marginBottom: 8,
  },
  bookName: {
    fontSize: 15,
    fontFamily: 'Manrope_600SemiBold',
    marginBottom: 2,
  },
  bookPages: {
    fontSize: 12,
    fontFamily: 'Manrope_400Regular',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  progressBg: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 13,
    fontFamily: 'Manrope_600SemiBold',
    minWidth: 36,
    textAlign: 'right',
  },
});
