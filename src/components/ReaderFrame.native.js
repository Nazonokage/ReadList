import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { WebView } from 'react-native-webview';

export default React.memo(forwardRef(function ReaderFrame({ html, onMessage }, ref) {
  const webview = useRef(null);
  useImperativeHandle(ref, () => ({ flush: () => webview.current?.injectJavaScript('window.ReadListReader?.flush(); true;') }), []);
  return <WebView ref={webview} source={{ html, baseUrl: 'about:blank' }} originWhitelist={['*']} javaScriptEnabled allowFileAccess={false} allowUniversalAccessFromFileURLs={false} setSupportMultipleWindows={false} mixedContentMode="never" onShouldStartLoadWithRequest={(request) => request.url === 'about:blank' || request.url.startsWith('about:blank#')} onMessage={(event) => { try { onMessage(JSON.parse(event.nativeEvent.data)); } catch { /* Ignore malformed bridge data. */ } }} style={{ flex: 1, backgroundColor: '#101014' }} />;
}));
