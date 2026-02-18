import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

export interface PdfDocument {
  id: string;
  name: string;
  uri: string;
  fileSize: number;
  totalPages: number;
  currentPage: number;
  readPercent: number;
  dateAdded: string;
  lastRead: string | null;
  status: 'not_started' | 'reading' | 'completed';
}

export interface Comment {
  id: string;
  pdfId: string;
  pageNumber: number;
  type: 'note' | 'link';
  content: string;
  title: string;
  createdAt: string;
}

export interface ReadingSession {
  id: string;
  pdfId: string;
  date: string;
  pagesRead: number;
  startPage: number;
  endPage: number;
}

export interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  readerBgColor: string;
}

const KEYS = {
  PDFS: '@pdfreader_pdfs',
  COMMENTS: '@pdfreader_comments',
  SESSIONS: '@pdfreader_sessions',
  SETTINGS: '@pdfreader_settings',
};

function generateId(): string {
  return Crypto.randomUUID();
}

export async function getPdfs(): Promise<PdfDocument[]> {
  const data = await AsyncStorage.getItem(KEYS.PDFS);
  return data ? JSON.parse(data) : [];
}

export async function getPdf(id: string): Promise<PdfDocument | null> {
  const pdfs = await getPdfs();
  return pdfs.find(p => p.id === id) || null;
}

export async function addPdf(pdf: Omit<PdfDocument, 'id' | 'currentPage' | 'readPercent' | 'lastRead' | 'status'>): Promise<PdfDocument> {
  const pdfs = await getPdfs();
  const newPdf: PdfDocument = {
    ...pdf,
    id: generateId(),
    currentPage: 1,
    readPercent: 0,
    lastRead: null,
    status: 'not_started',
  };
  pdfs.push(newPdf);
  await AsyncStorage.setItem(KEYS.PDFS, JSON.stringify(pdfs));
  return newPdf;
}

export async function updatePdf(id: string, updates: Partial<PdfDocument>): Promise<void> {
  const pdfs = await getPdfs();
  const index = pdfs.findIndex(p => p.id === id);
  if (index !== -1) {
    pdfs[index] = { ...pdfs[index], ...updates };
    await AsyncStorage.setItem(KEYS.PDFS, JSON.stringify(pdfs));
  }
}

export async function deletePdf(id: string): Promise<void> {
  let pdfs = await getPdfs();
  pdfs = pdfs.filter(p => p.id !== id);
  await AsyncStorage.setItem(KEYS.PDFS, JSON.stringify(pdfs));
  const comments = await getComments();
  const filtered = comments.filter(c => c.pdfId !== id);
  await AsyncStorage.setItem(KEYS.COMMENTS, JSON.stringify(filtered));
  const sessions = await getReadingSessions();
  const filteredSessions = sessions.filter(s => s.pdfId !== id);
  await AsyncStorage.setItem(KEYS.SESSIONS, JSON.stringify(filteredSessions));
}

export async function updateReadingProgress(
  id: string,
  currentPage: number,
  totalPages: number
): Promise<void> {
  const percent = totalPages > 0 ? Math.round((currentPage / totalPages) * 100) : 0;
  let status: PdfDocument['status'] = 'reading';
  if (currentPage <= 1) status = 'not_started';
  if (percent >= 100) status = 'completed';

  await updatePdf(id, {
    currentPage,
    readPercent: Math.min(percent, 100),
    lastRead: new Date().toISOString(),
    status,
    totalPages,
  });
}

export async function getComments(): Promise<Comment[]> {
  const data = await AsyncStorage.getItem(KEYS.COMMENTS);
  return data ? JSON.parse(data) : [];
}

export async function getCommentsForPage(pdfId: string, pageNumber: number): Promise<Comment[]> {
  const comments = await getComments();
  return comments.filter(c => c.pdfId === pdfId && c.pageNumber === pageNumber);
}

export async function getCommentsForPdf(pdfId: string): Promise<Comment[]> {
  const comments = await getComments();
  return comments.filter(c => c.pdfId === pdfId);
}

export async function addComment(comment: Omit<Comment, 'id' | 'createdAt'>): Promise<Comment> {
  const comments = await getComments();
  const newComment: Comment = {
    ...comment,
    id: generateId(),
    createdAt: new Date().toISOString(),
  };
  comments.push(newComment);
  await AsyncStorage.setItem(KEYS.COMMENTS, JSON.stringify(comments));
  return newComment;
}

export async function deleteComment(id: string): Promise<void> {
  let comments = await getComments();
  comments = comments.filter(c => c.id !== id);
  await AsyncStorage.setItem(KEYS.COMMENTS, JSON.stringify(comments));
}

export async function getReadingSessions(): Promise<ReadingSession[]> {
  const data = await AsyncStorage.getItem(KEYS.SESSIONS);
  return data ? JSON.parse(data) : [];
}

export async function addReadingSession(session: Omit<ReadingSession, 'id'>): Promise<ReadingSession> {
  const sessions = await getReadingSessions();
  const newSession: ReadingSession = {
    ...session,
    id: generateId(),
  };
  sessions.push(newSession);
  await AsyncStorage.setItem(KEYS.SESSIONS, JSON.stringify(sessions));
  return newSession;
}

export async function getSessionsForMonth(year: number, month: number): Promise<ReadingSession[]> {
  const sessions = await getReadingSessions();
  return sessions.filter(s => {
    const d = new Date(s.date);
    return d.getFullYear() === year && d.getMonth() === month;
  });
}

export async function getSettings(): Promise<AppSettings> {
  const data = await AsyncStorage.getItem(KEYS.SETTINGS);
  return data ? JSON.parse(data) : { theme: 'system', readerBgColor: '#FFFFFF' };
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await AsyncStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
}
