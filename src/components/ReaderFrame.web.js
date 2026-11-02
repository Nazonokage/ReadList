import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

export default React.memo(forwardRef(function ReaderFrame({ html, onMessage }, ref) {
  const frame = useRef(null);
  useImperativeHandle(ref, () => ({ flush: () => frame.current?.contentWindow?.postMessage({ readlistCommand: 'flush' }, '*') }), []);
  useEffect(() => {
    const listener = (event) => { if (event.source === frame.current?.contentWindow && event.data?.readlistReader) onMessage(event.data); };
    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  }, [onMessage]);
  return <iframe ref={frame} title="Offline book reader" srcDoc={html} sandbox="allow-scripts" style={{ border: 0, flex: 1, width: '100%', height: '100%', minHeight: 0 }} />;
}));
