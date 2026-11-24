/**
 * nn-conntent console: direct write to a connected domaiNN folder.
 *
 * "Connect folder" uses showDirectoryPicker(); the folder is accepted only when its
 * `domaiNN_NN.md` workspace_id matches the payload's. The handle is stored in
 * IndexedDB keyed by workspace_id. On submit the writer asks for permission and writes
 * `changes/<ws>_<reviewer>_<stamp>_changes_NN.md` with `wx` semantics (never
 * overwrites). Every failure falls back to the download path (design D-C2, D-C5;
 * capability console-changes-direct-write; task 4a.5/4a.6).
 *
 * No DOM, no build step: the runtime injects `win` and a store so this stays testable.
 */
;(function (root) {
  'use strict'

  function compactStamp(date) {
    return date.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')
  }

  function slugifyReviewer(name) {
    var slug = String(name == null ? '' : name)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
    return slug || 'reviewer'
  }

  function changesetFilename(input) {
    return (
      String(input.workspaceId) +
      '_' +
      slugifyReviewer(input.reviewer) +
      '_' +
      String(input.stamp) +
      '_changes_NN.md'
    )
  }

  /** The `workspace_id:` of a domaiNN manifest, or ''. */
  function workspaceIdOf(text) {
    var match = /^workspace_id:\s*"?([^"\r\n]+?)"?\s*$/m.exec(String(text == null ? '' : text))
    return match ? match[1].trim() : ''
  }

  async function readTextFile(dirHandle, name) {
    var handle = await dirHandle.getFileHandle(name)
    var file = await handle.getFile()
    return file.text()
  }

  async function ensurePermission(handle) {
    if (!handle || typeof handle.queryPermission !== 'function') return 'granted'
    var state = await handle.queryPermission({ mode: 'readwrite' })
    if (state === 'granted') return 'granted'
    if (typeof handle.requestPermission === 'function') {
      return handle.requestPermission({ mode: 'readwrite' })
    }
    return state
  }

  /**
   * The store key of a console's own file: one entry per domaiNN and file name, so two
   * consoles of the same domain never share a handle.
   */
  function snapshotKey(input) {
    var args = input || {}
    return 'snapshot:' + String(args.domainId || 'console') + ':' + String(args.name || '')
  }

  /**
   * Overwrites the file a person already picked, with no dialog: the handle comes from the
   * store, which only a previous "Save" ever filled. A `file://` page cannot obtain a
   * writable handle for its own URL, so the first save must go through the picker; every
   * later one lands on the same file, which is what keeps its path stable for an agent.
   *
   * Returns `no-handle` / `permission-denied` / `write-failed` instead of throwing, so the
   * caller falls back to the picker and never loses the person's edits to a broken handle.
   */
  async function saveToRememberedFile(input) {
    var args = input || {}
    var store = args.store || null
    if (!store) return { ok: false, reason: 'no-store' }
    var handle = null
    try {
      handle = await store.get(args.key)
    } catch (err) {
      return { ok: false, reason: 'no-store', error: err }
    }
    if (!handle) return { ok: false, reason: 'no-handle' }
    var permission = await ensurePermission(handle)
    if (permission !== 'granted') return { ok: false, reason: 'permission-denied' }
    try {
      var writable = await handle.createWritable()
      await writable.write(String(args.text == null ? '' : args.text))
      await writable.close()
    } catch (err) {
      return { ok: false, reason: 'write-failed', error: err }
    }
    return { ok: true, filename: handle.name || '', handle: handle }
  }

  function createWriter(options) {
    var opts = options || {}
    var win = opts.win || root
    var store = opts.store || null
    var now =
      opts.now ||
      function () {
        return new Date()
      }

    function available() {
      return !!win && typeof win.showDirectoryPicker === 'function'
    }

    async function connect(workspaceId) {
      if (!available()) return { ok: false, reason: 'fsa-unavailable' }
      var handle
      try {
        handle = await win.showDirectoryPicker({ mode: 'readwrite' })
      } catch (err) {
        return { ok: false, reason: 'aborted', error: err }
      }
      var text
      try {
        text = await readTextFile(handle, 'domaiNN_NN.md')
      } catch (err) {
        return { ok: false, reason: 'not-a-domain', error: err }
      }
      var found = workspaceIdOf(text)
      if (!found || found !== String(workspaceId)) {
        return { ok: false, reason: 'workspace-mismatch', found: found }
      }
      if (store) await store.set(String(workspaceId), handle)
      return { ok: true, handle: handle }
    }

    async function restore(workspaceId) {
      if (!store) return null
      try {
        return (await store.get(String(workspaceId))) || null
      } catch {
        return null
      }
    }

    async function writeChangeset(input) {
      var handle = await restore(input.workspaceId)
      if (!handle) return { ok: false, reason: 'no-folder' }
      var permission = await ensurePermission(handle)
      if (permission !== 'granted') return { ok: false, reason: 'permission-denied' }
      var filename = changesetFilename({
        workspaceId: input.workspaceId,
        reviewer: input.reviewer,
        stamp: input.stamp || compactStamp(now()),
      })
      var changesDir = await handle.getDirectoryHandle('changes', { create: true })
      // wx: an existing changeset is never overwritten.
      try {
        await changesDir.getFileHandle(filename)
        return { ok: false, reason: 'exists', filename: filename }
      } catch (err) {
        if (!err || (err.name !== 'NotFoundError' && err.code !== 8)) {
          return { ok: false, reason: 'write-failed', error: err }
        }
      }
      var file = await changesDir.getFileHandle(filename, { create: true })
      var writable = await file.createWritable()
      await writable.write(input.text)
      await writable.close()
      return { ok: true, filename: filename }
    }

    return {
      available: available,
      connect: connect,
      restore: restore,
      writeChangeset: writeChangeset,
    }
  }

  /**
   * A minimal IndexedDB key/value store for FileSystemHandles, keyed by workspace id.
   * Every file:// page shares one origin, so the key is the only partition.
   */
  function createIndexedDbStore(idb, dbName) {
    var database = idb || (typeof indexedDB !== 'undefined' ? indexedDB : null)
    var name = dbName || 'nn-console-fsa'
    var opening = null

    function open() {
      if (opening) return opening
      opening = new Promise(function (resolve, reject) {
        var request = database.open(name, 1)
        request.onupgradeneeded = function () {
          request.result.createObjectStore('handles')
        }
        request.onsuccess = function () {
          resolve(request.result)
        }
        request.onerror = function () {
          reject(request.error)
        }
      })
      return opening
    }

    function run(mode, fn) {
      return open().then(function (db) {
        return new Promise(function (resolve, reject) {
          var tx = db.transaction('handles', mode)
          var request = fn(tx.objectStore('handles'))
          tx.oncomplete = function () {
            resolve(request ? request.result : undefined)
          }
          tx.onerror = function () {
            reject(tx.error)
          }
          tx.onabort = function () {
            reject(tx.error)
          }
        })
      })
    }

    return {
      get: function (key) {
        return run('readonly', function (store) {
          return store.get(key)
        })
      },
      set: function (key, value) {
        return run('readwrite', function (store) {
          return store.put(value, key)
        })
      },
    }
  }

  var api = {
    createWriter: createWriter,
    createIndexedDbStore: createIndexedDbStore,
    changesetFilename: changesetFilename,
    workspaceIdOf: workspaceIdOf,
    slugifyReviewer: slugifyReviewer,
    compactStamp: compactStamp,
    ensurePermission: ensurePermission,
    snapshotKey: snapshotKey,
    saveToRememberedFile: saveToRememberedFile,
  }

  if (typeof module === 'object' && module.exports) module.exports = api
  root.nnFsa = api
})(typeof globalThis !== 'undefined' ? globalThis : this)
