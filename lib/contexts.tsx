import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import * as Storage from '@/lib/storage';
import Colors from '@/constants/colors';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextValue {
  mode: ThemeMode;
  isDark: boolean;
  colors: typeof Colors.light;
  readerBgColor: string;
  setMode: (mode: ThemeMode) => void;
  setReaderBgColor: (color: string) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');
  const [readerBgColor, setReaderBgColorState] = useState('#FFFFFF');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Storage.getSettings().then(settings => {
      setModeState(settings.theme);
      setReaderBgColorState(settings.readerBgColor);
      setLoaded(true);
    });
  }, []);

  const isDark = mode === 'system' ? systemScheme === 'dark' : mode === 'dark';
  const colors = isDark ? Colors.dark : Colors.light;

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    Storage.getSettings().then(s => Storage.saveSettings({ ...s, theme: m }));
  }, []);

  const setReaderBgColor = useCallback((c: string) => {
    setReaderBgColorState(c);
    Storage.getSettings().then(s => Storage.saveSettings({ ...s, readerBgColor: c }));
  }, []);

  const value = useMemo(() => ({
    mode,
    isDark,
    colors,
    readerBgColor,
    setMode,
    setReaderBgColor,
  }), [mode, isDark, colors, readerBgColor, setMode, setReaderBgColor]);

  if (!loaded) return null;

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}

interface PdfContextValue {
  pdfs: Storage.PdfDocument[];
  loading: boolean;
  refresh: () => Promise<void>;
  addPdf: (pdf: Omit<Storage.PdfDocument, 'id' | 'currentPage' | 'readPercent' | 'lastRead' | 'status'>) => Promise<Storage.PdfDocument>;
  deletePdf: (id: string) => Promise<void>;
  updateProgress: (id: string, currentPage: number, totalPages: number) => Promise<void>;
}

const PdfContext = createContext<PdfContextValue | null>(null);

export function PdfProvider({ children }: { children: ReactNode }) {
  const [pdfs, setPdfs] = useState<Storage.PdfDocument[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const data = await Storage.getPdfs();
    setPdfs(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addPdfFn = useCallback(async (pdf: Omit<Storage.PdfDocument, 'id' | 'currentPage' | 'readPercent' | 'lastRead' | 'status'>) => {
    const newPdf = await Storage.addPdf(pdf);
    await refresh();
    return newPdf;
  }, [refresh]);

  const deletePdfFn = useCallback(async (id: string) => {
    await Storage.deletePdf(id);
    await refresh();
  }, [refresh]);

  const updateProgress = useCallback(async (id: string, currentPage: number, totalPages: number) => {
    await Storage.updateReadingProgress(id, currentPage, totalPages);
    await refresh();
  }, [refresh]);

  const value = useMemo(() => ({
    pdfs,
    loading,
    refresh,
    addPdf: addPdfFn,
    deletePdf: deletePdfFn,
    updateProgress,
  }), [pdfs, loading, refresh, addPdfFn, deletePdfFn, updateProgress]);

  return <PdfContext.Provider value={value}>{children}</PdfContext.Provider>;
}

export function usePdfs() {
  const ctx = useContext(PdfContext);
  if (!ctx) throw new Error('usePdfs must be used within PdfProvider');
  return ctx;
}
