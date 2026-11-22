// Red-team lab harness. With the real extension installed, these pages are
// attacked by Unmaskr's own content script and nothing here runs. Open a page
// with ?harness to test WITHOUT installing it: this stubs the few chrome.* APIs
// the content script uses and loads the built bundle from extension-dist/.
// Serve the repo root:  python -m http.server 8137 --bind 127.0.0.1
// ?harness=v020 loads the shipped v0.2.0 build instead (extension-dist-v020/),
// for before/after comparison. Only these two folders are accepted.
const BUILDS = { '': 'extension-dist', v020: 'extension-dist-v020' }
const build = BUILDS[new URLSearchParams(location.search).get('harness') ?? 'x']
if (build) {
  if (!window.chrome?.storage) {
    const noop = { addListener() {} }
    window.chrome = Object.assign(window.chrome || {}, {
      runtime: { sendMessage: (m) => (console.log('[unmaskr msg]', JSON.stringify(m)), Promise.resolve()) },
      storage: { local: { get: async () => ({}), set: async () => {} }, onChanged: noop },
    })
  }
  addEventListener('load', () => {
    const s = document.createElement('script')
    s.src = `/${build}/content.js`
    document.body.appendChild(s)
  })
}
