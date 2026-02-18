import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  Alert,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  ActivityIndicator,
  Linking,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTheme, usePdfs } from '@/lib/contexts';
import * as Storage from '@/lib/storage';
import Colors from '@/constants/colors';

const isWeb = Platform.OS === 'web';

let WebView: any = null;
let FileSystem: any = null;
if (!isWeb) {
  WebView = require('react-native-webview').WebView;
  FileSystem = require('expo-file-system');
}

const READER_BG_OPTIONS = [
  { key: 'white', color: Colors.reader.white, label: 'White' },
  { key: 'cream', color: Colors.reader.cream, label: 'Cream' },
  { key: 'sepia', color: Colors.reader.sepia, label: 'Sepia' },
  { key: 'gray', color: Colors.reader.gray, label: 'Gray' },
  { key: 'dark', color: Colors.reader.dark, label: 'Dark' },
  { key: 'black', color: Colors.reader.black, label: 'Black' },
];

function isLightColor(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 128;
}

function getPdfViewerHtml(bgColor: string): string {
  const textColor = isLightColor(bgColor) ? '#222' : '#eee';
  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=3.0, user-scalable=yes">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 100%; height: 100%; overflow: auto; background: ${bgColor}; }
  body { display: flex; flex-direction: column; align-items: center; padding: 0; }
  #page-container { width: 100%; display: flex; justify-content: center; align-items: flex-start; min-height: 100vh; }
  canvas { max-width: 100%; height: auto !important; display: block; }
  #loading { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: ${textColor}; font-family: system-ui; font-size: 16px; }
  #error-msg { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: ${textColor}; font-family: system-ui; font-size: 14px; text-align: center; padding: 20px; display: none; }
</style>
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"><\/script>
</head>
<body>
<div id="loading">Loading PDF...</div>
<div id="error-msg"></div>
<div id="page-container"><canvas id="pdf-canvas"></canvas></div>
<script>
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

  var pdfDoc = null;
  var currentPage = 1;
  var totalPages = 0;

  function getScale() {
    return window.devicePixelRatio > 1 ? 2 : 1.5;
  }

  function renderPage(num) {
    if (!pdfDoc || num < 1 || num > totalPages) return;
    currentPage = num;
    pdfDoc.getPage(num).then(function(page) {
      var containerWidth = document.body.clientWidth;
      var unscaledViewport = page.getViewport({ scale: 1 });
      var fitScale = containerWidth / unscaledViewport.width;
      var scale = fitScale * getScale();
      var viewport = page.getViewport({ scale: scale });
      var canvas = document.getElementById('pdf-canvas');
      var ctx = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      canvas.style.width = containerWidth + 'px';
      canvas.style.height = (containerWidth * viewport.height / viewport.width) + 'px';
      page.render({ canvasContext: ctx, viewport: viewport }).promise.then(function() {
        window.scrollTo(0, 0);
        sendMsg({ type: 'pageChange', currentPage: num, totalPages: totalPages });
      });
    });
  }

  function sendMsg(data) {
    try {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify(data));
      } else if (window.parent && window.parent !== window) {
        window.parent.postMessage(JSON.stringify(data), '*');
      }
    } catch(e) {}
  }

  function handleCommand(rawData) {
    try {
      var cmd = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
      if (cmd.type === 'goToPage' && pdfDoc) {
        var p = Math.max(1, Math.min(cmd.page, totalPages));
        renderPage(p);
      } else if (cmd.type === 'setBackground') {
        document.body.style.background = cmd.color;
        document.getElementById('page-container').style.background = cmd.color;
      } else if (cmd.type === 'loadBase64') {
        loadFromBase64(cmd.data);
      }
    } catch(e) {}
  }

  document.addEventListener('message', function(e) { handleCommand(e.data); });
  window.addEventListener('message', function(e) { handleCommand(e.data); });

  function loadFromBase64(b64) {
    try {
      var raw = atob(b64);
      var arr = new Uint8Array(raw.length);
      for (var i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
      loadPdfData(arr);
    } catch(e) {
      showError('Failed to decode PDF data');
    }
  }

  function loadPdfData(data) {
    document.getElementById('loading').style.display = 'block';
    pdfjsLib.getDocument({ data: data }).promise.then(function(doc) {
      pdfDoc = doc;
      totalPages = doc.numPages;
      document.getElementById('loading').style.display = 'none';
      sendMsg({ type: 'pdfLoaded', totalPages: totalPages });
      renderPage(1);
    }).catch(function(err) {
      showError('Could not load PDF: ' + err.message);
    });
  }

  function showError(msg) {
    document.getElementById('loading').style.display = 'none';
    var el = document.getElementById('error-msg');
    el.textContent = msg;
    el.style.display = 'block';
    sendMsg({ type: 'error', message: msg });
  }

  window.onresize = function() {
    if (pdfDoc) renderPage(currentPage);
  };

  sendMsg({ type: 'ready' });
<\/script>
</body>
</html>`;
}

function WebPdfViewer({ bgColor, onMessage, iframeRef }: {
  bgColor: string;
  onMessage: (data: any) => void;
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
}) {
  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    const html = getPdfViewerHtml(bgColor);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    blobUrlRef.current = url;

    const handleMessage = (event: MessageEvent) => {
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data.type) onMessage(data);
      } catch {}
    };
    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    };
  }, []);

  return (
    <iframe
      ref={iframeRef as any}
      src={blobUrlRef.current || ''}
      style={{
        width: '100%',
        height: '100%',
        border: 'none',
        backgroundColor: bgColor,
      }}
      sandbox="allow-scripts allow-same-origin"
    />
  );
}

export default function ReaderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, isDark, readerBgColor, setReaderBgColor } = useTheme();
  const { updateProgress } = usePdfs();
  const insets = useSafeAreaInsets();
  const webViewRef = useRef<any>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const [pdf, setPdf] = useState<Storage.PdfDocument | null>(null);
  const [loadingPdf, setLoadingPdf] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Storage.Comment[]>([]);
  const [pageComments, setPageComments] = useState<Storage.Comment[]>([]);
  const [pdfReady, setPdfReady] = useState(false);
  const [pageInputVisible, setPageInputVisible] = useState(false);
  const [pageInputText, setPageInputText] = useState('');

  const startPageRef = useRef(1);
  const pdfRef = useRef<Storage.PdfDocument | null>(null);

  useEffect(() => {
    loadPdfData();
  }, [id]);

  useEffect(() => {
    loadPageComments();
  }, [currentPage, id]);

  const loadPdfData = async () => {
    if (!id) return;
    const data = await Storage.getPdf(id);
    if (data) {
      setPdf(data);
      pdfRef.current = data;
      setCurrentPage(data.currentPage || 1);
      startPageRef.current = data.currentPage || 1;
      const allComments = await Storage.getCommentsForPdf(id);
      setComments(allComments);
    }
    setLoadingPdf(false);
  };

  const loadPageComments = async () => {
    if (!id) return;
    const pc = await Storage.getCommentsForPage(id, currentPage);
    setPageComments(pc);
  };

  const sendCommand = useCallback((data: object) => {
    const msg = JSON.stringify(data);
    if (isWeb) {
      try {
        const iframe = iframeRef.current;
        if (iframe?.contentWindow) {
          iframe.contentWindow.postMessage(msg, '*');
        }
      } catch {}
    } else {
      webViewRef.current?.injectJavaScript(`
        handleCommand('${msg.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}');
        true;
      `);
    }
  }, []);

  const handleViewerMessage = useCallback(async (data: any) => {
    const currentPdf = pdfRef.current;
    if (data.type === 'ready' && currentPdf) {
      loadPdfIntoViewer(currentPdf);
    } else if (data.type === 'pdfLoaded') {
      setTotalPages(data.totalPages);
      setPdfReady(true);
      if (currentPdf && currentPdf.totalPages !== data.totalPages) {
        await Storage.updatePdf(currentPdf.id, { totalPages: data.totalPages });
      }
      if (currentPdf && currentPdf.currentPage > 1) {
        setTimeout(() => {
          sendCommand({ type: 'goToPage', page: currentPdf.currentPage });
        }, 300);
      }
    } else if (data.type === 'pageChange') {
      setCurrentPage(data.currentPage);
      setTotalPages(data.totalPages);
    }
  }, [sendCommand]);

  const onWebViewMessage = useCallback((event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      handleViewerMessage(data);
    } catch {}
  }, [handleViewerMessage]);

  const loadPdfIntoViewer = async (pdfData: Storage.PdfDocument) => {
    try {
      if (isWeb) {
        const response = await fetch(pdfData.uri);
        const arrayBuffer = await response.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        let binary = '';
        const chunkSize = 8192;
        for (let i = 0; i < bytes.length; i += chunkSize) {
          const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
          binary += String.fromCharCode.apply(null, Array.from(chunk));
        }
        const base64 = btoa(binary);
        sendCommand({ type: 'loadBase64', data: base64 });
      } else {
        const base64 = await FileSystem.readAsStringAsync(pdfData.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        sendCommand({ type: 'loadBase64', data: base64 });
      }
    } catch (err) {
      Alert.alert('Error', 'Could not load PDF file. The file may have been moved or deleted.');
    }
  };

  const goToPage = (page: number) => {
    const p = Math.max(1, Math.min(page, totalPages));
    sendCommand({ type: 'goToPage', page: p });
    setCurrentPage(p);
  };

  const handleExit = async () => {
    if (pdf && totalPages > 0) {
      await updateProgress(pdf.id, currentPage, totalPages);
      const pagesRead = Math.abs(currentPage - startPageRef.current);
      if (pagesRead > 0) {
        const today = new Date().toISOString().split('T')[0];
        await Storage.addReadingSession({
          pdfId: pdf.id,
          date: today,
          pagesRead,
          startPage: startPageRef.current,
          endPage: currentPage,
        });
      }
    }
    router.back();
  };

  const handleBgColorChange = (color: string) => {
    setReaderBgColor(color);
    sendCommand({ type: 'setBackground', color });
  };

  if (loadingPdf || !pdf) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 100 }} />
      </View>
    );
  }

  const percent = totalPages > 0 ? Math.round((currentPage / totalPages) * 100) : 0;
  const controlTextColor = isLightColor(readerBgColor) ? '#333' : '#eee';
  const controlBg = isLightColor(readerBgColor) ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.12)';

  return (
    <View style={[styles.container, { backgroundColor: readerBgColor }]}>
      <View style={StyleSheet.absoluteFill}>
        {isWeb ? (
          <WebPdfViewer
            bgColor={readerBgColor}
            onMessage={handleViewerMessage}
            iframeRef={iframeRef}
          />
        ) : (
          WebView && (
            <WebView
              ref={webViewRef}
              source={{ html: getPdfViewerHtml(readerBgColor) }}
              style={[styles.webview, { backgroundColor: readerBgColor }]}
              onMessage={onWebViewMessage}
              originWhitelist={['*']}
              javaScriptEnabled
              domStorageEnabled
              scalesPageToFit={false}
              scrollEnabled
              showsVerticalScrollIndicator={false}
              allowFileAccess
              allowFileAccessFromFileURLs
              allowUniversalAccessFromFileURLs
            />
          )
        )}
      </View>

      {showControls && (
        <>
          <View
            style={[styles.topBar, { paddingTop: insets.top + (isWeb ? 67 : 0), backgroundColor: controlBg }]}
            pointerEvents="box-none"
          >
            <Pressable onPress={handleExit} style={styles.controlBtn} hitSlop={10}>
              <Ionicons name="chevron-back" size={24} color={controlTextColor} />
            </Pressable>
            <Pressable style={{ flex: 1 }} onPress={() => setShowControls(false)}>
              <Text style={[styles.topTitle, { color: controlTextColor }]} numberOfLines={1}>
                {pdf.name}
              </Text>
            </Pressable>
            <View style={styles.topActions}>
              <Pressable onPress={() => setShowComments(true)} style={styles.controlBtn} hitSlop={10}>
                <Ionicons name="chatbubble-outline" size={20} color={controlTextColor} />
                {pageComments.length > 0 && (
                  <View style={[styles.commentBadge, { backgroundColor: colors.primary }]}>
                    <Text style={styles.commentBadgeText}>{pageComments.length}</Text>
                  </View>
                )}
              </Pressable>
              <Pressable onPress={() => setShowSettings(true)} style={styles.controlBtn} hitSlop={10}>
                <Ionicons name="settings-outline" size={20} color={controlTextColor} />
              </Pressable>
            </View>
          </View>

          <View style={[styles.bottomBar, { paddingBottom: insets.bottom + (isWeb ? 34 : 0) + 8, backgroundColor: controlBg }]}>
            <Pressable
              onPress={() => goToPage(currentPage - 1)}
              disabled={currentPage <= 1}
              style={[styles.navBtn, currentPage <= 1 && { opacity: 0.3 }]}
            >
              <Ionicons name="chevron-back" size={22} color={controlTextColor} />
            </Pressable>

            <View style={styles.pageInfoCenter}>
              <View style={[styles.progressTrack, { backgroundColor: isLightColor(readerBgColor) ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.15)' }]}>
                <View style={[styles.progressFill, { width: `${percent}%`, backgroundColor: colors.primary }]} />
              </View>
              <Pressable onPress={() => { setPageInputText(String(currentPage)); setPageInputVisible(true); }}>
                <Text style={[styles.pageText, { color: controlTextColor }]}>
                  {currentPage} / {totalPages || '?'} · {percent}%
                </Text>
              </Pressable>
            </View>

            <Pressable
              onPress={() => goToPage(currentPage + 1)}
              disabled={currentPage >= totalPages}
              style={[styles.navBtn, currentPage >= totalPages && { opacity: 0.3 }]}
            >
              <Ionicons name="chevron-forward" size={22} color={controlTextColor} />
            </Pressable>
          </View>
        </>
      )}

      <Modal visible={pageInputVisible} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setPageInputVisible(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <Pressable style={[styles.pageInputModal, { backgroundColor: colors.surface }]} onPress={() => {}}>
              <Text style={[styles.pageInputLabel, { color: colors.text }]}>Go to Page</Text>
              <TextInput
                style={[styles.pageInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBg }]}
                value={pageInputText}
                onChangeText={setPageInputText}
                keyboardType="number-pad"
                autoFocus
                selectTextOnFocus
              />
              <Pressable
                onPress={() => {
                  const p = parseInt(pageInputText, 10);
                  if (!isNaN(p) && p >= 1 && p <= totalPages) {
                    goToPage(p);
                    setPageInputVisible(false);
                  }
                }}
                style={[styles.goBtn, { backgroundColor: colors.primary }]}
              >
                <Text style={styles.goBtnText}>Go</Text>
              </Pressable>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>

      <SettingsModal
        visible={showSettings}
        onClose={() => setShowSettings(false)}
        bgColor={readerBgColor}
        onBgColorChange={handleBgColorChange}
        colors={colors}
        insets={insets}
      />

      <CommentsModal
        visible={showComments}
        onClose={() => setShowComments(false)}
        pdfId={id}
        currentPage={currentPage}
        pageComments={pageComments}
        allComments={comments}
        onRefresh={async () => {
          await loadPageComments();
          const all = await Storage.getCommentsForPdf(id);
          setComments(all);
        }}
        colors={colors}
        insets={insets}
      />
    </View>
  );
}

function SettingsModal({ visible, onClose, bgColor, onBgColorChange, colors, insets }: {
  visible: boolean;
  onClose: () => void;
  bgColor: string;
  onBgColorChange: (color: string) => void;
  colors: any;
  insets: any;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable
          style={[styles.settingsSheet, { backgroundColor: colors.surface, paddingBottom: insets.bottom + (isWeb ? 34 : 0) + 20 }]}
          onPress={() => {}}
        >
          <View style={styles.sheetHandle} />
          <Text style={[styles.sheetTitle, { color: colors.text }]}>Reader Settings</Text>

          <Text style={[styles.settingLabel, { color: colors.textSecondary }]}>Background Color</Text>
          <View style={styles.bgColorGrid}>
            {READER_BG_OPTIONS.map(opt => (
              <Pressable
                key={opt.key}
                onPress={() => {
                  if (!isWeb) Haptics.selectionAsync();
                  onBgColorChange(opt.color);
                }}
                style={[
                  styles.bgColorOption,
                  {
                    backgroundColor: opt.color,
                    borderWidth: bgColor === opt.color ? 3 : 1,
                    borderColor: bgColor === opt.color ? colors.primary : colors.border,
                  },
                ]}
              >
                {bgColor === opt.color && (
                  <Ionicons name="checkmark" size={18} color={isLightColor(opt.color) ? '#333' : '#fff'} />
                )}
              </Pressable>
            ))}
          </View>
          <View style={styles.bgColorLabels}>
            {READER_BG_OPTIONS.map(opt => (
              <Text key={opt.key} style={[styles.bgColorLabel, { color: colors.textTertiary }]}>{opt.label}</Text>
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function CommentsModal({ visible, onClose, pdfId, currentPage, pageComments, allComments, onRefresh, colors, insets }: {
  visible: boolean;
  onClose: () => void;
  pdfId: string;
  currentPage: number;
  pageComments: Storage.Comment[];
  allComments: Storage.Comment[];
  onRefresh: () => Promise<void>;
  colors: any;
  insets: any;
}) {
  const [newType, setNewType] = useState<'note' | 'link'>('note');
  const [newContent, setNewContent] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [showAllPages, setShowAllPages] = useState(false);

  const displayComments = showAllPages ? allComments : pageComments;

  const handleAdd = async () => {
    if (!newContent.trim()) return;
    await Storage.addComment({
      pdfId,
      pageNumber: currentPage,
      type: newType,
      content: newContent.trim(),
      title: newTitle.trim() || (newType === 'note' ? 'Note' : newContent.trim()),
    });
    setNewContent('');
    setNewTitle('');
    if (!isWeb) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await onRefresh();
  };

  const handleDelete = async (commentId: string) => {
    Alert.alert('Delete Comment', 'Remove this comment?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await Storage.deleteComment(commentId);
          await onRefresh();
        },
      },
    ]);
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable
            style={[styles.commentsSheet, { backgroundColor: colors.surface, paddingBottom: insets.bottom + (isWeb ? 34 : 0) + 10 }]}
            onPress={() => {}}
          >
            <View style={styles.sheetHandle} />
            <View style={styles.commentsHeader}>
              <Text style={[styles.sheetTitle, { color: colors.text }]}>Comments</Text>
              <Pressable
                onPress={() => setShowAllPages(!showAllPages)}
                style={[styles.allPagesToggle, { backgroundColor: showAllPages ? colors.primary + '20' : colors.surfaceSecondary }]}
              >
                <Text style={[styles.allPagesText, { color: showAllPages ? colors.primary : colors.textSecondary }]}>
                  {showAllPages ? 'All Pages' : `Page ${currentPage}`}
                </Text>
              </Pressable>
            </View>

            <ScrollView style={styles.commentsList} showsVerticalScrollIndicator={false}>
              {displayComments.length === 0 ? (
                <View style={styles.noComments}>
                  <Feather name="message-circle" size={32} color={colors.textTertiary} />
                  <Text style={[styles.noCommentsText, { color: colors.textTertiary }]}>
                    No comments {showAllPages ? 'yet' : 'on this page'}
                  </Text>
                </View>
              ) : (
                displayComments.map(comment => (
                  <View key={comment.id} style={[styles.commentCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                    <View style={styles.commentTop}>
                      <View style={styles.commentTypeRow}>
                        {comment.type === 'link' ? (
                          <Ionicons name="link" size={16} color={colors.primary} />
                        ) : (
                          <Ionicons name="document-text-outline" size={16} color={colors.primary} />
                        )}
                        <Text style={[styles.commentPage, { color: colors.textSecondary }]}>Page {comment.pageNumber}</Text>
                      </View>
                      <Pressable onPress={() => handleDelete(comment.id)} hitSlop={8}>
                        <Ionicons name="trash-outline" size={16} color={colors.error} />
                      </Pressable>
                    </View>
                    {comment.title ? (
                      <Text style={[styles.commentTitle, { color: colors.text }]}>{comment.title}</Text>
                    ) : null}
                    {comment.type === 'link' ? (
                      <Pressable onPress={() => Linking.openURL(comment.content)}>
                        <Text style={[styles.commentLink, { color: colors.primary }]} numberOfLines={2}>{comment.content}</Text>
                      </Pressable>
                    ) : (
                      <Text style={[styles.commentContent, { color: colors.text }]}>{comment.content}</Text>
                    )}
                    <Text style={[styles.commentDate, { color: colors.textTertiary }]}>
                      {new Date(comment.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                ))
              )}
            </ScrollView>

            <View style={[styles.addCommentSection, { borderTopColor: colors.border }]}>
              <View style={styles.commentTypeSelector}>
                <Pressable
                  onPress={() => setNewType('note')}
                  style={[styles.typeBtn, { backgroundColor: newType === 'note' ? colors.primary : colors.surfaceSecondary }]}
                >
                  <Ionicons name="document-text-outline" size={16} color={newType === 'note' ? '#fff' : colors.textSecondary} />
                  <Text style={[styles.typeBtnText, { color: newType === 'note' ? '#fff' : colors.textSecondary }]}>Note</Text>
                </Pressable>
                <Pressable
                  onPress={() => setNewType('link')}
                  style={[styles.typeBtn, { backgroundColor: newType === 'link' ? colors.primary : colors.surfaceSecondary }]}
                >
                  <Ionicons name="link" size={16} color={newType === 'link' ? '#fff' : colors.textSecondary} />
                  <Text style={[styles.typeBtnText, { color: newType === 'link' ? '#fff' : colors.textSecondary }]}>Link</Text>
                </Pressable>
              </View>
              {newType === 'link' && (
                <TextInput
                  style={[styles.commentInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBg }]}
                  placeholder="Title (optional)"
                  placeholderTextColor={colors.textTertiary}
                  value={newTitle}
                  onChangeText={setNewTitle}
                />
              )}
              <View style={styles.commentInputRow}>
                <TextInput
                  style={[styles.commentInput, styles.commentInputFlex, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBg }]}
                  placeholder={newType === 'note' ? 'Write a note...' : 'Paste URL...'}
                  placeholderTextColor={colors.textTertiary}
                  value={newContent}
                  onChangeText={setNewContent}
                  multiline={newType === 'note'}
                  autoCapitalize={newType === 'link' ? 'none' : 'sentences'}
                  keyboardType={newType === 'link' ? 'url' : 'default'}
                />
                <Pressable
                  onPress={handleAdd}
                  disabled={!newContent.trim()}
                  style={[styles.sendBtn, { backgroundColor: colors.primary, opacity: newContent.trim() ? 1 : 0.4 }]}
                >
                  <Ionicons name="arrow-up" size={20} color="#fff" />
                </Pressable>
              </View>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  webview: { flex: 1 },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 10,
    zIndex: 10,
  },
  controlBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topTitle: {
    fontSize: 16,
    fontFamily: 'Manrope_600SemiBold',
    marginHorizontal: 8,
  },
  topActions: {
    flexDirection: 'row',
    gap: 4,
  },
  commentBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  commentBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontFamily: 'Manrope_700Bold',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    zIndex: 10,
  },
  navBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pageInfoCenter: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  progressTrack: {
    width: '100%',
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  pageText: {
    fontSize: 13,
    fontFamily: 'Manrope_500Medium',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pageInputModal: {
    width: 260,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    gap: 14,
  },
  pageInputLabel: {
    fontSize: 17,
    fontFamily: 'Manrope_600SemiBold',
  },
  pageInput: {
    width: '100%',
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 18,
    fontFamily: 'Manrope_600SemiBold',
    textAlign: 'center',
  },
  goBtn: {
    width: '100%',
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  goBtnText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Manrope_600SemiBold',
  },
  settingsSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  commentsSheet: {
    width: '100%',
    maxHeight: '80%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(128,128,128,0.3)',
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 20,
    fontFamily: 'Manrope_700Bold',
    marginBottom: 16,
  },
  settingLabel: {
    fontSize: 14,
    fontFamily: 'Manrope_500Medium',
    marginBottom: 12,
  },
  bgColorGrid: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
    marginBottom: 6,
  },
  bgColorOption: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bgColorLabels: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
  },
  bgColorLabel: {
    width: 44,
    textAlign: 'center',
    fontSize: 10,
    fontFamily: 'Manrope_400Regular',
  },
  commentsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  allPagesToggle: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    marginBottom: 16,
  },
  allPagesText: {
    fontSize: 12,
    fontFamily: 'Manrope_500Medium',
  },
  commentsList: {
    maxHeight: 300,
    marginBottom: 12,
  },
  noComments: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  noCommentsText: {
    fontSize: 14,
    fontFamily: 'Manrope_500Medium',
  },
  commentCard: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 0.5,
  },
  commentTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  commentTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  commentPage: {
    fontSize: 12,
    fontFamily: 'Manrope_500Medium',
  },
  commentTitle: {
    fontSize: 14,
    fontFamily: 'Manrope_600SemiBold',
    marginBottom: 4,
  },
  commentContent: {
    fontSize: 14,
    fontFamily: 'Manrope_400Regular',
    lineHeight: 20,
  },
  commentLink: {
    fontSize: 14,
    fontFamily: 'Manrope_400Regular',
    textDecorationLine: 'underline',
  },
  commentDate: {
    fontSize: 11,
    fontFamily: 'Manrope_400Regular',
    marginTop: 6,
  },
  addCommentSection: {
    borderTopWidth: 1,
    paddingTop: 12,
    gap: 8,
  },
  commentTypeSelector: {
    flexDirection: 'row',
    gap: 8,
  },
  typeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  typeBtnText: {
    fontSize: 13,
    fontFamily: 'Manrope_500Medium',
  },
  commentInputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-end',
  },
  commentInput: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: 'Manrope_400Regular',
    minHeight: 42,
  },
  commentInputFlex: {
    flex: 1,
    maxHeight: 100,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
