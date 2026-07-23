(function(){
  if (window.__acep_fetch_hooked) return;
  window.__acep_fetch_hooked = true;
  const ORIGINAL_FETCH = window.fetch;
  let lastAuth = null;

  window.fetch = async function(...args){
    let input = args[0];
    let init = args[1];
    let url = '';
    let auth = null;
    try {
      if (input instanceof Request) {
        const cloned = input.clone();
        url = cloned.url || '';
        auth = cloned.headers.get('authorization');
      } else {
        url = typeof input === 'string' ? input : (input && input.url) || '';
        const hdrs = init && init.headers ? new Headers(init.headers) : null;
        auth = hdrs ? hdrs.get('authorization') : null;
      }
    } catch (e) {
      url = '';
      auth = null;
    }

    if (auth && auth !== lastAuth) {
      lastAuth = auth;
      try { window.postMessage({ source: 'acep', type: 'authToken', token: auth }, '*'); } catch(e){}
    }

    const res = await ORIGINAL_FETCH.apply(this, args);
    try {
      const clone = res.clone();
      const ct = clone.headers.get('content-type') || '';
      const looksLikeConversations = (typeof url === 'string') && url.includes('/backend-api/conversations');
      const looksLikeProjects = (typeof url === 'string') && url.includes('/backend-api/gizmos/snorlax/sidebar');
      if (ct.includes('application/json') && looksLikeConversations) {
        const text = await clone.text();
        try {
          const json = JSON.parse(text);
          if (json.items && Array.isArray(json.items)) {
            let offset = null; let limit = null;
            try { const u = new URL(url); offset = parseInt(u.searchParams.get('offset')||'0',10); limit = parseInt(u.searchParams.get('limit')||'0',10); } catch(e) { offset=null; limit=null; }
            try { window.postMessage({ source: 'acep', type: 'conversations', items: json.items, offset, limit, total: json.total }, '*'); } catch(e){}
          }
          const cid = json.conversation_id || json.id || null;
          if (cid) { try { window.postMessage({ source: 'acep', type: 'conversationId', conversationId: cid }, '*'); } catch(e){} }
        } catch(e){}
      }
      // projects / gizmos sidebar
      if (ct.includes('application/json') && looksLikeProjects) {
        const text = await clone.text();
        try {
          const json = JSON.parse(text);
          const items = Array.isArray(json?.items) ? json.items : (Array.isArray(json?.gizmos) ? json.gizmos : null);
          if (items && Array.isArray(items)) {
            try { window.postMessage({ source: 'acep', type: 'projects', items }, '*'); } catch(e){}
          }
        } catch(e){}
      }
    } catch(e){}
    return res;
  };
})();
